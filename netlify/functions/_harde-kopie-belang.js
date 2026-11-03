// netlify/functions/_harde-kopie-belang.js
//
// Gedeelde helper vir "Laat weet my" by harde kopieë (November 2026).
//
// WAT DIT IS
//
// 'n Boek wat nog nie in harde kopie te koop is nie, kan in die paneelbord
// die merkie "Vra of mense 'n harde kopie wil hê" kry (vra_harde_kopie op die
// produk). Die boekbladsy wys dan "Binnekort" met 'n knoppie "Laat weet my".
// Wie daarop druk, word hier per boek aangeteken. Sodra die harde kopie
// beskikbaar is, stuur personeel met een knoppie 'n e-pos aan almal.
//
// DIE STORE
//
// "harde-kopie-belang", een sleutel per boek-slug:
//   { slug, inskrywings: [{ epos, taal, op, gestuur_op }] }
// gestuur_op is null tot die kennisgewing deurgekom het. Niemand kry dit twee
// keer nie, en wie se pos misluk het, word met die volgende druk weer probeer.
//
// Die lys word NIE uitgevee as die merkie afgeskakel word nie: afskakel
// versteek net die knoppie op die winkel.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "harde-kopie-belang";
const MAKS_INSKRYWINGS = 5000;
const EPOS_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_PATROON = /^[a-z0-9][a-z0-9-]{0,150}$/;

function store() {
  return kry_store(STORE_NAAM);
}

function skoon_epos(waarde) {
  const epos = String(waarde || "").trim().toLowerCase().slice(0, 200);
  return EPOS_PATROON.test(epos) ? epos : "";
}

function skoon_slug(waarde) {
  const slug = String(waarde || "").trim().toLowerCase();
  return SLUG_PATROON.test(slug) ? slug : "";
}

async function lees(slug) {
  const rekord = await store().get(slug, { type: "json" });
  if (rekord && Array.isArray(rekord.inskrywings)) return rekord;
  return { slug, inskrywings: [] };
}

async function skryf(rekord) {
  await store().setJSON(rekord.slug, rekord);
}

// Gee { nuut: true } as die e-pos bygevoeg is, { nuut: false } as dit reeds
// op die lys was.
async function teken_aan(slug, epos, taal) {
  const rekord = await lees(slug);
  if (rekord.inskrywings.some((i) => i.epos === epos)) return { nuut: false };
  if (rekord.inskrywings.length >= MAKS_INSKRYWINGS) return { nuut: false };
  rekord.inskrywings.push({
    epos,
    taal: taal === "en" ? "en" : "af",
    op: new Date().toISOString(),
    gestuur_op: null,
  });
  await skryf(rekord);
  return { nuut: true };
}

// Opsomming per boek vir die paneelbord.
async function opsomming() {
  const { blobs } = await store().list();
  const per_slug = {};
  for (const { key } of blobs) {
    const rekord = await store().get(key, { type: "json" });
    if (!rekord || !Array.isArray(rekord.inskrywings)) continue;
    const wag = rekord.inskrywings.filter((i) => !i.gestuur_op);
    const gestuur = rekord.inskrywings.filter((i) => i.gestuur_op);
    const jongste = rekord.inskrywings.reduce((m, i) => (i.op > m ? i.op : m), "");
    const laaste_stuur = gestuur.reduce((m, i) => (i.gestuur_op > m ? i.gestuur_op : m), "");
    per_slug[key] = { wag: wag.length, gestuur: gestuur.length, jongste, laaste_stuur };
  }
  return per_slug;
}

module.exports = { lees, skryf, teken_aan, opsomming, skoon_epos, skoon_slug };
