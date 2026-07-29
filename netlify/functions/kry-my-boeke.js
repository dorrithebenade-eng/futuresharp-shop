// netlify/functions/kry-my-boeke.js
//
// Koper-beskermde Function: gee 'n lys van die aangemelde koper se
// suksesvol-betaalde e-boeke terug, vir vertoning op "My Boeke".
//
// Gebruik dieselfde patroon as die ander beskermde Functions:
//   - _rol-kontrole.js verifieer die Bearer-token direk teen Netlify se
//     Identity-API (GoTrue) en bevestig die "koper"-rol (outomaties
//     toegeken by registrasie deur identity-registrasie.js).
//   - _blob-store.js gee 'n Blobs-winkel terug met die eksplisiete
//     siteID/token-omweg (i.p.v. Netlify se onbetroubare outo-inspuiting).

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ fout: "Metode nie toegelaat nie" }),
    };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return {
      statusCode: 401,
      body: JSON.stringify({ fout: "Meld eers aan om jou boeke te sien" }),
    };
  }

  try {
    const bestellings_store = kry_store("bestellings");
    const katalogus_store = kry_store("katalogus");
    const { blobs } = await bestellings_store.list();

    // Kas produk-opsoeke binne hierdie versoek — 'n koper kan dieselfde
    // boek oor verskeie bestellings besit, geen rede om dit twee keer
    // uit Blobs te lees nie.
    const produk_kas = new Map();
    async function kry_produk(slug) {
      if (produk_kas.has(slug)) return produk_kas.get(slug);
      const produk = await katalogus_store.get(slug, { type: "json" });
      produk_kas.set(slug, produk);
      return produk;
    }

    const vandag = new Date().toISOString().slice(0, 10);
    const my_boeke = [];
    const koepon_store = kry_store("koepons");

    // Versamel eers al hierdie koper se BETAALDE bestellings — ons het dit
    // twee keer nodig: (1) om te weet watter boeke reeds as volle eboek
    // besit word (sodat ons nooit 'n opgradering-aanbod op iets wys wat
    // klaar besit word nie), en (2) die gewone lys-bou-lus hieronder.
    const koper_bestellings = [];
    for (const item of blobs) {
      const ruwe = await bestellings_store.get(item.key);
      if (!ruwe) continue;

      let bestelling;
      try {
        bestelling = JSON.parse(ruwe);
      } catch {
        continue; // ignoreer onverwagte/korrupte rekords
      }

      const behoort_aan_koper =
        bestelling.koper &&
        bestelling.koper.netlify_identity_id === gebruiker.id;

      // "Nuut" = status ná suksesvolle betaling (sien paystack-webhook.js)
      const is_betaal = bestelling.status === "Nuut";

      if (behoort_aan_koper && is_betaal) koper_bestellings.push(bestelling);
    }

    const reeds_besit_as_eboek = new Set();
    for (const bestelling of koper_bestellings) {
      for (const boek_item of bestelling.items || []) {
        if (boek_item.formaat === "eboek") reeds_besit_as_eboek.add(boek_item.produk_slug);
      }
    }

    for (const bestelling of koper_bestellings) {
      const items = Array.isArray(bestelling.items) ? bestelling.items : [];

      for (const boek_item of items) {
        // "My Boeke" wys e-boeke wat gekoop OF geleen is — harde kopieë
        // loop deur die drukker/POD-vloei, nie hier nie.
        if (boek_item.formaat !== "eboek" && boek_item.formaat !== "leen") continue;

        const is_leen = boek_item.formaat === "leen";

        // As die koper hierdie boek intussen ook as volle eboek gekoop
        // het (bv. via die leen-na-koop-opgradering), moet die ou
        // leen-kaart nie ook nog apart wys nie — net die "Gekoop"-kaart.
        if (is_leen && reeds_besit_as_eboek.has(boek_item.produk_slug)) continue;

        const vrystelling_datum = boek_item.vrystelling_datum || null;
        const beskikbaar_nou = !vrystelling_datum || vrystelling_datum <= vandag;

        // Omslag en outeur kom van die katalogus-rekord, nie van die
        // bestelling nie — bestellings stoor net wat op koop-tydstip
        // nodig was. Val gragvol terug indien die produk intussen
        // gedeaktiveer/verwyder is.
        const produk = await kry_produk(boek_item.produk_slug);

        let leen_aktief = null;
        let dae_oor = null;
        if (is_leen && boek_item.verval_op) {
          const verval_datum = new Date(boek_item.verval_op);
          leen_aktief = verval_datum > new Date();
          dae_oor = Math.max(0, Math.ceil((verval_datum - new Date()) / (1000 * 60 * 60 * 24)));
        }

        // Leen-na-koop-opgradering: net gewys as (a) hierdie 'n leen is,
        // (b) die koper NIE reeds die eboek self ook besit nie, (c) die
        // outomaties-geskepte koepon nog werklik geldig is, EN (d) óf die
        // leen reeds verval het, óf daar nog net 5 dae of minder oor is —
        // vroeër as dit voel dit soos 'n te-vroeë upsell, nie 'n tydige
        // herinnering nie.
        const OPGRADERING_WYS_DAE_VOOR_VERVAL = 5;
        const binne_wys_venster =
          leen_aktief === false || (leen_aktief === true && dae_oor !== null && dae_oor <= OPGRADERING_WYS_DAE_VOOR_VERVAL);

        let opgradering = null;
        if (is_leen && boek_item.opgradering_koepon_kode && binne_wys_venster) {
          const koepon = await koepon_store.get(boek_item.opgradering_koepon_kode, { type: "json" });
          const nog_geldig =
            koepon &&
            koepon.aktief &&
            koepon.gebruike_tot_dusver < koepon.maks_gebruike &&
            (!koepon.verval_op || new Date(koepon.verval_op) > new Date());

          const eboek_formaat = produk && produk.formate && produk.formate.eboek;

          if (nog_geldig && eboek_formaat && eboek_formaat.beskikbaar) {
            opgradering = {
              koepon_kode: koepon.kode,
              afslag_sent: koepon.afslag_waarde,
              verval_op: koepon.verval_op,
              eboek_prys_sent: eboek_formaat.prys_sent,
            };
          }
        }

        my_boeke.push({
          bestelnommer: bestelling.bestelnommer,
          produk_slug: boek_item.produk_slug,
          titel: boek_item.titel,
          outeur: (produk && produk.outeur) || "",
          omslag: (produk && produk.omslag) || "",
          vrystelling_datum,
          beskikbaar_nou,
          is_leen,
          verval_op: is_leen ? boek_item.verval_op || null : null,
          leen_aktief,
          dae_oor,
          opgradering,
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ boeke: my_boeke }),
    };
  } catch (fout) {
    console.error("kry-my-boeke fout:", fout);
    return {
      statusCode: 500,
      body: JSON.stringify({ fout: "Kon nie boeke oplaai nie, probeer later weer" }),
    };
  }
};
