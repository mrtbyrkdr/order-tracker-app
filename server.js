const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

// Prefer a writable tmp dir on Render; otherwise use local 'data/'
let DATA_DIR = path.join(__dirname, "data");
try {
  if (process.env.RENDER) {
    const tmpCandidates = ["/var/tmp/data", "/tmp/data"];
    for (const d of tmpCandidates) {
      try { fs.mkdirSync(d, { recursive: true }); DATA_DIR = d; break; } catch {}
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.error("DATA_DIR oluşturulamadı, belleğe yazılacak:", e.message);
  DATA_DIR = null; // memory fallback
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "please-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    sameSite: "lax",
    secure: false, // Render HTTPS olsa bile Lax + false cookie set etmeye izin verir
  },
}));

// static
app.use(express.static(path.join(__dirname, "public")));

// helpers
function parseDataText(text) {
  const lines = text.split(/\r?\n/);
  const steps = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) throw new Error(`Geçersiz satır: "${line}". Beklenen format: 1 - 93`);
    steps.push({ step: parseInt(m[1], 10), notch: parseInt(m[2], 10) });
  }
  steps.sort((a, b) => a.step - b.step);
  return steps;
}

function orderPath(orderNo) {
  const safe = String(orderNo).replace(/[^a-zA-Z0-9_\-]/g, "_");
  return DATA_DIR ? path.join(DATA_DIR, `${safe}.json`) : null;
}

// Memory fallback when disk is not writable/available
const memoryStore = new Map();

// Public API
app.get("/api/order/:orderNo", (req, res) => {
  const p = orderPath(req.params.orderNo);
  // prefer disk if available
  if (p) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        return res.json(data);
      }
    } catch (e) { return res.status(500).json({ error: "Dosya okunamadı", detail: e.message }); }
  }
  // then memory
  if (memoryStore.has(req.params.orderNo)) return res.json(memoryStore.get(req.params.orderNo));
  return res.status(404).json({ error: "Sipariş bulunamadı" });
});

// Admin auth
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) { req.session.isAdmin = true; return res.json({ ok: true }); }
  res.status(401).json({ ok: false, error: "Şifre hatalı" });
});
app.post("/api/admin/logout", (req, res) => { req.session.destroy(() => res.json({ ok: true })); });
function requireAdmin(req, res, next) { if (req.session && req.session.isAdmin) return next(); return res.status(401).json({ error: "Yetkisiz" }); }

// Admin save/load
app.post("/api/admin/save", requireAdmin, (req, res) => {
  try {
    const { orderNo, dataText } = req.body;
    if (!orderNo || !dataText) return res.status(400).json({ error: "Eksik veri" });
    const steps = parseDataText(dataText);
    const payload = { orderNo: String(orderNo), total: steps.length, color: "Black", steps, updatedAt: new Date().toISOString() };

    // try disk first
    const p = orderPath(orderNo);
    try {
      if (p) {
        fs.writeFileSync(p, JSON.stringify(payload, null, 2), "utf-8");
        return res.json({ ok: true, total: steps.length, where: p });
      }
    } catch (e) {
      console.warn("Diske yazılamadı, belleğe kaydediliyor:", e.message);
    }
    // memory fallback
    memoryStore.set(String(orderNo), payload);
    return res.json({ ok: true, total: steps.length, where: "memory" });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

app.get("/api/admin/order/:orderNo", requireAdmin, (req, res) => {
  const p = orderPath(req.params.orderNo);
  if (p && fs.existsSync(p)) {
    try { return res.json(JSON.parse(fs.readFileSync(p, "utf-8"))); }
    catch (e) { return res.status(500).json({ error: "Dosya okunamadı", detail: e.message }); }
  }
  if (memoryStore.has(req.params.orderNo)) return res.json(memoryStore.get(req.params.orderNo));
  return res.status(404).json({ error: "Kayıt yok" });
});

// Pretty routes
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/order/:orderNo", (req, res) => res.sendFile(path.join(__dirname, "public", "order.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

// Seed TEST123 at boot if not exists
(function seed() {
  const seedSteps = [
    {step:1, notch:93},{step:2, notch:201},{step:3, notch:9},{step:4, notch:160},{step:5, notch:151},
    {step:6, notch:192},{step:7, notch:230},{step:8, notch:212},{step:9, notch:86},{step:10, notch:29}
  ];
  const payload = { orderNo: "TEST123", total: 10, color: "Black", steps: seedSteps, updatedAt: new Date().toISOString() };
  const p = orderPath("TEST123");
  try {
    if (p) {
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, JSON.stringify(payload, null, 2), "utf-8");
        console.log("Seed yazıldı:", p);
      }
    } else {
      if (!memoryStore.has("TEST123")) memoryStore.set("TEST123", payload);
      console.log("Seed belleğe yazıldı.");
    }
  } catch (e) {
    if (!memoryStore.has("TEST123")) memoryStore.set("TEST123", payload);
    console.warn("Seed diske yazılamadı, belleğe alındı:", e.message);
  }
})();

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} (DATA_DIR=${DATA_DIR || "memory"})`));
