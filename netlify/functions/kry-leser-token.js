// Koper-beskermd — reik 'n kort-leeftyd, eenmalige "leestoken" uit vir
// een spesifieke boek. NODIG omdat leser.html se <iframe> (vir die
// blaaier se ingeboude PDF-bekyker) geen Authorization-kopstuk kan
// stuur nie — 'n iframe se src is net 'n gewone GET-URL. Ons los dit op
// deur eers HIER (met 'n normale, geverifieerde fetch-versoek met
// Bearer-token) 'n kort token te kry, en dié dan as "?token="
// URL-parameter in die iframe se src te gebruik.
//
// Die token is 15 minute geldig en net vir hierdie een produk_slug +
// hierdie een koper bruikbaar — dit gee nie algemene toegang nie.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const GELDIGHEID_MS = 15 * 60 * 1000; // 15 minute

// Suiwer informatief — vir die leser se "X dae oor"-kennisgewing. GEE
// NIE toegang nie; kry-eboek-inhoud.js bly die enigste, gesaghebbende
// toegangskontrole. Gee null terug as die koper dit gekoop het (nie
// geleen nie) of glad nie hierdie boek s'n is nie.
async function kry_leen_status(gebruiker_id, produk_slug) {
  const bestellings_store = kry_store("bestellings");
  const { blobs } = await bestellings_store.list();

  for (const item of blobs) {
    const bestelling = await bestellings_store.get(item.key, { type: "json" });
    if (!bestelling) continue;
    const behoort_aan_koper =
      bestelling.koper && bestelling.koper.netlify_identity_id === gebruiker_id;
    if (!behoort_aan_koper || bestelling.status !== "Nuut") continue;

    const items = Array.isArray(bestelling.items) ? bestelling.items : [];
    const leen_item = items.find((i) => i.produk_slug === produk_slug && i.formaat === "leen");
    if (leen_item && leen_item.verval_op) {
      return { is_leen: true, verval_op: leen_item.verval_op, aktief: new Date(leen_item.verval_op) > new Date() };
    }
  }
  return null;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const produk_slug = event.queryStringParameters && event.queryStringParameters.produk_slug;
  if (!produk_slug) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ontbrekende 'produk_slug'-parameter" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const verval_op = Date.now() + GELDIGHEID_MS;

  try {
    const store = kry_store("leestokens");
    await store.setJSON(token, {
      gebruiker_id: gebruiker.id,
      gebruiker_epos: gebruiker.email,
      produk_slug,
      verval_op,
    });

    const leen_status = await kry_leen_status(gebruiker.id, produk_slug);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, verval_op, leen: leen_status }),
    };
  } catch (fout) {
    console.error("Kon nie leestoken skep nie:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie leestoken skep nie" }) };
  }
};
