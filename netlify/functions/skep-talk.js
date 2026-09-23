// Personeel-beskermd — skep 'n nuwe talk in die "talks"-store.
// FutureSharp Talks. Die reëls leef in _talk-validering.js.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { bou_talk } = require("./_talk-validering");

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
  invoer._gebruiker = gebruiker.email;

  const resultaat = await bou_talk(invoer, null);
  if (resultaat.fout) return { statusCode: resultaat.status, body: resultaat.fout };
  const { talk } = resultaat;

  const store = kry_store("talks");
  if (await store.get(talk.slug, { type: "json" })) {
    return { statusCode: 409, body: `Daar is reeds 'n talk met die slug "${talk.slug}"` };
  }

  await store.setJSON(talk.slug, talk);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(talk),
  };
};
