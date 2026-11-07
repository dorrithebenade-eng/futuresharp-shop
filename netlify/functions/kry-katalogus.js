// Publieke Function — geen rol-kontrole nodig nie, enigeen mag die
// katalogus deurblaai. Lys alle produkte met aktief = true uit die
// "katalogus"-Blobs-store.
//
// ONGELYS (November 2026): 'n produk met `ongelys: true` is te koop, maar
// verskyn nie in die lys nie (geen kaart, geen ry, geen tuisblad). Dit is
// net bereikbaar met ?slug=<slug>, wat koop.html en produk.html gebruik.
// So kan 'n boek met 'n eie webblad deur daardie webblad verkoop word
// sonder dat die winkel hom al wys.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  try {
    const store = kry_store("katalogus");
    const params = event.queryStringParameters || {};
    const slug = String(params.slug || "").trim();

    // Een produk volgens slug, ook as dit ongelys is. Onaktiewe produkte
    // bly onsigbaar.
    if (slug) {
      const rekord = await store.get(slug, { type: "json" });
      const produkte = rekord && rekord.aktief ? [rekord] : [];
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produkte }),
      };
    }

    const { blobs } = await store.list();

    const produkte = [];
    for (const { key } of blobs) {
      const rekord = await store.get(key, { type: "json" });
      if (rekord && rekord.aktief && rekord.ongelys !== true) {
        produkte.push(rekord);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produkte }),
    };
  } catch (fout) {
    console.error("Kon nie katalogus laai nie:", fout);
    return { statusCode: 500, body: "Kon nie katalogus laai nie" };
  }
};
