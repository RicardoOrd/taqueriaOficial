const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Inicializar DB al arrancar
require('./db/database').getDb();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));   // 10 MB para imágenes en base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Archivos estáticos (frontend) ─────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas API ──────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));

// ── Health check ───────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Fallback → index.html (SPA) ────────────────────────
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Arrancar servidor ──────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🌮  Taquería Comandas');
  console.log(`✅  Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📱  Abre esa URL en tu celular/iPad (misma red WiFi)`);
  console.log('');
});
