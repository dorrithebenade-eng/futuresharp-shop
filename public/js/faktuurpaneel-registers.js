// public/js/faktuurpaneel-registers.js
//
// Die sub-navigasie op die Registers-blad: een register op 'n slag.
//
// WAAROM DIT NOU BESTAAN. Die HTML het by die tweede register 'n aantekening
// gedra — "kom daar later 'n derde en vierde by, word dit sub-navigasie; twee
// regverdig dit nog nie". Die register van werk en uitgawes is die derde, en
// die produk- en diensregisters kom nog. Vyf lyste onder mekaar beteken 'n
// mens rol verby vier soekvelde wat almal eenders lyk om by die vyfde uit te
// kom, en gryp dan die verkeerde een.
//
// 'N NUWE LÊER. faktuurpaneel.js bly onaangeraak; hy hanteer die vier
// hoofpille en die sessie. Hierdie een doen presies dieselfde ding een vlak
// dieper, met dieselfde meganisme: 'n klas wat wys en versteek, nie 'n
// hidden-attribuut nie. `hidden` werk nie wanneer 'n klasreël display stel —
// die les van die .oi-knoppie in die winkel.
//
// GEEN SESSIE NODIG NIE. Die sub-navigasie skakel net tussen dele van 'n blad
// wat reeds sigbaar is; die drie registers haal elk sy eie data en elkeen
// kontroleer sy eie rol.

function fr_wys(naam) {
  document.querySelectorAll("#fr-sub .fr-sub-knop").forEach((knop) =>
    knop.classList.toggle("aan", knop.getAttribute("data-reg") === naam));

  document.querySelectorAll(".fk-reg").forEach((blok) =>
    blok.classList.toggle("wys", blok.getAttribute("data-reg") === naam));
}

document.addEventListener("DOMContentLoaded", () => {
  const sub = document.getElementById("fr-sub");
  if (!sub) return;

  sub.querySelectorAll(".fr-sub-knop").forEach((knop) =>
    knop.addEventListener("click", () => fr_wys(knop.getAttribute("data-reg"))));

  // Kliënte is die verstek: dit is die register wat by 'n nuwe faktuur die
  // meeste gebruik word.
  fr_wys("kliente");
});
