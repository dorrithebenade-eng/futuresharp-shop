// Personeel-beskermd — lys alle talks uit die "talks"-store, nuutste eerste.
// FutureSharp Talks. Die publieke lys vir die FST-blad kom in Fase 3 en sal
// net aktiewe talks wys.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const store = kry_store("talks");
  const video_store = kry_store("talk-video");
  const { blobs } = await store.list();
  const talks = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }))))
    .filter(Boolean)
    .sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")));

  // Die video se stand (Fase 4) leef in 'n eie store; die paneel wys dit in
  // die lys. Net die velde wat die paneel nodig het.
  await Promise.all(talks.map(async (t) => {
    const v = await video_store.get(t.slug, { type: "json" });
    t.video_stand = v
      ? { stand: v.stand, duur_sekondes: v.duur_sekondes || null, fout: v.fout || null, speel_nog_ou: Boolean(v.speel_playback_id) }
      : { stand: "geen" };
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ talks }),
  };
};
