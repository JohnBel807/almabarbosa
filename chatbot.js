/* ==========================================================
   BARBOSA TURISMO — chatbot.js
   Motor conversacional con flujos ricos basados en el
   documento "Atractivos cerca a Barbosa Santander"
   Proxy a Rasa 3.7 → fallback local por intenciones
   ========================================================== */

'use strict';

// ── CONFIG ──────────────────────────────────────────────────
const CHAT_CONFIG = {
  BOT_DELAY_MIN: 600,
  BOT_DELAY_MAX: 1200,
  RASA_ENDPOINT: '/api/chat',
  MAX_HISTORY: 20,
};

// ── STATE ───────────────────────────────────────────────────
const chatState = {
  open: false,
  history: [],          // [{role, text}]
  lastIntent: null,
  awaitingFollowUp: null,
};

// ══════════════════════════════════════════════════════════
//  KNOWLEDGE BASE — extraída del documento turístico
// ══════════════════════════════════════════════════════════
const KB = {

  saludar: {
    patterns: ['hola','buenos','buenas','hey','hi','hello','saludos','buen día','qué tal','información','ayuda'],
    response: () => `¡Hola! 👋 Soy el asistente virtual de <strong>Barbosa Turismo</strong> — la Puerta de Oro de Santander.<br><br>
Puedo ayudarte con:<br>
🏖️ Balnearios y cascadas &nbsp;·&nbsp; 🦅 Aves y fauna &nbsp;·&nbsp; 🍽️ Gastronomía<br>
🏨 Hoteles &nbsp;·&nbsp; 🚗 Cómo llegar &nbsp;·&nbsp; 🗓️ Itinerarios<br><br>
¿Qué quieres explorar hoy?`,
    followUp: 'main_menu',
  },

  como_llegar: {
    patterns: ['llegar','llego','viajar','bus','transporte','reina','bogotá','bucaramanga','san gil','chiquinquirá','terminal','salitre','norte','horas','distancia','ruta','cómo ir'],
    response: () => `🚗 <strong>Cómo llegar a Barbosa (Santander)</strong><br><br>
Barbosa conecta con <strong>4 troncales nacionales</strong>:<br>
• <strong>Desde Bogotá:</strong> ~3h vía Bogotá → Tunja → Moniquirá → Barbosa<br>
• <strong>Desde Bucaramanga:</strong> ~3h por la troncal norte<br>
• <strong>Desde San Gil:</strong> ~1h 15min hacia el sur<br><br>
🚌 <strong>Empresa recomendada: Transportes Reina</strong><br>
Sale desde el Terminal del Norte y el Terminal Salitre (Bogotá).<br><br>
¿Quieres ver las <strong>tarifas exactas</strong> de los pasajes?`,
    followUp: 'tarifas',
  },

  tarifas: {
    patterns: ['tarifa','precio pasaje','cuánto cuesta el bus','cuánto vale ir','pasaje','tiquete','valor bus','cuánto es el pasaje'],
    response: () => `💰 <strong>Tarifas Transportes Reina 2026:</strong><br><br>
<table style="width:100%;font-size:0.8rem;border-collapse:collapse">
  <tr style="color:#c9a84c"><td><b>Origen</b></td><td><b>→ Barbosa</b></td><td><b>→ Oiba</b></td></tr>
  <tr><td>Bogotá</td><td>$50.000</td><td>$72.000</td></tr>
  <tr><td>Bucaramanga</td><td>$73.000</td><td>$53.000</td></tr>
  <tr><td>San Gil</td><td>$44.000</td><td>$26.000</td></tr>
  <tr><td>Chiquinquirá</td><td>$15.000</td><td>$48.000</td></tr>
  <tr><td>Sutatausa</td><td>$39.000</td><td>$61.000</td></tr>
</table><br>
Una vez en Barbosa, taxis a Moniquirá/Puente Nacional cuestan $5.000–$10.000. 🚕`,
    followUp: null,
  },

  rutas: {
    patterns: ['rutas','destinos','lugares','qué visitar','qué hay','planes','cerca','alrededores','qué puedo hacer','atractivos','recomend'],
    response: () => `🗺️ <strong>Destinos desde Barbosa — radio de 2 horas:</strong><br><br>
<strong>⚡ Menos de 30 min:</strong><br>
📍 Moniquirá (10 min) — spas, piscinas y cascada<br>
📍 Puente Nacional (15 min) — El Balay típico<br>
📍 Vélez (25 min) — catedral y bocadillo veleño<br><br>
<strong>🕐 30–90 min:</strong><br>
📍 Suaita (45 min) — Cascada de los Caballeros 120m<br>
📍 Oiba (1h) — Pueblito Pesebre y artesanías<br><br>
<strong>🕑 90 min – 2h:</strong><br>
📍 Florián (1h 30m) — Ventanas de Tisquizoque 300m ⭐<br>
📍 Gámbita (2h) — Manto de la Virgen 500m 🏆<br><br>
¿Cuál te llama la atención?`,
    followUp: 'rutas_menu',
  },

  barbosa: {
    patterns: ['barbosa','playa piedra','piedra de pato','charco','playita','dos quebradas','río suárez','balneario','baño','nadar'],
    response: () => `🌊 <strong>Barbosa — La Puerta de Oro de Santander</strong><br><br>
El corazón todo es el <strong>Río Suárez</strong>:<br><br>
<strong>🏖️ Balnearios:</strong><br>
• <strong>Playa Piedra de Pato</strong> — sede del Festival del Río (enero). Formaciones rocosas que simulan una playa costera en medio de las montañas<br>
• <strong>Charcos La Playita</strong> (vereda La Playa) — tranquilo, conservado, ideal para escapar del bullicio<br>
• <strong>Charco Dos Quebradas</strong> — perfecto para "turismo de olla": cocinar típico a la orilla del río con familia o amigos<br><br>
<strong>⛰️ Aventura y naturaleza:</strong><br>
• <strong>Chorro del Diablo</strong> — cascada en bosque húmedo, ideal para aves<br>
• <strong>Cueva de Sánchez</strong> — 6 cuevas en zona cafetera (requiere guía)<br>
• <strong>Mirador Cristo Rey</strong> — panorámica completa del municipio<br><br>
¿Sobre cuál quieres profundizar?`,
    followUp: 'barbosa_menu',
  },

  mirador: {
    patterns: ['mirador','cristo rey','panorámica','cima','colina','vista','sendero','caminata corta'],
    response: () => `⛰️ <strong>Mirador del Cristo Rey — Barbosa</strong><br><br>
Situado en la cima de una colina con <strong>panorámica completa del municipio</strong> y el Río Suárez.<br><br>
• Caminata: moderada (~40 min subida)<br>
• Sin guía requerido — sendero marcado<br>
• Mejor hora: amanecer o atardecer para fotografía<br>
• Desde arriba se entiende por qué Barbosa es el nodo logístico de la región<br><br>
💡 <em>Tip: madruga, desayuna en Arepas donde Julia y luego sube al mirador.</em>`,
    followUp: null,
  },

  cuevas_barbosa: {
    patterns: ['cueva sánchez','cueva de sánchez','cuevas barbosa','espeleología barbosa','6 cuevas','cafetera','oscuridad','espeleología'],
    response: () => `🕳️ <strong>Cueva de Sánchez — Barbosa</strong><br><br>
Sistema de <strong>6 cuevas</strong> inmersas en zona cafetera. Lo que la hace única:<br><br>
• Oscuridad total — experiencia sensorial sin igual<br>
• Formaciones kársticas de gran valor geológico<br>
• <strong>Guía obligatorio</strong> (oscuridad total, terreno irregular)<br>
• Duración: 2–3 horas de recorrido<br>
• Dificultad: media-alta (ropa que pueda ensuciarse y linterna)<br><br>
💡 Combínala con el <strong>Chorro del Diablo</strong> para un día de aventura completa.<br>
¿Quieres que te ayude a encontrar un guía?`,
    followUp: 'guias',
  },

  chorro_diablo: {
    patterns: ['chorro del diablo','la chorrera','cascada barbosa','cascada mística','chorro'],
    response: () => `💧 <strong>Chorro del Diablo — Vereda La Chorrera, Barbosa</strong><br><br>
Una cascada de caída imponente rodeada de <strong>vegetación densa</strong> que crea un microclima fresco y húmedo.<br><br>
✅ Ideal para observación de aves endémicas<br>
✅ Flora nativa en estado natural<br>
✅ Dificultad: moderada (sendero con humedad)<br>
🦜 El dosel vegetal protege especies de aves que solo existen en este microhábitat<br><br>
💡 <em>Combinado con la Cueva de Sánchez = día de aventura completo en Barbosa.</em>`,
    followUp: 'fauna',
  },

  festival_rio: {
    patterns: ['festival','río suárez festival','festival del río','enero barbosa','kartismo','mountain bike','reinado','eventos barbosa','fiestas'],
    response: () => `🎉 <strong>Festival del Río Suárez — Barbosa</strong><br><br>
📅 <strong>Mes:</strong> Enero de cada año<br>
📍 <strong>Lugar:</strong> Playa Piedra de Pato, Río Suárez<br><br>
Una articulación social y económica que atrae miles de turistas:<br><br>
🏎️ Demostraciones de <strong>kartismo</strong><br>
🚵 <strong>Mountain Bike</strong> de alta competencia<br>
👑 Reinados populares<br>
🍽️ Feria gastronómica con sabores veleños<br>
🎵 Música en vivo y comparsas<br><br>
La geología del lugar crea una "playa costera" natural en plenas montañas. <strong>¡La experiencia más vibrante del año!</strong>`,
    followUp: null,
  },

  velez: {
    patterns: ['vélez','velez','catedral atravesada','nuestra señora de las nieves','folclor vélez','guabina','tiple','festival tiple','folclor','parque folclor','centro histórico vélez'],
    response: () => `🏛️ <strong>Vélez, Santander — A solo 25 min de Barbosa</strong><br><br>
<strong>🕌 Catedral Atravesada</strong> (1560)<br>
Joya arquitectónica única en el mundo: su entrada principal está en el costado lateral, dictada por la topografía del terreno al momento de su construcción.<br><br>
<strong>🎵 Parque Nacional del Folclor</strong><br>
Sede del <strong>Festival de la Guabina y el Tiple</strong>. Ritmos como el torbellino y la guabina llenan las plazas.<br><br>
<strong>🏠 Centro Histórico</strong><br>
Arquitectura de tapia pisada, balcones de madera y tejados de barro de los siglos XVI–XVII intactos.<br><br>
🍬 Además: la capital del <strong>Bocadillo Veleño</strong> con denominación de origen.<br>
¿Quieres saber más del bocadillo?`,
    followUp: 'bocadillo',
  },

  bocadillo: {
    patterns: ['bocadillo','bocadillo veleño','guayaba','bijao','fruti fresca','dulce vélez','reinado bocadillo','denominación origen'],
    response: () => `🍬 <strong>El Bocadillo Veleño — Denominación de Origen</strong><br><br>
El producto estrella de Colombia combina tradición artesanal con proyección internacional:<br><br>
<strong>Proceso:</strong> Guayaba roja + blanca → cocción lenta → bloques envueltos en <strong>hoja de bijao</strong> (100% biodegradable)<br><br>
🏭 <strong>Fruti Fresca</strong> — permite recorridos guiados por la fábrica<br>
🛒 Mercados de Vélez: la opción más económica y auténtica<br><br>
👑 <strong>Reinado Nacional del Bocadillo</strong> — celebra la productividad agrícola<br><br>
💡 <em>¡El bocadillo con queso campesino fresco es la combinación obligatoria!</em>`,
    followUp: null,
  },

  moniquira: {
    patterns: ['moniquirá','moniquira','palmeras de luz','chiminigagua','spa','jacuzzi','piscina moniquirá','sauna','cascada honda','bienestar','relajación','boyacá'],
    response: () => `🌿 <strong>Moniquirá, Boyacá — A solo 10 min de Barbosa</strong><br><br>
La "Ciudad Dulce de Colombia" — especializada en turismo de bienestar:<br><br>
<strong>🏨 Complejos de spa:</strong><br>
• <strong>Hotel Palmeras de Luz</strong> — spa, sauna, jacuzzi + Restaurante Aromas de mi Tierra (fusión boyacense-internacional)<br>
• <strong>Centro Vacacional Chiminigagua</strong> — piscinas de gran escala, terapias de relajación<br><br>
🌊 <strong>Cascada La Honda</strong> — parque ecológico con biodiversidad de la Provincia de Ricaurte<br><br>
💡 Hoteles en Barbosa como <strong>La Floresta de Cite</strong> sirven como base para explorar Santander y Boyacá en el mismo viaje.`,
    followUp: null,
  },

  florian: {
    patterns: ['florián','florian','tisquizoque','ventanas','ciudad ventanas','cueva florián','cascada florián','cascada 300','estalactitas florián'],
    response: () => `🏔️ <strong>Florián — "Ciudad de las Ventanas Abiertas"</strong> (~1h 30m)<br><br>
⭐ <strong>Ventanas de Tisquizoque</strong> — una de las maravillas de Santander<br><br>
Una cueva natural en la montaña de la cual emerge una quebrada que cae en una <strong>cascada de 3 escalones sumando +300 metros de altura</strong>.<br><br>
La experiencia completa:<br>
🕳️ Caminar dentro de la cueva entre estalactitas y estalagmitas<br>
🌊 Escuchar el río nacer desde las entrañas de la montaña<br>
🏞️ Asomarse a la "ventana" natural con vista al abismo<br><br>
🚕 Taxi desde Barbosa: $20.000–$25.000<br>
⏱️ Viaje: 1h 30m–2h (vía veredal)<br>
🏅 Se recomienda guía local`,
    followUp: 'guias',
  },

  gambita: {
    patterns: ['gámbita','gambita','manto de la virgen','humeadora','cueva del chocó','hondura','canyoning','cascada 500','agua roja','robledal'],
    response: () => `🌊 <strong>Gámbita — Aventura extrema</strong> (~2h de Barbosa)<br><br>
⭐ <strong>El Manto de la Virgen</strong> — <strong>+500 metros de caída</strong> (una de las más altas de Colombia)<br><br>
Sus aguas tienen un <strong>color rojizo único</strong> por los taninos de los robledales circundantes.<br><br>
<strong>🧗 Actividades:</strong><br>
• <strong>Canyoning</strong> en el Cañón de la Hondura<br>
• <strong>Espeleología</strong> en la Cueva del Chocó<br>
• <strong>Senderismo de alta dificultad</strong><br>
• <strong>La Humeadora</strong> — bruma constante al chocar el agua con las rocas<br><br>
⚠️ <em>Requiere guía especializado y buena condición física.</em>`,
    followUp: 'aventura',
  },

  suaita: {
    patterns: ['suaita','caballeros','cascada suaita','san josé suaita','museo algodón','fábrica textil','primera fábrica','torrentismo suaita'],
    response: () => `💧 <strong>Suaita — Naturaleza e Historia Industrial</strong> (~45 min)<br><br>
⭐ <strong>Cascada de los Caballeros — 120 metros</strong><br>
Explorable en <strong>3 niveles diferentes</strong> con torrentismo y rappel.<br><br>
🏛️ <strong>Dato histórico único:</strong><br>
Alberga las ruinas de la <strong>primera fábrica textil de Colombia</strong> en San José de Suaita. El <strong>Museo del Algodón</strong> narra los inicios de la era industrial colombiana.<br><br>
💡 <em>Ideal para el viajero que quiere más que paisajes — quiere entender la historia del país.</em><br><br>
🚕 Taxi desde Barbosa: $15.000–$20.000`,
    followUp: null,
  },

  puente_nacional: {
    patterns: ['puente nacional','el balay','balay','gallina criolla','canasto','plato canasto','cúrcuma','bijao gallina'],
    response: () => `🍽️ <strong>Puente Nacional — El Balay</strong> (15 min de Barbosa)<br><br>
El plato más emblemático de la región:<br><br>
🧺 Se sirve en un <strong>canasto tejido</strong> (el "balay") con:<br>
• Gallina criolla de campo<br>
• Yuca, arracacha, plátano y papa<br>
• Guiso con cúrcuma natural (sin colorantes artificiales)<br>
• Envuelto en hojas de bijao que conservan calor y aroma<br><br>
La <strong>cocción en leña</strong> es el secreto de su sabor inconfundible.<br><br>
💡 <em>¡Es el "piquete de los reyes" — perfecto después de un día de senderismo!</em>`,
    followUp: 'gastronomia',
  },

  oiba: {
    patterns: ['oiba','pueblito pesebre','caolín','san miguel oiba','artesanías oiba'],
    response: () => `🎨 <strong>Oiba — "El Pueblito Pesebre"</strong> (~1h de Barbosa)<br><br>
Un municipio de arquitectura colonial tan conservada que parece un pesebre viviente:<br><br>
🏺 <strong>Artesanías en Caolín</strong> — material local que da vida a piezas únicas<br>
⛪ <strong>Templo de San Miguel</strong> — patrimonio arquitectónico colonial<br>
🎨 Talleres de artesanos donde puedes comprar directamente al creador<br><br>
💡 <em>Perfecto en la ruta de regreso desde Florián o Gámbita.</em><br>
🚕 Taxi desde Barbosa: ~$40.000`,
    followUp: null,
  },

  gastronomia: {
    patterns: ['comer','gastronomía','platos típicos','restaurante','piquete','carne oreada','cabrito','pepitoria','arepa','desayuno','caldito','julia','comida','sabores','típico santandereano'],
    response: () => `🍽️ <strong>Gastronomía de la Provincia de Vélez</strong><br><br>
<strong>🥩 Piquete Santandereano — el rey de las carreteras:</strong><br>
• Carne oreada (marinada y secada al sol)<br>
• Cabrito al horno<br>
• Pepitoria (arroz con vísceras de cabro)<br>
• Arepa de maíz pela'o<br><br>
<strong>🍳 Desayunos en Barbosa:</strong><br>
• <strong>Arepas donde Julia</strong> — caldo de carne + arepa artesanal de maíz (el favorito del pueblo)<br><br>
<strong>🧺 En la ruta (15–25 min):</strong><br>
• El Balay (Puente Nacional) — gallina en canasto<br>
• Bocadillo con queso (Vélez) — el dulce más famoso de Colombia<br><br>
¿Quieres saber dónde comer en un destino específico?`,
    followUp: null,
  },

  hoteles: {
    patterns: ['hotel','hostal','posada','alojamiento','dormir','hospedaje','dónde quedarme','turrim','floresta','palmeras'],
    response: () => `🏨 <strong>Alojamiento en Barbosa y la región</strong><br><br>
<strong>En Barbosa:</strong><br>
• <strong>Turrim Dei Hotel Boutique</strong> — planes de aventura y ecoturismo integrados, el más recomendado<br>
• <strong>La Floresta de Cite</strong> — ideal como base para explorar Santander y Boyacá<br>
• Posadas familiares y hospedajes económicos en el centro urbano<br><br>
<strong>En Moniquirá (10 min):</strong><br>
• <strong>Hotel Palmeras de Luz</strong> — spa, piscinas, restaurante gourmet<br>
• <strong>Centro Vacacional Chiminigagua</strong> — complejo familiar con todas las comodidades<br><br>
💡 <em>Hospédate en Barbosa si quieres explorar múltiples destinos — su posición central es imbatible.</em>`,
    followUp: null,
  },

  fauna: {
    patterns: ['fauna','aves','avistamiento','birdwatching','ardilla','animales','vida silvestre','especies','pájaro','colibri','tangar'],
    response: () => `🦜 <strong>Fauna y vida silvestre de la Provincia de Vélez</strong><br><br>
<strong>🐦 Aves más avistadas:</strong><br>
🔴 <strong>Atrapamoscas Bermellón</strong> <em>(Pyrocephalus rubinus)</em> — pecho rojo brillante<br>
🐦 <strong>Copetón Andino</strong> <em>(Zonotrichia capensis)</em> — el "gorrión de los Andes"<br>
🪶 <strong>Carpintero Real</strong> <em>(Dryocopus pileatus)</em> — cresta roja, gran tamaño<br>
🌿 Tangaras, colibríes y especies endémicas de la cordillera oriental<br><br>
<strong>🐿️ Mamíferos:</strong><br>
• Ardilla colorada <em>(Sciurus granatensis)</em> — ágil y muy fotogénica<br><br>
💡 <em>Mejores puntos: Chorro del Diablo y El Peñón (Bosque de Piedra).</em><br>
¿Tienes binoculares? ¡Los necesitarás!`,
    followUp: null,
  },

  precio: {
    patterns: ['precio','cuánto cuesta','tarifa','valor','presupuesto','cuánto cobran','cuánto necesito','cotización'],
    response: () => `💰 <strong>Tarifas aproximadas (COP / persona):</strong><br><br>
<table style="width:100%;font-size:0.8rem;border-collapse:collapse">
  <tr style="color:#c9a84c"><td><b>Tour</b></td><td><b>Precio</b></td></tr>
  <tr><td>Cascadas en Barbosa</td><td>$40.000–$80.000</td></tr>
  <tr><td>Cueva de Sánchez + guía</td><td>$60.000–$100.000</td></tr>
  <tr><td>Ventanas de Tisquizoque</td><td>$80.000–$130.000</td></tr>
  <tr><td>Cascada Caballeros (Suaita)</td><td>$70.000–$120.000</td></tr>
  <tr><td>Gámbita – Manto Virgen</td><td>$100.000–$180.000</td></tr>
  <tr><td>Paquete fin de semana (2d)</td><td>$350.000–$600.000</td></tr>
</table><br>
🍽️ Alimentación: desayuno ~$15.000, almuerzo ~$25.000<br>
¿Quieres una cotización personalizada?`,
    followUp: null,
  },

  guias: {
    patterns: ['guía','guías','certificado','seguro','quién me lleva','necesito guía','guía espeleología','tour guide'],
    response: () => `🏅 <strong>Guías certificados — Barbosa Turismo</strong><br><br>
Todos cuentan con:<br>
✅ Certificación del <strong>Ministerio de Comercio, Industria y Turismo</strong><br>
✅ Capacitación en primeros auxilios<br>
✅ Conocimiento profundo del territorio regional<br>
✅ Experiencia en cuevas, cascadas, senderismo y fauna<br>
✅ Manejo básico de inglés<br><br>
⚠️ <strong>Obligatorio con guía:</strong><br>
• Cueva de Sánchez (oscuridad total)<br>
• Cueva del Chocó / Gámbita (terreno técnico)<br>
• Ventanas de Tisquizoque (sendero veredal)<br><br>
¿Quieres reservar un guía? Usa el formulario de contacto o escríbenos por WhatsApp.`,
    followUp: null,
  },

  temporada: {
    patterns: ['cuándo viajar','mejor época','temporada','clima','temperatura','lluvia','mes','temporada alta','seca','humeda'],
    response: () => `🌤️ <strong>Mejor época para visitar Barbosa</strong><br><br>
Clima templado-cálido todo el año (<strong>22–26°C</strong>) gracias al Valle del Río Suárez.<br><br>
<strong>📅 Temporada alta (más turistas):</strong><br>
• Diciembre–Enero (Festival del Río en enero 🎉)<br>
• Semana Santa<br>
• Junio–Julio (vacaciones escolares)<br><br>
<strong>🌿 Ideal para naturaleza:</strong><br>
• Feb–Abril: post-lluvia, cascadas en su máximo esplendor<br>
• Agosto–Octubre: clima seco, mejor para cuevas y senderismo<br><br>
⚠️ <em>Las vías a Florián y Gámbita pueden complicarse en abril–mayo y oct–nov.</em>`,
    followUp: 'como_llegar',
  },

  plan_dias: {
    patterns: ['fin de semana','2 días','3 días','4 días','itinerario','organizar viaje','qué hacer en dos','plan familiar','planificar','semana'],
    response: () => `🗓️ <strong>Itinerarios recomendados</strong><br><br>
<strong>🌟 Fin de semana (2 días):</strong><br>
Día 1: Llegada → Playa Piedra de Pato → Mirador Cristo Rey → Cena típica<br>
Día 2: Cueva de Sánchez → Vélez (Catedral + bocadillo)<br><br>
<strong>🌟 3 días:</strong><br>
+ Día 3: Suaita (Cascada Caballeros) → Puente Nacional (El Balay)<br><br>
<strong>🌟 4–5 días (completo):</strong><br>
+ Día 4: Moniquirá (spa o Cascada La Honda)<br>
+ Día 5: Florián (Ventanas de Tisquizoque) ⭐<br><br>
💡 <em>Para Gámbita se recomienda salida muy temprano o pernoctar en Oiba la noche anterior.</em>`,
    followUp: 'hoteles',
  },

  familia: {
    patterns: ['niños','familia','familiar','con hijos','todas las edades','apto niños','vacaciones familia'],
    response: () => `👨‍👩‍👧‍👦 <strong>Barbosa es perfecta para familias con niños</strong><br><br>
<strong>✅ Actividades tranquilas (todas las edades):</strong><br>
🏖️ Playa Piedra de Pato — aguas tranquilas del Río Suárez<br>
🌊 Charcos La Playita — ambiente conservado y seguro<br>
🎉 Festival del Río (enero) — kartismo, música y gastronomía<br>
🏛️ Vélez — catedral, folclor y fábricas de bocadillo<br>
🍽️ Puente Nacional — El Balay (experiencia gastronómica única)<br><br>
<strong>🧗 Con niños mayores de 10 años:</strong><br>
🕳️ Cueva de Sánchez (con guía)<br>
🥾 Mirador del Cristo Rey (caminata moderada)<br><br>
💡 <em>Moniquirá (10 min) tiene piscinas y jacuzzis — los niños lo adoran.</em>`,
    followUp: null,
  },

  aventura: {
    patterns: ['deporte extremo','aventura','canyoning','torrentismo','rappel','kayak','tubing','mountain bike','kartismo','senderismo extremo','adrenalina'],
    response: () => `🧗 <strong>Aventura y deportes extremos en la región</strong><br><br>
<strong>En Barbosa:</strong><br>
🚵 Mountain Bike y 🏎️ Kartismo (Festival del Río, enero)<br>
🥾 Senderismo al Chorro del Diablo y Cueva de Sánchez<br><br>
<strong>Suaita (45 min):</strong><br>
🌊 <strong>Torrentismo</strong> en Cascada de los Caballeros (120m, 3 niveles)<br>
🧗 Rappel en la cascada<br><br>
<strong>Gámbita (2h) — nivel experto:</strong><br>
🧗 <strong>Canyoning</strong> en Cañón de la Hondura<br>
🕳️ <strong>Espeleología</strong> en Cueva del Chocó<br>
🥾 Senderismo extremo al Manto de la Virgen (500m)<br><br>
<strong>Río Suárez:</strong><br>
🚣 Kayak y tubing en tramos tranquilos<br><br>
¿Cuál se ajusta a tu nivel de experiencia?`,
    followUp: 'guias',
  },

  despedirse: {
    patterns: ['adiós','hasta luego','chao','bye','goodbye','hasta pronto','nos vemos'],
    response: () => `¡Hasta pronto! 👋 Esperamos verte muy pronto en Barbosa — donde cada camino lleva a una cascada, cada pueblo a una historia y cada plato a una tradición centenaria. ♥🌿`,
    followUp: null,
  },

  agradecer: {
    patterns: ['gracias','muchas gracias','muy amable','excelente','thank you','muy útil','perfecto','genial','increíble','qué buena'],
    response: () => `¡Con mucho gusto! 😊 Si necesitas más detalles o quieres reservar un tour, escríbenos por WhatsApp o llena el formulario de contacto. ¡Barbosa te espera! 🌿`,
    followUp: null,
  },
};

// ══════════════════════════════════════════════════════════
//  QUICK REPLIES POR CONTEXTO
// ══════════════════════════════════════════════════════════
const QUICK_REPLIES = {
  main_menu: [
    { label: '🗺️ Rutas y destinos', msg: '¿Qué rutas hay cerca de Barbosa?' },
    { label: '🚗 Cómo llegar', msg: '¿Cómo llego a Barbosa desde Bogotá?' },
    { label: '🏨 Hoteles', msg: '¿Dónde puedo hospedarme?' },
    { label: '🍽️ Gastronomía', msg: '¿Qué se come en Barbosa?' },
  ],
  rutas_menu: [
    { label: '🌊 Florián (Ventanas)', msg: '¿Qué hay en Florián y las Ventanas de Tisquizoque?' },
    { label: '💧 Suaita', msg: '¿Qué hay en Suaita y la Cascada de los Caballeros?' },
    { label: '🌿 Moniquirá', msg: '¿Qué hay en Moniquirá?' },
    { label: '🏔️ Gámbita', msg: '¿Qué hay en Gámbita?' },
  ],
  barbosa_menu: [
    { label: '🕳️ Cueva de Sánchez', msg: '¿Cómo es la Cueva de Sánchez?' },
    { label: '💧 Chorro del Diablo', msg: '¿Qué es el Chorro del Diablo?' },
    { label: '⛰️ Mirador Cristo Rey', msg: '¿Cómo es el Mirador del Cristo Rey?' },
    { label: '🎉 Festival del Río', msg: '¿Cuándo es el Festival del Río?' },
  ],
  tarifas: [
    { label: '💰 Ver tarifas de buses', msg: '¿Cuánto cuesta el pasaje desde Bogotá?' },
    { label: '🗺️ Ver destinos', msg: '¿Qué destinos hay cerca de Barbosa?' },
  ],
  guias: [
    { label: '🏅 Reservar guía', msg: 'Quiero reservar un guía certificado' },
    { label: '💰 Ver precios tours', msg: '¿Cuánto cuestan los tours?' },
  ],
  aventura: [
    { label: '🧗 Gámbita extremo', msg: '¿Qué hay en Gámbita para aventura?' },
    { label: '💧 Torrentismo Suaita', msg: '¿Cómo es el torrentismo en Suaita?' },
    { label: '🏅 Necesito guía', msg: '¿Tienen guías certificados?' },
  ],
  hoteles: [
    { label: '💰 Ver precios', msg: '¿Cuánto cuestan los tours y hoteles?' },
    { label: '🗓️ Planificar itinerario', msg: '¿Qué hacer en un fin de semana?' },
  ],
  bocadillo: [
    { label: '🏛️ Catedral Atravesada', msg: '¿Qué más hay en Vélez?' },
    { label: '🍽️ Más gastronomía', msg: '¿Qué más hay para comer en la región?' },
  ],
  gastronomia: [
    { label: '🧺 El Balay (Puente Nal)', msg: '¿Qué es El Balay en Puente Nacional?' },
    { label: '🍬 Bocadillo Veleño', msg: '¿Dónde comprar el bocadillo veleño?' },
  ],
  fauna: [
    { label: '💧 Chorro del Diablo', msg: '¿El Chorro del Diablo es bueno para aves?' },
    { label: '🦅 El Peñón', msg: '¿Qué aves hay en el Bosque de Piedra?' },
  ],
};

// ══════════════════════════════════════════════════════════
//  MOTOR NLU LOCAL — detección de intención por keywords
// ══════════════════════════════════════════════════════════
function detectIntent(text) {
  const t = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, ' ');

  let best = null;
  let bestScore = 0;

  for (const [intent, data] of Object.entries(KB)) {
    let score = 0;
    for (const pattern of data.patterns) {
      const p = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (t.includes(p)) {
        score += p.split(' ').length; // más palabras = match más específico
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return bestScore > 0 ? best : null;
}

function getBotResponse(message) {
  const intent = detectIntent(message);
  if (!intent) {
    return {
      text: `🤔 No estoy seguro de entender. Puedes preguntar sobre:<br>
• 🗺️ Rutas y destinos cercanos<br>
• 🏨 Hoteles y alojamiento<br>
• 🍽️ Gastronomía típica<br>
• 🚗 Cómo llegar y tarifas<br>
• 🦅 Fauna y naturaleza<br>
• 🗓️ Itinerarios por días<br>
¿Sobre cuál quieres info?`,
      followUp: 'main_menu',
      intent: null,
    };
  }
  const kb = KB[intent];
  chatState.lastIntent = intent;
  return {
    text: kb.response(),
    followUp: kb.followUp,
    intent,
  };
}

// ══════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════
function getTypingDelay() {
  return CHAT_CONFIG.BOT_DELAY_MIN +
    Math.random() * (CHAT_CONFIG.BOT_DELAY_MAX - CHAT_CONFIG.BOT_DELAY_MIN);
}

function addMessage(html, isUser) {
  const messagesEl = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
  div.innerHTML = `<div class="chat-bubble">${html}</div>`;
  // Animación de entrada
  div.style.opacity = '0';
  div.style.transform = 'translateY(8px)';
  messagesEl.appendChild(div);
  requestAnimationFrame(() => {
    div.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    div.style.opacity = '1';
    div.style.transform = 'translateY(0)';
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Guardar en historial
  chatState.history.push({ role: isUser ? 'user' : 'bot', text: html });
  if (chatState.history.length > CHAT_CONFIG.MAX_HISTORY) {
    chatState.history.shift();
  }
}

function addTypingIndicator() {
  const messagesEl = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.id = 'typingIndicator';
  div.innerHTML = `<div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function renderQuickReplies(contextKey) {
  const qrEl = document.getElementById('quickReplies');
  if (!qrEl) return;
  const replies = QUICK_REPLIES[contextKey];
  if (!replies) { qrEl.innerHTML = ''; return; }
  qrEl.innerHTML = replies
    .map(r => `<button onclick="sendQuick('${r.msg.replace(/'/g, "\\'")}')">${r.label}</button>`)
    .join('');
}

// ══════════════════════════════════════════════════════════
//  FLUJO DE ENVÍO
// ══════════════════════════════════════════════════════════
async function sendToRasa(message) {
  const res = await fetch(CHAT_CONFIG.RASA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: 'user_' + (sessionStorage.getItem('chatId') || Date.now()),
      message,
      lang: window.currentLang || 'es',
    }),
  });
  if (!res.ok) throw new Error('Rasa unavailable');
  const data = await res.json();
  if (data && data.response) return data.response;
  throw new Error('Empty response');
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  processChatMessage(msg);
}

function sendQuick(msg) {
  processChatMessage(msg);
}

async function processChatMessage(msg) {
  addMessage(msg, true);
  document.getElementById('quickReplies').innerHTML = '';
  addTypingIndicator();

  const delay = getTypingDelay();

  try {
    // Intenta Rasa primero
    const rasaResponse = await Promise.race([
      sendToRasa(msg),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
    setTimeout(() => {
      removeTypingIndicator();
      addMessage(rasaResponse, false);
      // Para Rasa: inferir follow-up desde intent local como fallback
      const fallback = getBotResponse(msg);
      if (fallback.followUp) renderQuickReplies(fallback.followUp);
    }, delay);
  } catch {
    // Fallback local rico
    const { text, followUp } = getBotResponse(msg);
    setTimeout(() => {
      removeTypingIndicator();
      addMessage(text, false);
      if (followUp) renderQuickReplies(followUp);
    }, delay);
  }
}

function toggleChat() {
  chatState.open = !chatState.open;
  const body = document.getElementById('chatBody');
  const toggle = document.getElementById('chatToggle');
  body.style.display = chatState.open ? 'flex' : 'none';
  toggle.style.transform = chatState.open ? '' : 'rotate(180deg)';

  if (chatState.open && chatState.history.length === 0) {
    // Primer apertura: mensaje de bienvenida
    setTimeout(() => {
      addMessage(KB.saludar.response(), false);
      renderQuickReplies('main_menu');
    }, 400);
  }
}

// ── Inicialización ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!sessionStorage.getItem('chatId')) {
    sessionStorage.setItem('chatId', Date.now().toString());
  }
  // El chat inicia colapsado — toggle lo abre
  const body = document.getElementById('chatBody');
  if (body) body.style.display = 'none';
  chatState.open = false;

  // Enter en el input
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });
  }
});

// Exponer globalmente
window.sendChat = sendChat;
window.sendQuick = sendQuick;
window.toggleChat = toggleChat;
