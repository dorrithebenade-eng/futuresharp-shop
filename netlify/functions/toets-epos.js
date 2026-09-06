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
//
// ─────────────────────────────────────────────────────────────────────────
// DIE MERK. Voeg { merk: "faktuur" } by om die BOEKHOUDING se posbus te
// toets in plaas van die winkel s'n.
//
// Daar is twee SMTP-aanmeldings. Die winkel stuur uit
// EPOS_GEBRUIKER (futureshop@); 'n faktuur en 'n kwotasie stuur uit
// EPOS_ADMIN_GEBRUIKER (admin@) — sien MERKE in _stuur-epos.js.
//
// Tot 6 September 2026 het hierdie Function ALTYD die winkel s'n getoets.
// 'n Geslaagde toets het dus niks gesê oor die posbus waardeur elke faktuur
// en elke kwotasie gaan — en presies daardie een was stil.
//
// Die opstelling in die antwoord wys nou die merk se EIE waardes, sodat 'n
// mens sien watter gasheer, poort en gebruiker werklik gebruik is.

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

  // Watter posbus word getoets. Enigiets anders as "faktuur" is die winkel
  // s'n — dieselfde terugval as kry_merk() in _stuur-epos.js.
  const merk = invoer.merk === "faktuur" ? "faktuur" : "winkel";
  const admin = merk === "faktuur";

  // Wys watter instellings gevind is — sonder die wagwoord. Die waardes is
  // die MERK se eie, met dieselfde terugvalle as _stuur-epos.js: EPOS_ADMIN_
  // val terug op EPOS_ vir gasheer en poort, maar NIE vir gebruiker en
  // wagwoord nie — daardie twee is die aanmelding self.
  const opstelling = {
    merk,
    gasheer: admin
      ? process.env.EPOS_ADMIN_GASHEER || process.env.EPOS_GASHEER || null
      : process.env.EPOS_GASHEER || null,
    poort: admin
      ? Number(process.env.EPOS_ADMIN_POORT) || Number(process.env.EPOS_POORT) || 465
      : Number(process.env.EPOS_POORT) || 465,
    gebruiker: admin
      ? process.env.EPOS_ADMIN_GEBRUIKER || null
      : process.env.EPOS_GEBRUIKER || null,
    wagwoord_gestel: Boolean(
      admin ? process.env.EPOS_ADMIN_WAGWOORD : process.env.EPOS_WAGWOORD
    ),
  };

  const uitslag = await stuur_epos({
    aan,
    merk,
    onderwerp: admin ? "Toetspos van Future Sharp NPC" : "Toetspos van Future Shop",
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
