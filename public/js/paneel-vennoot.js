// public/js/paneel-vennoot.js
//
// Beperk die paneelbord vir 'n vennoot (direkteur) tot SLEGS twee
// afdelings: Dokumente en die Verdeling-rekenaar. Lees-alleen — geen
// oplaai, geen skrap.
//
// WAAROM 'N APARTE LÊER: paneelbord.js, paneel-kieslys.js en dokumente.js
// werk almal reeds. Hierdie beperking is 'n laag bo-op hulle, nie 'n
// wysiging aan hulle nie. paneelbord.js roep net paneel_vennoot_beperk()
// aan wanneer 'n vennoot aanmeld.
//
// WAAROM DIE VERBERGING MET CSS GEBEUR EN NIE MET JAVASCRIPT NIE:
// dokumente.js bou sy lys asinkroon, en elke ry kry 'n Skrap-knoppie.
// Sou ons hulle met JavaScript verwyder, moes ons die lys dophou en ná
// elke herteken weer skoonmaak. 'n CSS-reël onder body.vennoot-modus geld
// outomaties vir elke knoppie wat later bygekom het.
//
// DIT IS NIE DIE SEKURITEIT NIE. 'n Verborge knoppie kan in die blaaier
// sigbaar gemaak word. Die werklike grens sit bediener-kant:
//   kry-dokumente.js    → ["personeel", "vennoot"]
//   laai-dokument-op.js → "personeel" alleen
//   skrap-dokument.js   → "personeel" alleen
// 'n Vennoot wat die Skrap-knoppie sigbaar maak en klik, kry 403.

const VENNOOT_AFDELINGS = ["dokumente", "verdeling-rekenaar"];

function paneel_vennoot_beperk() {
  document.body.classList.add("vennoot-modus");

  // DIE TELLERS BLY, DIE HERSTEL-KNOPPIE GAAN.
  //
  // 'n Vennoot sien die vier winkeltellers — kry-statistieke.js laat hom
  // toe. Maar die ↺ langs Totaal skryf, en herstel-statistiek.js bly
  // personeel alleen. 'n Sigbare knoppie wat altyd 403 gee, lyk soos 'n
  // stukkende stelsel.
  //
  // Verwyder en nie versteek nie, om dieselfde rede as die kieslys-items:
  // die blok word een keer gebou en verander nie weer nie.
  const herstel = document.getElementById("statistiek-herstel-totaal");
  if (herstel) herstel.remove();

  // Verwyder die kieslys-items wat nie geld nie heeltemal uit die DOM.
  // CSS sou hulle net versteek; hier is dit skoner, want die kieslys word
  // een keer gebou en verander nie weer nie.
  document.querySelectorAll(".paneel-kieslys-item").forEach((knoppie) => {
    const afdeling = knoppie.getAttribute("data-afdeling");
    if (!VENNOOT_AFDELINGS.includes(afdeling)) knoppie.remove();
  });

  // Dokumente word die begin-afdeling. paneel-kieslys.js het by
  // DOMContentLoaded reeds Katalogus gewys — dié aanroep vervang dit.
  if (typeof paneel_kieslys_wys_afdeling === "function") {
    paneel_kieslys_wys_afdeling("dokumente");
  }
}

// Nie 'n module nie — paneelbord.js roep dit direk aan.
window.paneel_vennoot_beperk = paneel_vennoot_beperk;
