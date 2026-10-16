// netlify/functions/stuur-betaalposte-background.js
// Weergawe 1 (16 Oktober 2026).
//
// Stuur die eposse ná 'n HANDMATIGE betaling: die kwitansie aan die kliënt,
// die state aan die ontvangers, en die kennisgewing. Rol: boekhouding.
// Invoer: { sleutel }
//
// HOEKOM 'N AGTERGRONDFUNKSIE
//
// teken-betaling-aan.js het hierdie drie eposse self gestuur en op elkeen
// gewag. By FS/01969 het dit langer gevat as Netlify se tydsgrens vir 'n
// gewone funksie, en die skerm het 'n rou HTML-foutblad gewys terwyl die
// betaling wel gestoor was. Die `-background` agter die naam maak hierdie
// 'n Netlify-agtergrondfunksie: die blaaier kry dadelik 202 terug, en die
// funksie het tot 15 minute om klaar te kry.
//
// DIESELFDE DRIE EPOSSE AS DIE WEBHOOK, uit dieselfde lêer
// (_faktuur-betaling.js). Twee kopieë sou uitmekaar dryf.
//
// NOOIT TWEE KEER NIE. Die funksie merk die betaling eers met
// `eposse_gestuur_op` en stuur dan. Word hy 'n tweede keer geroep (die
// skerm is herlaai, of 'n knoppie is twee keer gedruk), sien hy die merk en
// doen niks. Die merk word gesit VOOR die eposse uitgaan: 'n pos wat nie
// uitgaan nie, is beter as 'n skool wat drie kwitansies kry. Die log sê
// watter pos misluk het.
//
// 'n Agtergrondfunksie se antwoord bereik niemand nie; alles wat saak maak,
// staan in die log.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, is_konsep_sleutel, sleutel_na_nommer } = require("./_fakture");
const { kry_maatskappy } = require("./_instellings");
const {
  stuur_kwitansie,
  stuur_state,
  stuur_kennisgewing,
} = require("./_faktuur-betaling");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    console.error("Betaalposte: geen boekhouding-rol nie; niks gestuur nie.");
    return { statusCode: 403 };
  }

  let sleutel = "";
  try {
    sleutel = String(JSON.parse(event.body).sleutel || "").trim();
  } catch {
    return { statusCode: 400 };
  }
  if (!sleutel || is_konsep_sleutel(sleutel) || !sleutel_na_nommer(sleutel)) {
    console.error(`Betaalposte: ongeldige sleutel ${sleutel}`);
    return { statusCode: 400 };
  }

  const store = kry_fakture_store();

  // -- Eis die eposse op ------------------------------------------------
  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Betaalposte: kon nie ${sleutel} lees nie:`, fout);
    return { statusCode: 500 };
  }
  if (!rekord) return { statusCode: 404 };

  // Net 'n handmatige betaling. Die webhook stuur sy eie eposse; hierdie
  // funksie mag nie 'n skakelbetaling se kwitansie herhaal nie.
  if (rekord.stand !== "betaal" || !rekord.betaling || rekord.betaling.metode !== "bankoorbetaling") {
    console.log(`Betaalposte: ${sleutel} is nie 'n handmatige betaling nie; niks gestuur nie.`);
    return { statusCode: 409 };
  }
  if (rekord.betaling.eposse_gestuur_op) {
    console.log(`Betaalposte: ${sleutel} se eposse is reeds op ${rekord.betaling.eposse_gestuur_op} gestuur.`);
    return { statusCode: 200 };
  }

  rekord.betaling.eposse_gestuur_op = new Date().toISOString();
  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Betaalposte: kon nie ${sleutel} merk nie; niks gestuur nie:`, fout);
    return { statusCode: 500 };
  }

  // -- Stuur ------------------------------------------------------------
  // Elkeen vang sy eie foute binne-in (_faktuur-betaling.js).
  let maatskappy = null;
  try {
    maatskappy = await kry_maatskappy();
  } catch (fout) {
    console.error("Betaalposte: kon nie die instelling lees nie:", fout);
  }

  await stuur_kwitansie(rekord);
  await stuur_state(rekord);
  await stuur_kennisgewing(rekord, maatskappy, false);

  console.log(`Betaalposte: ${rekord.nommer || sleutel} se eposse gestuur (${gebruiker.email || ""}).`);
  return { statusCode: 200 };
};
