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
    const { blobs } = await bestellings_store.list();

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
        // Net e-boeke is relevant vir "My Boeke" — harde kopieë loop deur
        // die drukker/POD-vloei, nie hier nie.
        if (boek_item.formaat !== "eboek") continue;

        const vrystelling_datum = boek_item.vrystelling_datum || null;
        const beskikbaar_nou = !vrystelling_datum || vrystelling_datum <= vandag;

        my_boeke.push({
          bestelnommer: bestelling.bestelnommer,
          produk_slug: boek_item.produk_slug,
          titel: boek_item.titel,
          vrystelling_datum,
          beskikbaar_nou,
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
