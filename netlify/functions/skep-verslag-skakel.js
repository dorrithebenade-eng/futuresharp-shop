// Personeel-beskermd — genereer 'n AANHOUDENDE verslag-skakel vir 'n
// Outeur of Vennoot (nie eenmalig soos die uitnodigings-tokens nie — dié
// werk enige aantal kere, vir altyd, totdat personeel dit self skrap).
//
// Idempotent: as daar reeds 'n skakel vir hierdie entiteit bestaan, gee
// dieselfde token terug i.p.v. 'n nuwe een te skep — voorkom dat elke
// klik 'n vars, ander skakel maak wat die vorige een orphan laat.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const GELDIGE_ROLLE = ["outeur", "vennoot"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const rol_tipe = (invoer.rol_tipe || "").trim();
  const entiteit_id = (invoer.entiteit_id || "").trim();

  if (!GELDIGE_ROLLE.includes(rol_tipe)) {
    return { statusCode: 400, body: `Ongeldige rol_tipe — moet een van wees: ${GELDIGE_ROLLE.join(", ")}` };
  }
  if (!entiteit_id) {
    return { statusCode: 400, body: "Verpligte veld: entiteit_id" };
  }

  const indeks_store = kry_store("verslag-skakels-indeks");
  const indeks_sleutel = `${rol_tipe}:${entiteit_id}`;

  const bestaande = await indeks_store.get(indeks_sleutel, { type: "json" });
  if (bestaande && bestaande.token) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: bestaande.token, nuut: false }),
    };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const skakels_store = kry_store("verslag-skakels");

  await skakels_store.setJSON(token, {
    token,
    rol_tipe,
    entiteit_id,
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  });
  await indeks_store.setJSON(indeks_sleutel, { token });

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, nuut: true }),
  };
};
