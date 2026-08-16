// netlify/functions/kry-instellings.js
//
// Die maatskappy se besonderhede. Rol: boekhouding.
//
// Word deur TWEE skerms gelees: die Instellings-blad, wat hulle wysig, en die
// faktuurdokument, wat hulle druk. Dieselfde bron, sodat 'n adreswysiging op
// één plek gebeur.
//
// `bank_onvolledig` gaan saam terug sodat die skerm kan waarsku sonder om
// self te besluit wat "onvolledig" beteken. Die toets leef op een plek.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maatskappy, bank_onvolledig } = require("./_instellings");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const maatskappy = await kry_maatskappy();

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maatskappy,
      bank_onvolledig: bank_onvolledig(maatskappy),
    }),
  };
};
