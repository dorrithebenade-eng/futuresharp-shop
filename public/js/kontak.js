// public/js/kontak.js
//
// Die "Stuur e-pos"-knoppie op kontak.html is 'n eenvoudige mailto:-skakel
// (geen bediener-kant e-posstuur-diens bestaan nie — sien taal.js/README
// vir die redenasie). Om dit tog nuttiger te maak vir 'n voornemende
// skrywer, bou ons hier 'n vooraf-ingevulde raamwerk in die e-pos se
// liggaam: 'n paar kort vrae wat die skrywer net hoef in te vul voor
// hulle stuur. Dit loop ná taal.js (wat t() en die huidige taal opstel),
// sodat die raamwerk outomaties in die regte taal is.

function bou_kontak_mailto_skakel() {
  const skakel = document.getElementById("kontak-stuur-knoppie");
  if (!skakel) return;

  const onderwerp = t("kontak_epos_onderwerp");

  const reels = [
    `${t("kontak_raamwerk_naam")}: `,
    `${t("kontak_raamwerk_kontaknommer")}: `,
    "",
    t("kontak_raamwerk_agtergrond_vraag"),
    "",
    "",
    `${t("kontak_raamwerk_hoeveel_boeke")} `,
    "",
    t("kontak_raamwerk_titels_kategoriee_vraag"),
    "1. ",
    "2. ",
    "",
    t("kontak_raamwerk_formaat_vraag"),
    "",
    "",
    t("kontak_raamwerk_bykomend"),
    "",
  ];

  const liggaam = reels.join("\n");

  skakel.href =
    "mailto:futureshop@futuresharp.co.za" +
    `?subject=${encodeURIComponent(onderwerp)}` +
    `&body=${encodeURIComponent(liggaam)}`;
}

// Die lesers se knoppie (November 2026): 'n navraag oor 'n boek, 'n
// bestelling of My Leeskamer, met drie kort velde vooraf ingevul.
function bou_leser_mailto_skakel() {
  const skakel = document.getElementById("kontak-leser-knoppie");
  if (!skakel) return;
  const liggaam = [
    `${t("kontak_leser_naam")}: `,
    `${t("kontak_leser_bestelnommer")}: `,
    "",
    t("kontak_leser_vraag"),
    "",
  ].join("\n");
  skakel.href =
    "mailto:futureshop@futuresharp.co.za" +
    `?subject=${encodeURIComponent(t("kontak_leser_onderwerp"))}` +
    `&body=${encodeURIComponent(liggaam)}`;
}

document.addEventListener("DOMContentLoaded", bou_kontak_mailto_skakel);
document.addEventListener("DOMContentLoaded", bou_leser_mailto_skakel);

// "Vir skrywers" in die voet skakel na kontak.html#skrywer: vou dan die
// skrywersafdeling dadelik oop.
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash === "#skrywer") {
    const d = document.getElementById("skrywer");
    if (d) d.open = true;
  }
});
