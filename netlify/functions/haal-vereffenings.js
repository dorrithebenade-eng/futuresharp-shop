// netlify/functions/haal-vereffenings.js
//
// GESKEDULEERD -- 03:45 UTC daagliks, dit is 05:45 in Suid-Afrika. Die skedule
// staan in netlify.toml, nie hier nie.
//
// Dit haal Paystack se vereffenings vir die afgelope SEWE dae -- die
// hoofrekening s'n en die subrekeninge s'n kom in dieselfde lys -- en skryf
// hulle na die store. Die werk self leef in _vereffening-haal.js, wat
// haal-vereffenings-inhaal.js ook gebruik.
//
// WAAROM 03:45 EN NIE 03:30 NIE. haal-paystack.js loop om 03:30. Die
// vereffening verwys na transaksies, dus loop sy NA hulle: dan is die
// transaksie wat sy noem reeds in die ander store. Twee geskeduleerde funksies
// op dieselfde minuut is nie 'n fout nie, maar hul logs lees dan deurmekaar.
//
// DIT LOOP NIE VIR 'N MENS NIE. Daar is geen rol-kontrole nie omdat daar geen
// aanroeper is nie; Netlify roep dit self aan en 'n geskeduleerde funksie is
// nie oor HTTP bereikbaar nie. Die uitslag staan in die funksie se log.

const { haal_vereffenings, dae_terug, vandag } = require("./_vereffening-haal");

// SEWE DAE, NIE EEN NIE. Dieselfde rede as by die transaksies, plus een wat
// hier eie is: 'n vereffening wat gister `processing` was, is vandag `success`,
// en die tweede loop werk daardie rekord by in plaas van 'n nuwe te skep.
const VENSTER_DAE = 7;

exports.handler = async () => {
  const van = dae_terug(VENSTER_DAE);
  const tot = vandag();

  try {
    const uitslag = await haal_vereffenings(van, tot);

    console.log(
      `Vereffening-afhaal ${van} tot ${tot}: ${uitslag.gehaal} gehaal, ` +
        `${uitslag.geskryf} geskryf. Per ontvanger: ` +
        uitslag.per_ontvanger.map((o) => `${o.naam} ${o.geskryf}`).join(", ")
    );
    if (uitslag.foute.length) {
      console.error("Vereffening-afhaal se foute:", uitslag.foute);
    }

    return { statusCode: 200, body: "Klaar" };
  } catch (fout) {
    // 'n FOUT HIER MOET LUID WEES. Misluk die afhaal stil, weet niemand dat die
    // uitbetalings agter raak nie.
    console.error("Vereffening-afhaal het misluk:", fout);
    return { statusCode: 500, body: "Die afhaal het misluk" };
  }
};
