const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "please-change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Serve static
app.use(express.static(path.join(__dirname, "public")));

// Helpers
function parseDataText(text) {
  const lines = text.split(/\r?\n/);
  const steps = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) throw new Error(`Geçersiz satır: "${line}". Format: 1 - 93`);
    steps.push({ step: parseInt(m[1], 10), notch: parseInt(m[2], 10) });
  }
  steps.sort((a, b) => a.step - b.step);
  return steps;
}
function orderPath(orderNo) {
  const safe = String(orderNo).replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

// Public API
app.get("/api/order/:orderNo", (req, res) => {
  const p = orderPath(req.params.orderNo);
  if (!fs.existsSync(p)) return res.status(404).json({ error: "Sipariş bulunamadı" });
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    res.json(data);
  } catch (e) { res.status(500).json({ error: "Dosya okunamadı" }); }
});

// Admin auth
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) { req.session.isAdmin = true; return res.json({ ok: true }); }
  res.status(401).json({ ok: false, error: "Şifre hatalı" });
});
app.post("/api/admin/logout", (req, res) => { req.session.destroy(() => res.json({ ok: true })); });
function requireAdmin(req, res, next) { if (req.session && req.session.isAdmin) return next(); return res.status(401).json({ error: "Yetkisiz" }); }

// Admin CRUD
app.post("/api/admin/save", requireAdmin, (req, res) => {
  try {
    const { orderNo, dataText } = req.body;
    if (!orderNo || !dataText) return res.status(400).json({ error: "Eksik veri" });
    const steps = parseDataText(dataText);
    const payload = { orderNo: String(orderNo), total: steps.length, color: "Black", steps, updatedAt: new Date().toISOString() };
    fs.writeFileSync(orderPath(orderNo), JSON.stringify(payload, null, 2), "utf-8");
    res.json({ ok: true, total: steps.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/admin/order/:orderNo", requireAdmin, (req, res) => {
  const p = orderPath(req.params.orderNo);
  if (!fs.existsSync(p)) return res.status(404).json({ error: "Kayıt yok" });
  try { res.json(JSON.parse(fs.readFileSync(p, "utf-8"))); } catch (e) { res.status(500).json({ error: "Dosya okunamadı" }); }
});

// Pretty routes
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });
app.get("/order/:orderNo", (req, res) => { res.sendFile(path.join(__dirname, "public", "order.html")); });
app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, "public", "admin.html")); });

app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`); });
