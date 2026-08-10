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

// --- Die admin se kant ---
//
// TWEE POSTE, EN NET TWEE: 'n nuwe indiening en 'n nuwe wysiging. Geen
// verkoopsposte nie. 'n Kanaal wat elke transaksie dra, word binne 'n maand
// een wat niemand meer lees nie, en dan word die een wat saak maak ook
// gemis.
//
// DIE POS SÊ NIE WAT IN DIE VORM STAAN NIE. Wie dit lees, gaan in elk geval
// kyk; 'n opsomming wat verouder voordat sy dit oopmaak, help niemand. Wat
// hier hoort, is genoeg om te weet of dit nou aandag verg: wie, watter boek,
// en watter nommer.
//
// WAARHEEN: ADMIN_EPOS as dit gestel is, anders die posbus self. Future
// Shop se eie adres is futureshop@futuresharp.co.za, en 'n pos van daardie
// posbus na homself kom deur — so werk dit sonder 'n nuwe veranderlike, en
// 'n ander adres is later net 'n instelling in Netlify.
function admin_adres() {
  return process.env.ADMIN_EPOS || process.env.EPOS_GEBRUIKER || "";
}

function bou_admin_pos(rekord, is_wysiging) {
  const titel = (rekord.data && rekord.data.titel) || "";
  const naam = titel || "sonder titel";
  const outeur = rekord.outeur_naam || "'n outeur";

  return {
    onderwerp: is_wysiging
      ? `Wysiging ingedien \u2014 ${naam}`
      : `Nuwe indiening \u2014 ${naam}`,
    opskrif: is_wysiging ? "'n Wysiging wag vir hantering" : "'n Nuwe indiening wag",
    reels: [
      is_wysiging
        ? `${ontsnap(outeur)} het 'n wysiging vir <b>${ontsnap(naam)}</b> ingedien.`
        : `${ontsnap(outeur)} het <b>${ontsnap(naam)}</b> ingedien.`,
      `Verwysing: ${ontsnap(rekord.nommer)}`,
    ],
    knoppie: { teks: "Maak die paneelbord oop", url: `${WERF_URL}/paneelbord.html` },
  };
}

// Soos die outeur se een: gee { gestuur, rede } terug en gooi nooit.
async function stuur_admin_indiening_kennisgewing(rekord, is_wysiging) {
  try {
    const aan = admin_adres();
    if (!aan) return { gestuur: false, rede: "geen admin-adres opgestel nie" };

    const { onderwerp, opskrif, reels, knoppie } = bou_admin_pos(rekord, Boolean(is_wysiging));

    const uitslag = await stuur_epos({ aan, onderwerp, opskrif, reels, knoppie });
    if (!uitslag.ok) {
      console.error(`Admin-pos vir ${rekord.nommer} het misluk:`, uitslag.fout);
      return { gestuur: false, rede: uitslag.fout };
    }
    return { gestuur: true, rede: null };
  } catch (fout) {
    console.error("Admin-pos het gestort:", fout && fout.message);
    return { gestuur: false, rede: (fout && fout.message) || "onbekende fout" };
  }
}

module.exports = {
  stuur_terugstuur_kennisgewing,
  stuur_admin_indiening_kennisgewing,
  bou_pos,
  bou_admin_pos,
};
