// Koper-beskermd (vereis aanmelding, soos begin-betaling.js) — gee 'n
// VOORSKOU van hoeveel 'n koepon die mandjie sal verminder, sonder om dit
// te registreer as gebruik nie. Die WERKLIKE, gesaghebbende berekening
// gebeur eers by begin-betaling.js self — hierdie Function bestaan net
// om die koper dadelik terugvoer te gee voor hulle na Paystack gaan.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const kode = (invoer.koepon_kode || "").trim().toUpperCase();
  const items = Array.isArray(invoer.items) ? invoer.items : [];

  if (!kode) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fout_kode: "VERPLIGTE_KODE" }),
    };
  }

  const koeponStore = kry_store("koepons");
  const koepon = await koeponStore.get(kode, { type: "json" });

  if (!koepon) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fout_kode: "ONGELDIG" }),
    };
  }
  if (!koepon.aktief) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fout_kode: "ONAKTIEF" }),
    };
  }
  if (koepon.verval_op && new Date(koepon.verval_op) < new Date()) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fout_kode: "VERVAL" }),
    };
  }
  if (koepon.gebruike_tot_dusver >= koepon.maks_gebruike) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fout_kode: "VOLGEBRUIK" }),
    };
  }

  const katalogusStore = kry_store("katalogus");
  let oorspronklike_totaal_sent = 0;
  let nuwe_totaal_sent = 0;
  let enige_item_pas = false;

  for (const kliënt_item of items) {
    const produk = await katalogusStore.get(kliënt_item.produk_slug, { type: "json" });
    if (!produk) continue;
    const formaat_data = produk.formate && produk.formate[kliënt_item.formaat];
    if (!formaat_data || !formaat_data.beskikbaar) continue;

    const item_prys_sent = formaat_data.prys_sent;
    oorspronklike_totaal_sent += item_prys_sent;

    const kom_ooreen =
      (!koepon.produk_slug || koepon.produk_slug === produk.slug) &&
      (koepon.formaat_beperking === "albei" || koepon.formaat_beperking === kliënt_item.formaat);

    const reeds_gebruik = (koepon.gebruike_geskiedenis || []).some(
      (g) => g.koper_id === gebruiker.id && g.produk_slug === produk.slug
    );

    if (kom_ooreen && !reeds_gebruik) {
      enige_item_pas = true;
      let verkoop_prys_sent = item_prys_sent;
      if (koepon.tipe === "gratis") {
        verkoop_prys_sent = 0;
      } else if (koepon.afslag_tipe === "vaste_bedrag") {
        verkoop_prys_sent = Math.max(0, item_prys_sent - koepon.afslag_waarde);
      } else {
        verkoop_prys_sent = Math.max(
          0,
          item_prys_sent - Math.round((item_prys_sent * koepon.afslag_waarde) / 100)
        );
      }
      nuwe_totaal_sent += verkoop_prys_sent;
    } else {
      nuwe_totaal_sent += item_prys_sent;
    }
  }

  if (!enige_item_pas) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fout_kode: "GEEN_TOEPASSING" }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      geldig: true,
      oorspronklike_totaal_sent,
      nuwe_totaal_sent,
      afslag_sent: oorspronklike_totaal_sent - nuwe_totaal_sent,
    }),
  };
};
