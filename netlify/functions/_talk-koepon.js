// FutureSharp Talks — koepons vir talks.
//
// Talks gebruik dieselfde "koepons"-store en dieselfde velde as die boeke,
// met formaat_beperking "video". Die boeke se betaling aanvaar net "albei"
// of die presiese boekformaat, dus kan 'n talk-koepon nooit per ongeluk op
// 'n boek toegepas word nie, en andersom.
//
// Beperkings wat vir talks geld:
//   produk_slug  net hierdie talk (leeg = enige talk)
//   spreker_id   net talks van hierdie spreker (leeg = enige spreker)
//   koper_id_beperking, maks_gebruike, verval_op, aktief: soos by boeke
// En altyd: een keer per talk per koper.
//
// Die bedrag word hier, op die bediener, bereken; die blaaier kry net die
// uitslag om te wys.

const { kry_store } = require("./_blob-store");

// Gee { koepon, prys_na_sent } terug, of { fout_kode }.
async function toets_talk_koepon(kode_rou, gebruiker, talk) {
  const kode = String(kode_rou || "").trim().toUpperCase();
  if (!kode) return { fout_kode: "ONBEKEND" };
  const koepon = await kry_store("koepons").get(kode, { type: "json" });
  if (!koepon) return { fout_kode: "ONBEKEND" };
  if (!koepon.aktief) return { fout_kode: "ONAKTIEF" };
  if (koepon.verval_op && new Date(koepon.verval_op) < new Date()) return { fout_kode: "VERVAL" };
  if ((koepon.gebruike_tot_dusver || 0) >= koepon.maks_gebruike) return { fout_kode: "VOLGEBRUIK" };
  if (koepon.koper_id_beperking && koepon.koper_id_beperking !== gebruiker.id) return { fout_kode: "NIE_JOUNE" };
  if (koepon.formaat_beperking !== "video") return { fout_kode: "GEEN_TOEPASSING" };
  if (koepon.produk_slug && koepon.produk_slug !== talk.slug) return { fout_kode: "GEEN_TOEPASSING" };
  if (koepon.spreker_id && !(talk.spreker_ids || []).includes(koepon.spreker_id)) return { fout_kode: "GEEN_TOEPASSING" };
  if ((koepon.gebruike_geskiedenis || []).some((g) => g.koper_id === gebruiker.id && g.produk_slug === talk.slug)) {
    return { fout_kode: "REEDS_GEBRUIK" };
  }

  const prys = Math.round((talk.formate && talk.formate.video && talk.formate.video.prys_sent) || 0);
  let prys_na_sent = prys;
  if (koepon.tipe === "gratis") {
    prys_na_sent = 0;
  } else if (koepon.afslag_tipe === "vaste_bedrag") {
    prys_na_sent = Math.max(0, prys - Math.round(koepon.afslag_waarde));
  } else {
    prys_na_sent = Math.max(0, prys - Math.round((prys * koepon.afslag_waarde) / 100));
  }
  return { koepon, prys_na_sent };
}

// Teken die gebruik aan: die teller op, en wie dit teen watter talk gebruik
// het. Word geroep wanneer die talk werklik toegeken is (dadelik by R0,
// ná betaling andersins), sodat 'n betaling wat laat vaar word, nie 'n
// gebruik opmaak nie.
async function merk_talk_koepon_gebruik(kode, koper_id, slug, bestelnommer) {
  const store = kry_store("koepons");
  const koepon = await store.get(kode, { type: "json" });
  if (!koepon) return;
  if ((koepon.gebruike_geskiedenis || []).some((g) => g.bestelnommer === bestelnommer)) return;
  await store.setJSON(kode, {
    ...koepon,
    gebruike_tot_dusver: (koepon.gebruike_tot_dusver || 0) + 1,
    gebruike_geskiedenis: [
      ...(koepon.gebruike_geskiedenis || []),
      { koper_id, produk_slug: slug, bestelnommer, gebruik_op: new Date().toISOString() },
    ],
  });
}

module.exports = { toets_talk_koepon, merk_talk_koepon_gebruik };
