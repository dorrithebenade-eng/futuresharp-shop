// netlify/functions/kry-betaalstand.js
//
// Wat het met hierdie betaling gebeur? Vir betaal-klaar.html.
//
// DIT IS 'N PUBLIEKE FUNCTION. Die kliënt meld nooit aan nie — hy is 'n
// rekord, nie 'n rekening nie — dus kan hier geen rolkontrole wees. Drie
// dinge hou dit toe:
//
//   * DIT LEES SLEGS. Niks word geskryf nie, dus is daar geen misbruikvlak
//     soos by die publieke kliëntvorm of die bestelbladsy nie.
//   * DIE KODE IS DIE BEWYS. Die sleutel vind die rekord, maar sonder die
//     publieke kode is die antwoord 404. Die faktuurnommer is deurlopend en
//     dus tel-baar; die kode is dit nie.
//   * DIE ANTWOORD DRA GEEN KLIËNTDATA. Geen naam, geen e-pos, geen adres,
//     geen verdeling en geen begroting. Net wat op die bladsy verskyn.
//
// WAAROM DIT PAYSTACK VRA EN NIE NET DIE REKORD LEES NIE
//
// Die rekord sê "gestuur" tot die webhook praat, en die webhook is fase 4.
// Belangriker: 'n kansellasie kom by DIESELFDE callback-URL uit as 'n
// geslaagde betaling — Paystack se eie dokumentasie sê die verwysing kom as
// 'n navraagparameter terug, nie die uitslag nie. Die bladsy kan dus niks uit
// die URL aflei nie en moet vra.
//
// DIT SKRYF NIE DIE ANTWOORD TERUG NIE. Dit is 'n leesbladsy. Die webhook is
// wat 'n betaling aanteken, en 'n publieke Function wat 'n faktuur as betaal
// kan merk, is 'n Function wat iemand anders kan laat merk.
//
// DIE VIER UITKOMSTE
//
//   betaal    — die geld is deur
//   loop      — geïnisieer, wag op die bank. 'n Instant EFT is ASINKROON: die
//               kliënt kan terug wees voordat sy bank bevestig het. Sonder
//               hierdie geval sou hy "nie voltooi nie" sien vir 'n betaling
//               wat wel deurgaan, en dan betaal die skool twee keer.
//   oop       — gekanselleer, laat vaar, of misluk. Niks is afgetrek nie.
//   onbekend  — Paystack antwoord nie. Ons weet nie, en ons sê so.

const { kry_fakture_store, is_konsep_sleutel, sleutel_na_nommer } = require("./_fakture");

// Paystack se `data.status`, nie die API-antwoord se eie `status` nie — dié
// twee beteken heeltemal verskillende dinge en word maklik verwar.
const PS_BETAAL = ["success"];
const PS_LOOP = ["ongoing", "pending", "processing", "queued"];
const PS_OOP = ["abandoned", "failed", "reversed", "cancelled"];

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const vraag = event.queryStringParameters || {};
  const sleutel = teks(vraag.f);
  const kode = teks(vraag.k);

  // Een boodskap vir elke soort mislukking. Sê 'n mens "faktuur nie gevind
  // nie" teenoor "verkeerde kode", verklap die verskil watter nommers bestaan.
  const NIE_GEVIND = { statusCode: 404, body: "Nie gevind nie" };

  if (!sleutel || !kode) return NIE_GEVIND;
  // 'n Konsep het geen betaalskakel en dus niks om oor te vra nie.
  if (is_konsep_sleutel(sleutel) || !sleutel_na_nommer(sleutel)) return NIE_GEVIND;

  let rekord;
  try {
    rekord = await kry_fakture_store().get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return NIE_GEVIND;
  if (!rekord.publieke_kode || rekord.publieke_kode !== kode) return NIE_GEVIND;

  const antwoord = {
    nommer: rekord.nommer || sleutel_na_nommer(sleutel),
    bedrag_sent: rekord.totaal_sent || 0,
    // Die DOKUMENT se taal, per faktuur — dieselfde bron as die proforma wat
    // die kliënt ontvang het. Nie die blaaier se taal nie.
    taal: rekord.taal === "en" ? "en" : "af",
    betaalskakel: null,
    stand: "onbekend",
  };

  // Die rekord antwoord self waar hy kan.
  if (rekord.stand === "betaal") {
    antwoord.stand = "betaal";
    return ok(antwoord);
  }
  if (rekord.stand === "gekanselleer") {
    // Die faktuur is dood en die skakel weier betaling. Geen betaalskakel
    // gaan terug nie — 'n knoppie na 'n skakel wat weier, is 'n doodloopstraat
    // met 'n knoppie daarop.
    antwoord.stand = "oop";
    return ok(antwoord);
  }

  const paystack = rekord.paystack || {};
  const verwysing = teks(paystack.referensie);
  antwoord.betaalskakel = paystack.authorization_url || null;

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

  // 'n Betaalde transaksie het niks meer om te hervat nie.
  if (antwoord.stand === "betaal") antwoord.betaalskakel = null;

  return ok(antwoord);
};

function ok(antwoord) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Nooit kas nie. Die stand verander binne sekondes wanneer 'n EFT deur
      // die bank kom, en 'n gekaste "oop" sou die kliënt laat dink sy betaling
      // het misluk.
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(antwoord),
  };
}
