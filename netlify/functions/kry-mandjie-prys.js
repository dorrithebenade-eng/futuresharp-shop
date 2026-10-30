// netlify/functions/kry-mandjie-prys.js
//
// Publiek. Gee die mandjie se pryse soos die kassa dit sal bereken, voor
// enige koepon: die katalogus se prys per item, en 'n reekspakket waar al
// die boeke van 'n reeks in die mandjie is (sien _reekspakkette.js). Die
// mandjie en die betaalbladsy wys hiermee die regte totaal; begin-betaling.js
// bereken dit self weer, gesaghebbend.
//
// POST { items: [{ produk_slug, formaat }] }
// -> { items: [{ produk_slug, formaat, prys_sent, pakket_prys_sent?, pakket_id? }],
//      pakkette: [...toegepas], oorspronklike_totaal_sent, totaal_sent }

const { kry_store } = require("./_blob-store");
const { kry_aktiewe_pakkette, pas_pakkette_toe } = require("./_reekspakkette");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const ruwe = Array.isArray(invoer.items) ? invoer.items.slice(0, 50) : [];

  try {
    const katalogus = kry_store("katalogus");
    const items = [];
    for (const it of ruwe) {
      const slug = String(it.produk_slug || "").slice(0, 80);
      const formaat = String(it.formaat || "");
      const produk = slug ? await katalogus.get(slug, { type: "json" }) : null;
      const fd = produk && produk.formate && produk.formate[formaat];
      items.push({ produk_slug: slug, formaat, prys_sent: fd && fd.beskikbaar ? fd.prys_sent : 0 });
    }

    const { per_item, toegepas } = pas_pakkette_toe(items, await kry_aktiewe_pakkette());
    let oorspronklik = 0;
    let totaal = 0;
    const uit = items.map((it, i) => {
      oorspronklik += it.prys_sent;
      const p = per_item[i];
      totaal += p ? p.prys_sent : it.prys_sent;
      return p ? { ...it, pakket_id: p.pakket_id, pakket_prys_sent: p.prys_sent } : it;
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ items: uit, pakkette: toegepas, oorspronklike_totaal_sent: oorspronklik, totaal_sent: totaal }),
    };
  } catch (fout) {
    console.error("kry-mandjie-prys fout:", fout);
    return { statusCode: 500, body: "Kon nie die mandjie bereken nie" };
  }
};
