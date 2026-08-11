// netlify/functions/_kennisgewing-bank.js
//
// Die pos aan admin wanneer 'n outeur 'n verandering van sy
// bankbesonderhede versoek.
//
// EEN POS, EN NET EEN. Die outeur kry niks: hy sien die versoek hangend op
// sy eie skerm die oomblik wanneer hy dit stuur, en 'n pos wat sê wat hy 'n
// sekonde gelede self gedoen het, is die soort pos wat 'n kanaal doodmaak.
// Wanneer die verandering deurgevoer is, sien hy dit op dieselfde skerm.
//
// DIE POS DRA GEEN BANKBESONDERHEDE NIE. Nie die rekeningnommer nie, nie
// die takkode nie. Wie dit lees, gaan in elk geval in die paneelbord kyk,
// en 'n rekeningnommer wat deur 'n gewone posbus loop en daarna in 'n
// e-posargief bly staan, is 'n risiko sonder 'n opweegbare voordeel. Wat
// hier hoort, is wie en wanneer.
//
// GOOI NOOIT. Soos die ander kennisgewing-modules: { gestuur, rede } terug,
// sodat 'n stukkende posbediener nie 'n versoek wat reeds gestoor is, as 'n
// 500 laat lyk nie.

const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie — die wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener land.
const WERF_URL = "https://futureshop.futuresharp.co.za";

function admin_adres() {
  return process.env.ADMIN_EPOS || process.env.EPOS_GEBRUIKER || "";
}

function bou_admin_pos(outeur_naam, het_opmerking) {
  const naam = outeur_naam || "'n outeur";

  return {
    onderwerp: "Bankbesonderhede \u2014 verandering versoek",
    opskrif: "'n Verandering van bankbesonderhede wag",
    reels: [
      `${ontsnap(naam)} het 'n verandering van sy bankbesonderhede versoek.`,
      het_opmerking
        ? "Die nuwe besonderhede en sy opmerking staan in die paneelbord."
        : "Die nuwe besonderhede staan in die paneelbord.",
      "Verander dit eers by die betaaldiens, en merk dit dan as gedoen \u2014 dit is die stap wat die rekord bywerk.",
    ],
    knoppie: { teks: "Maak die paneelbord oop", url: `${WERF_URL}/paneelbord.html` },
  };
}

async function stuur_bankversoek_kennisgewing(outeur_naam, het_opmerking) {
  try {
    const aan = admin_adres();
    if (!aan) return { gestuur: false, rede: "geen admin-adres opgestel nie" };

    const { onderwerp, opskrif, reels, knoppie } = bou_admin_pos(
      outeur_naam,
      Boolean(het_opmerking)
    );

    const uitslag = await stuur_epos({ aan, onderwerp, opskrif, reels, knoppie });
    if (!uitslag.ok) {
      console.error("Bankversoek-pos het misluk:", uitslag.fout);
      return { gestuur: false, rede: uitslag.fout };
    }
    return { gestuur: true, rede: null };
  } catch (fout) {
    console.error("Bankversoek-pos het gestort:", fout && fout.message);
    return { gestuur: false, rede: (fout && fout.message) || "onbekende fout" };
  }
}

module.exports = { stuur_bankversoek_kennisgewing, bou_admin_pos };
