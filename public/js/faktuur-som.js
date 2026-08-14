// public/js/faktuur-som.js
//
// DIE FAKTUUR SE SOM. Een berekening, en later meer as een gebruiker: die
// faktuurvorm se rekenaar op die rekenaarskerm, die foonaansig se opsomming,
// en die verdeling wat by uitreiking gevries word.
//
// Dit is 'n SUIWER funksie, presies soos verdeling-som.js — dit lees geen
// veld, raak geen DOM, en weet niks van 'n bladsy nie. Alles kom in as
// getalle, alles gaan uit as getalle.
//
// WAAROM DIT SAAK MAAK: Paystack weier 'n verdeling wat nie tot op die sent
// klop nie. By één outeur is afronding onbelangrik; by vier ontvangers is dit
// die verskil tussen 'n betaling wat deurgaan en een wat nie.
//
// ---------------------------------------------------------------------------
// DIE AFTREKSOM
//
// Die kliënt se bedrag kom EERSTE. Paystack se fooi word van bo af
// weggeneem. Wat oorbly, is wat verdeel word. Niks word bygetel nie en niks
// kan wegraak nie.
//
//     kliënt betaal  P
//     minus          Paystack (3,5% van P + R1,30)
//     = verdeelbaar  wat onder die rye loop
//
// Gevolge wat nie omgekeer mag word nie:
//
//   * Paystack is NIE 'n ontvanger nie. Hy is 'n geslote, berekende ry op
//     elke reël — nie 'n besluit nie, dus nie 'n keuse nie.
//   * Die fooi val op ELKE reël, ook 'n koste. 'n Kostereël van R2 000 gee
//     die persoon dus R1 930 terug; om hom heel te kry, moet die REËL hoër
//     wees. Dit is wat die vorm se "los op"-knoppie doen.
//   * Hosting en Future Sharp kry wel 'n ry op die skerm, maar word NOOIT
//     uitbetaal nie — hulle geld bly in die hoofrekening. Skep 'n mens 'n
//     werklike verdelingsry daarvoor, word dit uitbetaal EN daar bly niks
//     vir Paystack nie. Dieselfde slaggat as die winkel se oorskot.
//   * Wat oorbly heet die OORSKOT. Nie "direkteursfooie" nie.
//
// DIE MINIMUM IS NIE DIE FOOI NIE. Die werklike fooi is 3,335% + R1,15; wat
// by stoortyd vereis word, is 3,5% + R1,30. Ons reken met die MINIMUM, en
// altyd met die duurste geval (kaart). Betaal die kliënt per Instant EFT of
// Capitec Pay — 2%, geen vaste fooi — bly die verskil in die hoofrekening.
// Dit dwaal in die veilige rigting.
//
// Math.ceil, nooit Math.round nie: 'n afronding wat afwaarts gaan, kan die
// bedrag onder Paystack se minimum druk.

// Paystack se AFGEDWINGE MINIMUM, nie sy fooi nie. Sien _paystack-koste.js.
const FS_PS_PCT = 3.5;
const FS_PS_VAS = 1.30;

// Ontvangers wat op die skerm 'n ry kry maar nooit uitbetaal word nie. Hulle
// geld bly in die hoofrekening. Die som moet dit weet, want dit is die enigste
// plek waar die onderskeid tot op die sent tel.
const FS_BLY_IN_HOOFREKENING = ["Hosting", "Future Sharp"];

// Twee invoerrigtings, soos in die winkel se rekenaar:
//
//   rigting "totaal"  — jy tik elke reël se bedrag in. Paystack kom af, die
//                       persentasies loop op wat oorbly, en die totaal is die
//                       som van die reëls.
//   rigting "bedrae"  — jy tik in elke ry wat daardie persoon in die hand moet
//                       hê. Die reël se bedrag word bereken, en die totaal wat
//                       die kliënt moet betaal, word daaruit opgelos.
//
// invoer = { reels, rigting, rond }
//   reels: [{ soort: "verkoop" | "koste", beskrywing, bedrag,
//             verdeling: [{ ontvanger, tipe: "pct" | "vas", waarde }] }]
function fs_bereken(invoer) {
  const inv = invoer || {};
  const reels = inv.reels || [];
  const rond = Number(inv.rond) || 0;
  const terugwaarts = inv.rigting === "bedrae";

  let P, P_rou;

  if (terugwaarts) {
    // Elke ry se bedrag is wat die persoon moet KRY. Die reël se basis volg
    // daaruit, en die totaal word daaruit opgelos:
    //     P − (3,5% van P + R1,30) = die som van die basisse
    let basisSom = 0;
    reels.forEach((rl) => {
      basisSom += fs_basis_uit_rye(rl);
    });
    P = basisSom > 0 ? (basisSom + FS_PS_VAS) / (1 - FS_PS_PCT / 100) : 0;
    P_rou = P;
    if (rond > 0 && P > 0) P = Math.ceil(P / rond) * rond;
    P = Math.ceil(P * 100) / 100;
  } else {
    // Die reëls dra die bedrae; die totaal volg.
    P = reels.reduce((s, rl) => s + (Number(rl.bedrag) || 0), 0);
    P_rou = P;
    if (rond > 0 && P > 0) P = Math.ceil(P / rond) * rond;
    P = Math.ceil(P * 100) / 100;
  }

  // Alles hierna loop in SENT. Rand met desimale tel nie betroubaar op nie,
  // en dit is presies waar 'n sent verlore raak.
  const totaalSent = Math.round(P * 100);
  const paystackSent =
    P > 0 ? Math.round(((FS_PS_PCT / 100) * P + FS_PS_VAS) * 100) : 0;
  const verdeelbaarSent = totaalSent - paystackSent;

  // Wat elke reël aan die totaal bydra. Die fooi word na verhouding oor die
  // reëls versprei — andersins sou een reël die hele vaste R1,30 dra.
  const bydraes = reels.map((rl) =>
    terugwaarts
      ? Math.round(fs_basis_uit_rye(rl) * 100)
      : Math.round((Number(rl.bedrag) || 0) * 100)
  );
  const bydraeSom = bydraes.reduce((a, b) => a + b, 0);

  const ontvangers = [];
  const perReel = [];
  let hostingSent = 0;

  reels.forEach((rl, ix) => {
    let bedragSent, basisSent;
    if (terugwaarts) {
      // Die basis staan vas; die reël se bedrag is die basis plus sy deel
      // van die fooi.
      basisSent = bydraes[ix];
      const deel = bydraeSom > 0 ? basisSent / bydraeSom : 0;
      bedragSent = basisSent + Math.round(paystackSent * deel);
    } else {
      // Die bedrag staan vas; die basis is wat ná die fooi oorbly.
      bedragSent = bydraes[ix];
      const deel = totaalSent > 0 ? bedragSent / totaalSent : 0;
      basisSent = Math.max(0, bedragSent - Math.round(paystackSent * deel));
    }

    let toegekenSent = 0;
    (rl.verdeling || []).forEach((v) => {
      // 'n Persentasie loop op die BASIS — wat ná Paystack oorbly — nooit op
      // die reël se volle bedrag nie.
      const rand =
        v.tipe === "pct"
          ? ((Number(v.waarde) || 0) / 100) * (basisSent / 100)
          : Number(v.waarde) || 0;
      const sent = Math.round(rand * 100);

      if (v.ontvanger === "Hosting") {
        hostingSent += sent;
      } else if (v.ontvanger && v.ontvanger !== "Future Sharp") {
        ontvangers.push({
          naam: v.ontvanger,
          wat: rl.beskrywing,
          soort: rl.soort === "koste" ? "koste terug" : "verdienste",
          sent,
        });
      }
      // Future Sharp se ry tel wel by die toegekende bedrag — dit is hoekom
      // die reël se "bly in die hoofrekening" krimp — maar dit word nooit 'n
      // uitbetaling nie.
      toegekenSent += sent;
    });

    perReel.push({ basisSent, toegekenSent, bedragSent });
  });

  const uitSent = ontvangers.reduce((s, o) => s + o.sent, 0);

  // Die oorskot is wat OORBLY, nie 'n ry nie. Dit is ook waar 'n afronding
  // land: rond 'n mens R16 073,03 op na R16 075, is daardie R1,97 hier.
  const oorskotSent = totaalSent - uitSent - paystackSent - hostingSent;

  return {
    P,
    P_rou,
    afgerond: Math.abs(P - P_rou) > 0.005,
    rondBy: P - P_rou,
    paystack: paystackSent / 100,
    verdeelbaar: verdeelbaarSent / 100,
    hosting: hostingSent / 100,
    ontvangers,
    perReel,
    uitbetaal: uitSent / 100,
    oorskot: oorskotSent / 100,
    // Die rye vra meer as wat die faktuur inbring. Dan kan Paystack se fooi
    // nie betaal word nie en die transaksie word geweier.
    oorbestee: oorskotSent < 0,
  };
}

// Wat 'n reël se basis moet wees sodat elke ry kry wat hy moet kry.
//     basis = vaste bedrae / (1 − die persentasies)
function fs_basis_uit_rye(reel) {
  const rye = (reel && reel.verdeling) || [];
  const vas = rye
    .filter((v) => v.tipe === "vas")
    .reduce((s, v) => s + (Number(v.waarde) || 0), 0);
  const pct = rye
    .filter((v) => v.tipe === "pct")
    .reduce((s, v) => s + (Number(v.waarde) || 0), 0);
  return pct < 100 ? vas / (1 - pct / 100) : vas;
}

// Node kan dit ook laai, sodat die som getoets kan word sonder 'n blaaier.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fs_bereken,
    fs_basis_uit_rye,
    FS_PS_PCT,
    FS_PS_VAS,
    FS_BLY_IN_HOOFREKENING,
  };
}
