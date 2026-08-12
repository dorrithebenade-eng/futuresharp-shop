// Personeel-beskermd — lys alle uitnodigings (hangend + voltooi), nuutste
// eerste, sodat personeel 'n rekord het van wie uitgenooi is en of hulle
// reeds gereageer het.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { verval_op_van, is_verval } = require("./_uitnodiging-geldig");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const store = kry_store("uitnodigings");
  const { blobs } = await store.list();

  const rou = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }))
  );

  const nou = new Date();

  // filter(Boolean) is nie oorversigtigheid nie: list() is eventueel
  // konsekwent, dus kan 'n pas geskrapte sleutel nog gelys word terwyl
  // get() reeds null gee. Sonder die filter val die sort op null om.
  //
  // verval_op en is_verval word HIER opgelos, nie op die skerm nie —
  // dan bly die tydperk 'n bedienerbesluit en die skerm hoef dit nie
  // te ken nie.
  const uitnodigings = rou
    .filter(Boolean)
    .map((u) => ({
      ...u,
      verval_op: verval_op_van(u),
      is_verval: is_verval(u, nou),
    }));

  uitnodigings.sort((a, b) => new Date(b.geskep_op) - new Date(a.geskep_op));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitnodigings }),
  };
};
