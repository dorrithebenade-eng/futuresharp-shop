// Personeel-beskermd — wysig 'n bestaande talk in die "talks"-store.
// FutureSharp Talks. Die reëls leef in _talk-validering.js.
//
// DIE SLUG VERANDER NIE. Dit is die talk se adres
// (futuresharp.co.za/talks/<slug>), en sodra 'n spreker daardie skakel
// gedeel het, moet dit bly werk. Wil 'n mens tog 'n ander slug hê, skep 'n
// nuwe talk en skrap die ou een.

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

  const slug = String(invoer.slug || "").trim().toLowerCase();
  const store = kry_store("talks");
  const bestaande = slug ? await store.get(slug, { type: "json" }) : null;
  if (!bestaande) {
    return { statusCode: 404, body: `Geen talk met die slug "${slug}" nie` };
  }

  const resultaat = await bou_talk(invoer, bestaande);
  if (resultaat.fout) return { statusCode: resultaat.status, body: resultaat.fout };

  await store.setJSON(slug, resultaat.talk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resultaat.talk),
  };
};
