// Netlify se Identity-widget bied self geen "wys wagwoord"-ogie op sy
// wagwoord-velde nie, en ons kan nie die widget se eie interne kode
// wysig nie. Boonop render die widget sy hele venster binne 'n Shadow
// DOM (om sy eie CSS te isoleer) — gewone document.querySelectorAll kan
// nie daar uitkom nie, ons moet spesifiek na die skadu-wortel toe gaan.

(function () {
  function voeg_ogie_by(invoerVeld) {
    if (invoerVeld.dataset.wagwoordOgieBygevoeg) return;
    invoerVeld.dataset.wagwoordOgieBygevoeg = "true";

    const ouer = invoerVeld.parentElement;
    if (ouer && getComputedStyle(ouer).position === "static") {
      ouer.style.position = "relative";
    }
    invoerVeld.style.paddingRight = "36px";

    const knoppie = document.createElement("button");
    knoppie.type = "button";
    knoppie.textContent = "👁";
    knoppie.setAttribute("aria-label", "Wys/verberg wagwoord");
    knoppie.style.cssText = [
      "position:absolute",
      "right:10px",
      "top:50%",
      "transform:translateY(-50%)",
      "background:none",
      "border:none",
      "cursor:pointer",
      "font-size:15px",
      "line-height:1",
      "padding:4px",
      "opacity:0.55",
      "z-index:2",
    ].join(";");

    knoppie.addEventListener("click", () => {
      const wys = invoerVeld.type === "password";
      invoerVeld.type = wys ? "text" : "password";
      knoppie.style.opacity = wys ? "1" : "0.55";
    });

    invoerVeld.insertAdjacentElement("afterend", knoppie);
  }

  function verwerk_wortel(wortel) {
    wortel.querySelectorAll('input[type="password"]').forEach(voeg_ogie_by);
  }

  // Die widget se opspring-inhoud sit binne 'n element se .shadowRoot.
  // Ons soek na enige element met 'n shadowRoot iewers in die dokument,
  // en hou dit self ook dop vir veranderinge (die widget bou sy inhoud
  // van voor af elke keer as jy tussen Log in/Sign up/Herstel wissel).
  function vind_en_verwerk_skadu_wortels(wortel) {
    wortel.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) {
        verwerk_wortel(element.shadowRoot);
        if (!element.dataset.wagwoordSkaduWaargeneem) {
          element.dataset.wagwoordSkaduWaargeneem = "true";
          new MutationObserver(() => verwerk_wortel(element.shadowRoot)).observe(
            element.shadowRoot,
            { childList: true, subtree: true }
          );
        }
      }
    });
  }

  const hoof_waarnemer = new MutationObserver(() => vind_en_verwerk_skadu_wortels(document));
  hoof_waarnemer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("DOMContentLoaded", () => vind_en_verwerk_skadu_wortels(document));
})();
