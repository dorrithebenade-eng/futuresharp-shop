// Personeel-beskermd — gee al 4 besoek-tellers terug vir vertoning in
// die paneelbord. Gee altyd 0 terug (nie 'n fout nie) as 'n bepaalde
// teller nog nooit geskep is nie (bv. splinternuwe werf, nog geen
// besoeke getel nie).

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

  const store = kry_store("statistieke");
  const [totaal, dag, week, maand, geskiedenis] = await Promise.all([
    store.get("totaal", { type: "json" }),
    store.get("daagliks", { type: "json" }),
    store.get("weekliks", { type: "json" }),
    store.get("maandeliks", { type: "json" }),
    store.get("maandelikse-geskiedenis", { type: "json" }),
  ]);

  const maande_geskiedenis = Array.isArray(geskiedenis?.maande) ? geskiedenis.maande : [];
  // Nuutste eerste vir vertoning
  maande_geskiedenis.sort((a, b) => (a.maand < b.maand ? 1 : -1));

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
    body: JSON.stringify({
      totaal: totaal?.telling || 0,
      vandag: dag?.telling || 0,
      hierdie_week: week?.telling || 0,
      hierdie_maand: maand?.telling || 0,
      maandelikse_geskiedenis: maande_geskiedenis,
    }),
  };
};
