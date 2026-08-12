// Personeel-beskermd — skrap 'n HANGENDE uitnodiging, en niks anders nie.
//
// 'n VOLTOOIDE inskrywing bly staan. Dit is die rekord van wie wanneer
// aangesluit het, en dit is die enigste plek waar daardie datum leef —
// die register-inskrywing self dra net sy eie geskep_op. 'n Knoppie wat
// albei skrap, sou daardie rekord stilweg kan uitvee.
//
// Skrap is die tweede pad om 'n skakel dood te maak; die eerste is die
// vervaldatum, wat vanself werk. Hierdie een is vir die geval waar 'n
// skakel na die verkeerde persoon gegaan het en nie 14 dae kan wag nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

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

  const token = (invoer.token || "").trim();
  if (!token) {
    return { statusCode: 400, body: "Verpligte veld: token" };
  }

  const store = kry_store("uitnodigings");
  const uitnodiging = await store.get(token, { type: "json" });

  if (!uitnodiging) {
    return { statusCode: 404, body: "Hierdie uitnodiging bestaan nie" };
  }

  if (uitnodiging.status === "voltooi") {
    return {
      statusCode: 409,
      body: "'n Voltooide uitnodiging kan nie geskrap word nie — dit is die rekord van wie aangesluit het",
    };
  }

  await store.delete(token);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sukses: true, token }),
  };
};
