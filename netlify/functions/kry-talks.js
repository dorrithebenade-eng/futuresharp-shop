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

  // PROFIEL per talk, vir die paneel se "Profiel"-knoppie: besoeke aan die
  // talk se bladsy (talk-besigtigings), betaalde aankope (talk-bestellings)
  // en kyke in die teater (talk-kyke). Net getalle; geen koper se
  // identiteit word teruggegee nie.
  const besig_store = kry_store("talk-besigtigings");
  const kyk_store = kry_store("talk-kyke");
  const best_store = kry_store("talk-bestellings");
  const { blobs: best_blobs } = await best_store.list();
  const bestellings = (await Promise.all(best_blobs.map((b) => best_store.get(b.key, { type: "json" }))))
    .filter((b) => b && b.status === "Betaal");

  await Promise.all(talks.map(async (t) => {
    const [besoeke, kyke] = await Promise.all([
      besig_store.get(t.slug, { type: "json" }),
      kyk_store.get(t.slug, { type: "json" }),
    ]);
    const hierdie = bestellings.filter((b) => b.slug === t.slug);
    const betaal = hierdie.filter((b) => (Number(b.totaal_sent) || 0) > 0);
    const datums = hierdie.map((b) => String(b.betaal_op || b.geskep_op || "").slice(0, 10)).filter(Boolean).sort();
    t.profiel = {
      besoeke_totaal: (besoeke && besoeke.totaal) || 0,
      besoeke_per_maand: (besoeke && besoeke.per_maand) || {},
      kopers: hierdie.length,
      betaalde_kopers: betaal.length,
      koepon_kopers: hierdie.filter((b) => b.koepon_kode).length,
      gratis_kopers: hierdie.filter((b) => !(Number(b.totaal_sent) > 0)).length,
      bruto_sent: betaal.reduce((som, b) => som + (Number(b.totaal_sent) || 0), 0),
      eerste_aankoop: datums[0] || null,
      laaste_aankoop: datums[datums.length - 1] || null,
      kyke_totaal: (kyke && kyke.totaal) || 0,
      kyke_per_maand: (kyke && kyke.per_maand) || {},
      verskillende_kykers: kyke && Array.isArray(kyke.kykers) ? kyke.kykers.length : 0,
    };
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ talks }),
  };
};
