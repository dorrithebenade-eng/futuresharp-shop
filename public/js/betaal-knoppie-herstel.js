// public/js/betaal-knoppie-herstel.js
//
// 'n Betaalknoppie wat op "Besig…" vasstaan nadat die koper by Paystack
// gekanselleer het.
//
// WAT GEBEUR (14 Augustus 2026)
//
// Die knoppie word gedeaktiveer voordat na Paystack herlei word, en net in
// die catch-tak herstel. Gaan die herleiding wél deur, is daar geen fout
// nie — en die bladsy word verlaat met die knoppie dood.
//
// Kanselleer die koper dan by Paystack, HERLAAI die bladsy nie. Die blaaier
// hou 'n oomblikkiekiek van die hele DOM (die back-forward cache) en herstel
// dit presies soos dit gelos is: knoppie gedeaktiveer, teks "Besig…". Geen
// JavaScript loop weer nie, dus is daar niks wat dit kan regstel nie. Die
// koper sit met 'n knoppie wat nie werk nie en 'n bestelling wat lyk of sy
// hang.
//
// DIE HERSTEL is 'n pageshow-luisteraar. Dit vuur ook by 'n kas-herstel,
// waar DOMContentLoaded en load nie vuur nie.
//
// Dit loop ONVOORWAARDELIK, nie net wanneer event.persisted waar is nie —
// daardie vlag is nie oor alle blaaiers betroubaar nie, en die toets is in
// elk geval nie nodig: is die knoppie nie besig nie, doen die funksie niks.
//
// WAAROM 'N EIE LÊER: dieselfde slaggat wag in die faktuurmodule se
// betaalbladsy. Een stuk wat albei bedien, en geen bestaande vloei word
// aangeraak nie — voltooi-betaling.js bly onveranderd.

// Elke knoppie wat na 'n betaalbladsy herlei, met die taal-sleutel van sy
// rustende teks. Kom die faktuurmodule se knoppie by, word hy hier bygevoeg.
const BKH_KNOPPIES = [
  { id: "gaan-na-betaling", sleutel: "gaan_na_betaling" },
];

// Die rustende teks word onthou sodra die knoppie die eerste keer verskyn.
// Dit is die betroubaarste bron: die knoppie word deur JavaScript gebou, dra
// geen data-i18n nie, en sy teks kom uit t() op die oomblik van bou.
const bkh_rus_teks = {};

function bkh_onthou(knoppie, inskrywing) {
  if (bkh_rus_teks[inskrywing.id]) return;
  if (knoppie.disabled) return; // reeds besig — dan is die teks nie die rusteks nie
  bkh_rus_teks[inskrywing.id] = knoppie.textContent;
}

function bkh_herstel() {
  BKH_KNOPPIES.forEach((inskrywing) => {
    const knoppie = document.getElementById(inskrywing.id);
    if (!knoppie || !knoppie.disabled) return;

    // Die onthoude teks eerste; dan t(); dan 'n laaste vangnet. t() gee die
    // sleutel self terug wanneer hy hom nie ken nie, dus mag dit nie die
    // enigste bron wees nie.
    let teks = bkh_rus_teks[inskrywing.id];
    if (!teks && typeof t === "function") {
      const uit = t(inskrywing.sleutel);
      if (uit && uit !== inskrywing.sleutel) teks = uit;
    }

    knoppie.disabled = false;
    if (teks) knoppie.textContent = teks;
  });
}

// Die knoppie word dinamies gebou, dus bestaan hy nog nie by DOMContentLoaded
// nie. Dieselfde MutationObserver-patroon as paneel-kieslys.js.
function bkh_begin() {
  const kyk = () => {
    BKH_KNOPPIES.forEach((inskrywing) => {
      const knoppie = document.getElementById(inskrywing.id);
      if (knoppie) bkh_onthou(knoppie, inskrywing);
    });
  };

  kyk();
  new MutationObserver(kyk).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

window.addEventListener("pageshow", bkh_herstel);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bkh_begin);
} else {
  bkh_begin();
}
