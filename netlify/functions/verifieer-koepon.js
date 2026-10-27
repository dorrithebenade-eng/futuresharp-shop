// Koper-beskermd (vereis aanmelding, soos begin-betaling.js) — gee 'n
// VOORSKOU van hoeveel 'n koepon die mandjie sal verminder, sonder om dit
// te registreer as gebruik nie. Die WERKLIKE, gesaghebbende berekening
// gebeur eers by begin-betaling.js self — hierdie Function bestaan net
// om die koper dadelik terugvoer te gee voor hulle na Paystack gaan.
//
// Aanvaar tot twee kodes (koepon_kodes), een van elke soort (veldtog en
// lojaliteit). koepon_kode (een kode) werk steeds vir ouer kliënte.

const { kry_store } = require("./_blob-store");
const {
  koepon_geld_vir_boek,
  koepon_soort,
  besit_voldoen,
  kry_besitte_eboeke,
  skoon_kodes,
  pas_koepon_toe,
  sorteer_koepons,
} = require("./_koepon-velde");
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

  const kodes = skoon_kodes(invoer);
  const items = Array.isArray(invoer.items) ? invoer.items : [];
  const fout = (fout_kode, kode) => ({
    statusCode: 400,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fout_kode, kode: kode || null }),
  });

  if (!kodes.length) return fout("VERPLIGTE_KODE");
  if (kodes.length > 2) return fout("TE_VEEL");

  // Elke kode word apart getoets; 'n fout noem die kode wat dit veroorsaak.
  const koeponStore = kry_store("koepons");
  const koepons = [];
  for (const kode of kodes) {
    const koepon = await koeponStore.get(kode, { type: "json" });
    if (!koepon || koepon.formaat_beperking === "video") return fout("ONGELDIG", kode);
    if (!koepon.aktief) return fout("ONAKTIEF", kode);
    if (koepon.verval_op && new Date(koepon.verval_op) < new Date()) return fout("VERVAL", kode);
    if (koepon.gebruike_tot_dusver >= koepon.maks_gebruike) return fout("VOLGEBRUIK", kode);
    if (koepon.koper_id_beperking && koepon.koper_id_beperking !== gebruiker.id) return fout("NIE_JOUNE", kode);
    koepons.push(koepon);
  }

  // Een van elke soort: 'n veldtogkode en 'n lojaliteitskode mag saam.
  if (koepons.length === 2 && koepon_soort(koepons[0]) === koepon_soort(koepons[1])) {
    return fout("TWEE_VAN_SOORT", koepons[1].kode);
  }

  if (koepons.some((k) => k.vereis_besit)) {
    const besitte = await kry_besitte_eboeke(kry_store("bestellings"), gebruiker.id);
    const sonder_besit = koepons.find((k) => !besit_voldoen(k, besitte));
    if (sonder_besit) return fout("BESIT_NODIG", sonder_besit.kode);
  }

  const gesorteer = sorteer_koepons(koepons);
  const katalogusStore = kry_store("katalogus");
  let oorspronklike_totaal_sent = 0;
  let nuwe_totaal_sent = 0;
  const pas_iewers = new Set();

  for (const kliënt_item of items) {
    const produk = await katalogusStore.get(kliënt_item.produk_slug, { type: "json" });
    if (!produk) continue;
    const formaat_data = produk.formate && produk.formate[kliënt_item.formaat];
    if (!formaat_data || !formaat_data.beskikbaar) continue;

    const item_prys_sent = formaat_data.prys_sent;
    oorspronklike_totaal_sent += item_prys_sent;
    let verkoop_prys_sent = item_prys_sent;

    for (const koepon of gesorteer) {
      const kom_ooreen =
        koepon_geld_vir_boek(koepon, produk.slug) &&
        (koepon.formaat_beperking === "albei" || koepon.formaat_beperking === kliënt_item.formaat);
      const reeds_gebruik = (koepon.gebruike_geskiedenis || []).some(
        (g) => g.koper_id === gebruiker.id && g.produk_slug === produk.slug
      );
      if (kom_ooreen && !reeds_gebruik) {
        pas_iewers.add(koepon.kode);
        verkoop_prys_sent = pas_koepon_toe(koepon, verkoop_prys_sent);
      }
    }
    nuwe_totaal_sent += verkoop_prys_sent;
  }

  const pas_nêrens = koepons.find((k) => !pas_iewers.has(k.kode));
  if (pas_nêrens) return fout("GEEN_TOEPASSING", pas_nêrens.kode);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      geldig: true,
      kodes: koepons.map((k) => k.kode),
      oorspronklike_totaal_sent,
      nuwe_totaal_sent,
      afslag_sent: oorspronklike_totaal_sent - nuwe_totaal_sent,
    }),
  };
};
