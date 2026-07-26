// Personeel-beskermd — skrap 'n inskrywing uit die "ontwerp-admin"-store.
// Blokkeer NIE skrapping as dit reeds op 'n boek se verdeling gebruik
// word nie — die paneelbord wys eerder 'n waarskuwing vooraf aan
// personeel (kliëntkant, teen die produklys) en laat hulle self besluit.

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

  const ontwerp_admin_id = (invoer.ontwerp_admin_id || "").trim();
  if (!ontwerp_admin_id) {
    return { statusCode: 400, body: "Verpligte veld: ontwerp_admin_id" };
  }

  const store = kry_store("ontwerp-admin");

  const bestaande = await store.get(ontwerp_admin_id, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen inskrywing met ID "${ontwerp_admin_id}" gevind nie` };
  }

  await store.delete(ontwerp_admin_id);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: ontwerp_admin_id }),
  };
};
