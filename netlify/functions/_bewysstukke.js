// netlify/functions/_bewysstukke.js
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

module.exports = { STORE_NAAM, MAKS_GREPE, TIPES, kry_bewys_store, skep_sleutel, vee_uit_vir };
