// netlify/functions/_akk.js
//
// DIE AKKREDITASIES-AREA (14 Okt 2026): aansoeke by instansies om ons
// kursusse te akkrediteer, met die dokumente per instansie. Gebou op die
// patroon van Governance (_gov.js), met eie stores en dieselfde rol
// (boekhouding: Dorrithé en Ignatius).
//
//   akk-dokumente   een JSON-rekord per dokument (metadata, geen inhoud)
//   akk-leers       die lêers self, onder dieselfde sleutel as die rekord
//   akk-sperdatums  een JSON-rekord per sperdatum
//   akk-aansoeke    een JSON-rekord per aansoek, sleutel = aansoeknommer
//   akk-instellings "vouers": die instansies en hul subvouers

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");

const ROL = "boekhouding";

const STORE = {
  dokumente: "akk-dokumente",
  leers: "akk-leers",
  sperdatums: "akk-sperdatums",
  aansoeke: "akk-aansoeke",
  instellings: "akk-instellings",
};

const ARGIEF = "7";

// Elke instansie kry dieselfde vier subvouers. Die instansies self is
// voorbeelde: Dorrithé en Ignatius kan instansies byvoeg en hernoem.
const STANDAARD_SUBS = ["Aansoeke", "Registrasies en sertifikate", "Kursusmateriaal", "Korrespondensie"];

function instansie(id, titel) {
  return { id, titel, instansie: true, subs: STANDAARD_SUBS.map((t, i) => ({ id: id + "." + (i + 1), titel: t })) };
}

const VERSTEK_VOUERS = [
  instansie("01", "SACE"),
  instansie("02", "ETDP SETA"),
  instansie("03", "HPCSA (CPD)"),
  instansie("04", "QCTO"),
  instansie("05", "Ander instansies"),
  { id: "06", titel: "Gedeelde kursusmateriaal", subs: [{ id: "06.1", titel: "Kursusmateriaal" }] },
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
  if (id === ARGIEF) return "07 Archive";
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
  return { antwoord: json(403, { fout: "Geen toegang tot Akkreditasies nie." }) };
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
  STANDAARD_SUBS,
  instansie,
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
