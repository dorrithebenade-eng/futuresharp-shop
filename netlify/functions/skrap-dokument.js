// Personeel-beskermd — skrap 'n dokument (metadata-rekord + binêre lêer)
// uit die "Dokumente"-afdeling.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const { id } = invoer;
  if (!id) {
    return { statusCode: 400, body: "Verpligte veld: id" };
  }

  try {
    const dokumente_store = kry_store("dokumente");
    const rekord = await dokumente_store.get(id, { type: "json" });

    if (rekord && rekord.bestand_sleutel) {
      const lêer_store = kry_store("dokument-lêers");
      await lêer_store.delete(rekord.bestand_sleutel);
    }

    await dokumente_store.delete(id);

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (fout) {
    console.error("Kon nie dokument skrap nie:", fout);
    return { statusCode: 500, body: "Kon nie dokument skrap nie" };
  }
};
