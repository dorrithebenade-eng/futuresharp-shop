// Publieke Function — bedien 'n dokument-lêer wat via laai-dokument-op.js
// gestoor is. Doelbewus GEEN rol-kontrole nie: die hele punt van hierdie
// afdeling is om dokumente per e-pos/WhatsApp aan mense BUITE die
// personeel (bv. voornemende outeurs) te stuur — hulle het nie 'n
// personeel-aanmelding nie, en moet die skakel gewoon kan oopmaak.
//
// Sekuriteit berus op die sleutel self: 'n tydstempel + ewekansige string
// wat nie raai-baar is nie (dieselfde patroon as kry-omslag.js). Vir
// werklik sensitiewe dokumente moet iemand liewer nie hierdie afdeling
// gebruik nie — dis vir dinge soos voorstel-dokumente wat in elk geval
// aan buitestanders gestuur gaan word.
//
// Gebruik: /.netlify/functions/kry-dokument?sleutel=<bestand_sleutel>&naam=<lêernaam>

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const parms = event.queryStringParameters || {};
  const sleutel = parms.sleutel;
  if (!sleutel) {
    return { statusCode: 400, body: "Ontbrekende 'sleutel'-parameter" };
  }

  try {
    const store = kry_store("dokument-lêers");
    const resultaat = await store.getWithMetadata(sleutel, { type: "arrayBuffer" });

    if (!resultaat) {
      return { statusCode: 404, body: "Dokument nie gevind nie" };
    }

    const inhoud_tipe = (resultaat.metadata && resultaat.metadata.inhoud_tipe) || "application/octet-stream";
    const base64_data = Buffer.from(resultaat.data).toString("base64");

    // Gebruik die mens-leesbare lêernaam (query-parameter) vir die
    // aflaai-venster se voorgestelde naam, indien verskaf — anders die
    // interne sleutel.
    const wys_naam = (parms.naam || sleutel).replace(/"/g, "");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": inhoud_tipe,
        "Content-Disposition": `attachment; filename="${wys_naam}"`,
        "Cache-Control": "public, max-age=3600",
      },
      body: base64_data,
      isBase64Encoded: true,
    };
  } catch (fout) {
    console.error("Kon nie dokument laai nie:", fout);
    return { statusCode: 500, body: "Kon nie dokument laai nie" };
  }
};
