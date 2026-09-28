// netlify/functions/_bewysstukke.js
// Weergawe 2 (28 September 2026): bewyse ook by joernaalinskrywings (met die
// hand, en die wat uit 'n bankreel geskep is). Die lys leef op die inskrywing
// self as `dokumente`, dieselfde vorm as by 'n kontrolelys-item. By 'n
// bankinskrywing word die lys na die bankreel gespieel, sodat die Bankstate-pil
// dit kan wys sonder om die joernaal te lees. Die joernaal bly die bron.
// Weergawe 1 (25 September 2026).
//
// BEWYSSTUKKE by 'n toekenning se kontrolelys-items: die getekende ooreenkoms,
// die bywoningsregister, die leerderlys.
//
// DIESELFDE PATROON AS DIE DOKUMENTE-AFDELING (laai-dokument-op.js): die
// binere leer in 'n eie store, en 'n kort verwysing op die item self. Die lys
// word dus vinnig gelaai sonder om elke leer te haal.
//
// MAAR NIE PUBLIEK NIE. kry-dokument.js bedien sy leers aan enigiemand met die
// skakel, want daardie dokumente is bedoel vir buitestanders. 'n Bewysstuk kan
// persoonlike inligting dra (name, ID-nommers van leerders); kry-bewys.js gee
// dit net aan iemand met die boekhouding-rol.
//
// 4 MB PER LEER, soos die dokumente en die omslae. 'n Groter PDF moet eers
// kleiner gemaak word (skandeer teen 'n laer resolusie).

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "bewysstukke";
const MAKS_GREPE = 4 * 1024 * 1024;

const TIPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
};

function kry_bewys_store() {
  return kry_store(STORE_NAAM);
}

function skep_sleutel(toekenning_id, item_id, tipe) {
  const skoon = (s) => String(s || "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60);
  return `${skoon(toekenning_id)}/${skoon(item_id)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${TIPES[tipe] || "bin"}`;
}

// Vee al die bewysstukke van een toekenning uit. 'n Fout by een leer keer nie
// die res nie; die log se watter een agtergebly het.
async function vee_uit_vir(toekenning) {
  const store = kry_bewys_store();
  for (const item of toekenning.kontrolelys || []) {
    for (const d of item.dokumente || []) {
      try {
        await store.delete(d.sleutel);
      } catch (fout) {
        console.error(`Kon nie bewysstuk ${d.sleutel} uitvee nie:`, fout);
      }
    }
  }
}

// Vee 'n lys bewyse uit die store uit. Soos hierbo: een fout keer nie die res nie.
async function vee_lys_uit(dokumente) {
  const store = kry_bewys_store();
  for (const d of dokumente || []) {
    if (!d || !d.sleutel) continue;
    try {
      await store.delete(d.sleutel);
    } catch (fout) {
      console.error(`Kon nie bewysstuk ${d.sleutel} uitvee nie:`, fout);
    }
  }
}

// Vee die bewyse van een joernaalinskrywing uit, VOOR die inskrywing self weg
// is: die lys leef op die rekord. 'n Leesfout word gelog en laat die skrap
// van die inskrywing deurgaan; daar bly dan hoogstens 'n wees in die store.
async function vee_uit_vir_joernaal(jstore, sleutel) {
  if (!sleutel) return;
  try {
    const rekord = await jstore.get(sleutel, { type: "json" });
    if (rekord) await vee_lys_uit(rekord.dokumente);
  } catch (fout) {
    console.error(`Kon nie die bewyse van ${sleutel} lees nie:`, fout);
  }
}

// Die kort lys wat na 'n bankreel gespieel word: net wat nodig is om te wys
// en af te laai.
function kort_lys(dokumente) {
  return (dokumente || []).map((d) => ({ sleutel: d.sleutel, naam: d.naam }));
}

// Spieel 'n bankinskrywing se bewyse na sy reel. Beste poging: misluk dit,
// wys die Bankstate-pil 'n verouderde lys, maar die joernaal is reg.
async function spieel_na_bankreel(rekord) {
  if (!rekord || rekord.bron !== "bank" || !rekord.bankreel) return;
  const { kry_bankstate_store } = require("./_bankstate");
  const [sleutel, nr] = String(rekord.bankreel).split("#");
  try {
    const store = kry_bankstate_store();
    const staat = await store.get(sleutel, { type: "json" });
    if (!staat) return;
    const r = (staat.reels || []).find((x) => x.nr === Number(nr));
    if (!r || r.joernaal_sleutel !== rekord.sleutel) return;
    r.dokumente = kort_lys(rekord.dokumente);
    await store.setJSON(sleutel, staat);
  } catch (fout) {
    console.error(`Kon nie die bewyse na bankreel ${rekord.bankreel} spieel nie:`, fout);
  }
}

module.exports = {
  STORE_NAAM, MAKS_GREPE, TIPES, kry_bewys_store, skep_sleutel, vee_uit_vir,
  vee_lys_uit, vee_uit_vir_joernaal, kort_lys, spieel_na_bankreel,
};
