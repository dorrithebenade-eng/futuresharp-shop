// netlify/functions/kry-indiening-leer.js
//
// Bedien 'n ingediende manuskrip of omslag aan die personeel, sodat sy dit
// kan lees voordat sy goedkeur.
//
// PERSONEEL ALLEEN. 'n Manuskrip wat nog nie goedgekeur is nie, is die
// outeur se ongepubliseerde werk — dit is die strengste soort lêer op die
// werf. Anders as kry-omslag.js, wat publiek is omdat 'n omslag op die
// winkelrak staan, mag hier niks sonder 'n rol deurkom nie.
//
// GEEN KAS. 'n Vervangde lêer hou dieselfde sleutel (die sleutel is die
// vormnommer), dus sou 'n gekaste weergawe die ou manuskrip wys nadat die
// outeur 'n nuwe een gestuur het. Dit is presies die fout wat 'n mens nie
// sou raaksien nie.
//
// Gebruik: GET ?nommer=BV-2026-0026&soort=manuskrip
// Die kliënt haal dit met sy Authorization-kop en maak 'n blob-URL — 'n
// gewone <a href> kan nie 'n kop stuur nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_indienings_store } = require("./_indienings");

const LEERS_STORE = "indienings-leers";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Slegs GET" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const vrae = event.queryStringParameters || {};
  const nommer = vrae.nommer;
  const soort = vrae.soort;

  if (!/^BV-\d{4}-\d{4}$/.test(String(nommer || ""))) {
    return { statusCode: 400, body: "Ongeldige vormnommer" };
  }
  if (soort !== "manuskrip" && soort !== "omslag") {
    return { statusCode: 400, body: "Onbekende soort lêer" };
  }

  // Die sleutel kom uit die REKORD, nie uit die versoek nie. So kan 'n
  // aanvraag nie 'n pad saamstuur wat iets anders uit die store haal nie.
  let rekord;
  try {
    rekord = await kry_indienings_store().get(nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer laai nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }

  const inskrywing = (rekord.leers || {})[soort];
  if (!inskrywing || !inskrywing.sleutel) {
    return { statusCode: 404, body: "Daar is nie so 'n lêer by hierdie vorm nie" };
  }

  try {
    const resultaat = await kry_store(LEERS_STORE).getWithMetadata(inskrywing.sleutel, {
      type: "arrayBuffer",
    });

    if (!resultaat) {
      return { statusCode: 404, body: "Die lêer is nie gevind nie" };
    }

    const tipe =
      (resultaat.metadata && resultaat.metadata.inhoud_tipe) ||
      inskrywing.inhoud_tipe ||
      "application/octet-stream";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": tipe,
        "Cache-Control": "no-store",
      },
      body: Buffer.from(resultaat.data).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (fout) {
    console.error("Kon nie die lêer bedien nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer laai nie" };
  }
};
