// netlify/functions/kry-befondsingsoorte.js
//
// Boekhouding-beskermd -- lys die befondsingsoorte, voorgelaaides ingesluit.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_soorte_store, lees_almal, is_toets_naam } = require("./_befondsingsoorte");

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
    almal = await lees_almal(kry_soorte_store());
  } catch (fout) {
    console.error("Kon nie die befondsingsoorte lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die befondsingsoorte laai nie" };
  }
  const soorte = almal
    .map((s) => ({ ...s, aktief: s.aktief !== false, toets: is_toets_naam(s.naam) }))
    .sort((a, b) => {
      if (a.aktief !== b.aktief) return a.aktief ? -1 : 1;
      return String(a.naam).localeCompare(String(b.naam), "af-ZA");
    });
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soorte }),
  };
};
