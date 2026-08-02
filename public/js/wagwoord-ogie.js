// public/js/wagwoord-ogie.js
//
// Voeg 'n "wys/versteek"-ogie by ELKE wagwoordveld op die bladsy waar
// hierdie lêer ingesluit is — aanmeld, registreer, wagwoordherstel, die
// paneelbord se aanmeld, en enige bladsy wat later bykom.
//
// Waarom dit hier woon en nie in elke bladsy se eie skrip nie:
// die veld word opgespoor, nie hardgekodeer nie. Enige nuwe wagwoordveld
// kry die ogie vanself, sonder dat 'n bestaande lêer gewysig hoef te word.
//
// Die styl word van hier af ingespuit sodat css/styl.css onaangeraak bly.
//
// LET WEL: die knoppie is doelbewus tabIndex = -1. 'n Mens wat met Tab
// deur die vorm beweeg, moet van die wagwoordveld reguit na die volgende
// veld spring — nie eers deur 'n knoppie wat niks indien nie.

(function () {
  const STYL_ID = "wagwoord-ogie-styl";

  const STYLE = `
    .wagwoord-omhulsel { position: relative; display: block; }
    .wagwoord-omhulsel > input { padding-right: 46px !important; }
    .wagwoord-ogie {
      position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; padding: 0; margin: 0;
      background: none; border: 0; border-radius: 6px;
      color: #6b6b6b; cursor: pointer; line-height: 0;
    }
    .wagwoord-ogie:hover { color: #111; background: rgba(0,0,0,.05); }
    .wagwoord-ogie:focus-visible { outline: 2px solid #16a394; outline-offset: 1px; }
    .wagwoord-ogie svg { width: 20px; height: 20px; pointer-events: none; }
  `;

  const OOP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  const TOE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c7 0 10.5 6 10.5 6a17 17 0 0 1-3.6 4.2"/><path d="M6.6 7.8A16.7 16.7 0 0 0 1.5 12S5 18 12 18a10 10 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  // Eie etikette met 'n terugval, sodat hierdie lêer op enige bladsy werk —
  // ook waar taal.js (nog) nie gelaai is nie, soos die paneelbord se
  // aanmeldskerm. Is die sleutels wel in taal.js, word dié gebruik.
  const ETIKETTE = {
    wys: { af: "Wys wagwoord", en: "Show password" },
    versteek: { af: "Versteek wagwoord", en: "Hide password" },
  };

  function huidige_taal() {
    try {
      const gestoor = localStorage.getItem("future_shop_taal");
      if (gestoor === "af" || gestoor === "en") return gestoor;
    } catch {
      /* localStorage kan geblokkeer wees — val terug op af */
    }
    return "af";
  }

  function etiket(naam) {
    const sleutel = naam === "wys" ? "wagwoord_wys" : "wagwoord_versteek";
    if (typeof window.t === "function") {
      const uit = window.t(sleutel);
      // t() gee die sleutel self terug as dit onbekend is — dan val ons terug.
      if (uit && uit !== sleutel) return uit;
    }
    return ETIKETTE[naam][huidige_taal()];
  }

  function voeg_styl_by() {
    if (document.getElementById(STYL_ID)) return;
    const el = document.createElement("style");
    el.id = STYL_ID;
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  function heg_aan(veld) {
    if (!veld || veld.dataset.ogieAangeheg === "ja") return;
    if (!veld.parentNode) return;
    veld.dataset.ogieAangeheg = "ja";

    const omhulsel = document.createElement("span");
    omhulsel.className = "wagwoord-omhulsel";
    veld.parentNode.insertBefore(omhulsel, veld);
    omhulsel.appendChild(veld);

    const knoppie = document.createElement("button");
    knoppie.type = "button";
    knoppie.className = "wagwoord-ogie";
    knoppie.innerHTML = OOP;
    knoppie.setAttribute("aria-label", etiket("wys"));
    knoppie.setAttribute("aria-pressed", "false");
    knoppie.tabIndex = -1;

    knoppie.addEventListener("click", () => {
      const wys_nou = veld.type === "password";
      veld.type = wys_nou ? "text" : "password";
      knoppie.innerHTML = wys_nou ? TOE : OOP;
      knoppie.setAttribute("aria-label", wys_nou ? etiket("versteek") : etiket("wys"));
      knoppie.setAttribute("aria-pressed", wys_nou ? "true" : "false");
      veld.focus();
    });

    omhulsel.appendChild(knoppie);
  }

  function soek_velde() {
    document.querySelectorAll('input[type="password"]').forEach(heg_aan);
  }

  function begin() {
    voeg_styl_by();
    soek_velde();

    // Party vorms word eers later in die DOM gebou (die paneelbord se
    // aanmeldskerm, en die aanmeldbladsy se registreer-/herstelblokke wat
    // met "hidden" wissel). Hou dus dop vir wagwoordvelde wat later bykom.
    if (typeof MutationObserver === "function") {
      const waarnemer = new MutationObserver(soek_velde);
      waarnemer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
})();
