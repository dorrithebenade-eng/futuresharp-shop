// paneel-kieslys.js
// Hanteer die sy-kieslys navigasie in die personeel-paneelbord: watter
// afdeling wys, en die hamburger-laai op foon (≤640px). Werk los van
// paneelbord.js se bestaande vorm-/data-logika — raak dit nie aan nie.

function paneel_kieslys_wys_afdeling(afdeling_naam) {
  document.querySelectorAll("[data-afdeling-inhoud]").forEach((el) => {
    if (el.getAttribute("data-afdeling-inhoud") === afdeling_naam) {
      // Respekteer bestaande "verberg-tot-oopgemaak"-vorms (bv. die
      // produk-vorm) — moenie hulle afdwing om oop te wees nie, laat
      // paneelbord.js se eie show/hide-logika daardie besluit maak.
      if (el.id === "paneel-vorm-afdeling") {
        // laat soos dit is
      } else {
        el.style.display = "";
      }
    } else {
      el.style.display = "none";
    }
  });

  document.querySelectorAll(".paneel-kieslys-item").forEach((knoppie) => {
    knoppie.classList.toggle(
      "aktief",
      knoppie.getAttribute("data-afdeling") === afdeling_naam
    );
  });
}

function paneel_kieslys_maak_toe() {
  const kieslys = document.getElementById("paneel-sy-kieslys");
  const agtergrond = document.getElementById("paneel-kieslys-agtergrond");
  if (kieslys) kieslys.classList.remove("paneel-kieslys-oop");
  if (agtergrond) agtergrond.classList.remove("paneel-kieslys-agtergrond-oop");
}

document.addEventListener("DOMContentLoaded", () => {
  // Begin met Katalogus sigbaar (standaard-afdeling)
  paneel_kieslys_wys_afdeling("katalogus");

  document.querySelectorAll(".paneel-kieslys-item").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      paneel_kieslys_wys_afdeling(knoppie.getAttribute("data-afdeling"));
      paneel_kieslys_maak_toe();
    });
  });

  const hamburger = document.getElementById("paneel-kieslys-hamburger");
  const kieslys = document.getElementById("paneel-sy-kieslys");
  const agtergrond = document.getElementById("paneel-kieslys-agtergrond");

  if (hamburger && kieslys && agtergrond) {
    hamburger.addEventListener("click", () => {
      kieslys.classList.add("paneel-kieslys-oop");
      agtergrond.classList.add("paneel-kieslys-agtergrond-oop");
    });
    agtergrond.addEventListener("click", paneel_kieslys_maak_toe);
  }
});
