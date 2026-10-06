// Personeel-beskermd — wysig 'n dokument se naam en beskrywing in die
// "Dokumente"-afdeling.
//
// NET DIE METADATA. Die lêer self en sy sleutel bly onaangeraak, sodat 'n
// aflaaiskakel wat reeds per e-pos of WhatsApp gestuur is, steeds werk.
// 'n Ander lêer is 'n nuwe oplaai.

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

  const id = String(invoer.id || "").trim();
  const naam = String(invoer.naam || "").trim().slice(0, 200);
  const beskrywing = String(invoer.beskrywing || "").trim().slice(0, 500);

  if (!id) return { statusCode: 400, body: "Verpligte veld: id" };
  if (!naam) return { statusCode: 400, body: "Die naam mag nie leeg wees nie" };

  try {
    const store = kry_store("dokumente");
    const rekord = await store.get(id, { type: "json" });
    if (!rekord) return { statusCode: 404, body: "Hierdie dokument bestaan nie" };

    rekord.naam = naam;
    rekord.beskrywing = beskrywing;
    rekord.gewysig_op = new Date().toISOString();
    rekord.gewysig_deur = gebruiker.epos || gebruiker.email || gebruiker.id || "";

    await store.setJSON(id, rekord);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dokument: rekord }),
    };
  } catch (fout) {
    console.error("Kon nie dokument wysig nie:", fout);
    return { statusCode: 500, body: "Kon nie die dokument wysig nie" };
  }
};
