// netlify/functions/haal-paystack.js
//
// GESKEDULEERD -- 03:30 UTC daagliks, dit is 05:30 in Suid-Afrika. Die
// skedule staan in netlify.toml, nie hier nie.
//
// Dit haal Paystack se transaksielys vir die afgelope SEWE dae en skryf elke
// geslaagde transaksie na die store. Die werk self leef in _paystack-haal.js,
// wat haal-paystack-inhaal.js ook gebruik.
//
// WAAROM 03:30 EN NIE 04:00 NIE. leen-herinnering.js loop om 04:00. Twee
// geskeduleerde funksies op dieselfde minuut is nie 'n fout nie, maar die een
// se log word dan deur die ander s'n deurmekaar gelees.
//
// DIT LOOP NIE VIR 'N MENS NIE. Daar is geen rol-kontrole nie omdat daar geen
// aanroeper is nie; Netlify roep dit self aan en 'n geskeduleerde funksie is
// nie oor HTTP bereikbaar nie. Dit stuur dus niks terug wat iemand lees nie --
// die uitslag staan in die funksie se log.

const { haal_paystack_transaksies, dae_terug, vandag } = require("./_paystack-haal");

// SEWE DAE, NIE EEN NIE. Loop die skedule een nag nie -- 'n ontplooiing, 'n
// storing by Netlify -- is daar geen gat nie: die volgende loop dek daardie
// dag steeds. Die sleutel is deterministies, dus is die oorvleueling geen
// duplikaat nie.
const VENSTER_DAE = 7;

exports.handler = async () => {
  const van = dae_terug(VENSTER_DAE);
  const tot = vandag();

  try {
    const uitslag = await haal_paystack_transaksies(van, tot);

    console.log(
      `Paystack-afhaal ${van} tot ${tot}: ${uitslag.gehaal} gehaal, ` +
        `${uitslag.geskryf} geskryf, ${uitslag.oorgeslaan} oorgeslaan.`
    );
    if (uitslag.foute.length) {
      console.error("Paystack-afhaal se foute:", uitslag.foute);
    }

    return { statusCode: 200, body: "Klaar" };
  } catch (fout) {
    // 'n FOUT HIER MOET LUID WEES. Misluk die afhaal stil, ontbreek daardie
    // dag se transaksies in die joernaal en niemand merk dit op nie.
    console.error("Paystack-afhaal het misluk:", fout);
    return { statusCode: 500, body: "Die afhaal het misluk" };
  }
};
