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

  // Die taal-wisselaar bly ALTYD sigbaar in die kopbalk, ook op mobiel
  // — ons kloon dit in 'n aparte, altyd-sigbare balkie langs die
  // hamburger, en verskuil die oorspronklike een (binne die skyfie-
  // paneel) net op mobiel via CSS, om duplisering te vermy. taal.js se
  // eie DOMContentLoaded-luisteraar (wat .taal-knoppie-elemente aan
  // kliek-hanteerders koppel) loop eers NÁ hierdie sinkrone kode, so
  // die kloon se knoppies word ook korrek gekoppel.
  const mobiel_balk = document.createElement("div");
  mobiel_balk.className = "mini-kop-mobiel-balk";

  const taal_oorspronklik = regs.querySelector(".taal-wisselaar");
  if (taal_oorspronklik) {
    const taal_kloon = taal_oorspronklik.cloneNode(true);
    mobiel_balk.appendChild(taal_kloon);
  }
  mobiel_balk.appendChild(hamburger);

  inner.insertBefore(mobiel_balk, regs.nextSibling);
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
    const meld_aan_teks = window.t ? window.t("meld_aan_knoppie") : "Meld aan";
    plek.innerHTML = `<a href="aanmeld.html" class="mini-kop-rekening">${meld_aan_teks}</a>`;
    return;
  }

  // LET WEL: hierdie is die WINKEL-kant se rekening-nav — dit wys
  // ALTYD "My Boeke", nooit "Paneelbord" nie, ongeag of die
  // onderliggende rekening toevallig ook 'n personeel-rol het. Winkel-
  // en paneel-aanmelding is doelbewus volledig geskeide sessies (sien
  // identiteit.js) — 'n personeel-rekening wat hier aanmeld, word in
  // hierdie konteks bloot as 'n gewone koper behandel.
  //
  // Geen aftrekkieslys nie — e-pos, "My Boeke" en "Meld af" staan
  // reguit langs mekaar in die kopbalk. Op smal skerms val hulle
  // vanself in die bestaande mobiele skyfie-paneel (.mini-kop-regs)
  // in, saam met Mandjie en die taal-wisselaar — geen aparte
  // mobiel-hantering hier nodig nie.
  const my_boeke_teks = window.t ? window.t("my_boeke_titel") : "My Boeke";
  const meld_af_teks = window.t ? window.t("paneel_meld_af") : "Meld af";

  plek.innerHTML = `
    <div class="nav-rekening-groep">
      <span class="nav-rekening-epos">${sessie.gebruiker.email}</span>
      <a href="my-boeke.html" class="nav-rekening-skakel">${my_boeke_teks}</a>
      <button type="button" id="rekening-meld-af-knoppie" class="nav-rekening-skakel">${meld_af_teks}</button>
    </div>
  `;

  document.getElementById("rekening-meld-af-knoppie").addEventListener("click", () => {
    identiteit_meld_af();
    window.location.href = "index.html";
  });
})();
