// PUBLIEK — tel een besoek aan 'n talk-bladsy. FutureSharp Talks.
//
// Die telling leef in 'n EIE store ("talk-besigtigings"), nie op die talk se
// rekord nie. Die boeke tel op die produk self; by talks sou 'n wysiging in
// die paneelbord (wat die rekord veld vir veld opbou) die telling dan
// uitvee. So kan die twee nooit mekaar oorskryf nie.
//
// Rekord per slug: { totaal, per_maand: { "2026-09": 12, ... } }. Die maand
// in UTC, soos elke ander datum in die stelsel. Die Sprekerspaneel (Fase 5)
// lees dit.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const slug = String(invoer.slug || "").trim().toLowerCase();
  if (!slug) return { statusCode: 400, body: "Verpligte veld: slug" };

  // Tel net vir 'n talk wat bestaan en aktief is; 'n ou of verkeerde skakel
  // faal stil, want dit is 'n agtergrond-telling.
  const talk = await kry_store("talks").get(slug, { type: "json" });
  if (!talk || talk.aktief === false) return { statusCode: 204, body: "" };

  const store = kry_store("talk-besigtigings");
  const huidig = (await store.get(slug, { type: "json" })) || { totaal: 0, per_maand: {} };
  const maand = new Date().toISOString().slice(0, 7);
  const per_maand = { ...(huidig.per_maand || {}) };
  per_maand[maand] = (per_maand[maand] || 0) + 1;

  await store.setJSON(slug, { totaal: (huidig.totaal || 0) + 1, per_maand });

  return { statusCode: 204, body: "" };
};
