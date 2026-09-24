// netlify/functions/aktiveer-projek.js
//
// Heraktiveer een gedeaktiveerde projek. Rol: boekhouding.
//
// 'n Eie leer en nie 'n veld op die vorm nie: sou stoor-projek.js `aktief`
// aanvaar, sou elke wysiging aan 'n gedeaktiveerde projek dit stilweg
// heraktiveer. Dieselfde rede as aktiveer-fin-kategorie.js.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_projekte_store } = require("./_projekte");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const id = String(invoer.id || "").trim();
  if (!id) return { statusCode: 400, body: "Verpligte veld: id" };

  const store = kry_projekte_store();

  let projek = null;
  try {
    projek = await store.get(id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie projek "${id}" lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die projek laai nie" };
  }
  if (!projek) return { statusCode: 404, body: "Projek nie gevind nie" };

  const rekord = { ...projek, aktief: true, bygewerk_op: new Date().toISOString() };

  try {
    await store.setJSON(id, rekord);
  } catch (fout) {
    console.error(`Kon nie projek "${id}" aktiveer nie:`, fout);
    return { statusCode: 500, body: "Kon nie die projek aktiveer nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projek: rekord }),
  };
};
