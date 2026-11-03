// netlify/functions/_afdelings.js
//
// AFDELINGS OP DIE BOEKE-BLADSY (November 2026). Die Boeke-bladsy wys die
// boeke in rye. Elke ry is 'n afdeling, en 'n boek se afdeling is sy REEKS
// (die bestaande veld "Reeks" in die produkvorm, bv. SPEEL-SLIM). 'n Boek
// sonder 'n eie reeks erf sy eweknie s'n. Hierdie lys gee elke reekskode 'n
// naam in albei tale, 'n kort beskrywing en 'n plek op die bladsy.
//
// STORE "afdelings", sleutel "lys": rekords
//   { kode, naam_af, naam_en, beskrywing_af, beskrywing_en, plek }
// kode is die reekskode in hoofletters. plek: 1 = bo-aan.

const { kry_store } = require("./_blob-store");

const store = () => kry_store("afdelings");

function skoon(rekord) {
  const teks = (w, max) => String(w == null ? "" : w).trim().slice(0, max);
  const kode = teks(rekord && rekord.kode, 60).toUpperCase();
  if (!kode) return null;
  const plek = Number(rekord.plek);
  return {
    kode,
    naam_af: teks(rekord.naam_af, 60),
    naam_en: teks(rekord.naam_en, 60),
    beskrywing_af: teks(rekord.beskrywing_af, 200),
    beskrywing_en: teks(rekord.beskrywing_en, 200),
    plek: Number.isFinite(plek) && plek > 0 ? Math.round(plek) : null,
  };
}

async function lees_afdelings() {
  return (await store().get("lys", { type: "json" })) || [];
}

async function skryf_afdelings(lys) {
  const gesien = new Set();
  const skoon_lys = [];
  for (const r of Array.isArray(lys) ? lys : []) {
    const s = skoon(r);
    if (s && !gesien.has(s.kode)) {
      gesien.add(s.kode);
      skoon_lys.push(s);
    }
  }
  await store().setJSON("lys", skoon_lys);
  return skoon_lys;
}

module.exports = { lees_afdelings, skryf_afdelings };
