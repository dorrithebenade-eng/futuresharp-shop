// netlify/functions/_kennisgewing-indiening.js
//
// Die pos wat 'n outeur kry wanneer sy indiening teruggestuur word.
//
// WAAROM NET HIERDIE EEN. 'n Goedkeuring verg niks van hom nie — dit is
// goeie nuus wat kan wag tot hy volgende inteken, en 'n kanaal wat elke
// gebeurtenis dra, word binne 'n maand een wat niemand meer lees nie. 'n
// Terugstuur is anders: sy vorm staan oop met 'n opmerking daarop, en
// sonder hierdie pos wag hy terwyl daar op hom gewag word.
//
// DIE POS MAG NOOIT DIE TERUGSTUUR LAAT MISLUK NIE. stuur_epos() gooi nie
// en gee { ok, fout } terug; hierdie module vang boonop alles, sodat 'n
// ontbrekende outeursrekord of 'n stukkende posbediener nie 'n 500 word op
// 'n handeling wat reeds gestoor is.
//
// DIE OPMERKING GAAN DEUR ontsnap(). Dit is vrye teks wat iemand ingetik
// het, en `reels` word NIE deur die sjabloon ontsnap nie.

const { kry_store } = require("./_blob-store");
const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie — 'n wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener land.
const WERF_URL = "https://futureshop.futuresharp.co.za";

// Die opmerking staan in sy eie blok. 'n Mens moet kan sien waar Future
// Shop se woorde ophou en die opmerking begin — anders lees dit soos
// sjabloonteks en verloor dit sy gewig.
function haal_aan(teks) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr>
    <td style="border-left:3px solid #479F91;background:#F4F8F7;padding:13px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#333333;">${ontsnap(teks)}</td>
  </tr></table>`;
}

function bou_pos(titel, opmerking, nommer) {
  const naam = titel || "jou indiening";
  return {
    onderwerp: `Jou indiening is teruggestuur — ${naam}`,
    opskrif: "Jou indiening is teruggestuur",
    reels: [
      `Jou indiening vir <b>${ontsnap(naam)}</b> is teruggestuur sodat jy iets kan regmaak.`,
      haal_aan(opmerking),
      "Die boek indieningsvorm is weer oop vir wysigings. Maak die veranderinge en dien dit weer in.",
      `Verwysing: ${ontsnap(nommer)}`,
    ],
    knoppie: { teks: "Maak die vorm oop", url: `${WERF_URL}/outeur.html` },
  };
}

// Gee { gestuur, rede } terug — nooit 'n uitsondering nie. Die aanroeper
// teken dit aan en gaan aan.
async function stuur_terugstuur_kennisgewing(rekord, opmerking) {
  try {
    const outeur_id = rekord && rekord.outeur_id;
    if (!outeur_id) return { gestuur: false, rede: "geen outeur_id op die rekord nie" };

    const outeur = await kry_store("outeurs").get(outeur_id, { type: "json" });
    if (!outeur) return { gestuur: false, rede: "outeur nie gevind nie" };

    const aan = outeur.kontak_inligting && outeur.kontak_inligting.epos;
    if (!aan) return { gestuur: false, rede: "geen e-posadres nie" };

    const titel = (rekord.data && rekord.data.titel) || "";
    const { onderwerp, opskrif, reels, knoppie } = bou_pos(titel, opmerking, rekord.nommer);

    const uitslag = await stuur_epos({ aan, onderwerp, opskrif, reels, knoppie });
    if (!uitslag.ok) {
      console.error(`Terugstuur-pos aan "${outeur_id}" het misluk:`, uitslag.fout);
      return { gestuur: false, rede: uitslag.fout };
    }
    return { gestuur: true, rede: null };
  } catch (fout) {
    console.error("Terugstuur-pos het gestort:", fout && fout.message);
    return { gestuur: false, rede: (fout && fout.message) || "onbekende fout" };
  }
}

module.exports = { stuur_terugstuur_kennisgewing, bou_pos };
