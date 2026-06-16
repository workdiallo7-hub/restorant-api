require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// ═══════════════════════════════════════════════════
// TWILIO SMS
// ═══════════════════════════════════════════════════
const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_FROM;
const NOTIF_SMS    = process.env.NOTIF_SMS;

async function envoyerSMS(message) {
  try {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !NOTIF_SMS) {
      console.log("⚠️ Twilio non configuré — SMS ignoré");
      return;
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const body = new URLSearchParams({
      To:   NOTIF_SMS,
      From: TWILIO_FROM,
      Body: message,
    });
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (data.sid) console.log(`✅ SMS envoyé : ${data.sid}`);
    else console.log("❌ Erreur SMS:", data);
  } catch(e) {
    console.log("❌ Erreur Twilio:", e.message);
  }
}

function formatSMSReservation(resa, table) {
  const debut = new Date(resa.dateHeure);
  const fin   = new Date(resa.dateHeureFin);
  const date  = debut.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
  const hDebut= debut.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
  const hFin  = fin.toLocaleTimeString("fr-FR",   { hour:"2-digit", minute:"2-digit" });
  const zone  = table ? table.zone : "";

  return `🍽️ NOUVELLE RESERVATION - Le Plateau Dore

👤 Client : ${resa.client}
📞 Tel : ${resa.telephone}
👥 Personnes : ${resa.personnes}
🪑 Table : N°${resa.tableId}${zone ? " - " + zone : ""}
📅 Date : ${date}
⏰ Heure : ${hDebut} -> ${hFin}
📱 Source : ${resa.source === "api" ? "Agent vocal Aya" : "Dashboard"}

✅ Reservation confirmee !
Preparez la table ${resa.tableId} svp.`;
}

// ═══════════════════════════════════════════════════
// TABLES
// ═══════════════════════════════════════════════════
const TABLES = [
  {id:1,numero:1,capacite:2,zone:"Terrasse"},
  {id:2,numero:2,capacite:2,zone:"Terrasse"},
  {id:3,numero:3,capacite:4,zone:"Terrasse"},
  {id:4,numero:4,capacite:4,zone:"Terrasse"},
  {id:5,numero:5,capacite:4,zone:"Salle principale"},
  {id:6,numero:6,capacite:4,zone:"Salle principale"},
  {id:7,numero:7,capacite:6,zone:"Salle principale"},
  {id:8,numero:8,capacite:6,zone:"Salle principale"},
  {id:9,numero:9,capacite:8,zone:"Salle principale"},
  {id:10,numero:10,capacite:8,zone:"Salle principale"},
  {id:11,numero:11,capacite:2,zone:"Bar"},
  {id:12,numero:12,capacite:2,zone:"Bar"},
  {id:13,numero:13,capacite:4,zone:"Bar"},
  {id:14,numero:14,capacite:6,zone:"VIP"},
  {id:15,numero:15,capacite:10,zone:"VIP"},
];

// ═══════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════
let MENU = [
  {id:"E1",categorie:"Entrées",nom:"Salade Césare Africaine",prix:4500,disponible:true,description:"Laitue, poulet grillé, parmesan, sauce césar maison"},
  {id:"E2",categorie:"Entrées",nom:"Carpaccio de thiof",prix:5500,disponible:true,description:"Thiof mariné au citron vert, huile d'olive"},
  {id:"E3",categorie:"Entrées",nom:"Crevettes flambées",prix:7500,disponible:true,description:"Crevettes royales flambées au whisky, beurre ail"},
  {id:"E4",categorie:"Entrées",nom:"Soupe de poisson",prix:3500,disponible:true,description:"Soupe traditionnelle ivoirienne, légumes du jardin"},
  {id:"E5",categorie:"Entrées",nom:"Accras de crevettes",prix:4000,disponible:true,description:"Beignets légers de crevettes, sauce pimentée"},
  {id:"E6",categorie:"Entrées",nom:"Planche de charcuterie",prix:8500,disponible:false,description:"Charcuteries importées, pain grillé"},
  {id:"P1",categorie:"Poissons",nom:"Thiof braisé entier",prix:15000,disponible:true,description:"Thiof entier braisé, sauce tomate, attiéké"},
  {id:"P2",categorie:"Poissons",nom:"Capitaine grillé",prix:12500,disponible:true,description:"Filet de capitaine grillé, beurre blanc citron"},
  {id:"P3",categorie:"Poissons",nom:"Langouste grillée",prix:28000,disponible:false,description:"Langouste entière grillée, beurre ail, frites"},
  {id:"P4",categorie:"Poissons",nom:"Crevettes royales",prix:14000,disponible:true,description:"Crevettes sautées, sauce curry coco, riz basmati"},
  {id:"P5",categorie:"Poissons",nom:"Gambas à la plancha",prix:16500,disponible:true,description:"Gambas grillées, huile d'olive, ail, piment"},
  {id:"P6",categorie:"Poissons",nom:"Poisson sauce claire",prix:9500,disponible:true,description:"Poisson mijoté sauce claire, attiéké"},
  {id:"V1",categorie:"Viandes",nom:"Côte de boeuf 600g",prix:28000,disponible:true,description:"Boeuf maturé, sauce poivre, frites"},
  {id:"V2",categorie:"Viandes",nom:"Entrecôte grillée",prix:18500,disponible:true,description:"Entrecôte 300g, beurre maître d'hôtel"},
  {id:"V3",categorie:"Viandes",nom:"Poulet braisé",prix:9500,disponible:true,description:"Poulet braisé entier, sauce pimentée, attiéké"},
  {id:"V4",categorie:"Viandes",nom:"Magret de canard",prix:16000,disponible:false,description:"Magret de canard, sauce aux oranges"},
  {id:"V5",categorie:"Viandes",nom:"Brochettes de boeuf",prix:12000,disponible:true,description:"Brochettes filet de boeuf, légumes grillés"},
  {id:"V6",categorie:"Viandes",nom:"Mixed grill",prix:19000,disponible:true,description:"Assortiment grillades : boeuf, poulet, agneau"},
  {id:"V7",categorie:"Viandes",nom:"Poulet yassa",prix:8500,disponible:true,description:"Poulet yassa traditionnel, oignons confits, riz"},
  {id:"I1",categorie:"Cuisine Ivoirienne",nom:"Kedjenou de poulet",prix:8000,disponible:true,description:"Poulet mijoté en cocotte, épices du terroir"},
  {id:"I2",categorie:"Cuisine Ivoirienne",nom:"Sauce graine",prix:7500,disponible:true,description:"Sauce graine de palme, boeuf ou poulet, riz"},
  {id:"I3",categorie:"Cuisine Ivoirienne",nom:"Foutou banane",prix:6500,disponible:true,description:"Foutou banane, sauce arachide ou égusi"},
  {id:"I4",categorie:"Cuisine Ivoirienne",nom:"Riz gras ivoirien",prix:7000,disponible:true,description:"Riz gras au poulet, légumes du moment"},
  {id:"I5",categorie:"Cuisine Ivoirienne",nom:"Aloco au poisson",prix:5500,disponible:false,description:"Bananes plantain frites, poisson fumé"},
  {id:"I6",categorie:"Cuisine Ivoirienne",nom:"Placali sauce egusi",prix:6000,disponible:true,description:"Placali traditionnel, sauce egusi"},
  {id:"D1",categorie:"Desserts",nom:"Fondant chocolat",prix:4500,disponible:true,description:"Fondant chaud chocolat noir, glace vanille"},
  {id:"D2",categorie:"Desserts",nom:"Crème brûlée",prix:4000,disponible:true,description:"Crème brûlée vanille de Madagascar"},
  {id:"D3",categorie:"Desserts",nom:"Tiramisu maison",prix:4500,disponible:true,description:"Tiramisu café, mascarpone"},
  {id:"D4",categorie:"Desserts",nom:"Salade fruits tropicaux",prix:3500,disponible:true,description:"Mangue, papaye, ananas, pastèque, menthe"},
  {id:"D5",categorie:"Desserts",nom:"Glaces artisanales",prix:3000,disponible:true,description:"3 boules au choix"},
  {id:"B1",categorie:"Boissons",nom:"Jus de fruits frais",prix:2500,disponible:true,description:"Mangue, Ananas, Orange — 25cl"},
  {id:"B2",categorie:"Boissons",nom:"Bissap maison",prix:2000,disponible:true,description:"Jus d'hibiscus frais — 25cl"},
  {id:"B3",categorie:"Boissons",nom:"Smoothie tropical",prix:3500,disponible:true,description:"Mangue-Ananas-Gingembre — 30cl"},
  {id:"B4",categorie:"Boissons",nom:"Plateau Sunset cocktail",prix:6500,disponible:true,description:"Rhum blanc, mangue, grenadine, gingembre"},
];

let reservations = [];
let apiLogs = [];

const API_KEYS = (process.env.API_KEYS || "rk_live_m7ofv4_o4jpfn_eh1isy_h1md3g")
  .split(",").map(k => k.trim());

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════
function genId(p=""){ return p+Math.random().toString(36).slice(2,10).toUpperCase(); }

function getTableStatut(tableId, now=new Date()){
  const ct=new Date(now);
  const active=reservations.find(r=>{
    if(r.tableId!==tableId||r.statut==="terminee") return false;
    return new Date(r.dateHeure)<=ct && ct<new Date(r.dateHeureFin);
  });
  if(active) return {statut:"occupee",reservation:active,disponible:false};
  const bientot=reservations.find(r=>{
    if(r.tableId!==tableId||r.statut==="terminee") return false;
    const diff=(new Date(r.dateHeure)-ct)/60000;
    return diff>0 && diff<=30;
  });
  if(bientot) return {statut:"bientot",reservation:bientot,disponible:false};
  return {statut:"libre",reservation:null,disponible:true};
}

function verifierConflit(tableId,dateHeureDebut,dureeMin){
  const debut=new Date(dateHeureDebut);
  const fin=new Date(debut.getTime()+dureeMin*60000);
  return reservations.find(r=>{
    if(r.tableId!==parseInt(tableId)||r.statut==="terminee") return false;
    return debut<new Date(r.dateHeureFin)&&fin>new Date(r.dateHeure);
  })||null;
}

function autoExpirer(){
  const now=new Date();
  reservations=reservations.map(r=>
    r.statut!=="terminee"&&new Date(r.dateHeureFin)<now?{...r,statut:"terminee"}:r
  );
}

function addLog(method,path,status,keyName){
  apiLogs.unshift({id:genId(),ts:new Date().toISOString(),method,path,status,key:keyName});
  apiLogs=apiLogs.slice(0,200);
}

// ═══════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════
function requireApiKey(req,res,next){
  const key=req.headers["x-api-key"]||req.headers["authorization"]?.replace("Bearer ","")||req.body?._apiKey||req.query?.apiKey;
  if(!key){ addLog(req.method,req.path,401,"AUCUNE CLÉ"); return res.status(401).json({error:"Clé API manquante.",code:"API_KEY_REQUIRED"}); }
  if(!API_KEYS.includes(key)){ addLog(req.method,req.path,401,"CLÉ INVALIDE"); return res.status(401).json({error:"Clé API invalide.",code:"INVALID_API_KEY"}); }
  req.apiKeyName=key.slice(0,20)+"…";
  next();
}

// ═══════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════
app.get("/",(req,res)=>{
  res.json({service:"Le Plateau Doré — API v3.0",status:"✅ En ligne",sms:"✅ Twilio configuré",timestamp:new Date().toISOString()});
});

// TABLES
app.get("/tables",requireApiKey,(req,res)=>{
  autoExpirer();
  const now=new Date();
  const tables=TABLES.map(t=>{
    const{statut,reservation,disponible}=getTableStatut(t.id,now);
    return{...t,statut,disponible,reservation:reservation?{id:reservation.id,client:reservation.client,personnes:reservation.personnes,heureDebut:reservation.dateHeure,heureFin:reservation.dateHeureFin}:null};
  });
  const resume={libres:tables.filter(t=>t.statut==="libre").length,occupees:tables.filter(t=>t.statut==="occupee").length,bientot:tables.filter(t=>t.statut==="bientot").length,total:TABLES.length};
  addLog("GET","/tables",200,req.apiKeyName);
  res.json({tables,resume,timestamp:now.toISOString()});
});

app.get("/tables/disponibles",requireApiKey,(req,res)=>{
  autoExpirer();
  const now=new Date();
  const libres=TABLES.filter(t=>getTableStatut(t.id,now).disponible).map(t=>({id:t.id,numero:t.numero,capacite:t.capacite,zone:t.zone}));
  addLog("GET","/tables/disponibles",200,req.apiKeyName);
  res.json({tables:libres,count:libres.length,timestamp:now.toISOString()});
});

// RÉSERVATIONS
app.post("/reservations",requireApiKey,async(req,res)=>{
  autoExpirer();
  const{client,telephone,personnes,tableId,dateHeure,dureeMinutes=90}=req.body;

  if(!client||!telephone||!personnes||!tableId||!dateHeure){
    addLog("POST","/reservations",400,req.apiKeyName);
    return res.status(400).json({error:"Champs obligatoires manquants.",code:"MISSING_FIELDS"});
  }

  const tid=parseInt(tableId);
  const table=TABLES.find(t=>t.id===tid);
  if(!table){ addLog("POST","/reservations",404,req.apiKeyName); return res.status(404).json({error:`Table ${tableId} introuvable.`,code:"TABLE_NOT_FOUND"}); }

  const{disponible,statut:statutActuel,reservation:resActive}=getTableStatut(tid);
  if(!disponible){
    addLog("POST","/reservations",409,req.apiKeyName);
    return res.status(409).json({
      error:`🚫 Table ${table.numero} est ${statutActuel==="occupee"?"actuellement OCCUPÉE":"déjà RÉSERVÉE"}. Impossible de réserver.`,
      code:"TABLE_NOT_AVAILABLE",
      table:{id:tid,numero:table.numero,statut:statutActuel}
    });
  }

  const conflit=verifierConflit(tid,dateHeure,dureeMinutes);
  if(conflit){
    addLog("POST","/reservations",409,req.apiKeyName);
    return res.status(409).json({error:`🚫 Table ${table.numero} déjà réservée sur ce créneau par ${conflit.client}.`,code:"TABLE_CONFLICT"});
  }

  if(parseInt(personnes)>table.capacite){
    addLog("POST","/reservations",422,req.apiKeyName);
    return res.status(422).json({error:`Table ${table.numero} : capacité max ${table.capacite} personnes.`,code:"CAPACITY_EXCEEDED"});
  }

  const debut=new Date(dateHeure);
  const fin=new Date(debut.getTime()+dureeMinutes*60000);
  const newR={
    id:genId("R"),tableId:tid,client,telephone,
    personnes:parseInt(personnes),statut:"confirmee",
    dateHeure:debut.toISOString(),dateHeureFin:fin.toISOString(),
    notes:req.body.notes||"",createdAt:new Date().toISOString(),source:"api"
  };

  reservations.push(newR);
  addLog("POST","/reservations",201,req.apiKeyName);

  // ── ENVOI SMS AUTOMATIQUE ──────────────────────
  const smsMessage = formatSMSReservation(newR, table);
  envoyerSMS(smsMessage); // envoi en arrière-plan sans bloquer la réponse

  res.status(201).json({
    success:true,
    message:`✅ Table ${table.numero} réservée pour ${client}. SMS de notification envoyé.`,
    reservation:newR
  });
});

app.put("/reservations/:id/terminer",requireApiKey,async(req,res)=>{
  const{id}=req.params;
  const resa=reservations.find(r=>r.id===id);
  if(!resa){ addLog("PUT",`/reservations/${id}/terminer`,404,req.apiKeyName); return res.status(404).json({error:"Réservation introuvable.",code:"NOT_FOUND"}); }
  if(resa.statut==="terminee"){ addLog("PUT",`/reservations/${id}/terminer`,409,req.apiKeyName); return res.status(409).json({error:"Réservation déjà terminée.",code:"ALREADY_TERMINATED"}); }

  resa.statut="terminee";
  addLog("PUT",`/reservations/${id}/terminer`,200,req.apiKeyName);

  // SMS libération table
  const table=TABLES.find(t=>t.id===resa.tableId);
  await envoyerSMS(`✅ TABLE LIBÉRÉE - Le Plateau Doré\n\n🪑 Table ${resa.tableId}${table?" - "+table.zone:""} est maintenant libre.\n👤 Fin de séjour : ${resa.client}\n⏰ ${new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`);

  res.json({success:true,message:`✅ Table ${resa.tableId} libérée.`,tableId:resa.tableId,reservationId:id,libereeA:new Date().toISOString()});
});

app.get("/reservations",requireApiKey,(req,res)=>{
  autoExpirer();
  let result=[...reservations];
  if(req.query.statut) result=result.filter(r=>r.statut===req.query.statut);
  result.sort((a,b)=>new Date(b.dateHeure)-new Date(a.dateHeure));
  addLog("GET","/reservations",200,req.apiKeyName);
  res.json({reservations:result,count:result.length,timestamp:new Date().toISOString()});
});

// MENU
app.get("/menu",requireApiKey,(req,res)=>{
  addLog("GET","/menu",200,req.apiKeyName);
  res.json({plats:MENU,total:MENU.length,disponibles:MENU.filter(p=>p.disponible).length,timestamp:new Date().toISOString()});
});

app.get("/menu/disponibles",requireApiKey,(req,res)=>{
  const{categorie}=req.query;
  let plats=MENU.filter(p=>p.disponible);
  if(categorie) plats=plats.filter(p=>p.categorie.toLowerCase()===categorie.toLowerCase());
  const parCategorie={};
  plats.forEach(p=>{
    if(!parCategorie[p.categorie]) parCategorie[p.categorie]=[];
    parCategorie[p.categorie].push({id:p.id,nom:p.nom,prix:p.prix,description:p.description});
  });
  addLog("GET","/menu/disponibles",200,req.apiKeyName);
  res.json({message:"Plats disponibles aujourd'hui",parCategorie,liste:plats,count:plats.length,timestamp:new Date().toISOString()});
});

app.get("/menu/indisponibles",requireApiKey,(req,res)=>{
  const indispo=MENU.filter(p=>!p.disponible);
  addLog("GET","/menu/indisponibles",200,req.apiKeyName);
  res.json({plats:indispo,count:indispo.length,timestamp:new Date().toISOString()});
});

app.patch("/menu/:id/disponibilite",requireApiKey,(req,res)=>{
  const{id}=req.params;
  const{disponible}=req.body;
  if(typeof disponible!=="boolean") return res.status(400).json({error:"'disponible' doit être true ou false.",code:"INVALID_VALUE"});
  const plat=MENU.find(p=>p.id===id);
  if(!plat) return res.status(404).json({error:`Plat '${id}' introuvable.`,code:"NOT_FOUND"});
  plat.disponible=disponible;
  addLog("PATCH",`/menu/${id}/disponibilite`,200,req.apiKeyName);
  res.json({success:true,message:`✅ "${plat.nom}" est maintenant ${disponible?"DISPONIBLE":"INDISPONIBLE"}.`,plat});
});

app.patch("/menu/reset",requireApiKey,(req,res)=>{
  MENU=MENU.map(p=>({...p,disponible:true}));
  addLog("PATCH","/menu/reset",200,req.apiKeyName);
  res.json({success:true,message:"✅ Tous les plats sont disponibles.",total:MENU.length});
});

app.get("/logs",requireApiKey,(req,res)=>{
  res.json({logs:apiLogs.slice(0,100),count:apiLogs.length});
});

// ═══════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════
app.listen(PORT,()=>{
  console.log(`\n🍽️  Le Plateau Doré — API v3.0 démarrée sur le port ${PORT}`);
  console.log(`📱 SMS Twilio : ${TWILIO_SID ? "✅ Configuré" : "❌ Non configuré"}`);
  console.log(`📞 Notifications vers : ${NOTIF_SMS || "Non défini"}`);
  console.log(`\n✅ Endpoints disponibles :`);
  console.log(`   GET  /tables/disponibles`);
  console.log(`   POST /reservations  → SMS automatique`);
  console.log(`   PUT  /reservations/:id/terminer → SMS automatique`);
  console.log(`   GET  /menu/disponibles\n`);
});
