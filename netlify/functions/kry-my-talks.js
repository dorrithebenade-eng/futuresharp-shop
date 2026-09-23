// Koper-beskermd — die talks wat die aangemelde koper besit, vir My Teater
// en vir die koopknoppie op die talk-bladsy. FutureSharp Talks.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { lys_my_talks } = require("./_talk-besit");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const { gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["koper", "personeel"]);
  if (!gebruiker) return { statusCode: 401, body: "Meld eers aan" };

  const besit = await lys_my_talks(gebruiker.id);
  const talks_store = kry_store("talks");
  const talks = (await Promise.all(
    besit.map(async (b) => {
      const t = await talks_store.get(b.slug, { type: "json" });
      // 'n Gekoopte talk bly in die Teater, ook as dit later gedeaktiveer
      // word: die koper het dit permanent gekoop.
      if (!t) return null;
      return {
        slug: t.slug,
        titel: t.titel,
        spreker: t.spreker,
        kategoriee: t.kategoriee || [],
        omslag: t.omslag || "",
        duur_sekondes: (t.formate && t.formate.video && t.formate.video.duur_sekondes) || 0,
        verkry_op: b.verkry_op,
      };
    })
  ))
    .filter(Boolean)
    .sort((a, b) => String(b.verkry_op).localeCompare(String(a.verkry_op)));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ talks }),
  };
};
