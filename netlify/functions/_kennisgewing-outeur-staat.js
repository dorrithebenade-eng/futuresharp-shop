// netlify/functions/_kennisgewing-outeur-staat.js
//
// Laat die OUTEUR weet sy maandelikse staat is gereed.
//
// DIE POS DRA GEEN SYFERS NIE, EN DIT IS DOELBEWUS.
//
// kry-my-staat.js bereken die outeur se deel elke keer opnuut in plaas van
// dit te stoor, juis sodat daar EEN antwoord op die vraag is: word 'n
// verdeling later reggemaak, skuif die historiese syfers saam. 'n Bedrag in
// 'n pos is waar op die oomblik van stuur en daarna nie meer nie. Dit sou 'n
// tweede antwoord wees, en die een wat die outeur die langste bybly.
//
// Daar is ook 'n praktiese rede. kry-my-staat.js bereken die staat vir die
// AANGEMELDE outeur -- dit begin by kry_gebruiker_en_kontroleer_rol. 'n
// Geskeduleerde taak het niemand wat aangemeld is nie. Om die syfers in die
// pos te kry, sou die berekening uit daardie werkende funksie geskuif moes
// word, en dit is 'n refaktor van iets wat nie stukkend is nie.
//
// Wat die pos dus doen, is die enigste ding wat die skerm nie kan doen nie:
// die outeur laat weet dat daar iets is om te sien.
//
// DIT GOOI NOOIT NIE. stuur_epos() gee { ok, fout } terug, en die aanroeper
// merk die maand slegs as die pos deurgekom het.

const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie -- 'n wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener land.
// Dieselfde nota staan in _kennisgewing-versending.js.
const WERF_URL = "https://futureshop.futuresharp.co.za";

const MAANDE = [
  "Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
  "Julie", "Augustus", "September", "Oktober", "November", "Desember",
];

// "2026-09" -> "September 2026"
function maand_lank(sleutel) {
  const stukke = String(sleutel || "").split("-");
  const jaar = Number(stukke[0]);
  const maand = Number(stukke[1]);
  if (!jaar || !maand || maand < 1 || maand > 12) return String(sleutel || "");
  return `${MAANDE[maand - 1]} ${jaar}`;
}

// { aan, naam, maand, besigtigings_vanaf }
async function stuur_outeur_staat_kennisgewing(inligting) {
  const aan = String(inligting.aan || "").trim();
  if (!aan) return { ok: false, fout: "Geen outeur-e-pos" };

  const maand = String(inligting.maand || "").trim();
  if (!maand) return { ok: false, fout: "Geen maand" };

  const maand_teks = maand_lank(maand);
  const naam = String(inligting.naam || "").trim();

  const reels = [];

  reels.push(
    (naam ? `Hallo ${ontsnap(naam)}. ` : "") +
      `Jou staat vir <b>${ontsnap(maand_teks)}</b> is gereed. ` +
      "Dit wys elke titel se besigtigings, verkope en jou eie deel, en jy kan " +
      "die tydperk self verstel om verder terug te kyk."
  );

  // Besigtigings bestaan eers sedert 'n sekere maand (sien kry-my-staat.js se
  // BESIGTIGINGS_VANAF). Sonder hierdie sin lyk 'n nul in daardie kolom soos
  // 'n stil maand in plaas van data wat nooit bestaan het nie.
  if (inligting.besigtigings_vanaf) {
    reels.push(
      `Let op dat besigtigings eers vanaf ${ontsnap(maand_lank(inligting.besigtigings_vanaf))} ` +
        "getel word. Kies jy 'n vroeër tydperk, wys die verkope wel en die " +
        "besigtigings staan op nul."
    );
  }

  reels.push(
    "Wil jy nie hierdie pos elke maand ontvang nie, verstel dit onder " +
      "<b>My besonderhede</b> op dieselfde bladsy."
  );

  const uitslag = await stuur_epos({
    aan,
    onderwerp: `Jou staat vir ${maand_teks} is gereed`,
    opskrif: "Jou maandelikse staat",
    reels,
    knoppie: { teks: "Sien jou staat", url: `${WERF_URL}/outeur.html#staat` },
  });

  if (!uitslag.ok) {
    console.error(
      `Staat-kennisgewing aan "${naam || aan}" vir ${maand} het misluk:`,
      uitslag.fout
    );
  }

  return uitslag;
}

module.exports = { stuur_outeur_staat_kennisgewing, maand_lank };
