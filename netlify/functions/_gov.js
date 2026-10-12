// netlify/functions/_gov.js
//
// Gedeelde reëls vir die Governance-area (Oktober 2026): die vouerstruktuur,
// die stores en die rolkontrole. gov.js, gov-laai-op.js, gov-aflaai.js en
// gov-herinnering.js lees almal hier.
//
// TOEGANG: die boekhouding-rol, dieselfde as die Future Sharp-area. Dit is
// Dorrithé en Ignatius.
//
// DIE STORES
//   gov-dokumente   een JSON-rekord per dokument (metadata, geen inhoud)
//   gov-leers       die lêers self, onder dieselfde sleutel as die rekord
//   gov-sperdatums  een JSON-rekord per sperdatum
//   gov-besluite    een JSON-rekord per besluit, sleutel = besluitnommer
//   gov-instellings "vouers": die vouerstruktuur
//
// DIE VOUERSTRUKTUUR volg die Future Sharp Directory. Die hoofafdelings is
// vas; subvouers kan bygevoeg, hernoem en (leeg) verwyder word. Elke
// hoofafdeling het 'n eie Work in Progress (id "NN.W") en daar is een
// argief (id "7"). Hulle word nie gestoor nie: hulle bestaan altyd.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");

const ROL = "boekhouding";

const STORE = {
  dokumente: "gov-dokumente",
  leers: "gov-leers",
  sperdatums: "gov-sperdatums",
  besluite: "gov-besluite",
  instellings: "gov-instellings",
};

const ARGIEF = "7";

const VERSTEK_VOUERS = [
  { id: "01", titel: "Legal & Governance", subs: [
    { id: "01.1", titel: "Registration & CIPC" },
    { id: "01.2", titel: "Board & Resolutions" },
    { id: "01.3", titel: "Policies" },
    { id: "01.4", titel: "Intellectual Property" },
  ] },
  { id: "02", titel: "Finance", subs: [
    { id: "02.1", titel: "Annual Financial Statements" },
    { id: "02.2", titel: "Management Accounts" },
    { id: "02.3", titel: "Bank & Leger" },
    { id: "02.4", titel: "Budgets & Cash Flow" },
  ] },
  { id: "03", titel: "Tax & SARS", subs: [
    { id: "03.1", titel: "Income Tax & PBO" },
    { id: "03.2", titel: "18A & Donors" },
    { id: "03.3", titel: "VAT" },
    { id: "03.4", titel: "Payroll" },
  ] },
  { id: "04", titel: "Agreements", subs: [
    { id: "04.1", titel: "Funders & Donors" },
    { id: "04.2", titel: "Clients & Licensees" },
    { id: "04.3", titel: "Suppliers & Consultants" },
    { id: "04.4", titel: "Partners, MOUs & NDAs" },
  ] },
  { id: "05", titel: "People", subs: [
    { id: "05.1", titel: "Directors & Officers" },
    { id: "05.2", titel: "Staff & Contractors" },
    { id: "05.3", titel: "Volunteers" },
  ] },
  { id: "06", titel: "Programmes & Marketing", subs: [
    { id: "06.1", titel: "Programmes & Courses" },
    { id: "06.2", titel: "Organisational Training" },
    { id: "06.3", titel: "Marketing & Website" },
  ] },
];

async function kry_vouers() {
  try {
    const gestoor = await kry_store(STORE.instellings).get("vouers", { type: "json" });
    if (Array.isArray(gestoor) && gestoor.length) return gestoor;
  } catch (f) {
    console.error("Kon nie vouers lees nie:", f && f.message);
  }
  return VERSTEK_VOUERS;
}

async function stoor_vouers(vouers) {
  await kry_store(STORE.instellings).setJSON("vouers", vouers);
}

// Elke geldige plek waar 'n dokument kan staan: subvouers, Work in Progress
// per hoofafdeling, en die argief.
function geldige_vouer_ids(vouers) {
  const ids = new Set([ARGIEF]);
  for (const g of vouers) {
    ids.add(g.id + ".W");
    for (const s of g.subs) ids.add(s.id);
  }
  return ids;
}

function vouer_naam(vouers, id) {
  if (id === ARGIEF) return "7. Archive";
  for (const g of vouers) {
    if (id === g.id + ".W") return g.id + " " + g.titel + " · Work in Progress";
    for (const s of g.subs) if (s.id === id) return s.id + " " + s.titel;
  }
  return id;
}

// Gee { gebruiker } of { antwoord } terug. 401 vir geen of verlope token,
// 403 vir 'n geldige token sonder die rol.
async function kontroleer(event, context) {
  const { gebruiker, rede } = await kry_gebruiker_en_rol_uitslag(event, context, ROL);
  if (rede === "ok") return { gebruiker };
  if (rede === "geen_token") return { antwoord: json(401, { fout: "Sessie het verval. Meld weer aan." }) };
  return { antwoord: json(403, { fout: "Geen toegang tot Governance nie." }) };
}

function json(status, data) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(data),
  };
}

function nuwe_id(voorvoegsel) {
  return voorvoegsel + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function nou_iso() {
  return new Date().toISOString();
}

// Vandag in Suid-Afrika as JJJJ-MM-DD. Netlify loop op UTC; tussen 00:00 en
// 02:00 SA-tyd sou die UTC-datum nog gister wees.
function vandag_sa() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

function is_datum(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}

function dae_tussen(van, tot) {
  return Math.round((Date.parse(tot + "T00:00:00Z") - Date.parse(van + "T00:00:00Z")) / 86400000);
}

async function lees_alles(store_naam) {
  const store = kry_store(store_naam);
  const { blobs } = await store.list();
  const rekords = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json" }).catch(() => null)));
  return rekords.filter(Boolean);
}

module.exports = {
  ROL,
  STORE,
  ARGIEF,
  VERSTEK_VOUERS,
  kry_vouers,
  stoor_vouers,
  geldige_vouer_ids,
  vouer_naam,
  kontroleer,
  json,
  nuwe_id,
  nou_iso,
  vandag_sa,
  is_datum,
  dae_tussen,
  lees_alles,
};
