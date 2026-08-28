// public/js/faktuur-vorm.js
//
// Die faktuurvorm. Slag een: die DOKUMENT — die kliënt, die reëls, die
// somme, die aantekening, die twee betaalpaaie, en die outostoor.
//
// Die backoffice (die begroting en die verdeling) kom in die volgende slag.
// Hulle word doelbewus apart gebou: die dokument bepaal die totaal, die
// backoffice verdeel dit, en 'n fout in die een moet nie soos 'n fout in die
// ander lyk nie.
//
// ─────────────────────────────────────────────────────────────────────────
// DIE TAAL LOOP LANGS TWEE PAAIE, EN HULLE MAG NIE MENG NIE
//
//   die BLADSY   — t() en data-i18n. Die platform se taal, uit localStorage.
//                  Dit is julle skerm.
//   die DOKUMENT — t_in(sleutel, V.taal). Die FAKTUUR se eie taalveld, wat
//                  op die rekord gestoor word.
//
// 'n Skool in die Wes-Kaap en 'n departement in Gauteng kry nie noodwendig
// dieselfde een nie, en die keuse mag nie 'n stelselinstelling wees wat by
// die volgende faktuur verkeerd staan nie. Gebruik 'n mens t() binne die
// dokument, druk elke faktuur in die taal wat toevallig in hierdie blaaier
// gekies is.
//
// ─────────────────────────────────────────────────────────────────────────
// ALLES IS SENT
//
// Rand met desimale tel nie betroubaar op nie. Die vorm hou sent, wys rand,
// en stuur sent. Die bediener reken die bedrae in elk geval self oor — 'n
// getal wat afgelei kan word, word nooit van hier af vertrou nie.

/* ═══ die toestand ═══ */
// Die hosting wat 'n NUWE inkomstereel begin met. 'n Verstek, nie 'n
// afdwinging: elke reel se persentasie word daarna per reel gestel, en 'n
// doelbewuste nul oorleef die rondreis.
const HOSTING_VERSTEK = 5;

// EEN plek waar 'n nuwe reel gemaak word. Was dit twee keer ingetik, kry die
// eerste reel van 'n faktuur ander velde as die tweede -- en dan werk die
// verdeling op die een en nie op die ander nie.
/* ═══ EEN VORM, TWEE DOKUMENTE ═══════════════════════════════════════════

   `?soort=kwotasie` maak van hierdie bladsy 'n kwotasievorm. Alles anders bly
   presies dieselfde: die reels, die invou, die verdeling, die begroting, die
   som, die ontdoen, die foonaansig.

   WAAROM NIE 'N TWEEDE VORM NIE: die kwotasie en die faktuur deel die reels,
   die verdeling en `faktuur-som.js`. Twee vorms sou binne 'n maand uitmekaar
   loop, en dit sou STIL gebeur -- die een sou 'n regstelling kry en die ander
   nie.

   WAT VERSKIL, en dit is alles:

     die drie eindpunte        stoor-, kry-, uitreik-
     die opskrif               KWOTASIE teenoor PROFORMA-FAKTUUR
     "Gekwoteer aan"           teenoor "Gefaktureer aan"
     "Totaal"                  teenoor "Totaal verskuldig"
     "Kwotasietotaal"          teenoor "Faktuurtotaal" in die backoffice
     "Geldig tot"              teenoor "Betaalbaar teen" -- ANDER VELDE, nie
                               net ander woorde: geldig_tot KEER aanvaarding,
                               betaalbaar_teen keer niks
     die betaalblok            val weg. 'n Kwotasie is nie betaalbaar nie.
     die pad terug             na die Kwotasies-pil

   DIE SOORT KOM UIT DIE URL EN VERANDER NOOIT. Hy word een keer gelees en
   daarna nêrens weer nie -- 'n bladsy wat halfpad van dokument verwissel, is
   'n bladsy wat 'n kwotasie na stoor-faktuur.js kan stuur. */
const SOORT =
  new URLSearchParams(window.location.search).get("soort") === "kwotasie"
    ? "kwotasie"
    : "faktuur";

const IS_KW = SOORT === "kwotasie";

// Die drie eindpunte. Hulle staan HIER en nêrens anders nie: 'n fetch met 'n
// hardgekodeerde naam iewers in die lêer is presies hoe die kwotasie stilweg
// by die faktuur se store beland.
const EIND = IS_KW
  ? { stoor: "stoor-kwotasie", kry: "kry-kwotasie", veld: "kwotasie" }
  : { stoor: "stoor-faktuur", kry: "kry-faktuur", veld: "faktuur" };

// Die sleutel wat die skerm se woord kies. Die DOKUMENT se woorde loop deur
// dt() met die dokument se eie taal; hierdie een is vir die skerm.
function soort_t(kw_sleutel, f_sleutel, verstek) {
  return fv_t(IS_KW ? kw_sleutel : f_sleutel, verstek);
}

function nuwe_reel() {
  return {
    soort: "verkoop",
    beskrywing: "",
    hoeveelheid: 1,
    prys_pp_sent: 0,
    // 'n Nuwe reël staan op haar eie. Die `+` op 'n bestaande reël stel
    // `vou_in` self — sien voeg_reel_in().
    vou_in: false,
    hosting_pct: HOSTING_VERSTEK,
    verdeling: [],
  };
}

const V = {
  sleutel: null,          // null = nog nooit gestoor nie
  nommer: null,
  stand: "konsep",
  taal: "af",             // die DOKUMENT se taal
  klient_id: null,
  klient: { naam: "", kontakpersoon: "", epos: "", selfoon: "", adres: "" },
  bestelnommer: "",
  // ELKE REEL DRA SY EIE VERDELING EN SY EIE HOSTING (25 Augustus 2026).
  // Die reels en die verdeling is EEN lys: tik iemand 'n reel by, kom die
  // reel dadelik in die backoffice se verdelingsblok.
  reels: [],              // { soort, beskrywing, hoeveelheid, prys_pp_sent,
                          //   vou_in, hosting_pct, verdeling: [] }
                          //
                          // `vou_in` beteken: hierdie reël se bedrag tel by
                          // die reël BO HAAR wanneer die dokument druk. Die
                          // VOLGORDE is dus die groepering — geen tweede
                          // naamveld nie. Sien
                          // Reels-Invou-En-Volgorde-Ontwerp.md.
  dokument_nota: "",
  afslag_sent: 0,
  skenking_sent: 0,
  koepon_kode: null,
  // Die backoffice s'n. Hulle leef HIER, in een toestand, want die
  // faktuurtotaal en die verdeling is een som — nie twee skerms wat mekaar
  // se getalle raai nie.
  // Die begroting BLY op faktuurvlak. Sy is 'n MAATSTAF -- wat julle verwag
  // om te bestee -- en sy hang aan die werk, nie aan 'n bepaalde reel nie.
  // Sy betaal ook niemand: 'n uitbetaling gebeur slegs deur 'n reel se
  // verdeling, sodat elke betaling gekies is en nie uit 'n raming afgelei.
  koste: [],              // { beskrywing, ontvanger, bedrag_sent, inskrywing }
  hosting_pct: 5,
  betaalbaar_teen: null,

  // SLEGS OP 'N KWOTASIE. Hulle bly leeg op 'n faktuur en gaan nooit na
  // stoor-faktuur.js nie -- liggaam() stuur hulle net wanneer IS_KW.
  geldig_tot: null,
  hersiening: 1,
  geskep_op: null,
  betaalskakel: null,
};

let SESSIE = null;

// DIE SEIN DAT DIE FAKTUUR GELAAI IS. faktuur-uitreik.js het dit nodig: hy
// mag nie die stand lees terwyl laai_faktuur() nog loop nie, anders sien hy
// 'n uitgereikte faktuur as 'n konsep. 'n Vaste wagtyd is 'n raaiskoot; dit
// is die feit.
let FV_GELAAI = false;

// DIE MAATSKAPPY SE BESONDERHEDE, uit die instelling. Hulle staan op die
// dokument se kop en in die bankblok — twee plekke wat tot 16 Augustus elk sy
// eie vasgespykerde teks gedra het. Nou is daar een bron.
//
// Misluk die lees, bly dit null en die blokke word nie herteken nie: die
// bladsy se eie teks bly staan. 'n Faktuur met 'n ou adres is beter as 'n
// faktuur met 'n leë kop.
let MAATSKAPPY = null;
let KLIENTE = [];
let VUIL = false;         // daar is veranderinge wat nog nie gestoor is nie
let BESIG = false;
let TYD = null;

/* ═══ die twee vertaalpaaie ═══ */

// Die BLADSY se taal. Dieselfde patroon as faktuurpaneel.js: t() gee die
// sleutel terug wanneer hy hom nie ken nie, dus geld die verstek slegs
// wanneer taal.js glad nie gelaai het nie of die sleutel nog nie bygekom het
// nie.
function fv_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

// Die DOKUMENT se taal. t_in() neem die taal as argument.
function dt(sleutel, verstek) {
  const uit = window.t_in ? window.t_in(sleutel, V.taal) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

/* ═══ getalle en teks ═══ */
// Die formateerder leef in taal.js — die desimaalteken is 'n taalsaak. Hier
// geld die FAKTUUR se taal, dieselfde bron as dt(): dit is die klient se
// dokument, nie jou skerm nie. In Engels word die komma 'n punt.
function rand(sent) {
  return window.t_rand
    ? t_rand(sent, V.taal)
    : "R" + (Number(sent || 0) / 100).toFixed(2);
}

// Rand-teks na sent. Die gebruiker tik "1 250,50" of "1250.5"; albei moet
// werk. Math.round en nie parseInt nie: 12,505 sent bestaan nie.
function na_sent(teks) {
  const skoon = String(teks == null ? "" : teks)
    .replace(/\s/g, "")
    .replace(/[Rr]/g, "")
    .replace(",", ".");
  const getal = Number(skoon);
  return Number.isFinite(getal) && getal > 0 ? Math.round(getal * 100) : 0;
}

function sent_as_teks(sent) {
  return (Number(sent || 0) / 100).toFixed(2);
}

// Leeg by nul. Die plekhouer wys 0,00 in grys, sodat 'n mens weet wat die
// veld verwag sonder dat daar iets is om uit te vee.
function veld_sent(sent) {
  return Number(sent) ? (Number(sent) / 100).toFixed(2) : "";
}
function veld_getal(n) {
  return Number(n) ? String(n) : "";
}

function ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Die datum word met fd_maande gebou, NIE met toLocaleDateString nie —
// daardie een gee die blaaier se taal, wat 'n derde bron sou wees naas die
// platform en die faktuur.
function dok_datum(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const maande = dt("fd_maande", "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Des").split(",");
  return `${d.getDate()} ${maande[d.getMonth()] || ""} ${d.getFullYear()}`;
}

// Vir 'n <input type="date">, wat altyd YYYY-MM-DD wil hê.
function invoer_datum(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/* ═══ die somme op die dokument ═══
   Reëls minus afslag, plus skenking. Die verdeling loop op die totaal en dit
   is die backoffice se werk; hier gaan dit net oor wat die kliënt sien. */
function reelsom() {
  return V.reels.reduce(
    (s, r) => s + Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)),
    0
  );
}
function totaal() {
  return Math.max(0, reelsom() - V.afslag_sent) + V.skenking_sent;
}

/* ═══ teken ═══ */

function teken_klient() {
  const plek = document.getElementById("d-klient");
  if (!plek) return;
  const k = V.klient || {};
  if (!V.klient_id) {
    plek.innerHTML = `<span class="leeg">${fv_t("fv_geen_klient", "Nog geen kliënt gekies nie")}</span>`;
    return;
  }
  const reels = [`<strong>${ontsnap(k.naam)}</strong>`];
  if (k.kontakpersoon) reels.push(ontsnap(k.kontakpersoon));
  if (k.adres) reels.push(`<span class="adres">${ontsnap(k.adres)}</span>`);
  plek.innerHTML = reels.join("<br>");
}

/* ═══ DIE INVOU ═══════════════════════════════════════════════════════════

   'n Reël met `vou_in` se bedrag tel by die reël BO HAAR wanneer die dokument
   druk. Die VOLGORDE is dus die groepering: geen tweede naamveld nie, want die
   naam wat die kliënt sien, is 'n gewone reël wat reeds getik word.

   Dit raak NIKS aan die som nie. Die verdeling, die fooi, die hosting, die
   gevriesde verdeling, die staat en die joernaal loop almal op die REELS.
   Slegs die drukwerk groepeer.

   EEN VLAK, NOOIT MEER. 'n Groep binne 'n groep is 'n boom, en dan vra 'n mens
   wie die fooi dra en wat op die dokument staan.

   Sien Reels-Invou-En-Volgorde-Ontwerp.md. */

// DIE EERSTE REEL VOU NOOIT IN NIE — daar is niks bo haar nie. Elke plek wat
// `vou_in` verander of 'n reël skuif, loop hierdeur. stoor-faktuur.js dwing
// dit ook af; die vorm is nie die poort nie.
function herstel_reels() {
  if (V.reels.length) V.reels[0].vou_in = false;
}

// Die begin van die blok waarin reël `i` lê, en die eerste reël daarna.
function blok_van(i) {
  let begin = i;
  while (begin > 0 && V.reels[begin].vou_in) begin -= 1;
  let einde = begin + 1;
  while (einde < V.reels.length && V.reels[einde].vou_in) einde += 1;
  return { begin, einde };
}

// Hoeveel reëls onder hierdie een invou. Nul beteken sy is nie 'n dra-reël nie.
function kinders_van(i) {
  if (V.reels[i].vou_in) return 0;
  return blok_van(i).einde - i - 1;
}

/* Wanneer 'n pyltjie werklik iets kan doen. 'n Pyltjie wat aan lyk maar niks
   doen nie, is erger as een wat af is. */
function kan_op(i) {
  if (!V.reels[i].vou_in) return blok_van(i).begin > 0;
  return i - 1 > blok_van(i).begin;
}
function kan_af(i) {
  if (!V.reels[i].vou_in) return blok_van(i).einde < V.reels.length;
  return i + 1 < blok_van(i).einde;
}

/* 'N DRA-REEL NEEM HAAR KINDERS SAAM.

   Sou die pyltjie een reël skuif, kon 'n mens "Aanbieding" bo "Skoolprojek"
   uitskuif — en dan is Aanbieding die dra-reël en Skoolprojek haar kind.
   Korrek volgens die reël en verkeerd volgens die bedoeling, en 'n mens sien
   dit eers op die gedrukte dokument.

   'n Kind skuif alleen, en net BINNE haar eie blok: sy mag nie bo haar
   dra-reël uitkom nie en nie by die volgende groep inloop nie. */
function skuif_reel(i, rigting) {
  ontdoen_merk();
  const r = V.reels[i];

  if (r.vou_in) {
    const { begin, einde } = blok_van(i);
    const j = i + rigting;
    if (j <= begin || j >= einde) return;
    [V.reels[i], V.reels[j]] = [V.reels[j], V.reels[i]];
  } else {
    const { begin, einde } = blok_van(i);
    const blok = V.reels.slice(begin, einde);
    if (rigting < 0) {
      if (begin === 0) return;
      const vorige = blok_van(begin - 1);
      V.reels.splice(begin, blok.length);
      V.reels.splice(vorige.begin, 0, ...blok);
    } else {
      if (einde >= V.reels.length) return;
      const volgende = blok_van(einde);
      const na = V.reels.slice(volgende.begin, volgende.einde);
      V.reels.splice(begin, blok.length + na.length, ...na, ...blok);
    }
  }
  na_reelverandering();
}

/* DIE + VOEG DIREK ONDER HIERDIE REEL IN, nie onderaan nie.

   Die nuwe reël is by verstek 'n KIND, want dit is die algemene geval: 'n mens
   klik die + op "Reiskoste" omdat 'n mens nog 'n reiskoste wil byvoeg. Klik
   'n mens hom op 'n reël wat self invou, kom die nuwe reël as SUSTER by — een
   vlak, nooit twee.

   Sy erf die soort en die hosting van die reël waaronder sy kom: 'n reiskoste
   onder 'n reiskoste is 'n uitgawe. */
function voeg_reel_in(i) {
  ontdoen_merk();
  const bo = V.reels[i];
  const nuut = nuwe_reel();
  nuut.vou_in = true;
  nuut.soort = bo.soort === "koste" ? "koste" : "verkoop";
  nuut.hosting_pct = Number.isFinite(Number(bo.hosting_pct)) ? Number(bo.hosting_pct) : 0;
  V.reels.splice(i + 1, 0, nuut);
  na_reelverandering(i + 1);
}

/* SKRAP JY 'N DRA-REEL, WORD HAAR EERSTE KIND DIE NUWE DRA-REEL.

   Die dokument behou sy vorm — twee reëls bly twee reëls — en net die naam is
   verkeerd, wat 'n mens dadelik sien en oortik. Sou almal los val, verander
   die kliënt se aanhaling van vorm omdat 'n mens een naam wou regmaak, en die
   verlies is groter: 'n naam is een woord; die groepering is die werk van
   drie merkers. */
function skrap_reel(i) {
  ontdoen_merk();
  const was_dra = !V.reels[i].vou_in;
  V.reels.splice(i, 1);
  if (was_dra && V.reels[i] && V.reels[i].vou_in) V.reels[i].vou_in = false;
  na_reelverandering();
}

/* Alles wat ná 'n reëlverandering moet gebeur, op EEN plek.

   DIE VERDELING HANG AAN DIE REELS. Teken 'n mens net die dokument oor, bly
   'n geskrapte reël se verdeling regs staan — met haar bedrag steeds in die
   totaal — en die twee kolomme is uitmekaar. */
function na_reelverandering(fokus) {
  herstel_reels();
  teken_reels();
  teken_somme();
  if (window.bo_teken) window.bo_teken();
  merk_vuil();
  if (fokus !== undefined) {
    const el = document.querySelector(
      `#fv-reels tr[data-reel="${fokus}"] [data-veld="beskrywing"]`
    );
    if (el) el.focus();
  }
}

/* WAT DIE KLIENT SIEN.

   Die reëltabel wys al die reëls, ingekeep, want elkeen moet gewysig kan word.
   Die GEDRUKTE dokument groepeer. Sonder hierdie strook kan 'n mens die
   groepering nie nagaan voordat die dokument uitgaan nie.

   Elke reël hoort aan presies EEN groep, dus tel die gedrukte bedrae altyd tot
   die totaal — en dít mag nooit op 'n dokument breek nie. */
function groepeer_vir_druk() {
  const uit = [];
  V.reels.forEach((r) => {
    const bedrag = Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0));
    if (!r.vou_in || !uit.length) {
      uit.push({
        beskrywing: r.beskrywing,
        hoeveelheid: r.hoeveelheid,
        prys_pp_sent: r.prys_pp_sent,
        bedrag,
        lede: 0,
      });
    } else {
      const g = uit[uit.length - 1];
      g.bedrag += bedrag;
      g.lede += 1;
    }
  });
  return uit;
}

/* DIE RYE WAT WERKLIK DRUK.

   Die gewone tbody dra die reels met hul invoervelde en hul vyf knoppies. Op
   papier moet daar GROEPE staan, en CSS kan dit nie doen nie: sy kan 'n ry
   versteek, maar sy kan nie 'n dra-reel se bedrag na die groep se som
   verander nie.

   Hierdie tbody staan langs die ander in dieselfde tabel en ruil met haar in
   @media print, sodat die kolombreedtes en die lyne presies dieselfde bly.

   'n GROEP DRA GEEN HOEVEELHEID EN GEEN EENHEIDSPRYS NIE -- sien
   groepeer_vir_druk(). Dieselfde som as _faktuur-pdf.js, en dit MOET dieselfde
   bly: wat 'n mens voor die uitreiking sien en wat die klient kry, is een
   ding. */
function teken_druk_reels() {
  const plek = document.getElementById("fv-druk-reels");
  if (!plek) return;
  plek.innerHTML = groepeer_vir_druk()
    .map(
      (g) => `<tr>
        <td>${ontsnap(g.beskrywing)}</td>
        <td class="n">${g.lede ? "" : ontsnap(g.hoeveelheid)}</td>
        <td class="n">${g.lede ? "" : veld_sent(g.prys_pp_sent)}</td>
        <td class="n sterk">${rand(g.bedrag)}</td>
        <td></td>
      </tr>`
    )
    .join("");
}

function teken_druk_voorskou() {
  const plek = document.getElementById("fv-voorskou");
  if (!plek) return;
  const groepe = groepeer_vir_druk();

  // Vou niks in nie, is die voorskou 'n tweede kopie van die tabel hierbo.
  if (!groepe.some((g) => g.lede)) {
    plek.hidden = true;
    return;
  }

  plek.hidden = false;
  plek.innerHTML =
    `<p class="fv-voorskou-et">${fv_t("fv_voorskou", "Wat die kliënt op die dokument sien")}</p>` +
    groepe
      .map(
        (g) => `<div class="fv-voorskou-ry">
          <span>${ontsnap(g.beskrywing) || `<i>${fv_t("fv_naamloos", "naamloos")}</i>`}</span>
          <b>${rand(g.bedrag)}</b>
        </div>`
      )
      .join("");
}

function teken_reels() {
  const plek = document.getElementById("fv-reels");
  if (!plek) return;

  // Voor die tekening, want kan_op(), kan_af() en kinders_van() lees die
  // volgorde: 'n eerste reël wat invou, sou 'n weeskind wees.
  herstel_reels();

  plek.innerHTML = V.reels
    .map((r, ix) => {
      const bedrag = Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0));
      // Die laaste kind van HAAR groep — nie die laaste ry van die tabel nie.
      // `:last-of-type` sou beteken "die laaste <tr>", en dan loop die
      // inkepingstreep by die laaste kind af tot in die volgende groep se ry.
      const kinders = kinders_van(ix);
      const laaste_kind =
        r.vou_in && (ix + 1 >= V.reels.length || !V.reels[ix + 1].vou_in);
      const klasse = r.vou_in
        ? "fv-kind" + (laaste_kind ? " fv-laaste" : "")
        : kinders
          ? "fv-dra"
          : "";
      return `
      <tr data-reel="${ix}"${klasse ? ` class="${klasse}"` : ""}>
        <!-- list="bo-items" — DIESELFDE datalist as die begroting s'n. Hy is
             tot 27 Augustus 2026 hier oorgeslaan: faktuur-koste-items.js het
             die lys gebou, faktuur-backoffice.js het hom aan die BEGROTING se
             veld gehaak, en hierdie veld het niks gekry nie. Maar
             faktuur-nuwe-koste-item.js luister op ALBEI velde, want albei dra
             data-veld="beskrywing". Die gevolg: 'n mens tik "Studievaardig",
             die strook se "nog nie in die register nie" kom op, en niks het
             ooit "Studievaardigheid" aangebied nie — die strook nooi 'n
             duplikaat uit waar die register klaar 'n antwoord gehad het.

             Die datalist self leef teen die einde van die bladsy, buite
             fv-reels, want hierdie ry word by elke wysiging herteken. -->
        <td class="fv-besk"><input class="tel-invoer" data-veld="beskrywing" list="bo-items" value="${ontsnap(r.beskrywing)}">${
          kinders
            ? `<span class="fv-dra-merk">${kinders} ${
                kinders === 1
                  ? fv_t("fv_reel_vou_in", "reël vou hieronder in")
                  : fv_t("fv_reels_vou_in", "reëls vou hieronder in")
              }</span>`
            : ""
        }</td>
        <td class="n"><input class="tel-invoer n" data-veld="hoeveelheid" inputmode="decimal" value="${ontsnap(r.hoeveelheid)}"></td>
        <td class="n"><input class="tel-invoer n" data-veld="prys" inputmode="decimal" value="${veld_sent(r.prys_pp_sent)}" placeholder="0,00"></td>
        <td class="n sterk">${rand(bedrag)}</td>
        <td class="fv-aksies">
          <button type="button" class="fv-a fv-vou${r.vou_in ? " aan" : ""}" data-vou
            ${ix > 0 ? "" : "disabled"}
            title="${
              r.vou_in
                ? fv_t("fv_vou_uit", "Staan op haar eie")
                : fv_t("fv_vou_in", "Vou in by die reël bo")
            }">&#8627;</button>
          <button type="button" class="fv-a" data-op ${kan_op(ix) ? "" : "disabled"}
            title="${
              r.vou_in
                ? fv_t("fv_skuif_op_groep", "Skuif op binne die groep")
                : fv_t("fv_skuif_op", "Skuif die groep op")
            }">&#8593;</button>
          <button type="button" class="fv-a" data-af ${kan_af(ix) ? "" : "disabled"}
            title="${
              r.vou_in
                ? fv_t("fv_skuif_af_groep", "Skuif af binne die groep")
                : fv_t("fv_skuif_af", "Skuif die groep af")
            }">&#8595;</button>
          <button type="button" class="fv-a fv-plus" data-plus
            title="${fv_t("fv_voeg_onder", "Voeg 'n reël hieronder in")}">+</button>
          <button type="button" class="fv-a dok-vee"
            title="${fv_t("fv_verwyder_reel", "Verwyder reël")}">&times;</button>
        </td>
      </tr>`;
    })
    .join("");

  bind_reels();
  teken_druk_voorskou();
  teken_druk_reels();
}

// Terwyl iemand tik, mag die veld nie onder sy vinger herbou word nie — dan
// spring die wyser na die einde. Ons werk dus net die SYFERS by.
function bind_reels() {
  document.querySelectorAll("#fv-reels tr").forEach((tr) => {
    const ix = Number(tr.getAttribute("data-reel"));

    tr.querySelectorAll("[data-veld]").forEach((el) => {
      el.addEventListener("input", () => {
        const veld = el.getAttribute("data-veld");
        ontdoen_merk_tik(`reel-${ix}-${veld}`);
        if (veld === "beskrywing") {
          V.reels[ix].beskrywing = el.value;
        } else if (veld === "hoeveelheid") {
          const getal = Number(String(el.value).replace(",", "."));
          V.reels[ix].hoeveelheid = Number.isFinite(getal) && getal >= 0 ? getal : 0;
        } else {
          V.reels[ix].prys_pp_sent = na_sent(el.value);
        }
        const r = V.reels[ix];
        const sel = tr.querySelector("td.sterk");
        if (sel) {
          sel.textContent = rand(
            Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0))
          );
        }
        teken_somme();

        // DIE TWEE DRUKBLOKKE MOET BY ELKE TIKSLAG BYGEWERK WORD.
        //
        // Hierdie luisteraar teken die ry DOELBEWUS nie oor nie -- die veld sou
        // onder die vinger herbou word en die wyser na die einde spring -- dus
        // loop teken_reels() hier nie, en daarmee ook nie die twee blokke wat
        // binne hom sit nie.
        //
        // Die gevolg was dat 'n reel wat na die laaste hertekening ingetik is,
        // op die skerm reg gelyk het maar as "naamloos R0,00" in die voorskou
        // gestaan het -- en presies so gedruk het. Die skerm en die dokument
        // het uitmekaar geloop sonder dat iets verkeerd gelyk het.
        //
        // Hulle bou uit V.reels, nie uit die DOM nie, dus raak hulle die veld
        // waarin getik word glad nie.
        teken_druk_voorskou();
        teken_druk_reels();

        if (window.bo_teken_syfers) window.bo_teken_syfers();
        merk_vuil();
      });
    });

    // Die vyf knoppies. Elkeen loop deur sy eie funksie hierbo, en almal
    // eindig by na_reelverandering() — sien daar waarom die verdeling saam
    // oorgeteken moet word.
    const aksie = (kies, doen) => {
      const el = tr.querySelector(kies);
      if (el) el.addEventListener("click", () => doen());
    };

    aksie("[data-vou]", () => {
      ontdoen_merk();
      V.reels[ix].vou_in = !V.reels[ix].vou_in;
      na_reelverandering();
    });
    aksie("[data-op]", () => skuif_reel(ix, -1));
    aksie("[data-af]", () => skuif_reel(ix, 1));
    aksie("[data-plus]", () => voeg_reel_in(ix));
    aksie(".dok-vee", () => skrap_reel(ix));
  });
}

// Subtotaal, afslag en skenking verskyn slegs wanneer hulle bestaan — 'n ry
// wat "R 0,00" sê, is 'n ry wat vra hoekom sy daar is.
function teken_somme() {
  const plek = document.getElementById("fv-somme");
  if (!plek) return;
  const rye = [];
  if (V.afslag_sent > 0 || V.skenking_sent > 0) {
    rye.push(`<div><span>${dt("fd_subtotaal", "Subtotaal")}</span><b>${rand(reelsom())}</b></div>`);
  }
  if (V.afslag_sent > 0) {
    rye.push(`<div><span>${dt("fd_afslag", "Afslag")}</span><b>− ${rand(V.afslag_sent)}</b></div>`);
  }
  if (V.skenking_sent > 0) {
    rye.push(`<div><span>${dt("fd_skenking", "Skenking")}</span><b>${rand(V.skenking_sent)}</b></div>`);
  }
  rye.push(
    `<div class="tot"><span>${
      IS_KW ? dt("fd_totaal", "Totaal") : dt("fd_totaal_verskuldig", "Totaal verskuldig")
    }</span><b>${rand(totaal())}</b></div>`
  );
  plek.innerHTML = rye.join("");
}

// Alles binne die dokument wat 'n etiket is, kom hier deur. Dit loop met
// t_in() op die FAKTUUR se taal.
function teken_dok_taal() {
  const stel = (id, sleutel, verstek) => {
    const el = document.getElementById(id);
    if (el) el.textContent = dt(sleutel, verstek);
  };

  // DIE VIER WOORDE WAT DIE DOKUMENT SE SOORT DRA.
  //
  // "Totaal" en nie "Totaal verskuldig" nie: niks is verskuldig voordat 'n
  // kwotasie aanvaar is nie, en die faktuur wat daaruit kom, dra wel die ander
  // woord.
  //
  // "Geldig tot" en nie "Betaalbaar teen" nie, en dit is nie 'n
  // woordverskil nie: geldig_tot KEER die aanvaarding, betaalbaar_teen keer
  // niks. Twee velde met twee betekenisse.
  if (IS_KW) {
    stel("d-soort", "fd_kwotasie", "Kwotasie");
    stel("d-aan", "fd_gekwoteer_aan", "Gekwoteer aan");
    stel("d-betaalbaar", "fd_geldig_tot", "Geldig tot");
  } else {
    stel("d-soort", "fd_proforma", "Proforma-faktuur");
    stel("d-aan", "fd_gefaktureer_aan", "Gefaktureer aan");
    stel("d-betaalbaar", "fd_betaalbaar_teen", "Betaalbaar teen");
  }
  stel("d-besonderhede", "fd_besonderhede", "Besonderhede");
  stel("d-datum", "fd_datum", "Datum");
  stel("d-bestelnr", "fd_bestelnommer", "Bestelnommer");
  stel("d-k-beskrywing", "fd_kol_beskrywing", "Beskrywing");
  stel("d-k-hoeveelheid", "fd_kol_hoeveelheid", "Hoeveelheid");
  stel("d-k-eenheid", "fd_kol_eenheidsprys", "Eenheidsprys");
  stel("d-k-bedrag", "fd_kol_bedrag", "Bedrag");
  stel("d-aantekening", "fd_aantekening", "Aantekening");
  stel("d-eft", "fd_eft_kop", "Betaal deur die skakel");
  stel("d-eft-lei", "fd_eft_lei", "Die betaling word dadelik bevestig.");
  stel("d-bank", "fd_bank_kop", "Bankoorbetaling");
  // Die QR se byskrif is dokumentinhoud, dus die FAKTUUR se taal. Die kode
  // self verander nooit met taal nie — dit is 'n URL — dus word hy net een
  // keer geteken, in faktuur-uitreik.js.
  stel("d-qr-teks", "fd_qr_teks", "Skandeer om te betaal");

  const datum_w = document.getElementById("d-datum-w");
  if (datum_w) datum_w.textContent = dok_datum(V.geskep_op);

  // Die nommer bestaan eers by stuur. Tot dan staan daar "Konsep" — nie 'n
  // voorlopige nommer nie, want 'n nommer wat verander, is nie 'n nommer nie.
  const nr = document.getElementById("d-nommer");
  if (nr) nr.textContent = V.nommer || dt("fd_stand_konsep", "Konsep");

  // DIE HERSIENINGSMERK. Die nommer bly deur die hele onderhandeling dieselfde,
  // dus kan die klient twee uitdrukke met dieselfde nommer en twee verskillende
  // totale he. Eers vanaf hersiening 2: 'n eerste aanbod wat "Hersiening 1"
  // lees, laat 'n mens wonder wat jy gemis het.
  const hers = document.getElementById("d-hersiening");
  if (hers) {
    const n = Number(V.hersiening) || 1;
    hers.textContent = n > 1 ? dt("fd_kw_hersiening", "Hersiening") + " " + n : "";
    hers.style.display = n > 1 ? "" : "none";
  }

  // Die betaalknoppie dra die nommer; hy is dood tot die faktuur uitgereik is.
  const knop = document.getElementById("d-betaal");
  if (knop) {
    knop.textContent = dt("fd_betaal_knop", "Betaal") + (V.nommer ? " " + V.nommer : "");
    knop.classList.toggle("dood", !V.betaalskakel);
    if (V.betaalskakel) knop.setAttribute("href", V.betaalskakel);
    else knop.removeAttribute("href");
  }

  // DIE FAKTUURNOMMER IS DIE BANKVERWYSING. Sonder dit sit 'n mens met 'n
  // bedrag in 'n bankstaat en geen naam nie. Die bankblok dra <br> en 'n
  // <span>, dus innerHTML — die inhoud kom uit taal.js en uit die nommer,
  // nooit van 'n gebruiker nie.
  const bank = document.getElementById("d-bank-lei");
  if (bank) {
    const verw = V.nommer || dt("fd_stand_konsep", "Konsep");
    const m = MAATSKAPPY || {};

    // 'n ONTBREKENDE VELD DRUK AS 'N STREPIE, nie as niks nie. 'n Leë reël
    // lyk soos 'n uitleg-keuse; 'n strepie sê daar hoort iets te wees. Die
    // Instellings-blad waarsku boonop op die Fakture-blad self.
    const of_streep = (waarde) => {
      const teks = String(waarde || "").trim();
      return teks ? ontsnap(teks) : "—";
    };

    const rye = [
      ontsnap(String(m.bank_rekeningnaam || m.naam || "").trim()),
      `${dt("fd_rekening", "Rekening")}: ${of_streep(m.bank_rekeningnommer)}`,
      `${dt("fd_takkode", "Takkode")}: ${of_streep(m.bank_takkode)}`,
    ];
    // Die bank en die rekeningtipe verskyn slegs as hulle bestaan. Hulle is
    // nie nodig om 'n betaling te maak nie, en 'n strepie langs "Bank" voeg
    // niks by wat die res nie reeds sê nie.
    if (String(m.bank || "").trim()) rye.unshift(ontsnap(m.bank.trim()));
    if (String(m.bank_rekeningtipe || "").trim()) {
      rye.push(ontsnap(m.bank_rekeningtipe.trim()));
    }
    rye.push(
      `${dt("fd_verwysing", "Verwysing")}: <span class="verw">${ontsnap(verw)}</span>`
    );

    bank.innerHTML = rye.join("<br>");
  }

  teken_maatskappy();
  teken_titel();

  document.querySelectorAll("#d-taal button").forEach((b) => {
    b.classList.toggle("aan", b.getAttribute("data-taal") === V.taal);
  });
}

// Die dokument se kop. Loop saam met teken_dok(), sodat 'n taalwissel of 'n
// herteken hom nie leeg laat nie.
/* DIE TITEL IS DIE PDF SE LEERNAAM.

   Chrome se "Save as PDF" stel die leernaam uit <title>. Die bladsy het
   "Faktuur — Future Shop" gedra: die verkeerde maatskappy — die winkel is nie
   die uitreiker nie — en sonder 'n nommer, sodat drie fakture as
   "Faktuur (1)", "(2)" en "(3)" in een gids beland.

   DIE SKUINSSTREEP MOET UIT. FS/01957 is die nommer op die dokument, maar
   Windows laat geen / in 'n leernaam toe nie; die sleutelvorm FS-01957 is
   presies dieselfde nommer sonder daardie probleem. */
function teken_titel() {
  const naam = (MAATSKAPPY && MAATSKAPPY.naam) || "Future Sharp NPC";
  const nommer = V.nommer
    ? String(V.nommer).replace(/\//g, "-")
    : dt("fd_stand_konsep", "Konsep");
  document.title = nommer + " — " + naam;
}

function teken_maatskappy() {
  if (!MAATSKAPPY) return;
  const stel = (id, waarde) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(waarde || "").trim();
  };
  stel("d-mts-naam", MAATSKAPPY.naam);
  stel("d-mts-reg", MAATSKAPPY.registrasienommer);
  stel("d-mts-adres", MAATSKAPPY.adres);
  stel("d-mts-epos", MAATSKAPPY.epos);
}

async function laai_maatskappy() {
  try {
    const resp = await fetch("/.netlify/functions/kry-instellings", {
      headers: { Authorization: `Bearer ${SESSIE.access_token}` },
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    MAATSKAPPY = data.maatskappy || null;
  } catch (fout) {
    // Nie fataal nie. Sonder die instelling bly die bladsy se eie teks staan.
    console.error("Kon nie die maatskappy-instelling laai nie:", fout);
    MAATSKAPPY = null;
  }
}

function teken_stand() {
  const el = document.getElementById("fv-stand");
  if (!el) return;
  // DIE KWOTASIE SE STANDE IS EIE WOORDE, nie die faktuur s'n nie. Sien
  // _kwotasies.js: kry-staat.js en kry-joernaal.js filtreer albei op
  // `stand === "gestuur"`, dus mag 'n kwotasie daardie woord nooit dra nie.
  const name = IS_KW
    ? {
        konsep: fv_t("fp_kw_stand_konsep", "Konsep"),
        uitgereik: fv_t("fp_kw_stand_uitgereik", "Uitgereik"),
        aanvaar: fv_t("fp_kw_stand_aanvaar", "Aanvaar"),
        verwerp: fv_t("fp_kw_stand_verwerp", "Verwerp"),
        verval: fv_t("fp_kw_stand_verval", "Verval"),
      }
    : {
        konsep: fv_t("fv_stand_konsep", "Konsep"),
        gestuur: fv_t("fv_stand_gestuur", "Gestuur"),
        betaal: fv_t("fv_stand_betaal", "Betaal"),
        gekanselleer: fv_t("fv_stand_gekanselleer", "Gekanselleer"),
      };
  el.textContent = name[V.stand] || V.stand;
  el.className = "fv-stand fv-stand-" + V.stand;
}

/* WAT 'N KWOTASIE NIE HET NIE.

   Die betaalblok val weg: 'n kwotasie is nie betaalbaar nie, en 'n bankrekening
   op 'n aanbod nooi 'n betaling uit vir iets wat nog nie gefaktureer is nie --
   dan land geld in die hoofrekening sonder 'n faktuur om dit teen af te skryf.

   In sy plek kom die geldigheidsblok, wat sê wat by aanvaarding gebeur.

   Die pad terug wys na die Kwotasies-pil, nie na Fakture nie. Dit loop een
   keer, by die begin -- niks hiervan verander terwyl 'n mens werk nie. */
/* DIE GELDIGHEIDSBLOK op die kwotasie se dokument, waar die faktuur haar
   betaalblok het.

   Hy dra die datum EN wat by aanvaarding gebeur. Sonder die tweede sin lyk
   "geldig tot 3 Oktober" soos 'n dreigement in plaas van 'n aanbod. */
function teken_geldig() {
  const blok = document.getElementById("fv-geldig");
  if (!blok) return;
  if (!IS_KW) {
    blok.hidden = true;
    return;
  }
  blok.hidden = false;
  const datum = dok_datum(V.geldig_tot);
  blok.innerHTML =
    "<b>" +
    ontsnap(
      dt("fd_kw_geldig_kop", "Hierdie kwotasie is geldig tot") + " " + (datum || "—")
    ) +
    "</b><br>" +
    ontsnap(
      dt(
        "fd_kw_geldig_lei",
        "By aanvaarding word 'n faktuur uitgereik en die betaalopsies verskyn onmiddellik."
      )
    );
}

/* ═══ DIE KOLOMME KAN GESKUIF WORD ═══════════════════════════════════════

   Die rekenaar se 400px is 'n keuse, nie 'n wet nie: 'n verdeling met vier
   ontvangers per reel is styf daarin, en 'n dokument met lang beskrywings vra
   die ruimte terug.

   DIE KEUSE WORD ONTHOU, in localStorage. Sy is 'n voorkeur oor hierdie skerm
   op hierdie masjien -- nie iets wat by die faktuur hoort nie, en nie iets wat
   Ignatius se skerm moet volg nie.

   KOLOMME IS VIR REKENAARS. Onder 980px val die backoffice onder die dokument
   in en die handvatsel verdwyn; sien faktuur.css.

   DIE GRENSE. Onder 320px breek die verdeling se rye -- die keuselys, die
   %/R-skakelaar, die veld en die bedrag pas nie langs mekaar nie. Bo 720px word
   die dokument nouer as die bladsy wat hy voorstel. */
const FV_GREEP_SLEUTEL = "future_shop_faktuur_bo_breedte";
const FV_GREEP_MIN = 320;
const FV_GREEP_MAX = 720;
const FV_GREEP_VERSTEK = 400;

function greep_stel(px) {
  const breedte = Math.min(FV_GREEP_MAX, Math.max(FV_GREEP_MIN, Math.round(px)));
  document.documentElement.style.setProperty("--bo-breedte", breedte + "px");
  const greep = document.getElementById("fv-greep");
  if (greep) greep.setAttribute("aria-valuenow", String(breedte));
  return breedte;
}

function greep_bind() {
  const greep = document.getElementById("fv-greep");
  const blad = document.querySelector(".fv-blad");
  if (!greep || !blad) return;

  // Die onthoude breedte, of die verstek. 'n Stukkende waarde word geignoreer
  // eerder as om die uitleg te breek.
  let gestoor = 0;
  try {
    gestoor = Number(localStorage.getItem(FV_GREEP_SLEUTEL)) || 0;
  } catch (fout) {
    /* privaat venster, of localStorage af */
  }
  greep_stel(gestoor || FV_GREEP_VERSTEK);

  let sleep = false;

  function na(x) {
    // Die rekenaar is die REGTER kolom, dus is sy breedte die afstand van die
    // wyser tot die blad se regterrand.
    const boks = blad.getBoundingClientRect();
    return greep_stel(boks.right - x);
  }

  function bewaar(breedte) {
    try {
      localStorage.setItem(FV_GREEP_SLEUTEL, String(breedte));
    } catch (fout) {
      /* niks om aan te doen nie */
    }
  }

  greep.addEventListener("pointerdown", (e) => {
    sleep = true;
    greep.classList.add("sleep");
    document.body.classList.add("fv-sleep");
    // Die wyser bly aan die handvatsel geheg, ook wanneer hy oor 'n invoerveld
    // beweeg -- andersins verloor die sleep sy grip halfpad.
    greep.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  greep.addEventListener("pointermove", (e) => {
    if (!sleep) return;
    na(e.clientX);
  });

  const los = (e) => {
    if (!sleep) return;
    sleep = false;
    greep.classList.remove("sleep");
    document.body.classList.remove("fv-sleep");
    try {
      greep.releasePointerCapture(e.pointerId);
    } catch (fout) {
      /* die wyser was reeds los */
    }
    bewaar(na(e.clientX));
  };

  greep.addEventListener("pointerup", los);
  greep.addEventListener("pointercancel", los);

  /* MET DIE SLEUTELBORD OOK. Tab tot by die handvatsel, dan links en regs.
     'n Handvatsel wat net met die muis werk, is 'n handvatsel wat sommige mense
     nie het nie. Shift gee groter stappe. */
  greep.addEventListener("keydown", (e) => {
    const stap = e.shiftKey ? 40 : 10;
    let nuut = null;
    if (e.key === "ArrowLeft") nuut = greep_nou() + stap;
    else if (e.key === "ArrowRight") nuut = greep_nou() - stap;
    else if (e.key === "Home") nuut = FV_GREEP_VERSTEK;
    if (nuut === null) return;
    e.preventDefault();
    bewaar(greep_stel(nuut));
  });

  // 'n Dubbelklik stel hom terug -- die vinnigste pad terug uit 'n sleep wat
  // verkeerd geloop het.
  greep.addEventListener("dblclick", () => {
    bewaar(greep_stel(FV_GREEP_VERSTEK));
  });
}

function greep_nou() {
  const w = getComputedStyle(document.documentElement).getPropertyValue("--bo-breedte");
  return Number(String(w).replace("px", "").trim()) || FV_GREEP_VERSTEK;
}

function teken_soort() {
  if (!IS_KW) return;

  document.body.classList.add("fv-kwotasie");

  const terug = document.querySelector(".terug-skakel");
  if (terug) terug.setAttribute("href", "faktuurpaneel.html#kwotasies");

  const titel = fv_t("fp_kwotasies_titel", "Kwotasies");
  if (document.title) document.title = titel + " · Future Sharp";

  // Die backoffice se twee opskrifte. Hulle staan in die HTML met die faktuur
  // se woorde en data-i18n, dus moet hulle NA taal.js se vertaling geruil word
  // -- andersins skryf die vertaler hulle weer om.
  const kop = document.getElementById("bo-verdeling-kop");
  if (kop) kop.textContent = fv_t("fv_kw_verdeling_kop", "Verdeling van die kwotasietotaal");
  const tot = document.getElementById("bo-totaal-et");
  if (tot) tot.textContent = fv_t("fv_kw_totaal", "Kwotasietotaal");
}

function teken_alles() {
  teken_klient();
  teken_reels();
  teken_somme();
  teken_dok_taal();
  teken_stand();
  teken_geldig();
  ontdoen_teken();
  // faktuur-backoffice.js haak hier in. Die wag is nie versiering nie: die
  // dokument moet werk al is die backoffice nie gelaai nie.
  if (window.bo_teken) window.bo_teken();
}

/* ═══ die kliëntkeuse ═══ */
async function laai_kliente() {
  try {
    const resp = await fetch("/.netlify/functions/kry-kliente", {
      headers: { Authorization: `Bearer ${SESSIE.access_token}` },
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    KLIENTE = data.kliente || [];
  } catch (fout) {
    console.error("Kon nie die kliënte laai nie:", fout);
    KLIENTE = [];
  }

  const kies = document.getElementById("fv-klient");
  if (!kies) return;
  const opsies = [
    `<option value="">${fv_t("fv_kies_klient", "Kies 'n kliënt …")}</option>`,
  ].concat(
    KLIENTE.map(
      (k) =>
        `<option value="${ontsnap(k.nommer)}" ${k.nommer === V.klient_id ? "selected" : ""}>${ontsnap(
          k.naam
        )}${k.onvolledig ? " · " + fv_t("fk_onvolledig", "onvolledig") : ""}</option>`
    )
  );
  kies.innerHTML = opsies.join("");
}

/* ═══ stoor ═══
 *
 * Konsepte stoor outomaties sowat twee sekondes ná iemand ophou tik, en by
 * blur — plus 'n knoppie, want dit is die enigste manier waarop 'n mens WEET
 * dit is gestoor. Dieselfde patroon as indien.html.
 *
 * 'n Uitgereikte faktuur stoor NIE. Die bediener gee 409 en dit is reg, maar
 * ons vra nie eens: die dokument is by die kliënt en die verdeling is
 * gevries.
 */
/* ═══ ONTDOEN EN HERDOEN ══════════════════════════════════════════════════

   Voor elke wysiging word 'n kopie van V op 'n stapel gestoor. Ontdoen haal
   die vorige af en teken oor.

   WAT DIT DEK: alles wat die VORM doen -- 'n reel geskrap, 'n verdelingsry
   weg, 'n groep verkeerd geskuif, 'n bedrag oorgetik, 'n dra-reel geskrap wat
   'n kind bevorder het. Dit is presies die handelinge waar hierdie ontwerp 'n
   mens kan laat struikel.

   WAT DIT NIE DEK NIE: die uitreiking, 'n aanvaarding, 'n kansellasie.
   Daardie handelinge het BUITE die blad gebeur -- 'n nommer is toegeken, 'n
   split by Paystack geskep, 'n pos gestuur. 'n Knoppie wat "ontdoen" se maar
   die pos nie kan terughaal nie, is erger as geen knoppie. Vandaar die toets
   op `V.stand === "konsep"`.

   DIT VERDWYN BY 'N HERLAAI. Die stapel leef in geheue, nie in die rekord nie.
   Dit is die eerlike beperking en dit is aanvaarbaar: die outomatiese stoor
   beteken die rekord is veilig; die stapel is vir die laaste paar minute se
   tikwerk.

   DIE STOOR WORD NIE ONTDOEN NIE. Ontdoen verander V en merk die vorm vuil;
   twee sekondes later stoor hy vanself. 'n Ontdoen wat nie gestoor word nie,
   sou by die volgende herlaai terugkom. */

const ONTDOEN_DIEP = 20;
const ONTDOEN = [];
const HERDOEN = [];

// 'n Volle kopie, want V se reels en hul verdelings is geneste voorwerpe. 'n
// vlak kopie sou die stapel aan die lewende V bind en elke stap sou dieselfde
// wees.
function ontdoen_kopie() {
  return JSON.parse(JSON.stringify(V));
}

/* Roep dit VOOR die wysiging, nie daarna nie. Wat gestoor word, is die
   toestand waarheen 'n mens wil terugkeer.

   'n NUWE HANDELING GOOI DIE HERDOEN-STAPEL WEG. 'n Mens ontdoen drie stappe,
   tik dan iets nuuts, en herdoen sou 'n toekoms herstel wat nie meer bestaan
   nie. */
function ontdoen_merk() {
  if (V.stand !== "konsep") return;
  ONTDOEN.push(ontdoen_kopie());
  if (ONTDOEN.length > ONTDOEN_DIEP) ONTDOEN.shift();
  HERDOEN.length = 0;
  ontdoen_teken();
}

/* TIK IS 'N VLAAG, NIE 'N REEKS STAPPE NIE.

   Sou elke aanslag 'n stap wees, sou "Aanbieding" tien van die twintig plekke
   vul en ontdoen sou letter vir letter terugloop -- en die stap wat 'n mens
   werklik soek, die geskrapte reel, sou lankal uitgeskuif wees.

   Een stap per vlaag: die eerste aanslag ná 'n stilte van 900ms merk; die res
   van die woord nie. Dieselfde gedrag as 'n teksverwerker.

   DIE VELD WORD OOK ONTHOU. Twee vlae in verskillende velde is twee stappe,
   ook wanneer hulle vinnig op mekaar volg -- van 'n bedrag na 'n beskrywing
   spring, is 'n nuwe gedagte. */
const TIK_STILTE = 900;
let TIK_LAAS = 0;
let TIK_VELD = null;

function ontdoen_merk_tik(kenmerk) {
  const nou = Date.now();
  if (kenmerk !== TIK_VELD || nou - TIK_LAAS > TIK_STILTE) ontdoen_merk();
  TIK_LAAS = nou;
  TIK_VELD = kenmerk;
}

function ontdoen_teken() {
  const o = document.getElementById("fv-ontdoen");
  const h = document.getElementById("fv-herdoen");
  const kan = V.stand === "konsep";
  if (o) {
    o.disabled = !kan || !ONTDOEN.length;
    o.title = fv_t("fv_ontdoen", "Ontdoen");
  }
  if (h) {
    h.disabled = !kan || !HERDOEN.length;
    h.title = fv_t("fv_herdoen", "Herdoen");
  }
}

/* Die veldname word EEN VIR EEN teruggesit, nie met 'n spread nie.

   `V` is 'n const en 'n mens kan hom nie vervang nie -- maar dit is nie die
   rede nie. faktuur-backoffice.js hou 'n verwysing na dieselfde voorwerp;
   sou ons V vervang, sou die backoffice na 'n dooie kopie wys en die twee
   kolomme sou stilweg uitmekaar loop. */
function ontdoen_herstel(toestand) {
  Object.keys(V).forEach((sleutel) => {
    if (toestand[sleutel] !== undefined) V[sleutel] = toestand[sleutel];
  });
  teken_alles();
  ontdoen_teken();
  merk_vuil();
}

function ontdoen_doen() {
  if (V.stand !== "konsep" || !ONTDOEN.length) return;
  HERDOEN.push(ontdoen_kopie());
  if (HERDOEN.length > ONTDOEN_DIEP) HERDOEN.shift();
  ontdoen_herstel(ONTDOEN.pop());
}

function herdoen_doen() {
  if (V.stand !== "konsep" || !HERDOEN.length) return;
  ONTDOEN.push(ontdoen_kopie());
  if (ONTDOEN.length > ONTDOEN_DIEP) ONTDOEN.shift();
  ontdoen_herstel(HERDOEN.pop());
}

// Die backoffice roep dit aan voordat sy 'n verdelingsry byvoeg, skrap of
// verander. Sonder hierdie haak sou ontdoen net die dokumentkolom dek.
window.fv_ontdoen_merk = ontdoen_merk;

function merk_vuil() {
  if (V.stand !== "konsep") return;
  VUIL = true;
  wys_stoorstand(fv_t("fv_nie_gestoor", "Nog nie gestoor nie"), false);
  if (TYD) clearTimeout(TYD);
  TYD = setTimeout(() => stoor(), 2000);
}

function wys_stoorstand(teks, is_fout) {
  const el = document.getElementById("fv-stoorstand");
  if (!el) return;
  el.textContent = teks;
  el.classList.toggle("fout", Boolean(is_fout));
}

function liggaam() {
  return {
    sleutel: V.sleutel || undefined,
    taal: V.taal,
    klient_id: V.klient_id || "",
    bestelnommer: V.bestelnommer,
    dokument_nota: V.dokument_nota,
    // Elke dokument stuur SLEGS sy eie datumveld. stoor-kwotasie.js ken
    // `betaalbaar_teen` glad nie, en stoor-faktuur.js ken `geldig_tot` nie --
    // 'n veld wat deurgaan na 'n Function wat hom nie ken nie, val stil weg.
    ...(IS_KW
      ? { geldig_tot: V.geldig_tot || "" }
      : { betaalbaar_teen: V.betaalbaar_teen || "" }),
    koste: V.koste,
    afslag_sent: V.afslag_sent,
    skenking_sent: V.skenking_sent,
    koepon_kode: V.koepon_kode || "",
    reels: V.reels.map((r) => ({
      soort: r.soort === "koste" ? "koste" : "verkoop",
      beskrywing: r.beskrywing,
      hoeveelheid: Number(r.hoeveelheid) || 0,
      prys_pp_sent: Number(r.prys_pp_sent) || 0,
      vou_in: r.vou_in === true,
      // Geen `|| 5`-terugval nie: 'n doelbewuste nul moet oorleef.
      hosting_pct: Number.isFinite(Number(r.hosting_pct)) ? Number(r.hosting_pct) : 0,
      verdeling: Array.isArray(r.verdeling) ? r.verdeling : [],
    })),
  };
}

async function stoor() {
  if (V.stand !== "konsep" || BESIG || !SESSIE) return;
  if (TYD) { clearTimeout(TYD); TYD = null; }
  BESIG = true;

  try {
    const resp = await fetch("/.netlify/functions/" + EIND.stoor, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SESSIE.access_token}`,
      },
      body: JSON.stringify(liggaam()),
    });

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    // Die eerste stoor gee die sleutel terug. Dit kom in die adresbalk sonder
    // om die bladsy te herlaai — 'n herlaai sou die konsep verloor, en 'n
    // konsep waarvan die URL nie klop nie, is 'n konsep wat nie teruggevind
    // kan word nie.
    if (!V.sleutel && data.sleutel) {
      V.sleutel = data.sleutel;
      const url = new URL(window.location.href);
      url.searchParams.set("sleutel", data.sleutel);
      window.history.replaceState({}, "", url.toString());
    }

    VUIL = false;
    const nou = new Date();
    wys_stoorstand(
      fv_t("fv_gestoor", "Gestoor") +
        " " +
        String(nou.getHours()).padStart(2, "0") + ":" + String(nou.getMinutes()).padStart(2, "0"),
      false
    );
  } catch (fout) {
    console.error("Kon nie die faktuur stoor nie:", fout);
    // Eerlik wees hieroor. 'n Stil mislukking laat iemand aangaan met werk
    // wat nêrens beland nie.
    wys_stoorstand(fv_t("fv_stoor_fout", "Kon nie stoor nie — probeer weer"), true);
  } finally {
    BESIG = false;
  }
}

/* ═══ laai ═══ */
async function laai_faktuur(vraag) {
  const resp = await fetch("/.netlify/functions/" + EIND.kry + "?" + vraag, {
    headers: { Authorization: `Bearer ${SESSIE.access_token}` },
  });
  if (!resp.ok) throw new Error(`Status ${resp.status}`);
  const data = await resp.json();
  const f = data[EIND.veld] || {};

  V.sleutel = f.sleutel || null;
  V.nommer = f.nommer || null;
  V.stand = f.stand || "konsep";
  V.taal = f.taal || "af";
  V.klient_id = f.klient_id || null;
  V.klient = f.klient || V.klient;
  V.bestelnommer = f.bestelnommer || "";
  V.reels = Array.isArray(f.reels)
    ? f.reels.map((r) => ({
        soort: r.soort === "koste" ? "koste" : "verkoop",
        beskrywing: r.beskrywing || "",
        hoeveelheid: r.hoeveelheid || 0,
        prys_pp_sent: r.prys_pp_sent || 0,
        vou_in: r.vou_in === true,
        // hosting_pct kan wettig 0 wees, dus nie || 5 nie -- dan sou iemand
        // wat Hosting doelbewus afskakel, dit elke keer terugkry. Op 'n
        // kostereel is nul die REGTE antwoord.
        hosting_pct: Number.isFinite(Number(r.hosting_pct)) ? Number(r.hosting_pct) : 0,
        verdeling: Array.isArray(r.verdeling) ? r.verdeling : [],
      }))
    : [];
  V.dokument_nota = f.dokument_nota || "";
  V.afslag_sent = f.afslag_sent || 0;
  V.skenking_sent = f.skenking_sent || 0;
  V.koepon_kode = f.koepon_kode || null;
  V.koste = Array.isArray(f.koste) ? f.koste : [];
  V.betaalbaar_teen = f.betaalbaar_teen || null;
  V.geldig_tot = f.geldig_tot || null;
  V.hersiening = Number(f.hersiening) || 1;
  V.geskep_op = f.geskep_op || null;
  V.betaalskakel = f.betaalskakel || null;
}

// 'n Uitgereikte of betaalde faktuur word gelees, nie gewysig nie. Elke veld
// gaan toe — die dokument is by die kliënt en die verdeling is gevries.
function sluit_toe() {
  document.querySelectorAll("#fv-dok input, #fv-dok textarea, #fv-dok select").forEach((el) => {
    el.setAttribute("disabled", "disabled");
  });
  ["fv-voeg-reel", "fv-stoor", "fv-uitreik"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const kies = document.getElementById("fv-klient-kies");
  if (kies) kies.style.display = "none";

  /* DIE BACKOFFICE OOK, EN DIT MOET 'N HERTEKEN OORLEEF.

     Die dokument se velde hou hul `disabled`, want niks teken hulle oor solank
     niemand kan tik nie. Die backoffice word by ELKE berekening oorgeteken, en
     'n attribuut op 'n element wat pas vervang is, is weg. Tot hier kon 'n mens
     dus die verdeling van 'n uitgereikte kwotasie tik: dit het nerens heen
     geskryf nie, en dit het gelyk of dit iets doen.

     Die klas sit op <body>, nie op die elemente nie. Sien faktuur.css. */
  document.body.classList.add("fv-toe");

  wys_stoorstand(fv_t("fv_toe", "Uitgereik — word nie meer gewysig nie"), false);
  hersien_wys();
}

/* ═══ DIE HERSIENING ════════════════════════════════════

   'n Klient vra 'n aanpassing. Die uitkoms is 'n nuwe aanbod onder DIESELFDE
   nommer en DIESELFDE skakel; die hersieningsnommer tel op.

   NIKS WORD GESTOOR TERWYL 'N MENS TIK NIE. Die klient se skakel wys altyd die
   lewende rekord, dus sou 'n outomatiese stoor beteken hy kan 'n halfgewysigde
   aanbod aanvaar. Die nuwe reels gaan in EEN oproep saam met die hersiening.
   stoor-kwotasie.js weier in elk geval op enigiets wat nie 'n konsep is nie.

   DIE UITREIKING KAN NIE ONTDOEN WORD NIE -- sy stuur 'n pos en maak die vorige
   aanbod dood. Die knoppie vra dus eers om bevestiging, in sy eie plek, soos
   die skrapknoppie in die register. */
let HERSIEN = false;

function hersien_wys() {
  if (!IS_KW) return;
  const knop = document.getElementById("fv-hersien");
  if (!knop) return;
  // Ook 'n verlope kwotasie. Dit is juis wat 'n mens doen wanneer 'n skool
  // eers na ses weke antwoord; hersien-kwotasie.js laat dit uitdruklik toe.
  knop.style.display = V.stand === "uitgereik" ? "" : "none";
}

function hersien_begin() {
  if (!IS_KW || HERSIEN || V.stand !== "uitgereik") return;
  HERSIEN = true;

  document.body.classList.remove("fv-toe");
  document
    .querySelectorAll("#fv-dok input, #fv-dok textarea, #fv-dok select")
    .forEach((el) => el.removeAttribute("disabled"));

  const wys = (id, aan) => {
    const el = document.getElementById(id);
    if (el) el.style.display = aan ? "" : "none";
  };
  wys("fv-voeg-reel", true);
  wys("fv-klient-kies", true);
  wys("fv-hersien", false);
  wys("fv-hersien-uit", true);
  wys("fv-hersien-vaar", true);

  // STOOR EN REIK UIT BLY WEG. 'n Hersiening is nie 'n stoor nie, en die
  // kwotasie is reeds uitgereik.
  wys("fv-stoor", false);
  wys("fv-uitreik", false);

  hersien_band();
  teken_alles();
}

function hersien_band() {
  const nuut = (Number(V.hersiening) || 1) + 1;
  const oud = Number(V.hersiening) || 1;
  wys_stoorstand(
    fv_t(
      "fv_kw_hersien_band",
      "Hersiening {nuut} in wording — die kliënt sien nog hersiening {oud}"
    )
      .replace("{nuut}", String(nuut))
      .replace("{oud}", String(oud)),
    false
  );
}

function hersien_vaar() {
  window.location.reload();
}

// Twee klikke, nie 'n confirm() nie. Die eerste ruil die knoppie se woorde;
// die tweede stuur. 'n Klik langs enigiets anders stel hom terug.
let HERSIEN_GEVRA = false;

function hersien_klik() {
  const knop = document.getElementById("fv-hersien-uit");
  if (!knop) return;
  if (!HERSIEN_GEVRA) {
    HERSIEN_GEVRA = true;
    knop.textContent = fv_t(
      "fv_kw_hersien_bevestig",
      "Bevestig — stuur aan die kliënt"
    );
    return;
  }
  hersien_stuur();
}

async function hersien_stuur() {
  if (!HERSIEN || BESIG || !SESSIE) return;
  const knop = document.getElementById("fv-hersien-uit");
  BESIG = true;
  if (knop) knop.disabled = true;

  try {
    const resp = await fetch("/.netlify/functions/hersien-kwotasie", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SESSIE.access_token}`,
      },
      body: JSON.stringify(liggaam()),
    });
    if (!resp.ok) throw new Error(await resp.text());

    // 'n HERLAAI, NIE 'n PLAASLIKE BYWERKING NIE. Die Function het die
    // momentopname geneem, die nommer opgetel, die geldigheid gestel en die pos
    // gestuur. Die rekord is die waarheid; die skerm moet hom gaan haal.
    window.location.reload();
  } catch (fout) {
    console.error("Kon nie die hersiening uitreik nie:", fout);
    wys_stoorstand(String((fout && fout.message) || fout), true);
    HERSIEN_GEVRA = false;
    if (knop) {
      knop.disabled = false;
      knop.textContent = fv_t("fv_kw_hersien_uit", "Reik hersiening uit");
    }
    BESIG = false;
  }
}

function geen_toegang(teks) {
  const blok = document.getElementById("fv-geen-toegang");
  const vorm = document.getElementById("fv-vorm");
  const el = document.getElementById("fv-geen-toegang-teks");
  if (teks && el) el.textContent = teks;
  if (blok) blok.style.display = "";
  if (vorm) vorm.style.display = "none";
}

/* ═══ begin ═══ */
document.addEventListener("DOMContentLoaded", async () => {
  const hoof = document.getElementById("fv-hoof");
  const wys = () => { if (hoof) hoof.style.visibility = "visible"; };

  try {
    SESSIE = await identiteit_kry_huidige_sessie();
  } catch {
    SESSIE = null;
  }

  if (!SESSIE) { geen_toegang(null); wys(); return; }

  const epos = document.getElementById("paneel-gebruiker-epos");
  if (epos && SESSIE.gebruiker) epos.textContent = SESSIE.gebruiker.email;

  // Die kliëntkant-kontrole is 'n hoflikheid, nie 'n slot. Dra die token nie
  // die rol nie, gee elke Function in elk geval 403.
  if (!identiteit_het_rol(SESSIE.gebruiker, "boekhouding")) {
    geen_toegang(
      fv_t("fp_geen_rol", "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan.")
    );
    wys();
    return;
  }

  const vorm = document.getElementById("fv-vorm");
  if (vorm) vorm.style.display = "";
  teken_soort();
  greep_bind();
  wys();

  const params = new URLSearchParams(window.location.search);
  const sleutel = params.get("sleutel");
  const nommer = params.get("nommer");

  try {
    if (sleutel) await laai_faktuur("sleutel=" + encodeURIComponent(sleutel));
    else if (nommer) await laai_faktuur("nommer=" + encodeURIComponent(nommer));
    else {
      // 'n Nuwe konsep. Hy word NIE dadelik gestoor nie — 'n konsep wat by
      // oopmaak bestaan, laat leë rekords agter van elke keer wat iemand die
      // bladsy oopgemaak en van gedagte verander het. Die eerste stoor
      // gebeur wanneer daar iets is om te stoor.
      V.geskep_op = new Date().toISOString();
      V.reels = [nuwe_reel()];
    }
  } catch (fout) {
    console.error("Kon nie die faktuur laai nie:", fout);
    geen_toegang(fv_t("fv_laai_fout", "Kon nie hierdie faktuur laai nie."));
    return;
  }

  // Die velde buite die tabel word een keer gevul; hulle word nooit herbou
  // nie, dus kan die wyser nie spring nie.
  const nota = document.getElementById("fv-nota");
  if (nota) {
    nota.value = V.dokument_nota;
    nota.addEventListener("input", () => { V.dokument_nota = nota.value; merk_vuil(); });
  }

  const bestelnr = document.getElementById("fv-bestelnommer");
  if (bestelnr) {
    bestelnr.value = V.bestelnommer;
    bestelnr.addEventListener("input", () => { V.bestelnommer = bestelnr.value; merk_vuil(); });
  }

  /* DIESELFDE VELD, TWEE BETEKENISSE.

     Op 'n faktuur is dit `betaalbaar_teen`: 'n datum op die dokument wat NIKS
     keer nie. Op 'n kwotasie is dit `geldig_tot`, en dié KEER: ná daardie dag
     weier aanvaar-kwotasie.js met 410.

     Hulle deel een invoerveld omdat hulle op dieselfde plek op die dokument
     staan, maar hulle land op verskillende velde van die rekord -- en
     stoor-kwotasie.js ken `betaalbaar_teen` glad nie. */
  const betaalbaar = document.getElementById("fv-betaalbaar");
  if (betaalbaar) {
    betaalbaar.value = invoer_datum(IS_KW ? V.geldig_tot : V.betaalbaar_teen);
    betaalbaar.addEventListener("change", () => {
      if (IS_KW) V.geldig_tot = betaalbaar.value || null;
      else V.betaalbaar_teen = betaalbaar.value || null;
      // Die geldigheidsblok dra die datum. Sonder hierdie reël staan daar
      // "geldig tot —" tot die volgende volle hertekening.
      teken_geldig();
      merk_vuil();
    });
  }

  const voeg = document.getElementById("fv-voeg-reel");
  if (voeg) {
    voeg.addEventListener("click", () => {
      // Onderaan, en op HAAR EIE — nie ingevou nie. Wie 'n reël binne 'n groep
      // wil hê, gebruik die + op daardie groep se reël.
      //
      // Die nuwe reel moet DADELIK regs verskyn, met sy eie ontvangers wat
      // wag om gekies te word. Die reels en die verdeling is een lys.
      ontdoen_merk();
      V.reels.push(nuwe_reel());
      na_reelverandering(V.reels.length - 1);
    });
  }

  const ontdoen_knop = document.getElementById("fv-ontdoen");
  if (ontdoen_knop) ontdoen_knop.addEventListener("click", ontdoen_doen);
  const herdoen_knop = document.getElementById("fv-herdoen");
  if (herdoen_knop) herdoen_knop.addEventListener("click", herdoen_doen);

  /* Ctrl+Z en Ctrl+Shift+Z, soos oral elders.

     BINNE 'N VELD DOEN ONS NIKS. Die blaaier se eie ontdoen werk daar, en 'n
     mens verwag dat Ctrl+Z 'n woord terugvat en nie 'n hele reel nie. Buite
     'n veld -- ná 'n skrap, 'n skuif of 'n klik -- is ons stapel die enigste
     een wat iets weet. */
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
    const in_veld = document.activeElement && (
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA"
    );
    if (in_veld) return;
    e.preventDefault();
    if (e.shiftKey) herdoen_doen();
    else ontdoen_doen();
  });

  /* Die balk kry sy lyn eers wanneer hy werklik oor die dokument le.
     `position: sticky` gee geen gebeurtenis nie, dus meet ons sy plek: staan
     hy op 0 terwyl die blad gerol is, klou hy vas.

     Sonder dit is daar 'n streep onder 'n balk wat aan niks raak nie. */
  const balk = document.querySelector(".fv-balk");
  if (balk) {
    const kyk = () => balk.classList.toggle("fv-balk-vas", window.scrollY > 4);
    window.addEventListener("scroll", kyk, { passive: true });
    kyk();

    /* DIE BALK SE HOOGTE IS 'n MAAT, NIE 'n KONSTANTE NIE.

       faktuur.css laat die backoffice-kolom onder hierdie balk klou. Op 'n nou
       venster loop die balk om en word twee reels hoog, en 'n vaste getal in
       die CSS sou die kolom dan weer agter hom laat inskuif. Ons meet hom. */
    const meet = () => {
      document.documentElement.style.setProperty(
        "--fv-balk-h",
        Math.round(balk.getBoundingClientRect().height) + "px"
      );
    };
    meet();
    if (window.ResizeObserver) new ResizeObserver(meet).observe(balk);
    else window.addEventListener("resize", meet, { passive: true });
  }

  const knop = document.getElementById("fv-stoor");
  if (knop) knop.addEventListener("click", () => stoor());

  const h_begin = document.getElementById("fv-hersien");
  if (h_begin) h_begin.addEventListener("click", hersien_begin);
  const h_uit = document.getElementById("fv-hersien-uit");
  if (h_uit) h_uit.addEventListener("click", hersien_klik);
  const h_vaar = document.getElementById("fv-hersien-vaar");
  if (h_vaar) h_vaar.addEventListener("click", hersien_vaar);

  document.getElementById("d-taal").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const nuwe = b.getAttribute("data-taal");
    if (!nuwe || nuwe === V.taal) return;
    V.taal = nuwe;
    teken_alles();
    merk_vuil();
  });

  await laai_maatskappy();
  await laai_kliente();
  const kies = document.getElementById("fv-klient");
  if (kies) {
    kies.addEventListener("change", () => {
      V.klient_id = kies.value || null;
      const gekose = KLIENTE.find((k) => k.nommer === V.klient_id);
      // Die register se veld heet `kontak`; op die faktuur heet dit
      // `kontakpersoon`. Hierdie afskrif is net vir die skerm — die bediener
      // lees die kliënt self uit die register wanneer hy stoor.
      V.klient = gekose
        ? {
            naam: gekose.naam || "",
            kontakpersoon: gekose.kontak || "",
            epos: gekose.epos || "",
            selfoon: gekose.selfoon || "",
            adres: gekose.adres || "",
          }
        : { naam: "", kontakpersoon: "", epos: "", selfoon: "", adres: "" };
      teken_klient();
      merk_vuil();
    });
  }

  teken_alles();

  if (V.stand !== "konsep") sluit_toe();

  FV_GELAAI = true;

  // By blur stoor ons dadelik in plaas van te wag — iemand wat wegklik, is
  // dikwels iemand wat weggaan.
  window.addEventListener("blur", () => { if (VUIL) stoor(); });
});
