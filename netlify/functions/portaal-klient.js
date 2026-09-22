// netlify/functions/portaal-klient.js
//
// Die registrasieportaal roep hierdie ná elke registrasie. GEEN ROL NIE:
// die portaal is 'n bediener, nie 'n aangemelde mens nie. Die slot is die
// geheime sleutel in die kop x-portaal-sleutel.
//
// Antwoord: { nommer: "K0031", gekoppel: true|false }

const { sleutel_klop, koppel_klient } = require("./_portaal");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const kop = (event.headers || {})["x-portaal-sleutel"];
  if (!sleutel_klop(kop)) return { statusCode: 401, body: "Geen toegang" };

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  try {
    const uit = await koppel_klient(invoer);
    return { statusCode: 200, headers: JSON_KOP, body: JSON.stringify(uit) };
  } catch (fout) {
    console.error("portaal-klient:", fout);
    return { statusCode: 400, headers: JSON_KOP, body: JSON.stringify({ fout: fout.message }) };
  }
};
