const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// data store
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dataFile = path.join(dataDir, 'orders.json');

function loadOrders() {
  if (!fs.existsSync(dataFile)) return {};
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')); }
  catch(e){ console.error('orders.json parse error:', e); return {}; }
}
function saveOrders(obj) {
  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2));
}

// seed
const seed = [
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
const start = loadOrders();
if (!start['TEST123']) {
  start['TEST123'] = seed;
  saveOrders(start);
}

// pages
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/order/:id', (req,res)=>res.sendFile(path.join(__dirname,'public','order.html')));
app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));

// apis
app.get('/api/order/:id', (req,res)=>{
  const all = loadOrders();
  const rec = all[req.params.id];
  if (rec) return res.json(rec);
  return res.status(404).json({ error: 'Sipariş bulunamadı' });
});

app.post('/api/admin/save', (req,res)=>{
  const { id, steps } = req.body;
  if (!id || !Array.isArray(steps)) return res.status(400).json({ error: 'Eksik veya hatalı veri' });
  const all = loadOrders();
  all[id] = steps.map(s => ({ step: Number(s.step), notch: Number(s.notch) }));
  saveOrders(all);
  res.json({ ok: true, total: all[id].length });
});

// deep-link fallback for static hosts/reloads
app.use((req,res,next)=>{
  if (req.path.startsWith('/order/')) return res.sendFile(path.join(__dirname,'public','order.html'));
  next();
});

app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
