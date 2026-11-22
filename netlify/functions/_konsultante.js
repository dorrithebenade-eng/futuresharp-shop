// netlify/functions/_konsultante.js
//
// DIE KONSULTANTE-REGISTER (November 2026). Een rekord per konsultant wat
// studievaardigheidskonsultasies vir Future Sharp doen, naas Dorrithé en
// Ignatius.
//
// STORE "konsultante", sleutel "lys": rekords
//   { kode, naam, epos, vraelyste: [instrument-ids], aktief }
//
//   kode       in die konsultant se registrasieskakel: /portaal/registreer?k=<kode>.
//              Die portaal stoor dit by die registrasie. a-z, 0-9 en "-",
//              2 tot 30 tekens. Verander dit nooit nadat die skakel uit is
//              nie: registrasies dra die ou kode.
//   epos       die e-pos waarmee sy by Netlify Identity aanmeld. Die rol
//              "konsultant" sê WAT sy mag doen; hierdie e-pos sê WIE sy is,
//              en dus watter registrasies hare is.
//   vraelyste  die instrument-ids wat sy vir 'n leerder of student mag kies.
//   aktief     'n onaktiewe konsultant kom nie meer in nie; haar
//              registrasies bly staan.
//
// DIE SLOT IS portaal.js, nie die skerm nie. Elke aksie van 'n konsultant
// word daar teen hierdie register getoets.

const { kry_store } = require("./_blob-store");

const store = () => kry_store("konsultante");

function skoon_kode(waarde) {
  const s = String(waarde == null ? "" : waarde).trim().toLowerCase();
  return /^[a-z0-9-]{2,30}$/.test(s) ? s : "";
}

function skoon_epos(waarde) {
  return String(waarde == null ? "" : waarde).trim().toLowerCase().slice(0, 200);
}

function skoon(rekord) {
  const r = rekord || {};
  const kode = skoon_kode(r.kode);
  if (!kode) return null;
  return {
    kode,
    naam: String(r.naam == null ? "" : r.naam).trim().slice(0, 120),
    epos: skoon_epos(r.epos),
    vraelyste: Array.isArray(r.vraelyste)
      ? [...new Set(r.vraelyste.map((v) => String(v || "").trim().slice(0, 80)).filter(Boolean))].slice(0, 20)
      : [],
    aktief: r.aktief !== false,
  };
}

async function lees_konsultante() {
  const lys = await store().get("lys", { type: "json" });
  return Array.isArray(lys) ? lys : [];
}

// Gooi 'n fout met .status 400 as die lys nie geldig is nie.
async function skryf_konsultante(rou) {
  const uit = [];
  const kodes = new Set();
  const eposse = new Set();
  for (const r of Array.isArray(rou) ? rou : []) {
    const s = skoon(r);
    if (!s) {
      const f = new Error("Elke konsultant het 'n kode nodig: kleinletters, syfers en '-', 2 tot 30 tekens");
      f.status = 400;
      throw f;
    }
    if (!s.naam) {
      const f = new Error(`Konsultant "${s.kode}" het 'n naam nodig`);
      f.status = 400;
      throw f;
    }
    if (kodes.has(s.kode)) {
      const f = new Error(`Die kode "${s.kode}" kom twee keer voor`);
      f.status = 400;
      throw f;
    }
    if (s.epos && eposse.has(s.epos)) {
      const f = new Error(`Die e-pos ${s.epos} kom twee keer voor`);
      f.status = 400;
      throw f;
    }
    kodes.add(s.kode);
    if (s.epos) eposse.add(s.epos);
    uit.push(s);
  }
  await store().setJSON("lys", uit);
  return uit;
}

// Die aktiewe konsultant met hierdie aanmeld-e-pos, of null.
async function konsultant_vir_epos(epos) {
  const e = skoon_epos(epos);
  if (!e) return null;
  return (await lees_konsultante()).find((k) => k.aktief !== false && k.epos === e) || null;
}

// Die konsultant met hierdie kode, aktief of nie, of null.
async function konsultant_vir_kode(kode) {
  const k = skoon_kode(kode);
  if (!k) return null;
  return (await lees_konsultante()).find((r) => r.kode === k) || null;
}

module.exports = {
  skoon_kode,
  lees_konsultante,
  skryf_konsultante,
  konsultant_vir_epos,
  konsultant_vir_kode,
};
