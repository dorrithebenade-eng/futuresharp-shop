// public/js/faktuurpaneel-state-aansigte.js
// Weergawe 1 (17 Oktober 2026).
//
// Die vier oortjies onder State: Begunstigdes en fakture, Ontvangste en
// betalings, Projekverslag en Maandopsomming. Een oortjie op 'n slag, soos
// die Bankstate se aansigte.
//
// Elke wissel stuur die gebeurtenis "st-aansig" met die oortjie se naam, sodat
// 'n verslag eers laai wanneer sy oortjie die eerste keer oopgaan
// (faktuurpaneel-projekverslag.js, faktuurpaneel-maandopsomming.js).
//
// Die laaste oortjie word in sessionStorage onthou, sodat 'n herlaai op
// dieselfde plek bly. Misluk dit, begin die blad by die eerste oortjie.

(function () {
  const SLEUTEL = "fp_state_aansig";

  function wissel(aansig) {
    const knoppe = document.querySelectorAll("[data-st-aansig]");
    if (![...knoppe].some((k) => k.getAttribute("data-st-aansig") === aansig)) aansig = "betaal";
    knoppe.forEach((k) => k.classList.toggle("aan", k.getAttribute("data-st-aansig") === aansig));
    document.querySelectorAll('[id^="st-aansig-"]').forEach((h) => {
      h.hidden = h.id !== "st-aansig-" + aansig;
    });
    try { sessionStorage.setItem(SLEUTEL, aansig); } catch { /* onthou net nie */ }
    document.dispatchEvent(new CustomEvent("st-aansig", { detail: aansig }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-st-aansig]")) return;
    document.querySelectorAll("[data-st-aansig]").forEach((k) =>
      k.addEventListener("click", () => wissel(k.getAttribute("data-st-aansig"))));
    let begin = "betaal";
    try { begin = sessionStorage.getItem(SLEUTEL) || "betaal"; } catch { /* verstek */ }
    // Laat die ander skripte eers hul eie DOMContentLoaded voltooi, sodat
    // hulle luister voordat die eerste wissel gebeur.
    setTimeout(() => wissel(begin), 0);
  });
})();
