// PUBLIEK: die name en volgorde van die afdelings op die Boeke-bladsy.
// Sien _afdelings.js. Niks hier is sensitief nie.

const { lees_afdelings, lees_band } = require("./_afdelings");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  try {
    const [afdelings, band] = await Promise.all([lees_afdelings(), lees_band()]);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ afdelings, band }),
    };
  } catch (fout) {
    console.error("Kon nie afdelings laai nie:", fout);
    return { statusCode: 500, body: "Kon nie afdelings laai nie" };
  }
};
