// netlify/functions/kry-outeur-dokument.js
//
// Bedien 'n outeur se bankbrief of ID-afskrif aan die personeel.
//
// PERSONEEL ALLEEN, en strenger as enigiets anders op die werf. 'n
// Manuskrip is die outeur se werk; hierdie twee is sy IDENTITEIT en sy
// bankrekening. Daar is geen publieke pad hierheen nie en daar mag nooit
// een wees nie.
//
// DIE SLEUTEL KOM UIT DIE REKORD, nooit uit die versoek nie. Dieselfde
// reël as kry-indiening-leer.js: 'n aanvraag wat sy eie pad kan saamstuur,
// kan enigiets uit die store haal.
//
// GEEN KAS. Verander 'n outeur later sy bankbesonderhede en stuur 'n nuwe
// bankbrief, hou die nuwe lêer dieselfde sleutel — 'n gekaste weergawe sou
// die ou brief wys terwyl die rekord die nuwe een sê.
//
// DIE LEERS BLY IN `uitnodiging-leers`. Hulle is nie geskuif toe die
// outeursrekord geskep is nie: 'n kopie beteken twee plekke met dieselfde
// ID-afskrif, en dit is die laaste ding wat 'n mens van hierdie soort data
// wil hê. Die rekord dra die verwysing; die store bly die enigste plek.
//
// Gebruik: GET ?outeur_id=anna-nuweling&soort=bankbrief
// Die kliënt haal dit met sy Authorization-kop en maak 'n blob-URL — 'n
// gewone <a href> kan nie 'n kop stuur nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const SOORTE = ["bankbrief", "idafskrif"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Slegs GET" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const vrae = event.queryStringParameters || {};
  const outeur_id = String(vrae.outeur_id || "").trim();
  const soort = vrae.soort;

  // 'n Slug en niks anders nie. Dit gaan na store.get(), dus word dit
  // getoets eerder as vertrou.
  if (!/^[a-z0-9-]{1,120}$/.test(outeur_id)) {
    return { statusCode: 400, body: "Ongeldige outeur" };
  }
  if (!SOORTE.includes(soort)) {
    return { statusCode: 400, body: "Onbekende soort dokument" };
  }

  let outeur;
  try {
    outeur = await kry_store("outeurs").get(outeur_id, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die outeur lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die dokument laai nie" };
  }

  if (!outeur) {
    return { statusCode: 404, body: "Hierdie outeur bestaan nie" };
  }

  const inskrywing = (outeur.dokumente || {})[soort];
  if (!inskrywing || !inskrywing.sleutel) {
    return {
      statusCode: 404,
      body:
        soort === "bankbrief"
          ? "Daar is geen bankbrief by hierdie outeur nie"
          : "Daar is geen ID-afskrif by hierdie outeur nie",
    };
  }

  // Die store staan op die rekord, met 'n terugval vir rekords wat voor
  // hierdie veld geskryf is.
  const store_naam = inskrywing.store || "uitnodiging-leers";

  try {
    const resultaat = await kry_store(store_naam).getWithMetadata(inskrywing.sleutel, {
      type: "arrayBuffer",
    });

    if (!resultaat) {
      return { statusCode: 404, body: "Die dokument is nie gevind nie" };
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
    console.error("Kon nie die dokument bedien nie:", fout);
    return { statusCode: 500, body: "Kon nie die dokument laai nie" };
  }
};
