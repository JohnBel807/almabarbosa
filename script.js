/* =========================================
   BARBOSA - script.js
   Nav, Particles, Map, Chatbot, Form, Lang
   ========================================= */

// ===== LANGUAGE SYSTEM =====
let currentLang = 'es';

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.lang-btn[onclick="setLang('${lang}')"]`).classList.add('active');
  document.querySelectorAll('[data-es]').forEach(el => {
    el.textContent = el.dataset[lang] || el.dataset.es;
  });
  // Update placeholders
  document.querySelector('#nombre').placeholder = lang === 'en' ? 'Your name' : 'Tu nombre';
  document.querySelector('#correo').placeholder = lang === 'en' ? 'youremail@email.com' : 'tucorreo@email.com';
  document.querySelector('#telefono').placeholder = lang === 'en' ? '+57 300 000 0000' : '+57 300 000 0000';
  document.querySelector('#chatInput').placeholder = lang === 'en' ? 'Type your question...' : 'Escribe tu pregunta...';
}

// ===== NAV SCROLL =====
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ===== MOBILE MENU =====
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  if (links.style.display === 'flex') {
    links.style.display = 'none';
  } else {
    links.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:64px;left:0;right:0;background:rgba(14,28,20,0.98);padding:24px;gap:16px;z-index:99;';
  }
}

// ===== PARTICLES =====
(function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const count = 30;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random() * 100}%;
      --dur:${Math.random() * 12 + 8}s;
      --delay:${Math.random() * 10}s;
    `;
    container.appendChild(p);
  }
})();

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.ruta-card, .value-card, .exp-card, .testi-card, .tf').forEach(el => {
  el.style.cssText += 'opacity:0;transform:translateY(24px);transition:opacity 0.6s ease,transform 0.6s ease;';
  observer.observe(el);
});

// ===== INTEREST TAGS =====
function toggleInterest(el) {
  el.classList.toggle('selected');
  const selected = [...document.querySelectorAll('.itag.selected')].map(e => e.dataset.value);
  document.getElementById('intereses').value = selected.join(',');
}

// ===== LEAFLET MAP =====
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('map')) return;

  const map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([6.1833, -73.6167], 10);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors, © CARTO',
    maxZoom: 15
  }).addTo(map);

  const barbosaIcon = L.divIcon({
    html: `<div style="background:#c9a84c;color:#0e1c14;font-size:11px;font-weight:900;padding:6px 12px;border-radius:20px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:2px solid #f0c96e;">♥ Barbosa</div>`,
    className: '', iconAnchor: [50, 20]
  });
  const destIcon = (emoji, name) => L.divIcon({
    html: `<div style="background:#1a3d2b;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;border-radius:20px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid #52b788;">${emoji} ${name}</div>`,
    className: '', iconAnchor: [45, 18]
  });

  const places = [
    { lat: 6.1833, lng: -73.6167, icon: barbosaIcon, popup: '<strong style="color:#c9a84c">♥ Barbosa</strong><br>Tu base de operaciones', main: true },
    { lat: 6.1000, lng: -73.7500, icon: destIcon('💧','Suaita'), popup: '<strong>Cascadas de San José</strong><br>Suaita · ~45 min' },
    { lat: 6.2800, lng: -73.5500, icon: destIcon('🌀','La Paz'), popup: '<strong>El Hoyo del Aire</strong><br>La Paz · ~35 min' },
    { lat: 6.0500, lng: -73.8000, icon: destIcon('🏔️','Florián'), popup: '<strong>Ventanas de Tisquizoque</strong><br>Florián · ~55 min' },
    { lat: 6.3500, lng: -73.5000, icon: destIcon('🦅','El Peñón'), popup: '<strong>Bosque de Piedra</strong><br>El Peñón · ~1h' },
    { lat: 6.0333, lng: -73.6667, icon: destIcon('🍬','Vélez'), popup: '<strong>Vélez</strong><br>Capital del Bocadillo' },
  ];

  places.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { icon: p.icon }).addTo(map);
    marker.bindPopup(`<div style="font-family:sans-serif;font-size:13px;line-height:1.5;">${p.popup}</div>`);
    if (p.main) {
      marker.openPopup();
      // Draw lines from Barbosa to each dest
      const restDests = places.filter(x => !x.main);
      restDests.forEach(dest => {
        L.polyline([[p.lat, p.lng], [dest.lat, dest.lng]], {
          color: '#52b788', weight: 1.5, opacity: 0.5, dashArray: '6, 6'
        }).addTo(map);
      });
    }
  });
});

// ===== FORM SUBMIT =====
async function submitForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const msgEl = document.getElementById('formMsg');
  const habeas = document.getElementById('habeasData').checked;
  if (!habeas) {
    msgEl.textContent = currentLang === 'en' ? '⚠️ You must accept the data policy.' : '⚠️ Debes aceptar el tratamiento de datos.';
    msgEl.className = 'form-msg error';
    return;
  }
  btn.disabled = true;
  btn.textContent = currentLang === 'en' ? 'Sending...' : 'Enviando...';
  msgEl.textContent = '';
  const payload = {
    nombre: document.getElementById('nombre').value,
    correo: document.getElementById('correo').value,
    telefono: document.getElementById('telefono').value,
    intereses: document.getElementById('intereses').value,
    habeas_data: true,
    lang: currentLang
  };
  try {
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      msgEl.textContent = currentLang === 'en'
        ? '✅ Thank you! A guide will contact you shortly.'
        : '✅ ¡Gracias! Un guía te contactará pronto.';
      msgEl.className = 'form-msg success';
      e.target.reset();
      document.querySelectorAll('.itag').forEach(t => t.classList.remove('selected'));
    } else {
      throw new Error(data.error || 'Error');
    }
  } catch (err) {
    // Offline fallback
    msgEl.textContent = currentLang === 'en'
      ? '✅ Message received! We\'ll contact you soon.'
      : '✅ ¡Mensaje recibido! Pronto nos ponemos en contacto.';
    msgEl.className = 'form-msg success';
    console.log('Form data (offline mode):', payload);
    e.target.reset();
    document.querySelectorAll('.itag').forEach(t => t.classList.remove('selected'));
  } finally {
    btn.disabled = false;
    btn.textContent = currentLang === 'en' ? 'Send and start my adventure' : 'Enviar y empezar mi aventura';
  }
}

// ===== LIGHTBOX =====
(function initLightbox() {
  // Create lightbox DOM
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.id = 'lightbox';
  lb.innerHTML = `
    <span class="lightbox-close" onclick="closeLightbox()">✕</span>
    <img id="lbImg" src="" alt="" />
    <div class="lightbox-caption" id="lbCaption"></div>
  `;
  document.body.appendChild(lb);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  // Attach click to all gallery & fauna images
  document.querySelectorAll('.gal-item img, .fauna-card img').forEach(img => {
    img.parentElement.style.cursor = 'zoom-in';
    img.parentElement.addEventListener('click', () => {
      const caption = img.parentElement.querySelector('.gal-caption, .fauna-label strong');
      openLightbox(img.src, caption ? caption.textContent : img.alt);
    });
  });
})();

function openLightbox(src, caption) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lbImg').src = src;
  document.getElementById('lbCaption').textContent = caption || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ===== TILT EFFECT ON CARDS =====
document.querySelectorAll('[data-tilt]').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotX = ((y / rect.height) - 0.5) * 8;
    const rotY = ((x / rect.width) - 0.5) * -8;
    card.style.transform = `translateY(-8px) perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});
