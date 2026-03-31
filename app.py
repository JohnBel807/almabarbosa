"""
=========================================
BARBOSA - Backend Flask
=========================================
Rutas:
  GET  /           → Sirve index.html
  POST /api/registro → Guarda usuarios interesados
  POST /api/chat    → Proxy a Rasa o fallback local
  GET  /api/usuarios → Admin: lista usuarios (protegida)
=========================================
Requisitos:
  pip install flask flask-cors python-dotenv
Opcional (Rasa):
  pip install requests
=========================================
"""

import os
import json
import re
import sqlite3
import logging
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS

try:
    import requests as http_requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# ─── CONFIG ───────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')   # Pon aquí tu frontend compilado
DB_PATH    = os.path.join(BASE_DIR, 'barbosa.db')
RASA_URL   = os.environ.get('RASA_URL', 'http://localhost:5005/webhooks/rest/webhook')
ADMIN_KEY  = os.environ.get('ADMIN_KEY', 'barbosa-admin-2025')   # Cambia en producción
DEBUG      = os.environ.get('DEBUG', 'true').lower() == 'true'

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('barbosa')

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:5000',
                   'https://barbosacorazon.co', 'https://www.barbosacorazon.co'])

# ─── DATABASE ─────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Crea las tablas si no existen."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre      TEXT    NOT NULL,
                correo      TEXT    NOT NULL UNIQUE,
                telefono    TEXT    NOT NULL,
                intereses   TEXT,
                habeas_data INTEGER NOT NULL DEFAULT 1,
                lang        TEXT    DEFAULT 'es',
                ip          TEXT,
                user_agent  TEXT,
                creado_en   TEXT    NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_logs (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                sender    TEXT,
                mensaje   TEXT,
                respuesta TEXT,
                fuente    TEXT    DEFAULT 'local',
                creado_en TEXT    NOT NULL
            )
        """)
        conn.commit()
    log.info('✅ Base de datos inicializada: %s', DB_PATH)

# ─── HELPERS ──────────────────────────────────────────────────────────────────
def validate_email(email: str) -> bool:
    return bool(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email))

def validate_phone(phone: str) -> bool:
    cleaned = re.sub(r'[\s\-\+\(\)]', '', phone)
    return cleaned.isdigit() and 7 <= len(cleaned) <= 15

def admin_required(f):
    """Decorator para rutas de administración."""
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get('X-Admin-Key') or request.args.get('key')
        if key != ADMIN_KEY:
            abort(403, 'Acceso denegado')
        return f(*args, **kwargs)
    return decorated

# ─── LOCAL CHATBOT FALLBACK ────────────────────────────────────────────────────
LOCAL_RESPONSES = {
    'es': {
        'llegar':      '🚗 Barbosa está a ~3h de Bogotá por la vía Tunja–Moniquirá. También hay buses desde el Terminal del Norte.',
        'rutas':       '🗺️ Rutas populares: Cascadas de San José (Suaita), El Hoyo del Aire (La Paz), Ventanas de Tisquizoque (Florián) y el Bosque de Piedra (El Peñón). ¿Cuál te interesa?',
        'hotel':       '🏨 Barbosa cuenta con hoteles boutique y posadas para todos los presupuestos. Escríbenos para opciones personalizadas.',
        'hospedarse':  '🏨 Barbosa cuenta con hoteles boutique y posadas para todos los presupuestos. Escríbenos para opciones personalizadas.',
        'comer':       '🍽️ ¡Prueba el piquete veleño, bocadillo con queso, mondongo, chicha y hornado! El sabor de Vélez es inolvidable.',
        'precio':      '💰 Los tours van de $80.000 a $250.000 COP por persona según el destino. Contáctanos para cotizar.',
        'festival':    '🎭 El Festival del Río se celebra en julio-agosto con música, gastronomía y regatas. ¡No te lo pierdas!',
        'cascadas':    '💧 Las Cascadas de San José en Suaita están a ~45 min de Barbosa. Son espectaculares — ideal para nadar y fotografiar.',
        'cuevas':      '⛏️ La región tiene cuevas kársticas perfectas para espeleología. Nuestros guías certificados te llevan con seguridad.',
        'guia':        '🏅 Todos nuestros guías están certificados por el Ministerio de Comercio, Industria y Turismo de Colombia.',
        'default':     '🌿 ¡Gracias por escribir! Para información detallada, completa el formulario o escríbenos por WhatsApp. Un guía certificado te atenderá pronto. 😊'
    },
    'en': {
        'get there':   '🚗 Barbosa is ~3h from Bogotá via the Tunja–Moniquirá route. Buses run from Norte Terminal.',
        'routes':      '🗺️ Popular routes: San José Waterfalls (Suaita), El Hoyo del Aire (La Paz), Tisquizoque Windows (Florián) and Stone Forest (El Peñón).',
        'hotel':       '🏨 Barbosa has boutique hotels and guesthouses for all budgets. Contact us for personalized options.',
        'food':        '🍽️ Try piquete veleño, bocadillo with cheese, mondongo and chicha! The flavor of Vélez is unforgettable.',
        'guide':       '🏅 All our guides are certified by Colombia\'s Ministry of Commerce.',
        'default':     '🌿 Thanks for reaching out! Fill the contact form or WhatsApp us. A certified guide will reply shortly. 😊'
    }
}

def local_bot_response(message: str, lang: str = 'es') -> str:
    m = message.lower()
    responses = LOCAL_RESPONSES.get(lang, LOCAL_RESPONSES['es'])
    for key, resp in responses.items():
        if key != 'default' and key in m:
            return resp
    return responses['default']

# ─── RASA PROXY ───────────────────────────────────────────────────────────────
def ask_rasa(sender: str, message: str) -> str | None:
    if not REQUESTS_AVAILABLE:
        return None
    try:
        res = http_requests.post(
            RASA_URL,
            json={'sender': sender, 'message': message},
            timeout=3
        )
        if res.status_code == 200:
            data = res.json()
            texts = [m.get('text', '') for m in data if m.get('text')]
            return ' '.join(texts) if texts else None
    except Exception as exc:
        log.warning('Rasa no disponible: %s', exc)
    return None

# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """Sirve el HTML de la landing page."""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


@app.route('/api/registro', methods=['POST'])
def registro():
    """
    Registra un usuario interesado.
    Cumple con Ley 1581/2012 (Habeas Data colombiano):
      - Verifica autorización explícita
      - Registra fecha/hora e IP
      - Datos nunca compartidos con terceros
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'JSON inválido'}), 400

    # ── Validaciones ──────────────────────────────────────────────────────────
    nombre   = (data.get('nombre') or '').strip()
    correo   = (data.get('correo') or '').strip().lower()
    telefono = (data.get('telefono') or '').strip()
    intereses = (data.get('intereses') or '').strip()
    habeas   = bool(data.get('habeas_data'))
    lang     = data.get('lang', 'es')[:5]

    errors = []
    if not nombre or len(nombre) < 2:
        errors.append('Nombre inválido')
    if not validate_email(correo):
        errors.append('Correo electrónico inválido')
    if not validate_phone(telefono):
        errors.append('Teléfono inválido')
    if not habeas:
        errors.append('Debes aceptar el tratamiento de datos personales (Ley 1581/2012)')

    if errors:
        return jsonify({'error': ' | '.join(errors)}), 422

    # ── Guardar en BD ─────────────────────────────────────────────────────────
    ip         = request.remote_addr or 'unknown'
    user_agent = request.headers.get('User-Agent', '')[:256]
    now        = datetime.utcnow().isoformat()

    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO usuarios
                  (nombre, correo, telefono, intereses, habeas_data, lang, ip, user_agent, creado_en)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (nombre, correo, telefono, intereses, 1 if habeas else 0, lang, ip, user_agent, now))
            conn.commit()
        log.info('Nuevo registro: %s <%s> — intereses: %s', nombre, correo, intereses)
        return jsonify({
            'ok': True,
            'message': '¡Registro exitoso! Pronto te contactaremos.' if lang == 'es'
                       else 'Registration successful! We\'ll contact you soon.'
        }), 201

    except sqlite3.IntegrityError:
        # El correo ya existe — actualizamos datos
        with get_db() as conn:
            conn.execute("""
                UPDATE usuarios
                   SET nombre=?, telefono=?, intereses=?, lang=?, creado_en=?
                 WHERE correo=?
            """, (nombre, telefono, intereses, lang, now, correo))
            conn.commit()
        log.info('Actualización registro: %s', correo)
        return jsonify({
            'ok': True,
            'message': '¡Datos actualizados! Pronto te contactaremos.' if lang == 'es'
                       else 'Data updated! We\'ll contact you soon.'
        }), 200

    except Exception as exc:
        log.error('Error BD registro: %s', exc)
        return jsonify({'error': 'Error interno del servidor'}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Proxy inteligente:
    1. Intenta Rasa 3.7 en localhost:5005
    2. Si falla → respuesta local basada en keywords
    """
    data   = request.get_json(silent=True) or {}
    sender  = str(data.get('sender', 'anon'))[:64]
    message = str(data.get('message', '')).strip()[:500]
    lang    = str(data.get('lang', 'es'))[:5]

    if not message:
        return jsonify({'error': 'Mensaje vacío'}), 400

    # Intentar Rasa
    rasa_resp = ask_rasa(sender, message)
    source = 'rasa' if rasa_resp else 'local'
    response = rasa_resp or local_bot_response(message, lang)

    # Log en BD
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO chat_logs (sender, mensaje, respuesta, fuente, creado_en)
                VALUES (?, ?, ?, ?, ?)
            """, (sender, message, response, source, datetime.utcnow().isoformat()))
            conn.commit()
    except Exception as exc:
        log.warning('Error guardando chat log: %s', exc)

    return jsonify({'response': response, 'source': source}), 200


@app.route('/api/usuarios', methods=['GET'])
@admin_required
def listar_usuarios():
    """Endpoint de administración para ver registros. Protegido por API key."""
    page  = max(1, int(request.args.get('page', 1)))
    limit = min(100, int(request.args.get('limit', 20)))
    offset = (page - 1) * limit

    with get_db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM usuarios').fetchone()[0]
        rows  = conn.execute(
            'SELECT id, nombre, correo, telefono, intereses, lang, creado_en FROM usuarios ORDER BY creado_en DESC LIMIT ? OFFSET ?',
            (limit, offset)
        ).fetchall()

    return jsonify({
        'total':    total,
        'page':     page,
        'limit':    limit,
        'usuarios': [dict(r) for r in rows]
    }), 200


@app.route('/api/derechos', methods=['DELETE'])
def ejercer_derecho():
    """
    Derecho de supresión (Ley 1581/2012, Art. 8).
    El titular puede solicitar eliminar sus datos enviando su correo.
    """
    data   = request.get_json(silent=True) or {}
    correo = (data.get('correo') or '').strip().lower()
    if not validate_email(correo):
        return jsonify({'error': 'Correo inválido'}), 400

    with get_db() as conn:
        result = conn.execute('DELETE FROM usuarios WHERE correo = ?', (correo,))
        conn.commit()
        deleted = result.rowcount

    if deleted:
        log.info('Derecho de supresión ejercido: %s', correo)
        return jsonify({'ok': True, 'message': f'Datos de {correo} eliminados correctamente.'}), 200
    else:
        return jsonify({'ok': False, 'message': 'Correo no encontrado.'}), 404


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Ruta no encontrada'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Error interno del servidor'}), 500


# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    log.info('🌿 Barbosa Backend corriendo en http://localhost:%d', port)
    log.info('🗄️  BD: %s', DB_PATH)
    log.info('🤖 Rasa URL: %s', RASA_URL)
    app.run(host='0.0.0.0', port=port, debug=DEBUG)
