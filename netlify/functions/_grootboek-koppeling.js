// netlify/functions/_grootboek-koppeling.js
// Weergawe 1 (16 Oktober 2026).
//
// Die koppeling van die rekenmeester se grootboekrekeninge aan Future Sharp se
// finansiele kategoriee. Een dokument: { rekeninge: { "2200/000": { kategorie,
// naam }, ... }, bygewerk_op, bygewerk_deur }.
//
// `kategorie` is 'n kategorie-id, "__oordrag" (tussen eie rekeninge) of leeg
// (nog nie gekoppel nie; daardie rekening se reels word nie toegewys nie).
//
// DIE KOPPELING LEEF OOR BOEKJARE HEEN. Die rekenmeester se rekeningkodes
// verander selde; wat verlede jaar 2200/000 Bankkoste was, is dit weer. Die
// koppeling kan enige tyd verander word; dit raak net toewysings wat daarna
// gedoen word, nooit 'n reel wat reeds toegewys is nie.

const { kry_store } = require("./_blob-store");

const STORE = "grootboek-koppeling";
const SLEUTEL = "koppeling";
const KODE = /^\d{4}\/\d{3}$/;

function kry_koppeling_store() {
  return kry_store(STORE);
}

async function lees(store) {
  const d = await store.get(SLEUTEL, { type: "json" });
  return d && typeof d.rekeninge === "object" && d.rekeninge ? d : { rekeninge: {} };
}

module.exports = { kry_koppeling_store, lees, SLEUTEL, KODE };
