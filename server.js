require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════
app.use(cors({ origin: "*" }));
app.use(express.json());

// ═══════════════════════════════════════════════════
// BASE DE DONNÉES EN MÉMOIRE (simple, sans Supabase)
// ═══════════════════════════════════════════════════
const TABLES = [
  { id:1,  numero:1,  capacite:2,  zone:"Terrasse" },
  { id:2,  numero:2,  capacite:2,  zone:"Terrasse" },
  { id:3,  numero:3,  capacite:4,  zone:"Terrasse" },
  { id:4,  numero:4,  capacite:4,  zone:"Terrasse" },
  { id:5,  numero:5,  capacite:4,  zone:"Salle principale" },
  { id:6,  numero:6,  capacite:4,  zone:"Salle principale" },
  { id:7,  numero:7,  capacite:6,  zone:"Salle principale" },
  { id:8,  numero:8,  capacite:6,  zone:"Salle principale" },
  { id:9,  numero:9,  capacite:8,  zone:"Salle principale" },
  { id:10, numero:10, capacite:8,  zone:"Salle principale" },
  { id:11, numero:11, capacite:2,  zone:"Bar" },
  { id:12, numero:12, capacite:2,  zone:"Bar" },
  { id:13, numero:13, capacite:4,  zone:"Bar" },
  { id:14, numero:14, capacite:6,  zone:"VIP" },
  { id:15, numero:15, capacite:10, zone:"VIP" },
];

// Réservations stockées en mémoire
let reservations = [];

// Clés API valides (ajoute les tiennes ici ou dans .env)
const API_KEYS = (process.env.API_KEYS || "rk_live_m7ofv4_o4jpfn_eh1isy_h1md3g")
  .split(",")
  .map(k => k.trim());

// Logs des appels API
let apiLogs = [];

// ═══════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════
function genId(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10).toUpperCase();
}

function getTableStatut(tableId, now = new Date()) {
  const ct = new Date(now);

  // Table occupée maintenant ?
  const active = reservations.find(r => {
    if (r.tableId !== tableId || r.statut === "terminee") return false;
    return new Date(r.dateHeure) <= ct && ct < new Date(r.dateHeureFin);
  });
  if (active) return { statut: "occupee", reservation: active, disponible: false };

  // Réservation dans moins de 30 min ?
  const bientot = reservations.find(r => {
    if (r.tableId !== tableId || r.statut === "terminee") return false;
    const diff = (new Date(r.dateHeure) - ct) / 60000;
    return diff > 0 && diff <= 30;
  });
  if (bientot) return { statut: "bientot", reservation: bientot, disponible: false };

  return { statut: "libre", reservation: null, disponible: true };
}

function verifierConflitCreneau(tableId, dateHeureDebut, dureeMin) {
  const debut = new Date(dateHeureDebut);
  const fin   = new Date(debut.getTime() + dureeMin * 60000);

  const conflit = reservations.find(r => {
    if (r.tableId !== parseInt(tableId) || r.statut === "terminee") return false;
    const rDebut = new Date(r.dateHeure);
    const rFin   = new Date(r.dateHeureFin);
    return debut < rFin && fin > rDebut;
  });

  return conflit || null;
}

function autoExpirer() {
  const now = new Date();
  reservations = reservations.map(r => {
    if (r.statut !== "terminee" && new Date(r.dateHeureFin) < now) {
      return { ...r, statut: "terminee" };
    }
    return r;
  });
}

function addLog(method, path, status, keyName) {
  apiLogs.unshift({
    id: genId(),
    ts: new Date().toISOString(),
    method,
    path,
    status,
    key: keyName,
  });
  apiLogs = apiLogs.slice(0, 200); // garde 200 entrées max
}

// ═══════════════════════════════════════════════════
// MIDDLEWARE AUTH — clé API obligatoire
// ═══════════════════════════════════════════════════
function requireApiKey(req, res, next) {
  const key =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.body?._apiKey ||
    req.query?.apiKey;

  if (!key) {
    addLog(req.method, req.path, 401, "AUCUNE CLÉ");
    return res.status(401).json({
      error: "Clé API manquante. Ajoutez le header : x-api-key: votre_cle",
      code:  "API_KEY_REQUIRED",
    });
  }

  if (!API_KEYS.includes(key)) {
    addLog(req.method, req.path, 401, "CLÉ INVALIDE");
    return res.status(401).json({
      error: "Clé API invalide. Accès refusé.",
      code:  "INVALID_API_KEY",
    });
  }

  req.apiKeyName = key.slice(0, 20) + "…";
  next();
}

// ═══════════════════════════════════════════════════
// ROUTES PUBLIQUES
// ═══════════════════════════════════════════════════

// Santé du serveur
app.get("/", (req, res) => {
  res.json({
    service:  "Le Plateau Doré — API Réservations",
    version:  "1.0.0",
    status:   "✅ En ligne",
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════
// ROUTES API (protégées par clé)
// ═══════════════════════════════════════════════════

// ── GET /tables ────────────────────────────────────
app.get("/tables", requireApiKey, (req, res) => {
  autoExpirer();
  const now = new Date();

  const tables = TABLES.map(t => {
    const { statut, reservation, disponible } = getTableStatut(t.id, now);
    return {
      id:         t.id,
      numero:     t.numero,
      capacite:   t.capacite,
      zone:       t.zone,
      statut,
      disponible,
      reservation: reservation ? {
        id:         reservation.id,
        client:     reservation.client,
        personnes:  reservation.personnes,
        heureDebut: reservation.dateHeure,
        heureFin:   reservation.dateHeureFin,
      } : null,
    };
  });

  const resume = {
    libres:   tables.filter(t => t.statut === "libre").length,
    occupees: tables.filter(t => t.statut === "occupee").length,
    bientot:  tables.filter(t => t.statut === "bientot").length,
    total:    TABLES.length,
  };

  addLog("GET", "/tables", 200, req.apiKeyName);
  res.json({ tables, resume, timestamp: now.toISOString() });
});

// ── GET /tables/disponibles ────────────────────────
app.get("/tables/disponibles", requireApiKey, (req, res) => {
  autoExpirer();
  const now = new Date();

  const libres = TABLES
    .filter(t => getTableStatut(t.id, now).disponible)
    .map(t => ({
      id:       t.id,
      numero:   t.numero,
      capacite: t.capacite,
      zone:     t.zone,
    }));

  addLog("GET", "/tables/disponibles", 200, req.apiKeyName);
  res.json({
    tables:    libres,
    count:     libres.length,
    timestamp: now.toISOString(),
  });
});

// ── POST /reservations ─────────────────────────────
app.post("/reservations", requireApiKey, (req, res) => {
  autoExpirer();

  const { client, telephone, personnes, tableId, dateHeure, dureeMinutes = 90 } = req.body;

  // Validation des champs
  if (!client || !telephone || !personnes || !tableId || !dateHeure) {
    addLog("POST", "/reservations", 400, req.apiKeyName);
    return res.status(400).json({
      error: "Champs obligatoires manquants : client, telephone, personnes, tableId, dateHeure",
      code:  "MISSING_FIELDS",
    });
  }

  const tid   = parseInt(tableId);
  const table = TABLES.find(t => t.id === tid);

  if (!table) {
    addLog("POST", "/reservations", 404, req.apiKeyName);
    return res.status(404).json({
      error: `Table ${tableId} introuvable.`,
      code:  "TABLE_NOT_FOUND",
    });
  }

  // ── VÉRIFICATION STRICTE STATUT ACTUEL ───────────
  const { statut: statutActuel, reservation: resActive } = getTableStatut(tid);
  if (!getTableStatut(tid).disponible) {
    addLog("POST", "/reservations", 409, req.apiKeyName);
    return res.status(409).json({
      error:    `🚫 Table ${table.numero} est ${statutActuel === "occupee" ? "actuellement OCCUPÉE" : "déjà RÉSERVÉE dans moins de 30 min"}. Réservation impossible.`,
      code:     "TABLE_NOT_AVAILABLE",
      table:    { id: tid, numero: table.numero, statut: statutActuel },
      conflit:  resActive ? { client: resActive.client, de: resActive.dateHeure, a: resActive.dateHeureFin } : null,
    });
  }

  // ── VÉRIFICATION CONFLIT DE CRÉNEAU ──────────────
  const conflit = verifierConflitCreneau(tid, dateHeure, dureeMinutes);
  if (conflit) {
    addLog("POST", "/reservations", 409, req.apiKeyName);
    return res.status(409).json({
      error:   `🚫 Table ${table.numero} déjà réservée sur ce créneau par ${conflit.client}.`,
      code:    "TABLE_CONFLICT",
      conflit: { client: conflit.client, de: conflit.dateHeure, a: conflit.dateHeureFin },
    });
  }

  // ── VÉRIFICATION CAPACITÉ ─────────────────────────
  if (parseInt(personnes) > table.capacite) {
    addLog("POST", "/reservations", 422, req.apiKeyName);
    return res.status(422).json({
      error: `La table ${table.numero} a une capacité maximum de ${table.capacite} personnes.`,
      code:  "CAPACITY_EXCEEDED",
    });
  }

  // ── CRÉATION DE LA RÉSERVATION ────────────────────
  const debut = new Date(dateHeure);
  const fin   = new Date(debut.getTime() + dureeMinutes * 60000);

  const newResa = {
    id:           genId("R"),
    tableId:      tid,
    client,
    telephone,
    personnes:    parseInt(personnes),
    statut:       "confirmee",
    dateHeure:    debut.toISOString(),
    dateHeureFin: fin.toISOString(),
    notes:        req.body.notes || "",
    createdAt:    new Date().toISOString(),
    source:       "api",
  };

  reservations.push(newResa);

  addLog("POST", "/reservations", 201, req.apiKeyName);
  res.status(201).json({
    success:     true,
    message:     `✅ Table ${table.numero} réservée pour ${client}.`,
    reservation: newResa,
  });
});

// ── PUT /reservations/:id/terminer ─────────────────
app.put("/reservations/:id/terminer", requireApiKey, (req, res) => {
  const { id } = req.params;
  const resa   = reservations.find(r => r.id === id);

  if (!resa) {
    addLog("PUT", `/reservations/${id}/terminer`, 404, req.apiKeyName);
    return res.status(404).json({ error: "Réservation introuvable.", code: "NOT_FOUND" });
  }

  if (resa.statut === "terminee") {
    addLog("PUT", `/reservations/${id}/terminer`, 409, req.apiKeyName);
    return res.status(409).json({ error: "Réservation déjà terminée.", code: "ALREADY_TERMINATED" });
  }

  resa.statut = "terminee";

  addLog("PUT", `/reservations/${id}/terminer`, 200, req.apiKeyName);
  res.json({
    success:       true,
    message:       `✅ Table ${resa.tableId} libérée avec succès.`,
    tableId:       resa.tableId,
    reservationId: id,
    libereeA:      new Date().toISOString(),
  });
});

// ── GET /reservations ──────────────────────────────
app.get("/reservations", requireApiKey, (req, res) => {
  autoExpirer();
  const { statut, date } = req.query;

  let result = [...reservations];

  if (statut)  result = result.filter(r => r.statut === statut);
  if (date)    result = result.filter(r => r.dateHeure.startsWith(date));

  result.sort((a, b) => new Date(b.dateHeure) - new Date(a.dateHeure));

  addLog("GET", "/reservations", 200, req.apiKeyName);
  res.json({ reservations: result, count: result.length, timestamp: new Date().toISOString() });
});

// ── GET /logs (admin) ──────────────────────────────
app.get("/logs", requireApiKey, (req, res) => {
  res.json({ logs: apiLogs.slice(0, 100), count: apiLogs.length });
});

// ═══════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🍽️  Le Plateau Doré — API démarrée sur le port ${PORT}`);
  console.log(`✅ Endpoints disponibles :`);
  console.log(`   GET  /tables`);
  console.log(`   GET  /tables/disponibles`);
  console.log(`   POST /reservations`);
  console.log(`   PUT  /reservations/:id/terminer`);
  console.log(`   GET  /reservations`);
  console.log(`   GET  /logs\n`);
});
