// PUBLIEK (geen aanmelding nodig nie) — die persoon wat die skakel
// ontvang het, het geen Netlify Identity-rekening nie. Ons gee doelbewus
// MINIMALE inligting terug (net rol_tipe + status) — nooit interne
// besonderhede soos wie dit geskep het nie.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const token = (event.queryStringParameters && event.queryStringParameters.token || "").trim();
  if (!token) {
    return { statusCode: 400, body: "Verpligte parameter: token" };
  }

  const store = kry_store("uitnodigings");
  const uitnodiging = await store.get(token, { type: "json" });

  if (!uitnodiging) {
    return { statusCode: 404, body: "Hierdie skakel is nie geldig nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rol_tipe: uitnodiging.rol_tipe,
      status: uitnodiging.status,
    }),
  };
};
