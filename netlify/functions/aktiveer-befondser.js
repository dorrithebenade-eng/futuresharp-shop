// netlify/functions/aktiveer-befondser.js
//
// Heraktiveer een gedeaktiveerde befondser of skenker. Rol: boekhouding.
// 'n Eie leer, sodat 'n gewone wysiging nooit stilweg heraktiveer nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_befondsers_store } = require("./_befondsers");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }
  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const nommer = String(invoer.nommer || "").trim();
  const store = kry_befondsers_store();
  let rekord;
  try {
    rekord = await store.get(nommer, { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die befondser laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Befondser nie gevind nie" };
  rekord = { ...rekord, aktief: true, bygewerk_op: new Date().toISOString() };
  try {
    await store.setJSON(nommer, rekord);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie aktiveer nie" };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ befondser: rekord }),
  };
};
