// netlify/functions/kry-geskenk.js
//
// Publiek. Wys wat 'n geskenkkode bevat, vir geskenk.html (die ontvangbladsy
// en die geskenkbewys). Sien _geskenke.js.
//
// GET ?kode=GESKENK-XXXX-XXXX
// -> { kode, aan, van, boodskap, items: [{ produk_slug, titel, formaat, omslag }], ontvang }
//
// Die koper se e-pos en die bestelnommer word nie gewys nie: wie die kode
// het, mag sien wat die geskenk is en van wie, en niks meer nie.

const { kry_store } = require("./_blob-store");
const { lees_geskenk } = require("./_geskenke");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Metode nie toegelaat nie" };

  try {
    const rekord = await lees_geskenk((event.queryStringParameters || {}).kode);
    if (!rekord) {
      return { statusCode: 404, headers: JSON_KOP, body: JSON.stringify({ fout: "ONBEKEND" }) };
    }

    const katalogus = kry_store("katalogus");
    const items = [];
    for (const i of rekord.items || []) {
      const produk = await katalogus.get(i.produk_slug, { type: "json" });
      items.push({
        produk_slug: i.produk_slug,
        titel: (produk && produk.titel) || i.titel,
        formaat: i.formaat,
        omslag: (produk && produk.omslag) || "",
      });
    }

    return {
      statusCode: 200,
      headers: JSON_KOP,
      body: JSON.stringify({
        kode: rekord.kode,
        aan: rekord.aan || "",
        van: rekord.van || "",
        boodskap: rekord.boodskap || "",
        items,
        ontvang: !!rekord.ontvang,
      }),
    };
  } catch (fout) {
    console.error("kry-geskenk fout:", fout);
    return { statusCode: 500, headers: JSON_KOP, body: JSON.stringify({ fout: "FOUT" }) };
  }
};
