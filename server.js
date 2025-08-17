const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dataFile = path.join(dataDir, 'orders.json');

function loadOrders() {
  if (!fs.existsSync(dataFile)) return {};
  return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
}
function saveOrders(orders) {
  fs.writeFileSync(dataFile, JSON.stringify(orders, null, 2));
}

// Seed TEST123 if not present
let orders = loadOrders();
if (!orders['TEST123']) {
  orders['TEST123'] = [
    { step: 1, notch: 93 },
    { step: 2, notch: 201 },
    { step: 3, notch: 9 },
    { step: 4, notch: 160 },
    { step: 5, notch: 151 },
    { step: 6, notch: 192 },
    { step: 7, notch: 230 },
    { step: 8, notch: 212 },
    { step: 9, notch: 86 },
    { step: 10, notch: 29 }
  ];
  saveOrders(orders);
}

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/order/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'order.html')));

app.get('/api/order/:id', (req, res) => {
  const id = req.params.id;
  const orders = loadOrders();
  res.json(orders[id] || []);
});

// Simple admin (no auth for demo)
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.post('/api/admin/save', (req, res) => {
  const { id, steps } = req.body;
  if (!id || !steps) return res.status(400).json({ error: 'Eksik veri' });
  const orders = loadOrders();
  orders[id] = steps;
  saveOrders(orders);
  res.json({ ok: true, total: steps.length });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
