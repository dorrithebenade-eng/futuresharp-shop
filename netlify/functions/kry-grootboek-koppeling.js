// netlify/functions/kry-grootboek-koppeling.js
// Weergawe 1 (16 Oktober 2026).
//
// Gee die koppeling van grootboekrekeninge aan kategoriee. Rol: boekhouding.
// Sien _grootboek-koppeling.js.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const K = require("./_grootboek-koppeling");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  try {
    const d = await K.lees(K.kry_koppeling_store());
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) };
  } catch (fout) {
    console.error("Kon nie die koppeling lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die koppeling laai nie" };
  }
};
