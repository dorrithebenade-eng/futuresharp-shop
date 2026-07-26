// Personeel-beskermd — gee alle koepon-rekords terug vir die paneelbord se
// oorsig-lys. Nuutste eerste.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang nie — personeel-rol vereis" }) };
  }

  try {
    const store = kry_store("koepons");
    const { blobs } = await store.list();

    const koepons = (
      await Promise.all(blobs.map((item) => store.get(item.key, { type: "json" })))
    ).filter(Boolean);

    koepons.sort((a, b) => (b.geskep_op || "").localeCompare(a.geskep_op || ""));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ koepons }),
    };
  } catch (fout) {
    console.error("kry-koepons fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie koepons laai nie" }) };
  }
};
