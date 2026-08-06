// public/js/verdeling-som.js
//
// DIE SOM. Een berekening, drie gebruikers: die Verdeling-rekenaar in die
// paneelbord, die outeur se indienvorm, en die deurtrek na die produkvorm.
//
// Dit is doelbewus 'n SUIWER funksie — dit lees geen velde, raak geen DOM,
// en weet niks van 'n bladsy nie. Alles kom in as getalle, alles gaan uit as
// getalle. Dit is wat dit moontlik maak om dieselfde som op 'n outeur se
// skerm en in die paneelbord te laat loop.
//
// WAAROM DIT SAAK MAAK: verskil twee weergawes met 'n sent, weier
// skep-produk.js die boek — en dan is dit 'n outeur wat die fout sien, nie
// Dorrithé nie.
//
// DIE MODEL: die boek het EEN prys. Wat 'n harde kopie duurder maak, is nie
// 'n ander verdeling nie — dit is versending wat bo-op kom.
//
//     e-boek en leen:  prys = boekprys
//     harde kopie:     prys = boekprys + (eie koste / 0,965)
//
// Die 0,965 is 1 minus die afgedwinge 3,5%. Daardie opstoot bly in die
// hoofrekening en betaal Paystack se fooi op die versending. Die outeur kry
// sy koste PRESIES terug, nie die opgestote bedrag nie — gee 'n mens hom die
// R51,81 in plaas van sy R50, dra Future Sharp die fooi steeds.

const VS_KOSTE_DEELTAL = 0.965;

// Twee invoerrigtings. In prys-modus is die getal die boekprys; in
// wins-modus is dit die outeur se verlangde wins en die boekprys word
// daaruit bereken.
function vs_bereken(invoer) {
  const o = invoer || {};
  const outeurPct = Number(o.outeurPct) || 0;
  const begin = Number(o.begin) || 0;
  const K = Number(o.koste) || 0;
  const rond = Number(o.rond) || 0;

  const kosteDeel = K > 0 ? K / VS_KOSTE_DEELTAL : 0;
  const boekprys = o.modus === "wins"
    ? (outeurPct > 0 ? begin / (outeurPct / 100) : 0)
    : begin;

  let P = boekprys + kosteDeel;

  if (P <= 0) {
    return {
      leeg: true, P: 0, P_rou: 0, afgerond: false,
      B: 0, kosteDeel: 0, outeurVasteRand: 0, outeurPersRand: 0,
      outeurRand: 0, outeurWins: 0, K: 0, paystackRand: 0,
      hostingRand: 0, adminRand: 0, ontwerpRand: 0,
      futureSharpRand: 0, direkteursRand: 0,
    };
  }

  const P_rou = P;
  // OPWAARTS, nooit afwaarts nie - 'n afronding wat afgaan, kan die prys
  // onder Paystack se minimum druk.
  if (rond > 0) P = Math.ceil(P / rond) * rond;

  // Ná afronding is die boekdeel wat werklik oorbly die basis vir elke
  // persentasie. Andersins tel die afronding stil by iemand se deel.
  const B = Math.max(0, P - kosteDeel);

  // Die outeur kry twee dinge: sy koste terug as 'n vaste bedrag, en sy
  // persentasie op die boekprys. In die katalogus is dit twee rye wat
  // bymekaar tel.
  const outeurVasteRand = K;
  const outeurPersRand = (outeurPct / 100) * B;
  const outeurRand = outeurVasteRand + outeurPersRand;

  // Paystack reken op die VOLLE prys — hy weet niks van boekdele nie.
  const paystackRand =
    ((Number(o.paystackPct) || 0) / 100 * P + (Number(o.paystackVaste) || 0)) *
    (1 + (Number(o.btwPct) || 0) / 100);

  // Die res geld op die boekprys. Andersins verdien Future Sharp op die
  // outeur se posgeld.
  const hostingRand = ((Number(o.hostingPct) || 0) / 100) * B;
  const adminRand = ((Number(o.adminPct) || 0) / 100) * B;
  const ontwerpRand = ((Number(o.ontwerpPct) || 0) / 100) * B;

  const futureSharpRand = P - outeurRand;

  return {
    leeg: false,
    P, P_rou, afgerond: Math.abs(P - P_rou) > 0.005,
    B, kosteDeel,
    outeurVasteRand, outeurPersRand, outeurRand,
    outeurWins: outeurPersRand,
    K,
    paystackRand, hostingRand, adminRand, ontwerpRand,
    futureSharpRand,
    direkteursRand: futureSharpRand - paystackRand - hostingRand - adminRand - ontwerpRand,
  };
}

// Node kan dit ook laai, sodat die som getoets kan word sonder 'n blaaier.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { vs_bereken, VS_KOSTE_DEELTAL };
}
