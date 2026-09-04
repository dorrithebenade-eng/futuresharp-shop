// netlify/functions/eenmalig-skrap-kwotasies.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM HY BESTAAN
//
// KW/01961 en KW/01962 is toetsdata. Albei staan op `aanvaar`, en
// skrap-kwotasie.js weier 'n aanvaarde kwotasie UITDRUKLIK -- ook een met die
// toetsstempel -- omdat 'n faktuur na haar verwys en daardie faktuur permanent
// kan wees.
//
// Daardie rede het weggeval: FS/01961 en FS/01962 bestaan nie meer nie. Die
// twee kwotasies verwys nou na fakture wat weg is, en dit is presies die
// toestand wat die weiering moes voorkom.
//
// Die reël in skrap-kwotasie.js bly onaangeraak. Sy is reg vir elke ander
// geval, en dit is die geval wat oorbly wanneer die toetsfase verby is.
//
// ─────────────────────────────────────────────────────────────────────────
// DRIE SLOTTE
//
//   1. DIE SLEUTELS IS HIER VASGESKRYF. Hy neem niks uit die versoek nie.
//      Bly hierdie lêer per ongeluk staan, kan hy NIKS anders raak nie -- en
//      daardie twee rekords bestaan dan reeds nie meer nie.
//   2. DIE ROL BLY GELD. Sonder `boekhouding` gebeur niks.
//   3. 'N WAGWOORD IN DIE LIGGAAM, sodat 'n oproep nie per ongeluk kan gebeur.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_kwotasies_store } = require("./_kwotasies");

// Die enigste rekords wat hierdie lêer ooit kan raak.
const SLEUTELS = ["KW-01961", "KW-01962"];
const WAGWOORD = "skrap-die-twee-toetskwotasies";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  if (invoer.bevestig !== WAGWOORD) {
    return { statusCode: 400, body: "Geen bevestiging nie" };
  }

  const store = kry_kwotasies_store();
  const uitslag = [];

  for (const sleutel of SLEUTELS) {
    let rekord = null;
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie ${sleutel} lees nie:`, fout);
      uitslag.push({ sleutel, uitslag: "leesfout" });
      continue;
    }

    if (!rekord) {
      uitslag.push({ sleutel, uitslag: "bestaan nie" });
      continue;
    }

    // Die rekord word GELOG voordat hy weggaan.
    console.log(
      `EENMALIG: ${sleutel} word geskrap deur ${(gebruiker && gebruiker.email) || "onbekend"}` +
        ` — stand ${rekord.stand}, faktuur ${rekord.faktuur_nommer || "geen"}`
    );

    try {
      await store.delete(sleutel);
      uitslag.push({ sleutel, uitslag: "geskrap", stand: rekord.stand });
    } catch (fout) {
      console.error(`Kon nie ${sleutel} skrap nie:`, fout);
      uitslag.push({ sleutel, uitslag: "skrapfout" });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitslag }),
  };
};
