// netlify/functions/kry-speelslim-instelling.js
//
// Die Speel-Slim-prystabel en -verdeling soos hulle nou geld. Rol: boekhouding.
//
// Gelees deur die Speel-Slim-blad onder Kwotasies. Dieselfde kry_instelling()
// as speelslim-aanvraag.js, sodat die skerm presies wys wat 'n nuwe aanvraag
// sal kry.
//
// DIE ONTVANGERS GAAN SAAM TERUG. Hulle name kom uit die begunstigde-register
// (los_ontvangers_op), en die skerm wys die verdeling met daardie name. As
// geen naam gevind word nie, is die lys leeg en waarsku die skerm: dan gaan
// alles na die hoofrekening.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_instelling, los_ontvangers_op } = require("./_speelslim");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const instelling = await kry_instelling();
  const verdeling = await los_ontvangers_op(instelling);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hoof_sent: Number(instelling.hoof_sent) || 0,
      ekstra_sent: Number(instelling.ekstra_sent) || 0,
      hosting_pct: Number(instelling.hosting_pct) || 0,
      // Vaste verdeling uit die store wen; anders die name uit die register.
      vaste_verdeling: Array.isArray(instelling.verdeling) && instelling.verdeling.length > 0,
      ontvangers: verdeling.map((v) => v.ontvanger),
      verdeling,
      bygewerk_op: instelling.bygewerk_op || null,
      bygewerk_deur: instelling.bygewerk_deur || null,
    }),
  };
};
