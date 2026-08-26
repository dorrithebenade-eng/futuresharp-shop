// netlify/functions/kry-bestelstand.js
//
// Wat het met hierdie betaling gebeur? Vir dankie.html.
//
// WAAROM DIT BESTAAN
//
// 'n Kansellasie op Paystack se betaalbladsy kom by DIESELFDE callback-URL
// uit as 'n geslaagde betaling. Paystack stuur die verwysing terug, nie die
// uitslag nie — die bladsy kan dus niks uit die URL aflei nie en moet vra.
//
// Sonder hierdie Function het dankie.html by elke uitkoms "Dankie vir jou
// bestelling" gesê en die mandjie leeggemaak, ook wanneer die koper gekanselleer
// het. Hy het dan niks betaal, niks gekoop, en sy mandjie was weg.
//
// DIT IS DIE FAKTUURMODULE SE kry-betaalstand.js, AANGEPAS
//
// Dieselfde vier uitkomste, dieselfde redenasie, dieselfde weiering om te
// skryf. Twee dinge verskil:
//
//   * DIE BEWYS. 'n Faktuurkliënt is 'n REKORD en meld nooit aan nie, dus
//     dra sy URL 'n publieke kode. 'n Koper is 'n REKENING — begin-betaling.js
//     weier sonder 'n geldige "koper"-rol-token. Die token bewys WIE vra, nie
//     net dat iemand die skakel het, en dit is die sterker toets. Geen nuwe
//     geheim hoef geskep, gestoor en deur die URL gedra te word nie.
//
//   * DIE VERWYSING. 'n Faktuur word een keer uitgereik en het een verwysing.
//     'n Bestelling kan hervat word: poging 1 is die kaal bestelnommer,
//     poging 2 is `FS-2026-000043-2`. Ons vra oor die JONGSTE poging, want dit
//     is die transaksie waarvandaan die koper pas teruggekeer het.
//
// DIT SKRYF NIE DIE ANTWOORD TERUG NIE. Dit is 'n leesbladsy. paystack-webhook.js
// is wat 'n betaling aanteken, en 'n Function wat 'n bestelling as betaal kan
// merk sonder dat die geld deur is, is 'n Function wat iemand anders kan misbruik.
//
// DIE VIER UITKOMSTE
//
//   betaal    — die geld is deur
//   loop      — geïnisieer, wag op die bank. 'n Instant EFT is ASINKROON: die
//               koper kan terug wees voordat sy bank bevestig het. Sonder
//               hierdie geval sou hy "nie voltooi nie" sien vir 'n betaling
//               wat wel deurgaan, en dan bestel hy dieselfde boeke twee keer.
//   oop       — gekanselleer, laat vaar, of misluk. Niks is afgetrek nie.
//   onbekend  — Paystack antwoord nie. Ons weet nie, en ons sê so.
//
// WAT DIE ANTWOORD DRA — en wat nie
//
// Die bestelnommer, die bedrag en die stand. Geen items, geen adres, geen
// verdeling, geen subrekeningkodes. Net wat op die bladsy verskyn.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Paystack se `data.status`, nie die API-antwoord se eie `status` nie — dié
// twee beteken heeltemal verskillende dinge en word maklik verwar.
const PS_BETAAL = ["success"];
const PS_LOOP = ["ongoing", "pending", "processing", "queued"];
const PS_OOP = ["abandoned", "failed", "reversed", "cancelled"];

// Die status wat paystack-betaling aanteken. begin-betaling.js skryf "Wag vir
// betaling"; paystack-webhook.js en die R0-kortpad skryf "Nuut". Staan dit
// reeds hier, hoef ons Paystack glad nie te vra nie.
//
// 'n LYS, NIE 'n GELYKHEIDSTOETS NIE. Kry 'n betaalde bestelling later 'n
// verdere status — versend, afgehandel — hoort hy hier by. 'n Toets teen net
// "Nuut" sou dan stilweg begin lieg.
const REKORD_BETAAL = ["Nuut"];

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    // Die bladsy val hierop terug na "onbekend" en HOU DIE MANDJIE. 'n Sessie
    // wat tussenin verval het, mag nie soos 'n mislukte betaling lyk nie.
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const bestelnommer = teks((event.queryStringParameters || {}).bestelnommer);

  // Een boodskap vir elke soort mislukking. Sê 'n mens "bestelling nie gevind
  // nie" teenoor "nie joune nie", verklap die verskil watter nommers bestaan.
  const NIE_GEVIND = { statusCode: 404, body: "Nie gevind nie" };
  if (!bestelnommer) return NIE_GEVIND;

  let rekord;
  try {
    rekord = await kry_store("bestellings").get(bestelnommer, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie bestelling ${bestelnommer} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die bestelling laai nie" };
  }
  if (!rekord) return NIE_GEVIND;

  // DIE EIENAARSKAPSKONTROLE. Bediener-kant geverifieer, teen die id wat
  // begin-betaling.js self op die rekord geskryf het — nooit teen iets wat die
  // blaaier saamstuur nie.
  const myne =
    rekord.koper && rekord.koper.netlify_identity_id === gebruiker.id;
  if (!myne) return NIE_GEVIND;

  const antwoord = {
    bestelnommer,
    bedrag_sent: rekord.totaal_sent || 0,
    items: Array.isArray(rekord.items) ? rekord.items.length : 0,
    stand: "onbekend",
  };

  // Die rekord antwoord self waar hy kan. Die webhook het dalk reeds gepraat
  // voordat Paystack die koper hierheen teruggestuur het.
  if (REKORD_BETAAL.includes(teks(rekord.status))) {
    antwoord.stand = "betaal";
    return ok(antwoord);
  }

  // 'n R0-bestelling loop deur begin-betaling.js se koepon-kortpad: geen
  // Paystack-transaksie, geen verwysing, en die rekord is klaar op "Nuut".
  // Kom hy tog hier uit, is `gratis_via_koepon` die bewys.
  if (rekord.paystack && rekord.paystack.gratis_via_koepon) {
    antwoord.stand = "betaal";
    return ok(antwoord);
  }

  const verwysing = teks(rekord.paystack && rekord.paystack.referensie);
  if (!verwysing) return ok(antwoord); // onbekend

  try {
    const resp = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(verwysing)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await resp.json();

    // resp.ok en data.status sê of die OPROEP geslaag het. Die TRANSAKSIE se
    // stand lê in data.data.status. Dit is die verwarring wat Paystack se eie
    // dokumentasie uitdruklik uitwys.
    if (!resp.ok || !data.status || !data.data) return ok(antwoord);

    const ps = teks(data.data.status).toLowerCase();
    if (PS_BETAAL.includes(ps)) antwoord.stand = "betaal";
    else if (PS_LOOP.includes(ps)) antwoord.stand = "loop";
    else if (PS_OOP.includes(ps)) antwoord.stand = "oop";
    // enigiets anders bly "onbekend" — 'n stand wat ons nie ken nie, word nie
    // geraai nie.
  } catch (fout) {
    console.error(`Kon nie ${verwysing} by Paystack verifieer nie:`, fout);
  }

  return ok(antwoord);
};

function ok(antwoord) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Nooit kas nie. Die stand verander binne sekondes wanneer 'n EFT deur
      // die bank kom, en 'n gekaste "oop" sou die koper laat dink sy betaling
      // het misluk.
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(antwoord),
  };
}
