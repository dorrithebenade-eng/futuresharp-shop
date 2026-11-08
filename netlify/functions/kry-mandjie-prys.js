// netlify/functions/kry-mandjie-prys.js
//
// Publiek. Gee die mandjie se pryse soos die kassa dit sal bereken, voor
// enige koepon: die katalogus se prys per item, en 'n reekspakket waar al
// die boeke van 'n reeks in die mandjie is (sien _reekspakkette.js). Die
// mandjie en die betaalbladsy wys hiermee die regte totaal; begin-betaling.js
// bereken dit self weer, gesaghebbend.
//
// POST { items: [{ produk_slug, formaat, geskenk? }], koepon_kodes?: [..] }
// -> { items: [{ produk_slug, formaat, prys_sent, pakket_prys_sent?, pakket_id? }],
//      pakkette: [...toegepas], oorspronklike_totaal_sent, totaal_sent }

const { kry_store } = require("./_blob-store");
const { kry_aktiewe_pakkette, pas_pakkette_toe_per_groep, bou_wenke } = require("./_reekspakkette");
const { kry_formaat_data } = require("./_harde-kopie-opsies");
const { koepon_geld_vir_boek, pas_koepon_toe, sorteer_koepons, skoon_kodes } = require("./_koepon-velde");

// Ook vir die boeke se eie webblaaie (bv. speelslim.futuresharp.co.za).
const KOP = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// KOEPON-VOORSKOU (November 2026): net openbare veldtogkodes (aktief, nie
// verval nie, nie vir een koper of net vir bestaande lesers nie). Die
// werklike afslag word steeds deur begin-betaling.js bereken.
async function kry_openbare_koepons(kodes) {
  if (!kodes.length) return [];
  const store = kry_store("koepons");
  const uit = [];
  for (const kode of kodes.slice(0, 2)) {
    const k = await store.get(kode, { type: "json" });
    if (!k || !k.aktief || k.koper_id_beperking || k.vereis_besit || k.formaat_beperking === "video") continue;
    if (k.verval_op && new Date(k.verval_op) < new Date()) continue;
    if (k.gebruike_tot_dusver >= k.maks_gebruike) continue;
    uit.push(k);
  }
  return sorteer_koepons(uit);
}

// Die basisboek se titel en prys, vir "Voeg Grondslag by" in die mandjie.
async function verryk_wenke(wenke, katalogus) {
  for (const w of wenke) {
    if (w.soort !== "basis") continue;
    const p = await katalogus.get(w.slug, { type: "json" });
    const e = p && p.formate && p.formate.eboek;
    w.titel = p ? p.titel : w.slug;
    w.prys_sent = e && e.beskikbaar ? e.prys_sent : 0;
  }
  return wenke;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: KOP, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: KOP, body: "Metode nie toegelaat nie" };

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: KOP, body: "Ongeldige JSON" };
  }
  const ruwe = Array.isArray(invoer.items) ? invoer.items.slice(0, 50) : [];

  try {
    const katalogus = kry_store("katalogus");
    const items = [];
    for (const it of ruwe) {
      const slug = String(it.produk_slug || "").slice(0, 80);
      const formaat = String(it.formaat || "");
      const produk = slug ? await katalogus.get(slug, { type: "json" }) : null;
      const fd = kry_formaat_data(produk, formaat, it.opsie);
      items.push({
        produk_slug: slug,
        formaat,
        prys_sent: fd && fd.beskikbaar ? fd.prys_sent : 0,
        ...(it.geskenk === true ? { geskenk: true } : {}),
      });
    }

    const aktiewe = await kry_aktiewe_pakkette();
    const { per_item, toegepas } = pas_pakkette_toe_per_groep(items, aktiewe);
    const koepons = await kry_openbare_koepons(skoon_kodes(invoer));
    let oorspronklik = 0;
    let totaal = 0;
    let na_koepon = 0;
    const uit = items.map((it, i) => {
      oorspronklik += it.prys_sent;
      const p = per_item[i];
      const prys = p ? p.prys_sent : it.prys_sent;
      totaal += prys;
      let met_koepon = prys;
      if (!p || p.koepon_toegelaat) {
        for (const k of koepons) {
          if (!koepon_geld_vir_boek(k, it.produk_slug)) continue;
          if (!(k.formaat_beperking === "albei" || k.formaat_beperking === it.formaat)) continue;
          met_koepon = pas_koepon_toe(k, met_koepon);
        }
      }
      na_koepon += met_koepon;
      return p ? { ...it, pakket_id: p.pakket_id, pakket_prys_sent: p.prys_sent } : it;
    });

    return {
      statusCode: 200,
      headers: KOP,
      body: JSON.stringify({
        items: uit,
        pakkette: toegepas,
        wenke: await verryk_wenke(bou_wenke(items, aktiewe), katalogus),
        oorspronklike_totaal_sent: oorspronklik,
        totaal_sent: totaal,
        ...(koepons.length ? { koepons: koepons.map((k) => k.kode), totaal_na_koepon_sent: na_koepon, koepon_afslag_sent: totaal - na_koepon } : {}),
      }),
    };
  } catch (fout) {
    console.error("kry-mandjie-prys fout:", fout);
    return { statusCode: 500, headers: KOP, body: "Kon nie die mandjie bereken nie" };
  }
};
