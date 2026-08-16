// netlify/functions/kanselleer-faktuur.js
//
// Maak 'n faktuur dood. Rol: boekhouding.
//
// 'N UITGEREIKTE FAKTUUR WORD NIE GEWYSIG NIE EN NIE UITGEVEE NIE.
//
// Hy dra 'n nommer in 'n deurlopende reeks, en die punt van daardie reeks is
// dat 'n gaping SIGBAAR is — dit is hoe 'n mens sien dat niks verdwyn het nie.
// Vee 'n mens hom uit, is daar geen gaping om te sien nie. Wil 'n mens iets
// verander, word gekanselleer en 'n NUWE uitgereik.
//
// ─────────────────────────────────────────────────────────────────────────
// WAT DIT NIE DOEN NIE: PAYSTACK SE SKAKEL DOODMAAK
//
// Daar is geen API om 'n geïnisieerde transaksie te herroep nie. Die
// authorization_url bly leef, en iemand met die ou skakel kan steeds betaal.
//
// Wat hier gebeur, is dat ONS rekord dood is. Die gevolg wat daaruit volg en
// wat in fase 4 gebou moet word: die webhook moet toets of die faktuur
// gekanselleer is voordat hy 'n betaling aanteken, en so 'n betaling UITLIG
// in plaas van stilweg te verwerk. Die geld is dan werklik ontvang — die
// verdeling het selfs gebeur — en iemand moet daaroor besluit.
//
// Om te maak asof die skakel dood is, sou erger wees as om dit te sê.
// ─────────────────────────────────────────────────────────────────────────
//
// 'N BETAALDE FAKTUUR KAN NIE GEKANSELLEER WORD NIE. Die geld is ontvang en
// die verdeling het gebeur; 'n rekord wat sê "gekanselleer" terwyl daar
// betaal is, is 'n leuen in die boeke. Wat daar nodig is, is 'n
// terugbetaling, en dié bestaan nie in hierdie module nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
  voeg_geskiedenis_by,
} = require("./_fakture");

// Kort genoeg om te tik, lank genoeg om iets te sê. "Nee" help niemand ses
// maande later nie.
const REDE_MIN = 3;
const REDE_MAKS = 300;

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
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = String(invoer.sleutel || "").trim();
  const rede = String(invoer.rede || "").trim().slice(0, REDE_MAKS);

  if (!sleutel || (!is_konsep_sleutel(sleutel) && !sleutel_na_nommer(sleutel))) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }

  // DIE REDE IS VERPLIG. Dieselfde redenasie as die opmerking by Stuur terug:
  // 'n handeling wat sonder rede in die geskiedenis staan, laat 'n mens raai —
  // en hier is dit 'n gaping in 'n nommerreeks, wat presies is wat 'n ouditeur
  // vra.
  if (rede.length < REDE_MIN) {
    return { statusCode: 400, body: "Gee 'n rede vir die kansellasie." };
  }

  const store = kry_fakture_store();
  const nou = new Date().toISOString();
  const wie = (gebruiker && gebruiker.email) || "";

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  if (rekord.stand === "gekanselleer") {
    return { statusCode: 409, body: "Hierdie faktuur is reeds gekanselleer." };
  }
  if (rekord.stand === "betaal") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is betaal. Die geld is ontvang en die verdeling het gebeur — 'n kansellasie sou die boeke verkeerd stel.",
    };
  }

  const vorige = rekord.stand;

  rekord.stand = "gekanselleer";
  rekord.gekanselleer_op = nou;
  rekord.gekanselleer_deur = wie;
  rekord.kanselleer_rede = rede;
  rekord.bygewerk_op = nou;

  // DIE GEVRIESDE VERDELING BLY STAAN. Sy is die rekord van wat by uitreiking
  // besluit is, en dit bly waar al is die faktuur dood.

  voeg_geskiedenis_by(rekord, "gekanselleer", wie, rede);

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} kanselleer nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur kanselleer nie" };
  }

  console.log(
    `Faktuur ${rekord.nommer || sleutel} gekanselleer deur ${wie} — was ${vorige}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sleutel, stand: rekord.stand }),
  };
};
