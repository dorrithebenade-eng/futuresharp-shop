// PUBLIEK (geen aanmelding nodig nie) — die persoon wat die skakel
// ontvang het, het geen Netlify Identity-rekening nie. Ons gee doelbewus
// MINIMALE inligting terug (net rol_tipe + status) — nooit interne
// besonderhede soos wie dit geskep het nie.

const { kry_store } = require("./_blob-store");
const { is_verval } = require("./_uitnodiging-geldig");

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

  // 410 en nie 404 nie: die skakel WAS geldig en het verval. Die bladsy
  // sê dit dan so, want "nie geldig nie" laat iemand dink hy het die
  // adres verkeerd oorgetik.
  if (is_verval(uitnodiging)) {
    return { statusCode: 410, body: "Hierdie skakel het verval" };
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
