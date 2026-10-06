// Personeel-beskermd — lys ALLE dokumente se metadata (nie die lêer-
// inhoud self nie) uit die "dokumente"-store, vir die paneelbord se
// "Dokumente"-afdeling.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["personeel", "vennoot"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie" };
  }

  try {
    const store = kry_store("dokumente");
    const { blobs } = await store.list();

    const dokumente = [];
    for (const { key } of blobs) {
      const rekord = await store.get(key, { type: "json" });
      if (rekord) dokumente.push(rekord);
    }

    // Alfabeties op naam. Hoof- en kleinletters en aksente tel nie, en
    // getalle sorteer as getalle (2 voor 10).
    dokumente.sort((a, b) =>
      String(a.naam || "").localeCompare(String(b.naam || ""), "af", { sensitivity: "base", numeric: true })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dokumente }),
    };
  } catch (fout) {
    console.error("Kon nie dokumente laai nie:", fout);
    return { statusCode: 500, body: "Kon nie dokumente laai nie" };
  }
};
