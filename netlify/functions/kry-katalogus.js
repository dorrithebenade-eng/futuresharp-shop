// Publieke Function — geen rol-kontrole nodig nie, enigeen mag die
// katalogus deurblaai. Lys alle produkte met aktief = true uit die
// "katalogus"-Blobs-store.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  try {
    const store = kry_store("katalogus");
    const { blobs } = await store.list();

    const produkte = [];
    for (const { key } of blobs) {
      const rekord = await store.get(key, { type: "json" });
      if (rekord && rekord.aktief) {
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
