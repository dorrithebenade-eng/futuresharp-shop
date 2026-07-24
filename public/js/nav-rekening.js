// public/js/nav-rekening.js
//
// Rekening-menu in die nav — 'n enkele klik-skakelaar-knoppie wat 'n
// klein paneel oopmaak (soortgelyk aan die algemene "My Account"-
// aftrekkieslys-patroon op e-handelswerwe). Klik-gebaseer, nie
// oorbeweeg-gebaseer nie — oorbeweeg werk nie op raakskerms nie.
//
//   - Niemand aangemeld nie -> plein "Meld aan"-skakel (geen paneel nodig)
//   - Koper aangemeld       -> skakelaar wys e-pos, paneel: "My Boeke" + "Meld af"
//   - Personeel aangemeld   -> skakelaar wys e-pos, paneel: "Paneelbord" + "Meld af"
//
// Vereis identiteit.js reeds gelaai. Vereis 'n plekhouer-element:
//   <span id="nav-rekening-plek"></span>

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
    const nou_oop = !paneel.hidden;
    if (nou_oop) {
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

  // Maak toe wanneer 'n mens êrens anders klik, of Escape druk.
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
