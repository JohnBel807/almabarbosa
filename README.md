# 🌿 Barbosa — El Corazón Late Fuerte en el Sur de Santander
## Landing Page + Backend + Chatbot Rasa 3.7

---

## 📁 Estructura del Proyecto

```
barbosa/
├── index.html          ← Landing page (frontend)
├── style.css           ← Estilos (CSS custom)
├── script.js           ← JS: nav, mapa, chatbot, formulario
├── app.py              ← Backend Flask (Python)
├── barbosa.db          ← SQLite (auto-generado)
├── requirements.txt    ← Dependencias Python
└── rasa/
    ├── config.yml      ← Configuración del pipeline NLU
    ├── domain.yml      ← Intenciones, respuestas, slots
    └── data/
        ├── nlu.yml     ← Datos de entrenamiento NLU
        └── stories.yml ← Historias de conversación + Reglas
```

---

## 🚀 Instalación Rápida

### 1. Requisitos del sistema
- Python 3.9–3.10 (Rasa 3.7 requiere ≤ 3.10)
- pip ≥ 22
- Node.js (opcional, para servidor de dev)

### 2. Instalar dependencias del backend Flask

```bash
pip install flask flask-cors requests python-dotenv
```

### 3. Iniciar el backend Flask

```bash
# Desde la carpeta raíz del proyecto
python app.py
```
El servidor estará disponible en **http://localhost:5000**

### 4. Instalar y configurar Rasa 3.7

```bash
# Crear entorno virtual separado (recomendado)
python -m venv rasa_env
source rasa_env/bin/activate   # Linux/Mac
# rasa_env\Scripts\activate    # Windows

pip install rasa==3.7.0

# Ir a la carpeta de Rasa
cd rasa/

# Entrenar el modelo
rasa train

# Iniciar el servidor Rasa (en otra terminal)
rasa run --enable-api --cors "*" --port 5005
```

### 5. Variables de entorno (opcional)

Crea un archivo `.env` en la raíz:

```env
# URL de Rasa (por defecto: localhost:5005)
RASA_URL=http://localhost:5005/webhooks/rest/webhook

# Clave de administrador para /api/usuarios
ADMIN_KEY=tu-clave-secreta-aqui

# Puerto del servidor Flask
PORT=5000

# Modo debug
DEBUG=true
```

---

## 📡 Endpoints de la API

### `POST /api/registro`
Registra un usuario interesado.

**Body JSON:**
```json
{
  "nombre": "Juan Pérez",
  "correo": "juan@email.com",
  "telefono": "+57 300 000 0000",
  "intereses": "cascadas,gastronomia",
  "habeas_data": true,
  "lang": "es"
}
```

**Respuestas:**
- `201 Created` — Nuevo registro exitoso
- `200 OK` — Actualización de registro existente
- `422 Unprocessable` — Validación fallida
- `500 Internal Server Error` — Error de BD

---

### `POST /api/chat`
Envía mensaje al chatbot (Rasa → fallback local).

**Body JSON:**
```json
{
  "sender": "usuario_12345",
  "message": "¿Cómo llego a Barbosa?",
  "lang": "es"
}
```

**Respuesta:**
```json
{
  "response": "🚗 Barbosa está a ~3h de Bogotá...",
  "source": "rasa"   // o "local" si Rasa no responde
}
```

---

### `GET /api/usuarios?key=ADMIN_KEY&page=1&limit=20`
Lista usuarios registrados (requiere `X-Admin-Key` header o `?key=`).

---

### `DELETE /api/derechos`
Derecho de supresión — Ley 1581/2012 Art. 8.

**Body JSON:**
```json
{
  "correo": "juan@email.com"
}
```

---

## 🔒 Cumplimiento Habeas Data (Ley 1581/2012)

El sistema implementa:

| Requisito Legal | Implementación |
|---|---|
| Autorización explícita | Checkbox obligatorio con texto de la ley |
| Finalidad del tratamiento | Descrita en el formulario |
| Derechos del titular | Endpoint `DELETE /api/derechos` |
| Seguridad de datos | BD local SQLite, no compartida |
| Responsable identificado | Barbosa Corazón Turístico |
| Datos de contacto | datos@barbosacorazon.co |

---

## 🌍 Despliegue en Producción

### Opción A — VPS/Servidor propio (recomendado)
```bash
# Instalar Gunicorn
pip install gunicorn

# Ejecutar con Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Configurar Nginx como proxy reverso
# Certificado SSL con Let's Encrypt
```

### Opción B — Railway / Render
1. Conectar repositorio GitHub
2. Configurar variables de entorno
3. Build command: `pip install -r requirements.txt`
4. Start command: `python app.py`

### Opción C — Docker
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

---

## 🤖 Flujo del Chatbot

```
Usuario escribe mensaje
        ↓
  POST /api/chat (Flask)
        ↓
  ¿Rasa disponible? ──YES──→ POST localhost:5005/webhooks/rest/webhook
        ↓ NO                          ↓
  Respuesta local           Respuesta de Rasa
  (keywords)                        ↓
        ↓                   Guardar en chat_logs
  Retornar respuesta al usuario
```

---

## 📱 WhatsApp Business

Para configurar el botón de WhatsApp:

1. Crea una cuenta en **WhatsApp Business API** o usa **Twilio**
2. Reemplaza el número en `index.html`:
   ```html
   href="https://wa.me/57TUNUMERO?text=Mensaje..."
   ```
3. Considera integrar **Wati.io** o **360dialog** para automatización

---

## 🗺️ Mapa Interactivo

El mapa usa **Leaflet.js** con tiles de **CartoDB Dark Matter** (libre).

Para personalizar con fotos de los destinos:
```javascript
// En script.js, reemplaza los íconos divIcon con marcadores con imágenes:
const icon = L.icon({
  iconUrl: 'img/marker-barbosa.png',
  iconSize: [40, 40]
});
```

---

## 📞 Soporte y Contacto

- **Email:** info@barbosacorazon.co
- **WhatsApp:** +57 310 000 0000
- **Datos personales:** datos@barbosacorazon.co

---

*Hecho con ♥ en Barbosa, Santander, Colombia*
*© 2025 Barbosa Corazón Turístico — Todos los derechos reservados*
