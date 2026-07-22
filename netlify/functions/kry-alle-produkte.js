// Personeel-beskermd — lys ALLE produkte (aktief én onaktief) uit die
// "katalogus"-store, vir die interne paneelbord. Verskil van
// kry-katalogus.js (wat publiek is en net aktiewe produkte wys) juis
// omdat personeel ook onaktiewe produkte moet kan sien om te wysig/
// heraktiveer.

const { getStore } = require("@netlify/blobs");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  try {
    const store = getStore("katalogus");
    const { blobs } = await store.list();

    const produkte = [];
    for (const { key } of blobs) {
      const rekord = await store.get(key, { type: "json" });
      if (rekord) produkte.push(rekord);
    }

    // Nuutste eerste
    produkte.sort((a, b) => (b.geskep_op || "").localeCompare(a.geskep_op || ""));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produkte }),
    };
  } catch (fout) {
    console.error("Kon nie alle produkte laai nie:", fout);
    return { statusCode: 500, body: "Kon nie produkte laai nie" };
  }
};
