// netlify/functions/_kennisgewing-leen-verval.js
//
// Laat die KOPER weet sy leen loop uit, en dat sy opgraderingskoepon wag.
//
// WAAROM DIT BESTAAN
//
// "My Boeke" wys reeds hoeveel dae oor is, en die opgradeer-knoppie verskyn
// vyf dae voor verval. Maar albei is bladsy-inhoud: hulle bestaan net vir
// iemand wat uit eie beweging gaan kyk. 'n Koper weet nie dat daar iets is
// om te gaan kyk nie. Die leen verval dan stil, en die koepon -- wat 'n
// werklike bedrag verteenwoordig wat hy reeds betaal het -- verval saam met
// hom, ongebruik.
//
// EEN POS, NIE TWEE NIE. 'n Aparte "jou leen verstryk"-pos sonder die
// koepon laat die leser met niks om mee te doen nie. 'n Aparte
// "hier is jou koepon"-pos sonder die sperdatum gee hom geen rede om nou te
// lees nie. Die twee hoort in een boodskap.
//
// DIE LEEN SE DATUM IS DIE OPSKRIF, nie die koepon s'n nie. Die leen is wat
// verander; die koepon is wat 'n mens daaraan kan doen. Die koepon leef
// boonop 14 dae LANGER as die leen (sien paystack-webhook.js), en 'n pos wat
// met die verste datum begin, klink soos iets wat kan wag.
//
// DIT GOOI NOOIT NIE. stuur_epos() gee { ok, fout } terug in plaas van te
// gooi, en die aanroeper merk die herinnering slegs as die pos deurgekom
// het. 'n Mislukte pos beteken dus 'n herprobeer more, nie 'n stil verlies
// nie.

const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie -- 'n wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener land.
// Sien dieselfde nota in _kennisgewing-versending.js.
const WERF_URL = "https://futureshop.futuresharp.co.za";

function datum_lank(iso) {
  const d = new Date(String(iso || "").slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return d.toLocaleDateString("af-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rand(sent) {
  return "R" + (Number(sent) / 100).toFixed(2);
}

function dae_woord(n) {
  return n === 1 ? "1 dag" : `${n} dae`;
}

// { aan, titel, verval_op, dae_oor, koepon_kode, afslag_sent,
//   koepon_verval_op, bestelnommer }
async function stuur_leen_verval_kennisgewing(inligting) {
  const aan = String(inligting.aan || "").trim();
  if (!aan) return { ok: false, fout: "Geen koper-e-pos" };

  const titel = String(inligting.titel || "").trim();
  if (!titel) return { ok: false, fout: "Geen titel" };

  const dae_oor = Number(inligting.dae_oor);
  if (!Number.isFinite(dae_oor) || dae_oor < 0) {
    return { ok: false, fout: "Ongeldige dae oor" };
  }

  const reels = [
    `Jou leen van <b>${ontsnap(titel)}</b> loop oor <b>${dae_woord(dae_oor)}</b> uit, ` +
      `op ${ontsnap(datum_lank(inligting.verval_op))}. Daarna is die boek nie meer ` +
      "in jou leser beskikbaar nie.",
  ];

  // Die koepon is die rede om nou te lees. Die bedrag staan in die sin,
  // nie net die kode nie -- 'n kode alleen sê nie wat dit werd is nie.
  reels.push(
    `Toe jy geleen het, het ons 'n koepon vir jou opsy gesit ter waarde van ` +
      `<b>${ontsnap(rand(inligting.afslag_sent))}</b> \u2014 presies wat jy vir die leen ` +
      "betaal het. Gebruik dit om die e-boek te koop en dan hou jy die boek permanent; " +
      "die leengeld tel ten volle daarteen."
  );

  const besonderhede = [`Koeponkode: <b>${ontsnap(String(inligting.koepon_kode || ""))}</b>`];
  if (inligting.koepon_verval_op) {
    besonderhede.push(`Geldig tot: ${ontsnap(datum_lank(inligting.koepon_verval_op))}`);
  }
  reels.push(besonderhede.join("<br>"));

  // Die koepon oorleef die leen met 14 dae. Sonder hierdie sin lyk die
  // twee datums hierbo soos 'n teenstrydigheid.
  if (inligting.koepon_verval_op) {
    reels.push(
      "Die koepon bly geldig vir 'n rukkie ná die leen verstryk, sodat jy nie hoef " +
        "te besluit terwyl jy nog lees nie."
    );
  }

  const uitslag = await stuur_epos({
    aan,
    onderwerp: `Jou leen van ${titel} loop oor ${dae_woord(dae_oor)} uit`,
    opskrif: "Jou leen loop uit",
    reels,
    knoppie: { teks: "Sien dit in My Boeke", url: `${WERF_URL}/my-boeke.html` },
  });

  if (!uitslag.ok) {
    console.error(
      `Leen-verval-kennisgewing vir "${titel}" (${inligting.bestelnommer || "?"}) het misluk:`,
      uitslag.fout
    );
  }

  return uitslag;
}

module.exports = { stuur_leen_verval_kennisgewing };
