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

      if (!behoort_aan_koper || !is_betaal) continue;

      const items = Array.isArray(bestelling.items) ? bestelling.items : [];

      for (const boek_item of items) {
        // "My Boeke" wys e-boeke wat gekoop OF geleen is — harde kopieë
        // loop deur die drukker/POD-vloei, nie hier nie.
        if (boek_item.formaat !== "eboek" && boek_item.formaat !== "leen") continue;

        const is_leen = boek_item.formaat === "leen";
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
