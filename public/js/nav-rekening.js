// public/js/nav-rekening.js
//
// Twee verantwoordelikhede, albei nav-verwant, saam hier om nie 'n
// nuwe skrip-tag op al nege bladsye te hoef byvoeg nie (hierdie lêer is
// reeds oral gelaai):
//
// 1. Mobiele hamburger-kieslys — op smal skerms word die nav-regs-
//    inhoud (Mandjie, rekening, taal) 'n verskuilde skyfie-paneel wat
//    met 'n hamburger-knoppie oop-/toegemaak word (soortgelyk aan die
//    algemene "volskerm-oorvloei-menu"-patroon).
// 2. Rekening-aftrekkieslys — soos voorheen: "Meld aan", of e-pos +
//    "My Boeke"/"Paneelbord" + "Meld af" vir wie aangemeld is.
//
// Vereis identiteit.js reeds gelaai. Vereis die bestaande mini-kop-
// merk-op (mini-kop-inner > mini-kop-regs > #nav-rekening-plek).

// --- 1. Mobiele hamburger-kieslys (loop ongeag aanmeld-status) ---
(function () {
  const inner = document.querySelector(".mini-kop-inner");
  const regs = document.querySelector(".mini-kop-regs");
  if (!inner || !regs) return;

  const hamburger = document.createElement("button");
  hamburger.type = "button";
  hamburger.className = "mini-kop-hamburger";
  hamburger.setAttribute("aria-label", "Kieslys");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.innerHTML = "<span></span><span></span><span></span>";

  const toemaak_knoppie = document.createElement("button");
  toemaak_knoppie.type = "button";
  toemaak_knoppie.className = "mini-kop-regs-toemaak";
  toemaak_knoppie.setAttribute("aria-label", "Maak kieslys toe");
  toemaak_knoppie.textContent = "✕";

  const agtergrond = document.createElement("div");
  agtergrond.className = "mini-kop-regs-agtergrond";

  inner.insertBefore(hamburger, regs);
  regs.insertBefore(toemaak_knoppie, regs.firstChild);
  inner.parentElement.insertBefore(agtergrond, inner.nextSibling);

  function maak_oop() {
    regs.classList.add("mini-kop-regs-oop");
    agtergrond.classList.add("mini-kop-regs-agtergrond-oop");
    hamburger.setAttribute("aria-expanded", "true");
  }
  function maak_toe() {
    regs.classList.remove("mini-kop-regs-oop");
    agtergrond.classList.remove("mini-kop-regs-agtergrond-oop");
    hamburger.setAttribute("aria-expanded", "false");
  }

  hamburger.addEventListener("click", maak_oop);
  toemaak_knoppie.addEventListener("click", maak_toe);
  agtergrond.addEventListener("click", maak_toe);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") maak_toe();
  });
  // Maak toe as die skerm weer wyer as mobiel gemaak word (bv. rotasie).
  window.addEventListener("resize", () => {
    if (window.innerWidth > 640) maak_toe();
  });
})();

// --- 2. Rekening-aftrekkieslys ---
(async function () {
  const plek = document.getElementById("nav-rekening-plek");
  if (!plek) return;

  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }

  if (!sessie) {
    plek.innerHTML = `<a href="aanmeld.html" class="mini-kop-rekening">Meld aan</a>`;
    return;
  }

  const is_personeel = identiteit_het_rol(sessie.gebruiker, "personeel");
  const bestemming_href = is_personeel ? "paneelbord.html" : "my-boeke.html";
  const bestemming_teks = is_personeel ? "Paneelbord" : "My Boeke";

  plek.innerHTML = `
    <div class="rekening-menu">
      <button type="button" id="rekening-skakelaar" class="rekening-skakelaar"
              aria-haspopup="true" aria-expanded="false">
        <span class="rekening-epos">${sessie.gebruiker.email}</span>
        <span class="rekening-pyltjie" aria-hidden="true">▾</span>
      </button>
      <div id="rekening-paneel" class="rekening-paneel" hidden>
        <a href="${bestemming_href}" class="rekening-paneel-skakel">${bestemming_teks}</a>
        <button type="button" id="rekening-meld-af-knoppie" class="rekening-paneel-skakel rekening-paneel-knoppie">Meld af</button>
      </div>
    </div>
  `;

  const skakelaar = document.getElementById("rekening-skakelaar");
  const paneel = document.getElementById("rekening-paneel");

  function maak_paneel_toe() {
    paneel.hidden = true;
    skakelaar.setAttribute("aria-expanded", "false");
  }
  function wissel_paneel() {
    if (!paneel.hidden) {
      maak_paneel_toe();
    } else {
      paneel.hidden = false;
      skakelaar.setAttribute("aria-expanded", "true");
    }
  }

  skakelaar.addEventListener("click", (ev) => {
    ev.stopPropagation();
    wissel_paneel();
  });
  document.addEventListener("click", (ev) => {
    if (!paneel.hidden && !paneel.contains(ev.target) && ev.target !== skakelaar) {
      maak_paneel_toe();
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !paneel.hidden) {
      maak_paneel_toe();
      skakelaar.focus();
    }
  });

  document.getElementById("rekening-meld-af-knoppie").addEventListener("click", () => {
    identiteit_meld_af();
    window.location.href = "index.html";
  });
})();
