// netlify/functions/toets-outeur-kennisgewing.js
//
// Personeel-beskermd — laat die outeur-kennisgewing vir 'n BESTAANDE
// bestelling weer loop, sodat dit getoets kan word sonder om 'n regte
// betaling deur te sit.
//
// Dieselfde gedagte as toets-epos.js: die webhook van 'n betaling is die
// verkeerde plek om iets vir die eerste keer te sien werk. Hier kan mens
// dit teen 'n bestelling loop waarvan die syfers reeds bekend is.
//
// Gebruik: POST met
//   { bestelnommer: "FS-...", droog: true }
//     — bereken alles en gee terug wie pos SOU kry, sonder om te stuur.
//   { bestelnommer: "FS-...", aan: "iemand@voorbeeld.co.za" }
//     — stuur werklik, maar alles na hierdie een adres toe.
//   { bestelnommer: "FS-..." }
//     — stuur werklik, na die outeurs se eie adresse.
//
// Die derde vorm stuur regte pos aan regte outeurs. Begin altyd met
// droog, en dan met "aan".

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { stuur_outeur_kennisgewings } = require("./_kennisgewing-outeur");

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
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  const bestelnommer = (invoer.bestelnommer || "").trim();
  if (!bestelnommer) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte veld: bestelnommer" }) };
  }

  const store = kry_store("bestellings");
  const bestelling = await store.get(bestelnommer, { type: "json" });
  if (!bestelling) {
    return {
      statusCode: 404,
      body: JSON.stringify({ fout: `Geen bestelling met nommer "${bestelnommer}" nie` }),
    };
  }

  const droog = Boolean(invoer.droog);
  const oorheers_aan = (invoer.aan || "").trim() || null;

  try {
    const opsomming = await stuur_outeur_kennisgewings(bestelling, { droog, oorheers_aan });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          bestelnommer,
          droog,
          oorheers_aan,
          aantal_items: (bestelling.items || []).length,
          // Wat NIE pos kry nie is net so belangrik as wat wel — 'n harde
          // kopie in hierdie bestelling verklaar 'n leë opsomming.
          formate_in_bestelling: [...new Set((bestelling.items || []).map((i) => i.formaat))],
          opsomming,
        },
        null,
        2
      ),
    };
  } catch (fout) {
    console.error("toets-outeur-kennisgewing fout:", fout);
    return {
      statusCode: 500,
      body: JSON.stringify({ fout: "Kon nie die kennisgewings verwerk nie" }),
    };
  }
};
