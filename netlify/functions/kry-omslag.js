// Publieke Function — bedien 'n omslagbeeld wat via laai-omslag-op.js
// gestoor is. Geen rol-kontrole nodig nie: enigeen wat die winkel besoek
// moet omslae kan sien, presies soos enige ander beeld op die werf.
//
// Gebruik: <img src="/.netlify/functions/kry-omslag?bestand=my-boek-123.jpg">
// Hierdie pad word outomaties deur laai-omslag-op.js gegenereer en in
// die produk se "omslag"-veld gestoor.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const sleutel = event.queryStringParameters && event.queryStringParameters.bestand;
  if (!sleutel) {
    return { statusCode: 400, body: "Ontbrekende 'bestand'-parameter" };
  }

  try {
    const store = kry_store("omslae");
    const resultaat = await store.getWithMetadata(sleutel, { type: "arrayBuffer" });

    if (!resultaat) {
      return { statusCode: 404, body: "Omslag nie gevind nie" };
    }

    const inhoud_tipe = (resultaat.metadata && resultaat.metadata.inhoud_tipe) || "image/jpeg";
    const base64_data = Buffer.from(resultaat.data).toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": inhoud_tipe,
        // Omslae verander nooit van inhoud sodra hulle gestoor is nie (nuwe
        // oplaai = nuwe lêernaam), so hulle mag vir 'n lang tyd gekas word.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: base64_data,
      isBase64Encoded: true,
    };
  } catch (fout) {
    console.error("Kon nie omslag laai nie:", fout);
    return { statusCode: 500, body: "Kon nie beeld laai nie" };
  }
};
