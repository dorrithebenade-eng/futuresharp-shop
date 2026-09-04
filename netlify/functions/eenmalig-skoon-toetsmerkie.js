// netlify/functions/eenmalig-skoon-toetsmerkie.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM HY BESTAAN
//
// Die vyf kategorieë wat op 4 September 2026 geskep is om die uitgawetak te
// struktureer, dra 'n TOETS-merkie. `nuwe_kategorie()` sit hom op terwyl
// TOETSFASE aan is, en die eenmalige Function wat hulle geskep het, het dit so
// gelaat. Dit was my weglating: hierdie vyf is STRUKTUUR, nie toetsdata nie.
//
// EN DIE MERKIE WORD 'N LEUEN sodra TOETSFASE af is. skrap-fin-kategorie.js
// vereis `toets === true` EN `is_toetsfase()`. Met die fase af sê die merkie
// "hierdie mag uitgevee word" terwyl niks meer uitgevee kan word nie.
//
// stoor-fin-kategorie.js raak nie aan die veld nie, dus is daar geen skermpad
// om hom af te haal nie.
//
// ─────────────────────────────────────────────────────────────────────────
// DRIE SLOTTE
//
//   1. DIE VYF ID'S IS HIER VASGESKRYF. Hy neem niks uit die versoek nie.
//   2. DIE ROL BLY GELD.
//   3. 'N WAGWOORD IN DIE LIGGAAM.
//
// HY VERANDER NET `toets`. Geen naam, geen rigting, geen ouer, geen merkie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fin_kategoriee_store } = require("./_fin-kategoriee");

const SLEUTELS = [
  "skenkings-en-donasies",
  "direkte-projekkoste",
  "vergoeding-vir-dienste",
  "administrasie-en-bedryfskoste",
  "bankkoste",
];
const WAGWOORD = "haal-die-toetsmerkie-af";

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

  const store = kry_fin_kategoriee_store();
  const uitslag = [];

  for (const sleutel of SLEUTELS) {
    let rekord = null;
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch {
      rekord = null;
    }
    if (!rekord) {
      uitslag.push({ sleutel, doen: "nie gevind nie" });
      continue;
    }
    if (rekord.toets !== true) {
      uitslag.push({ sleutel, doen: "dra reeds geen merkie" });
      continue;
    }

    rekord.toets = false;
    rekord.bygewerk_op = new Date().toISOString();

    try {
      await store.setJSON(sleutel, rekord);
      uitslag.push({ sleutel, doen: "merkie afgehaal", naam: rekord.naam });
    } catch (fout) {
      console.error(`Kon nie ${sleutel} skryf nie:`, fout);
      uitslag.push({ sleutel, doen: "skryffout" });
    }
  }

  console.log(
    `EENMALIG: toetsmerkie afgehaal deur ${(gebruiker && gebruiker.email) || "onbekend"}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitslag }),
  };
};
