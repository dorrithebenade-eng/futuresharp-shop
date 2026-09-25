// netlify/functions/kry-bewys.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- gee een bewysstuk terug. ?sleutel=<sleutel>
//
// Anders as kry-dokument.js is hierdie een NIE publiek nie en word dit nie
// in 'n kas gehou nie: 'n bewysstuk kan persoonlike inligting dra.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_bewys_store } = require("./_bewysstukke");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  const sleutel = String((event.queryStringParameters || {}).sleutel || "");
  if (!sleutel) return { statusCode: 400, body: "Geen sleutel nie" };

  try {
    const uit = await kry_bewys_store().getWithMetadata(sleutel, { type: "arrayBuffer" });
    if (!uit) return { statusCode: 404, body: "Bewysstuk nie gevind nie" };
    const tipe = (uit.metadata && uit.metadata.inhoud_tipe) || "application/octet-stream";
    const naam = String((uit.metadata && uit.metadata.naam) || "bewysstuk").replace(/"/g, "");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": tipe,
        "Content-Disposition": `attachment; filename="${naam}"`,
        "Cache-Control": "private, no-store",
      },
      body: Buffer.from(uit.data).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (fout) {
    console.error("Kon nie die bewysstuk laai nie:", fout);
    return { statusCode: 500, body: "Kon nie die bewysstuk laai nie" };
  }
};
