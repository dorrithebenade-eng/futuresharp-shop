// netlify/functions/_bankstate.js
//
// Ingevoerde bankstate en hul reels.
//
// EEN REKORD PER STAAT, met al sy reels daarin. 'n FNB-staat het 'n paar
// dosyn reels; een blob per staat hou die ketting en die kontroles bymekaar.
//
// DIE SLEUTEL: B-{laaste vier syfers}-{van}, byvoorbeeld B-2857-2025-06-13.
// Twee keer dieselfde staat invoer, gee dieselfde sleutel en word geweier.
//
// NET DIE LAASTE VIER SYFERS VAN DIE REKENING WORD GESTOOR. Genoeg om state
// van mekaar te onderskei; nie 'n rekeningnommer in die store nie.
//
// DIE STAND VAN 'N REEL
//
//   oop        nog nie verklaar nie
//   voorstel   die stelsel stel 'n kategorie voor; wag op bevestiging
//   gepas      verklaar deur iets wat die stelsel reeds ken:
//                vereffening  'n Paystack-uitbetaling na die hoofrekening
//                joernaal     'n bestaande handinskrywing
//   toegewys   'n joernaalinskrywing (bron "bank") is daarvoor geskep
//   oordrag    tussen eie rekeninge; nie inkomste of uitgawe nie
//   inligting  R0,00-reel van FNB; word nie geboek nie
//
// 'N REEL WORD NET EEN KEER GEBOEK. 'n Vereffening of joernaalinskrywing wat
// reeds aan 'n bankreel gekoppel is, word nie aan 'n tweede een gepas nie.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "bankstate";

// Future Sharp se rekening(e), aan die laaste vier syfers. 'n Staat van 'n
// ander rekening word net as toetsstaat aanvaar.
const EIE_REKENINGE = ["2857"];

function kry_bankstate_store() {
  return kry_store(STORE_NAAM);
}

function skep_sleutel(rekening4, van) {
  return `B-${String(rekening4).replace(/\D/g, "").slice(-4)}-${String(van).slice(0, 10)}`;
}

function verw(sleutel, nr) {
  return `${sleutel}#${nr}`;
}

// Die beskrywing sonder syfers en ekstra spasies: "Magtape Debit Vodacom
// 0463537674 B0501813" en volgende maand se weergawe word dieselfde patroon.
function patroon(beskrywing) {
  return String(beskrywing || "")
    .toLowerCase()
    .replace(/[0-9]+/g, "")
    .replace(/[^a-z* ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dae_tussen(a, b) {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
}

async function lees_almal(store) {
  const { blobs } = await store.list({ prefix: "B-" });
  return (
    await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
}

// Wat reeds aan 'n bankreel gekoppel is, oor alle state heen.
function gebruikte_verwysings(state) {
  const vereffenings = new Set();
  const joernaal = new Set();
  state.forEach((s) => (s.reels || []).forEach((r) => {
    if (r.stand === "gepas" && r.pas && r.pas.soort === "vereffening") vereffenings.add(r.pas.ref);
    if (r.stand === "gepas" && r.pas && r.pas.soort === "joernaal") joernaal.add(r.pas.ref);
    if (r.joernaal_sleutel) joernaal.add(r.joernaal_sleutel);
  }));
  return { vereffenings, joernaal };
}

// Patroon -> kategorie, uit vorige toewysings. Die jongste wen.
function voorstel_kaart(state) {
  const kaart = new Map();
  state
    .slice()
    .sort((a, b) => String(a.van).localeCompare(String(b.van)))
    .forEach((s) => (s.reels || []).forEach((r) => {
      if (r.stand === "toegewys" && r.kategorie_id) kaart.set(r.rigting + "|" + patroon(r.beskrywing), r.kategorie_id);
      if (r.stand === "oordrag") kaart.set(r.rigting + "|" + patroon(r.beskrywing), "oordrag");
    }));
  return kaart;
}

module.exports = {
  STORE_NAAM,
  EIE_REKENINGE,
  kry_bankstate_store,
  skep_sleutel,
  verw,
  patroon,
  dae_tussen,
  lees_almal,
  gebruikte_verwysings,
  voorstel_kaart,
};
