// netlify/functions/_koppelings.js
// Weergawe 1 (25 September 2026).
//
// KOPPELINGS: watter joernaalinskrywing by watter toekenning hoort.
//
// DIE BRONNE BLY ONAANGERAAK. 'n Faktuur, 'n Paystack-transaksie of 'n
// bankreel weet niks van projekte nie, en hoef ook nie. Die koppeling leef in
// 'n eie store, met die inskrywing se identiteit as sleutel.
//
// DIE IDENTITEIT VAN 'N INSKRYWING. Hand- en bankinskrywings het 'n sleutel.
// Die afgeleide inskrywings (faktuur, uitbetaling, winkel, Paystack) word elke
// keer uit hul bron opgebou en het nie een nie; hul identiteit is die bron,
// die datum, die rigting en die verwysing (die faktuurnommer of die
// Paystack-verwysing). Vir 'n uitbetaling, wat geen verwysing dra nie, is dit
// die begunstigde en die faktuurnommer uit die beskrywing, sonder die dele.
//
// DIE BEDRAG REIS SAAM. Die koppeling onthou die bedrag, rigting en datum op
// die oomblik van koppel, sodat 'n toekenning se "ontvang" en "bestee" opgetel
// kan word sonder om die hele joernaal van voor af te bou.
//
// EEN TOEKENNING PER INSKRYWING. Geld kan nie twee keer bestee word nie.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "koppelings";

function kry_koppelings_store() {
  return kry_store(STORE_NAAM);
}

function inskrywing_id(r) {
  if (r.sleutel) return String(r.sleutel);
  const kop = String(r.beskrywing || "").split(" (")[0];
  return [r.bron || "", r.datum || "", r.rigting || "", r.verwysing || kop].join("|");
}

// Die id as blob-sleutel: base64url, want 'n id kan / en | bevat.
function sleutel_van(id) {
  return "K-" + Buffer.from(String(id), "utf8").toString("base64url");
}

async function lees_almal(store) {
  const { blobs } = await store.list({ prefix: "K-" });
  return (
    await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
}

// Vee die koppeling van een inskrywing uit, as daar een is. Vir wanneer die
// inskrywing self verdwyn (ontdoen by die bank, skrap in die joernaal).
async function vee_uit_vir_inskrywing(id) {
  try {
    await kry_koppelings_store().delete(sleutel_van(id));
  } catch (fout) {
    console.error(`Kon nie die koppeling van ${id} uitvee nie:`, fout);
  }
}

module.exports = {
  STORE_NAAM,
  kry_koppelings_store,
  inskrywing_id,
  sleutel_van,
  lees_almal,
  vee_uit_vir_inskrywing,
};
