// netlify/functions/_toekennings.js
// Weergawe 1 (25 September 2026).
//
// TOEKENNINGS: die ooreenkoms tussen 'n befondser en 'n projek.
//
// 'n Befondser hoort nie direk aan 'n projek nie. Tussen hulle staan die
// ooreenkoms: hoeveel, vir watter tydperk, met of sonder voorwaardes, en
// watter soort befondsing dit is. Een befondser kan meer as een toekenning
// he, en een projek meer as een befondser.
//
// DIE KONTROLELYS IS 'N AFSKRIF. By die skep word die befondsingsoort se twee
// lyste (wat uitgereik word, watter rekords gehou moet word) na die toekenning
// gekopieer. 'n Latere wysiging aan die soort verander dus nie 'n toekenning
// wat reeds halfpad of klaar is nie. Elke toekenning kan ook eie items kry.
//
// DIE BEFONDSER EN DIE SOORT VERANDER NIE NA DIE SKEP NIE. Albei bepaal die
// kontrolelys; 'n verkeerde keuse word reggestel deur die toekenning te skrap
// en oor te begin.
//
// 'N TOETS: 'n toekenning op 'n toetsprojek. Dit gaan saam met die projek weg.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "toekennings";

function kry_toekennings_store() {
  return kry_store(STORE_NAAM);
}

function nuwe_id() {
  return "TK-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

// Die soort se lyste word kontrolelys-items. `klaar` en die datum word later
// afgemerk; `eie` is 'n item wat net vir hierdie toekenning bygevoeg is.
function kontrolelys_uit_soort(soort) {
  const items = [];
  (soort.uitreik || []).forEach((i) => items.push({
    id: "u-" + i.id, lys: "uitreik", naam: i.naam, dokument: false,
    klaar: false, datum: "", deur: "", nota: "", eie: false,
  }));
  (soort.rekords || []).forEach((i) => items.push({
    id: "r-" + i.id, lys: "rekords", naam: i.naam, dokument: Boolean(i.dokument),
    klaar: false, datum: "", deur: "", nota: "", eie: false,
  }));
  return items;
}

// "R 25 000,00", "25000", "25 000.50" -> sent. Null as dit nie 'n bedrag is nie.
function sent_uit(teks) {
  if (typeof teks === "number") return Number.isFinite(teks) && teks >= 0 ? Math.round(teks) : null;
  const skoon = String(teks || "").replace(/[R\s\u00A0]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(skoon)) return null;
  const [heel, breuk = ""] = skoon.split(".");
  return Number(heel) * 100 + Number((breuk + "00").slice(0, 2));
}

async function lees_almal(store) {
  const { blobs } = await store.list({ prefix: "TK-" });
  return (
    await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
}

module.exports = {
  STORE_NAAM,
  kry_toekennings_store,
  nuwe_id,
  kontrolelys_uit_soort,
  sent_uit,
  lees_almal,
};
