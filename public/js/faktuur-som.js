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

  /* DIE FOOI SE DELE MOET PRESIES TOT DIE FOOI TEL.

     Elke reël se deel is `Math.round(paystackSent × verhouding)`, en drie
     afrondings tel dalk een of twee sent langs die fooi. Die OORSKOT onderaan
     gebruik intussen die presiese `paystackSent`.

     Die gevolg was 'n stille teenstrydigheid op die skerm: op 28 Augustus 2026
     het drie reëls se "Na Future Sharp" −R0,02, +R0,01 en R0,00 gelees — saam
     −R0,01 — terwyl die somblok R0,00 gewys het. Twee paaie na dieselfde getal,
     met afrondings op verskillende plekke.

     Die LAASTE reël vang die verskil op. Dit is dieselfde beginsel as die
     oorskot self, wat reeds die afronding van die totaal dra: die verskil moet
     iewers land, en die laaste plek is die minste verrassende.

     Slegs die per-reël-syfers verander. Die totaal, die fooi, wat uitbetaal
     word en die oorskot bly presies wat hulle was. */
  const fooiDele = reels.map((rl, ix) => {
    if (terugwaarts) {
      const deel = bydraeSom > 0 ? bydraes[ix] / bydraeSom : 0;
      return Math.round(paystackSent * deel);
    }
    const deel = totaalSent > 0 ? bydraes[ix] / totaalSent : 0;
    return Math.round(paystackSent * deel);
  });

  if (fooiDele.length) {
    const som = fooiDele.reduce((a, b) => a + b, 0);
    fooiDele[fooiDele.length - 1] += paystackSent - som;
  }

  reels.forEach((rl, ix) => {
    let bedragSent, basisSent;
    if (terugwaarts) {
      // Die basis staan vas; die reël se bedrag is die basis plus sy deel
      // van die fooi.
      basisSent = bydraes[ix];
      bedragSent = basisSent + fooiDele[ix];
    } else {
      // Die bedrag staan vas; die basis is wat ná die fooi oorbly.
      bedragSent = bydraes[ix];
      basisSent = Math.max(0, bedragSent - fooiDele[ix]);
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
          // DIE REEL SE KATEGORIE GAAN SAAM. Sonder haar moet die staat 'n
          // uitbetaling se kategorie uit die BESKRYWING aflei, deur haar teen
          // die werk-itemregister se name te pas -- en 'n naam wat 'n dag
          // later anders getik word, val dan onder Ongekategoriseer.
          //
          // Sy word saam met die res gevries by uitreiking, dus verander 'n
          // latere wysiging aan die register niks aan 'n ou staat nie.
          kategorie_id: rl.kategorie_id || "",
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

// ---------------------------------------------------------------------------
// VAN 'N FAKTUURREKORD NA DIE SOM SE INVOER
//
// Hierdie vertaling het tot 15 Augustus in faktuur-backoffice.js gewoon, waar
// net die blaaier by hom kon kom. stuur-faktuur.js moet dieselfde som doen —
// die bedrae mag NOOIT van die kliëntkant af aanvaar word nie — en 'n tweede
// kopie daarvan sou beteken die skerm en die gevriesde verdeling kan met 'n
// sent verskil sonder dat iemand dit sien.
//
// Hy bly SUIWER: hy lees geen veld, raak geen DOM, en vra niks van 'n store
// nie. Wie 'n subrekening het, kom van buite af in as 'n toets — die blaaier
// gee sy gelaaide begunstigde-lys, die bediener gee die store.
//
// WAT DIE SOM INGEVOER KRY: ELKE FAKTUURREEL AS SY EIE REEL, met sy eie
// verdeling en sy eie Hosting daarop.
//
// TOT 25 AUGUSTUS 2026 HET HIERDIE VERTALER DIE HELE FAKTUUR PLAT GEVOU na
// een reel met die naam "Faktuur", en al die verdelingsrye in daardie een
// lys gegooi. Dit was reg solank die faktuur EEN verdeling gehad het.
//
// 'n Faktuur met 'n aanbieding, 'n vraelys en 'n verslag -- elk met sy eie
// ontvangers -- kon toe nie bestaan nie; 'n mens moes drie fakture uitreik
// en die skool moes drie keer betaal vir een stuk werk.
//
// fs_bereken() self het dit NOG ALTYD gekan. Dit neem reels[], gee elke reel
// sy eie basis, en versprei die fooi na verhouding. Net die vertaler het dit
// weggegooi. Sien Verdeling-Per-Lynitem-Ontwerp.md.
//
// DIE AFSLAG WORD NA VERHOUDING OOR DIE REELS VERSPREI.
//
// Dit is nie 'n nuwe besluit nie; dit hou die bestaande gedrag presies. Die
// afslag het nog altyd van die netto afgetrek voordat die persentasies loop,
// dus deel almal wat op 'n persentasie is die afslag, en 'n vaste bedrag word
// nie geraak nie. 'n Afslag wat op EEN reel land, sou daardie reel se
// ontvangers alleen laat betaal vir 'n toegewing wat vir die hele faktuur
// gegee is.
//
// BEGROTE KOSTE WORD NIE MEER 'N VERDELINGSRY NIE.
//
// Tot 25 Augustus het 'n begrote koste aan iemand met 'n subrekening
// outomaties 'n uitbetaling geword. Dit was 'n gerief toe daar EEN verdeling
// was en daardie ry net een plek gehad het om heen te gaan; met verdeling per
// reel bestaan daardie plek nie meer nie.
//
// En dit was in elk geval verkeerd: 'n begroting is 'n RAMING van wat julle
// verwag om te bestee. Word dit outomaties 'n betaling, betaal 'n mens iemand
// op grond van 'n skatting in plaas van op grond van 'n besluit. Wil 'n mens
// iemand se koste terugbetaal, is dit 'n REEL op die faktuur -- soort
// "koste", opgelos sodat die reel sy eie fooi dra -- en dan staan dit as 'n
// keuse op die dokument. Die begroting bly suiwer 'n maatstaf: sy vergelyk
// wat julle verwag het om te bestee met wat die faktuur inbring, en sy betaal
// niemand.
//
// DIE SKENKING KOM NIE HIER IN NIE, en dit is nie 'n vereenvoudiging nie. Gee
// 'n mens haar as 'n tweede reël, versprei die som die fooi pro rata: die
// faktuur se deel van die vaste R1,30 krimp, die basis groei, en elke
// begunstigde kry 'n sent of twee MEER omdat iemand 'n skenking bygevoeg het.
// Getoets: R1 000 het Eugene se bedrag met 2c verander. Die verdeling word dus
// op die FAKTUUR ALLEEN bereken; die skenking word daarna bygetel, dra haar
// eie deel van die werklike fooi, en die res val na die oorskot.
//
// faktuur      — die rekord se velde: reels (elk met sy eie verdeling en
//                hosting_pct), afslag_sent.
// het_subrekening — bly in die handtekening sodat elke oproeper onveranderd
//                bly. Hy word nie meer gebruik nie: die begrote koste was die
//                enigste plek wat gevra het wie 'n subrekening het, en 'n
//                verdelingsry kom nou altyd in, ook vir iemand wat met die
//                hand betaal word.
function fs_invoer_uit_faktuur(faktuur, het_subrekening) {
  const f = faktuur || {};

  // Die reëls dra hoeveelheid × eenheidsprys; die bedrag word hier gereken en
  // nooit van 'n gestoorde veld gelees nie — dieselfde reël as stoor-faktuur.js.
  const bedragSent = (r) =>
    Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0));

  const reelsomSent = (f.reels || []).reduce((s, r) => s + bedragSent(r), 0);

  // Die afslag mag nooit 'n reël onder nul druk nie, en die afslag wat
  // toegeken is, moet presies die afslag wees wat gegee is — die laaste reël
  // kry die res, sodat 'n afronding nie 'n sent laat wegraak nie.
  const afslagSent = Math.min(
    Math.max(0, Number(f.afslag_sent) || 0),
    reelsomSent
  );

  let toegeken = 0;
  const reels = (f.reels || []).map((r, ix, alles) => {
    const bruto = bedragSent(r);
    let deel;
    if (ix === alles.length - 1) {
      deel = afslagSent - toegeken;
    } else {
      deel = reelsomSent > 0 ? Math.round((afslagSent * bruto) / reelsomSent) : 0;
      toegeken += deel;
    }

    const rye = [];

    // Elke verdelingsry kom in, ook vir iemand sonder 'n subrekening — hy
    // word met die hand betaal, maar sy deel is steeds deel van die som.
    (r.verdeling || []).forEach((v) => {
      rye.push({
        ontvanger: v.ontvanger,
        tipe: v.tipe,
        waarde:
          v.tipe === "vas" ? (Number(v.waarde) || 0) / 100 : Number(v.waarde) || 0,
      });
    });

    // Hosting kry 'n ry op die skerm maar word NOOIT uitbetaal nie — dit bly
    // in die hoofrekening. Word dit ooit 'n Paystack-verdelingsry, word dit
    // uitbetaal EN daar bly niks vir Paystack nie.
    //
    // GEEN `|| 5`-TERUGVAL NIE. 'n Doelbewuste nul moet die rondreis oorleef:
    // op 'n kostereël beteken nul dat hosting nie gehef word nie, en dit is 'n
    // keuse, nie 'n weglating nie.
    // GEEN HOSTING OP 'N KOSTEREEL, EN DIE REEL STAAN HIER.
    //
    // Die skerm het hosting_pct op nul gesit sodra 'n reel na Uitgawe geskuif
    // is. Dit het gewerk, maar die getal was dan WEG: skuif 'n mens die reel
    // terug na Inkomste, staan die veld leeg en niks se dat die 5% verdwyn
    // het nie. Die model onthou nou wat getik is; hierdie funksie besluit of
    // dit tel.
    const hosting = r.soort === "koste" ? 0 : Number(r.hosting_pct);
    if (hosting > 0) {
      rye.push({ ontvanger: "Hosting", tipe: "pct", waarde: hosting });
    }

    return {
      soort: r.soort === "koste" ? "koste" : "verkoop",
      beskrywing: r.beskrywing || "",
      bedrag: Math.max(0, bruto - deel) / 100,
      verdeling: rye,
    };
  });

  return { rigting: "totaal", rond: 0, reels };
}

// Node kan dit ook laai, sodat die som getoets kan word sonder 'n blaaier —
// en sodat stuur-faktuur.js DIESELFDE lêer gebruik as die skerm.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fs_bereken,
    fs_basis_uit_rye,
    fs_invoer_uit_faktuur,
    FS_PS_PCT,
    FS_PS_VAS,
    FS_BLY_IN_HOOFREKENING,
  };
}
