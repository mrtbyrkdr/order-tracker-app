const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1); // Render/Proxy friendly
const PORT = process.env.PORT || 3000;

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'gizli',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax' } // not secure to support http in preview
}));

// Data store
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dataFile = path.join(dataDir, 'orders.json');

// Food ordering files
const menuFile = path.join(dataDir, 'menu.json');
const foodOrdersFile = path.join(dataDir, 'foodOrders.json');

function loadOrders() {
  if (!fs.existsSync(dataFile)) return {};
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')); }
  catch (e) { console.error('orders.json parse error:', e); return {}; }
}
function saveOrders(obj) { fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2)); }

function loadMenu() {
  if (!fs.existsSync(menuFile)) return [];
  try { return JSON.parse(fs.readFileSync(menuFile, 'utf-8')); }
  catch (e) { console.error('menu.json parse error:', e); return []; }
}

function loadFoodOrders() {
  if (!fs.existsSync(foodOrdersFile)) return [];
  try { return JSON.parse(fs.readFileSync(foodOrdersFile, 'utf-8')); }
  catch (e) { console.error('foodOrders.json parse error:', e); return []; }
}

function saveFoodOrders(arr) { fs.writeFileSync(foodOrdersFile, JSON.stringify(arr, null, 2)); }

// Seed data (for TEST123 demo)
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

// Public pages (login + order)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/order/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'order.html')));
app.get('/login', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/customer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'customer.html')));
app.get('/restaurant', (req, res) => res.sendFile(path.join(__dirname, 'public', 'restaurant.html')));

// PROTECT admin pages BEFORE static
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Static after protections
app.use(express.static(path.join(__dirname, 'public')));

// APIs
app.get('/api/order/:id', (req, res) => {
  const all = loadOrders();
  const rec = all[req.params.id];
  if (rec) return res.json(rec);
  return res.status(404).json({ error: 'Sipariş bulunamadı' });
});

// Food ordering APIs
app.get('/api/menu', (req, res) => {
  res.json(loadMenu());
});

app.post('/api/order', (req, res) => {
  const { restaurantId, items } = req.body;
  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Eksik veya hatalı veri' });
  }
  const orders = loadFoodOrders();
  const id = Math.random().toString(36).slice(2, 10);
  orders.push({ id, restaurantId, items });
  saveFoodOrders(orders);
  res.json({ ok: true, id });
});

app.get('/api/restaurant/orders/:rid', (req, res) => {
  const orders = loadFoodOrders().filter(o => o.restaurantId === req.params.rid);
  res.json(orders);
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
