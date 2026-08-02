// netlify/functions/toets-epos.js
//
// Personeel-beskermd — stuur een toetspos, sodat die SMTP-opstelling
// bevestig kan word VOORDAT e-pos aan die webhook of enige ander vloei
// gekoppel word.
//
// Dit is doelbewus 'n aparte Function: 'n betaling se webhook is die
// verkeerde plek om 'n verbinding vir die eerste keer te toets.
//
// Gebruik: POST met { aan: "iemand@voorbeeld.co.za" }.
// Laat "aan" weg, dan stuur dit na EPOS_GEBRUIKER self.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { stuur_epos } = require("./_stuur-epos");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer = {};
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    // 'n Leë liggaam is geldig — dan stuur ons na onsself.
  }

  const aan = invoer.aan || process.env.EPOS_GEBRUIKER;
  if (!aan) {
    return {
      statusCode: 400,
      body: "Geen ontvanger nie, en EPOS_GEBRUIKER is nie opgestel nie",
    };
  }

  // Wys watter instellings gevind is — sonder die wagwoord.
  const opstelling = {
    gasheer: process.env.EPOS_GASHEER || null,
    poort: Number(process.env.EPOS_POORT) || 465,
    gebruiker: process.env.EPOS_GEBRUIKER || null,
    wagwoord_gestel: Boolean(process.env.EPOS_WAGWOORD),
  };

  const uitslag = await stuur_epos({
    aan,
    onderwerp: "Toetspos van Future Shop",
    opskrif: "Die e-posdiens werk",
    reels: [
      "Hierdie is 'n toetspos. Kry jy dit, is die opstelling korrek en kan die res van die kennisgewings daarop gebou word.",
      `Gestuur op ${new Date().toLocaleString("af-ZA", { timeZone: "Africa/Johannesburg" })}.`,
      "Gaan gerus jou gemorspos na indien dit nie in die inkassie is nie — dit sê iets oor die aflewerbaarheid.",
    ],
    knoppie: { teks: "Gaan na Future Shop", url: "https://futureshop.futuresharp.co.za" },
  });

  return {
    statusCode: uitslag.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...uitslag, aan, opstelling }),
  };
};
