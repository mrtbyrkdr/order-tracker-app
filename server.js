const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'gizli',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax' }
}));

// Data store
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dataFile = path.join(dataDir, 'orders.json');

function loadOrders() {
  if (!fs.existsSync(dataFile)) return {};
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')); }
  catch (e) { console.error('orders.json parse error:', e); return {}; }
}
function saveOrders(obj) { fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2)); }

// Seed
const seed = [
  { step: 1, notch: 93 }, { step: 2, notch: 201 }, { step: 3, notch: 9 },
  { step: 4, notch: 160 }, { step: 5, notch: 151 }, { step: 6, notch: 192 },
  { step: 7, notch: 230 }, { step: 8, notch: 212 }, { step: 9, notch: 86 }, { step: 10, notch: 29 }
];
const start = loadOrders();
if (!start['TEST123']) { start['TEST123'] = seed; saveOrders(start); }

// Auth helpers
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/login.html');
}

// Public pages (before static: protect /admin.html explicitly)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/order/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'order.html')));
app.get('/login', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// Protect direct access to admin.html BEFORE static middleware
app.get('/admin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Static after route protections
app.use(express.static(path.join(__dirname, 'public')));

// APIs
app.get('/api/order/:id', (req, res) => {
  const all = loadOrders();
  const rec = all[req.params.id];
  if (rec) return res.json(rec);
  return res.status(404).json({ error: 'Sipariş bulunamadı' });
});

// Admin APIs (protected)
app.post('/api/admin/save', requireAdmin, (req, res) => {
  const { id, steps } = req.body;
  if (!id || !Array.isArray(steps)) return res.status(400).json({ error: 'Eksik veya hatalı veri' });
  const all = loadOrders();
  all[id] = steps.map(s => ({ step: Number(s.step), notch: Number(s.notch) }));
  saveOrders(all);
  res.json({ ok: true, total: all[id].length });
});

// Auth APIs
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || '123123Asd';
  if (password && password === adminPass) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.json({ success: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Deep-link fallback for order pages
app.use((req, res, next) => {
  if (req.path.startsWith('/order/')) return res.sendFile(path.join(__dirname, 'public', 'order.html'));
  next();
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
