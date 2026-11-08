// netlify/functions/_kennisgewing-koper.js
//
// Bevestig aan die KOPER wat hy pas gekoop het.
//
// WAAROM DIT BESTAAN
//
// Die outeur het nog altyd 'n pos gekry ("Jou boek is verkoop"). Die koper
// het niks van Future Shop gekry nie -- net Paystack se eie kwitansie, wat sê
// dat geld beweeg het maar nie WAT hy gekry het nie, en wat by 'n R0-bestelling
// glad nie kom nie, want Paystack word dan nooit geroep nie.
//
// DIT DUPLISEER NIE "MY BOEKE" NIE
//
// "My Boeke" is die waarheid: dit is altyd huidig en dit dra die spoornommer
// van 'n harde kopie. Hierdie pos herhaal dit nie. Sy werk is die een ding wat
// 'n bladsy nooit kan doen nie -- iemand vertel dat daar iets is om te sien.
// Daarom: wat gekoop is, die bestelnommer, en 'n knoppie daarheen.
//
// HOOGSTENS TWEE POSSE PER BESTELLING. Hierdie een, en by 'n harde kopie later
// die versendingskennisgewing met die spoornommer. 'n Suiwer e-boekbestelling
// kry dus EEN pos. 'n Pos vir elke statusverandering leer 'n koper om hulle te
// ignoreer, en dan mis hy die een wat saak maak.
//
// DIT GOOI NOOIT NIE. Die bestelling is reeds gestoor en die betaling reeds
// bevestig teen die tyd dat hierdie funksie loop. Die aanroeper hou dit in 'n
// try/catch, en stuur_epos() gee self { ok, fout } terug in plaas van te gooi.

const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie — 'n wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener land.
// Sien dieselfde nota in _kennisgewing-outeur.js.
const WERF_URL = "https://futureshop.futuresharp.co.za";

// Wat elke formaat vir die KOPER beteken, nie wat hy in die stelsel heet nie.
// "harde_kopie" is 'n sleutel; "gedrukte boek" is wat 'n mens ontvang.
const FORMAAT_WOORD = {
  eboek: "e-boek",
  leen: "leen",
  harde_kopie: "gedrukte boek",
};

function rand(sent) {
  return "R" + (Number(sent || 0) / 100).toFixed(2).replace(".", ",");
}

async function stuur_koper_bevestiging(bestelling) {
  const aan = String((bestelling.koper && bestelling.koper.epos) || "").trim();
  if (!aan) return { ok: false, fout: "Geen koper-e-pos" };

  const items = Array.isArray(bestelling.items) ? bestelling.items : [];
  if (!items.length) return { ok: false, fout: "Geen items" };

  const bestelnommer = String(bestelling.bestelnommer || "").trim();
  const bevat_harde_kopie = items.some((i) => i && i.formaat === "harde_kopie");
  const bevat_lees = items.some(
    (i) => i && i.geskenk !== true && (i.formaat === "eboek" || i.formaat === "leen")
  );
  const bevat_geskenk = items.some((i) => i && i.geskenk === true);

  // Elke reël 'n titel met sy formaat en prys. Die prys staan hier omdat dit
  // die enigste rekord is wat die koper self behou -- Paystack se kwitansie
  // wys 'n totaal sonder om te sê waarvoor.
  const lyn_items = items.map((i) => {
    const woord = FORMAAT_WOORD[i.formaat] || i.formaat || "";
    return (
      `<b>${ontsnap(i.titel || "")}</b>` +
      (woord ? ` &middot; ${ontsnap(woord)}` : "") +
      (i.geskenk === true ? " &middot; geskenk" : "") +
      ` &middot; ${rand(i.prys_sent)}`
    );
  });

  // Aflewering (November 2026): die koerierkoste as 'n eie reël.
  const afhaal = bevat_harde_kopie && bestelling.aflewering && bestelling.aflewering.metode === "afhaal";
  if (bevat_harde_kopie) {
    lyn_items.push(
      afhaal
        ? "Afhaal in Pretoria &middot; R0,00"
        : `Aflewering per koerier &middot; ${rand(bestelling.afleweringskoste_sent || 0)}`
    );
  }

  const reels = [
    "Dankie vir jou bestelling. Hier is wat jy gekoop het.",
    lyn_items.join("<br>"),
    `Totaal: <b>${rand(bestelling.totaal_sent)}</b><br>` +
      `Bestelnommer: <b>${ontsnap(bestelnommer)}</b>`,
  ];

  // WAT NOU VOLG -- en net dit wat werklik van toepassing is. 'n Koper wat net
  // 'n e-boek gekoop het, hoef niks van pos te lees nie, en andersom.
  if (afhaal) {
    reels.push(
      (bevat_lees ? 'Jou e-boeke wag in "My Boeke", gereed om te lees. ' : "") +
        "Jou gedrukte boek word gedruk, en ons stuur die tyd en plek in Pretoria " +
        "per e-pos sodra dit gereed is om af te haal."
    );
  } else if (bevat_lees && bevat_harde_kopie) {
    reels.push(
      'Jou e-boeke wag in "My Boeke", gereed om te lees. Die gedrukte boek word ' +
        'gepos, en ons stuur die spoornommer sodra dit weg is -- jy kan die ' +
        'status ook enige tyd in "My Boeke" volg.'
    );
  } else if (bevat_harde_kopie) {
    reels.push(
      'Jou boek word gepos. Ons stuur die spoornommer sodra dit weg is, en jy ' +
        'kan die status enige tyd in "My Boeke" volg.'
    );
  } else if (bevat_lees) {
    reels.push('Jou boeke wag in "My Boeke", gereed om te lees.');
  }

  // GESKENKE: die geskenkbewys met die kode kom in 'n aparte pos (sien
  // _geskenke.js), sodat die koper dit net so kan aanstuur.
  if (bevat_geskenk) {
    reels.push(
      "Die geskenkbewys met die geskenkkode kom in 'n aparte e-pos. " +
        "Die geskenkboeke gaan nie in jou eie leeskamer nie, maar in die ontvanger s'n."
    );
  }

  const uitslag = await stuur_epos({
    aan,
    onderwerp: `Jou bestelling — ${bestelnommer}`,
    opskrif: bevat_harde_kopie && !bevat_lees
      ? "Jou bestelling is ontvang"
      : "Dankie vir jou aankoop",
    reels,
    knoppie: bevat_lees || bevat_harde_kopie
      ? { teks: "Gaan na My Boeke", url: `${WERF_URL}/my-boeke.html` }
      : undefined,
  });

  if (!uitslag.ok) {
    console.error(
      `Koper-bevestiging vir ${bestelnommer} het misluk:`,
      uitslag.fout
    );
  }

  return uitslag;
}

module.exports = { stuur_koper_bevestiging };
