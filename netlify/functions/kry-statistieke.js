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

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { AFDELINGS, lees_tellers } = require("./_besoek-teller");

// Die lees-logika (en die reël dat 'n verstreke periode 0 wys) leef in
// _besoek-teller.js. Die winkel se velde bly op die boonste vlak soos
// voorheen; FutureSharp Talks s'n kom onder "fst".

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

  const [winkel, fst] = await Promise.all([lees_tellers(AFDELINGS.winkel), lees_tellers(AFDELINGS.fst)]);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
    body: JSON.stringify({ ...winkel, fst }),
  };
};
