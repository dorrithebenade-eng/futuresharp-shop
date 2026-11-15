// netlify/functions/_kennisgewing-mandjie.js
//
// Die mandjie-herinnering (November 2026): EEN neutrale pos aan 'n koper wat
// tot by Paystack gekom het, maar nie betaal het nie.
//
// DIE TEKS IS DORRITHÉ SE EIE WOORDE (15 November 2026). Verander dit net
// in oorleg met haar. Die toon is doelbewus sag: geen "vinnig, voor dit weg
// is" nie, geen afslag as lokaas nie. Die enigste datum is die 48 uur wat
// die skakel werk, en die sin oor aanbiedings is inligting, nie druk nie.
//
// TWEE TALE. Die koper kry die pos in die taal waarin sy gekoop het (sien
// mandjie-herinnering.js vir hoe dit bepaal word).
//
// DIT GOOI NOOIT NIE. stuur_epos() gee { ok, fout } terug; die aanroeper
// merk die bestelling eers as die pos deurgekom het.

const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie (sien _kennisgewing-versending.js).
const WERF_URL = "https://futureshop.futuresharp.co.za";

const TEKS = {
  af: {
    onderwerp: "Jou boeke wag nog vir jou",
    groet: "Hallo",
    inleiding:
      "Jy het onlangs boeke by Future Shop uitgekies, maar die bestelling is nog nie voltooi nie. " +
      "Ons het jou keuse vir jou gehou:",
    hou_oop: "Ons hou jou mandjie 48 uur lank vir jou oop. Gaan voort wanneer jy gereed is:",
    knoppie: "Voltooi my bestelling",
    aanbiedings: "Let wel: spesiale aanbiedings geld net tot hul oorspronklike einddatum.",
    hulp: "Kan ons met iets help? Kontak ons gerus indien jy enige onsekerheid of vraag het.",
    afsluiting: "Groete<br>Future Shop",
    voetnota:
      "Jy kry hierdie e-pos omdat jy 'n bestelling by Future Shop begin het. " +
      "Ons stuur net hierdie een herinnering.",
    formaat: { eboek: "E-boek", harde_kopie: "Harde kopie", leen: "Leen" },
  },
  en: {
    onderwerp: "Your books are still waiting for you",
    groet: "Hello",
    inleiding:
      "You recently chose books at Future Shop, but your order has not been completed yet. " +
      "We have kept your selection for you:",
    hou_oop: "We will keep your cart open for you for 48 hours. Continue whenever you are ready:",
    knoppie: "Complete my order",
    aanbiedings: "Please note: special offers are only valid until their original end date.",
    hulp: "Can we help with anything? Feel free to contact us if you have any uncertainty or questions.",
    afsluiting: "Kind regards<br>Future Shop",
    voetnota:
      "You are receiving this e-mail because you started an order at Future Shop. " +
      "We send only this one reminder.",
    formaat: { eboek: "E-book", harde_kopie: "Hard copy", leen: "Loan" },
  },
};

function herstel_url(bestelnommer, teken) {
  return (
    `${WERF_URL}/herstel-mandjie.html?b=${encodeURIComponent(bestelnommer)}` +
    `&t=${encodeURIComponent(teken)}`
  );
}

// { aan, taal, bestelnommer, teken, items: [{ titel, formaat }] }
async function stuur_mandjie_herinnering(inligting) {
  const aan = String(inligting.aan || "").trim();
  if (!aan) return { ok: false, fout: "Geen koper-e-pos" };
  if (!inligting.bestelnommer || !inligting.teken) {
    return { ok: false, fout: "Geen bestelnommer of teken" };
  }

  const T = TEKS[inligting.taal] || TEKS.af;
  const items = (inligting.items || []).filter((i) => i && i.titel);
  if (!items.length) return { ok: false, fout: "Geen items" };

  const lys = items
    .map((i) => `• ${ontsnap(i.titel)} (${T.formaat[i.formaat] || ontsnap(i.formaat)})`)
    .join("<br>");

  const reels = [
    T.groet,
    T.inleiding,
    lys,
    T.hou_oop, // indeks 3: die knoppie kom direk hierna
    T.aanbiedings,
    T.hulp,
    T.afsluiting,
    `<span style="font-size:12px;color:#8B8781;">${T.voetnota}</span>`,
  ];

  return stuur_epos({
    aan,
    onderwerp: T.onderwerp,
    opskrif: T.onderwerp,
    reels,
    knoppie: { teks: T.knoppie, url: herstel_url(inligting.bestelnommer, inligting.teken), na: 3 },
  });
}

module.exports = { stuur_mandjie_herinnering, herstel_url };
