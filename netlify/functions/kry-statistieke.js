// Personeel EN vennoot — gee al 4 besoek-tellers terug vir vertoning in
// die paneelbord.
//
// 'N VENNOOT LEES DIE TELLERS, HY HERSTEL HULLE NIE. Hierdie Function
// gee net terug; herstel-statistiek.js skryf, en die bly personeel
// alleen. Die ↺-knoppie word in vennoot-modus versteek sodat niemand
// 'n knoppie druk wat in elk geval 403 gee nie.
//
// Dieselfde paar as kry-dokumente.js (lees: personeel + vennoot) teenoor
// skrap-dokument.js (skryf: personeel alleen). Gee altyd 0 terug (nie 'n fout nie) as 'n bepaalde
// teller nog nooit geskep is nie (bv. splinternuwe werf, nog geen
// besoeke getel nie).

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_periode_sleutels } = require("./_periode-sleutels");

// 'n Teller word deur tel-besoek.js herstel, en tel-besoek.js loop SLEGS
// wanneer iemand die tuisblad laai. Kom daar 'n dag, 'n week of 'n maand
// lank geen besoek nie, staan die ou rekord ongeroerd in die store — en
// 'n lees wat net na `telling` kyk, wys daardie ou getal onder 'n vars
// etiket. Op 2 September 2026 het "Hierdie maand" so Augustus se 513
// gewys terwyl "Hierdie week" op 162 gestaan het, wat onmoontlik is.
//
// Vandaar: pas die gestoorde sleutel nie by die huidige periode nie, is
// die telling verstreke en die antwoord 0. Die Function bly LEES-ALLEEN
// — dit stel niks reg nie; die eerste besoek doen dit.
function telling_indien_huidig(rekord, huidige_sleutel) {
  if (!rekord || rekord.sleutel !== huidige_sleutel) return 0;
  return rekord.telling || 0;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, [
    "personeel",
    "vennoot",
  ]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie" };
  }

  const sleutels_nou = kry_periode_sleutels();

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
      vandag: telling_indien_huidig(dag, sleutels_nou.daagliks),
      hierdie_week: telling_indien_huidig(week, sleutels_nou.weekliks),
      hierdie_maand: telling_indien_huidig(maand, sleutels_nou.maandeliks),
      maandelikse_geskiedenis: maande_geskiedenis,
    }),
  };
};
