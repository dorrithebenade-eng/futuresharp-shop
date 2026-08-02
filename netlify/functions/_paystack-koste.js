// Gedeelde helper: hoeveel moet Future Sharp se hoofrekening ten minste
// van 'n transaksie behou?
//
// WAAROM DIT BESTAAN (Augustus 2026)
//
// Die oorspronklike reël was 'n plat 3%. Dit is verkeerd, en dit is by 'n
// R50-leen ontdek: Paystack het die transaksie geweier met
// "Merchant share cannot be lower than zero".
//
// Paystack se fooi in Suid-Afrika is nie 'n suiwer persentasie nie —
// dit is 2,9% PLUS R1, en dan BTW op die hele fooi:
//
//     fooi = (0,029 × bedrag + R1,00) × 1,15
//          = 3,335% × bedrag + R1,15
//
// Bevestig teen 'n werklike transaksie op 2 Augustus 2026:
//     R100,00 → 3,335 + 1,15 = R4,485.  Paystack het R4,49 gehef.
//
// Die vaste deel is die probleem. Op R500 is 3% ruim; op R50 is 3% net
// R1,50 terwyl die werklike koste R2,82 is. Hoe kleiner die prys, hoe
// groter word die fooi as persentasie — en 'n plat persentasiereël sien
// dit glad nie raak nie.
//
// Ons hou dus 'n bietjie meer terug as die blote koste:
//
//     minimum = 3,5% × bedrag + R1,30
//
// Dit lê altyd bo die werklike fooi, met 'n klein marge vir wisseling in
// Paystack se tariewe of BTW.
//
//     Prys     Werklike fooi   Minimum      Marge
//     R10      R1,48           R1,65        R0,17
//     R50      R2,82           R3,05        R0,23
//     R100     R4,49           R4,80        R0,31
//     R250     R9,49           R10,05       R0,56
//     R500     R17,83          R18,80       R0,97
//
// LET WEL VIR PRYSSTELLING: by lae pryse is dit wiskundig onmoontlik om
// 'n outeur 90% te gee. Op R50 moet die hoofrekening 6,1% behou net om
// gelyk te breek. Dis nie 'n beperking van hierdie stelsel nie — dis wat
// Paystack se vaste fooi doen. 'n Boek teen R250+ dra 'n 90%-verdeling
// gemaklik; 'n boek teen R50 nie.

// Paystack SA, plaaslike kaart, met BTW ingereken.
const KOSTE_PERSENTASIE = 0.029;
const KOSTE_VAS_SENT = 100;
const BTW_FAKTOR = 1.15;

// Wat ons werklik terughou — die koste plus 'n klein marge.
const MINIMUM_PERSENTASIE = 0.035;
const MINIMUM_VAS_SENT = 130;

/**
 * Paystack se verwagte fooi op 'n bedrag, in sent (BTW ingesluit).
 * Slegs vir vertoon en vir die kommentaar hierbo — die minimum hieronder
 * is wat afgedwing word.
 */
function kry_paystack_fooi_sent(prys_sent) {
  if (!prys_sent || prys_sent <= 0) return 0;
  return Math.round((KOSTE_PERSENTASIE * prys_sent + KOSTE_VAS_SENT) * BTW_FAKTOR);
}

/**
 * Die minimum wat Future Sharp se hoofrekening moet behou, in sent.
 * Gratis items (prys 0) het geen transaksie en dus geen minimum nie.
 */
function kry_minimum_hoofrekening_sent(prys_sent) {
  if (!prys_sent || prys_sent <= 0) return 0;
  return Math.ceil(MINIMUM_PERSENTASIE * prys_sent) + MINIMUM_VAS_SENT;
}

/**
 * Dieselfde minimum, maar as 'n persentasie van die prys.
 * Die stoor-kant (skep-produk.js / wysig-produk.js) werk in persentasies,
 * want 'n verdeling kan as persentasie OF as vaste bedrag gestel word.
 *
 * Gee 0 terug vir 'n gratis item, en 100 as die prys so klein is dat die
 * fooi dit heeltemal opeet — dan kan daar niks verdeel word nie.
 */
function kry_minimum_hoofrekening_persentasie(prys_sent) {
  if (!prys_sent || prys_sent <= 0) return 0;
  const minimum_sent = kry_minimum_hoofrekening_sent(prys_sent);
  return Math.min(100, (minimum_sent / prys_sent) * 100);
}

/**
 * Die maksimum wat saam verdeel mag word (subrekeninge + hosting),
 * as 'n persentasie van die prys.
 */
function kry_maks_verdeling_persentasie(prys_sent) {
  return 100 - kry_minimum_hoofrekening_persentasie(prys_sent);
}

/**
 * Die maksimum wat saam verdeel mag word, in sent.
 */
function kry_maks_verdeling_sent(totaal_sent) {
  return Math.max(0, totaal_sent - kry_minimum_hoofrekening_sent(totaal_sent));
}

/**
 * 'n Leesbare boodskap vir die paneelbord wanneer 'n verdeling te hoog is.
 * Sê vir die gebruiker presies watter persentasie by HIERDIE prys geld —
 * "ten minste 3%" was misleidend, want die werklike vereiste hang van die
 * prys af.
 */
function beskryf_minimum(prys_sent) {
  const persentasie = kry_minimum_hoofrekening_persentasie(prys_sent);
  const rand = (kry_minimum_hoofrekening_sent(prys_sent) / 100).toFixed(2);
  return `ten minste ${persentasie.toFixed(1)}% (R${rand})`;
}

module.exports = {
  kry_paystack_fooi_sent,
  kry_minimum_hoofrekening_sent,
  kry_minimum_hoofrekening_persentasie,
  kry_maks_verdeling_persentasie,
  kry_maks_verdeling_sent,
  beskryf_minimum,
};
