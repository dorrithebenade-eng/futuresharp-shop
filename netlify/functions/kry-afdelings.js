// PUBLIEK: die name en volgorde van die afdelings op die Boeke-bladsy.
// Sien _afdelings.js. Niks hier is sensitief nie.

const { lees_afdelings } = require("./_afdelings");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  try {
    const afdelings = await lees_afdelings();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ afdelings }),
    };
  } catch (fout) {
    console.error("Kon nie afdelings laai nie:", fout);
    return { statusCode: 500, body: "Kon nie afdelings laai nie" };
  }
};
