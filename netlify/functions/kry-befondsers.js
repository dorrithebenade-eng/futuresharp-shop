// netlify/functions/kry-befondsers.js
//
// Boekhouding-beskermd -- lys die befondsers en skenkers. Albei rolle kom
// saam; die skerm se twee oortjies filtreer. Die rekord gaan volledig deur.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_befondsers_store, lees_almal, is_toets_naam } = require("./_befondsers");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let almal;
  try {
    almal = await lees_almal(kry_befondsers_store());
  } catch (fout) {
    console.error("Kon nie die befondsers lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die befondsers laai nie" };
  }

  const befondsers = almal
    .map((b) => ({ ...b, aktief: b.aktief !== false, toets: is_toets_naam(b.naam) }))
    .sort((a, b) => {
      if (a.aktief !== b.aktief) return a.aktief ? -1 : 1;
      return String(a.naam).localeCompare(String(b.naam), "af-ZA");
    });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ befondsers }),
  };
};
