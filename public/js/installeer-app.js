// installeer-app.js — Future Shop PWA installeer-balk
//
// Wys 'n eie "Installeer app"-balk bo-aan die bladsy sodat kopers nie
// self deur die blaaiser se kieslys hoef te grawe nie.
//
// Gedrag:
// - Android/Chrome: luister vir "beforeinstallprompt", wys 'n knoppie
//   wat die native installasie-versoek direk oopmaak met een tik.
// - iOS/Safari: geen programmatiese installasie moontlik nie (Apple
//   laat dit nie toe nie) — wys net 'n instruksie na die Deel-knoppie.
// - Word nooit gewys nie as die app reeds in standalone-modus loop
//   (d.w.s. iemand het dit klaar geïnstalleer).
// - As iemand die balk toemaak (×), bly dit weg vir 14 dae.

(function () {
  const WEGWYS_SLEUTEL = "fs-pwa-installeer-toegemaak";
  const WEGWYS_DAE = 14;

  function reedsGeinstalleer() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true // ouer iOS Safari-eiendom
    );
  }

  function onlangsToegemaak() {
    const gestoor = localStorage.getItem(WEGWYS_SLEUTEL);
    if (!gestoor) return false;
    const verstrekeDae = (Date.now() - Number(gestoor)) / (1000 * 60 * 60 * 24);
    return verstrekeDae < WEGWYS_DAE;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function bouBalk({ toonKnoppie }) {
    const balk = document.createElement("div");
    balk.className = "pwa-installeer-balk";
    balk.id = "pwa-installeer-balk";

    const teksInhoud = toonKnoppie
      ? `<strong>Installeer Future Shop</strong>Vinniger toegang tot jou boeke — reg vanaf jou tuisskerm.`
      : `<strong>Installeer Future Shop</strong>Tik <strong style="display:inline;font-family:inherit;">Deel</strong> onderaan jou skerm, kies dan "Voeg by Tuisskerm".`;

    balk.innerHTML = `
      <div class="pwa-installeer-ikoon">FS</div>
      <div class="pwa-installeer-teks">${teksInhoud}</div>
      ${toonKnoppie ? '<button type="button" class="pwa-installeer-knoppie" id="pwa-installeer-knoppie">Installeer</button>' : ""}
      <button type="button" class="pwa-installeer-sluit" id="pwa-installeer-sluit" aria-label="Maak toe">×</button>
    `;
    return balk;
  }

  function voegBalkIn(balk) {
    const plekhouer = document.getElementById("pwa-installeer-plek");
    if (plekhouer) {
      plekhouer.appendChild(balk);
    } else {
      // Terugval: voeg by die begin van <main> in
      const main = document.querySelector("main");
      if (main) main.insertBefore(balk, main.firstChild);
    }
  }

  function sluitBalk(balk) {
    localStorage.setItem(WEGWYS_SLEUTEL, String(Date.now()));
    balk.remove();
  }

  if (reedsGeinstalleer() || onlangsToegemaak()) {
    return; // niks om te doen nie
  }

  if (isIOS()) {
    // iOS: geen beforeinstallprompt-gebeurtenis bestaan nie — wys dadelik die instruksie
    document.addEventListener("DOMContentLoaded", () => {
      const balk = bouBalk({ toonKnoppie: false });
      voegBalkIn(balk);
      document.getElementById("pwa-installeer-sluit").addEventListener("click", () => sluitBalk(balk));
    });
    return;
  }

  // Android/Chrome (en ander blaaisers wat die gebeurtenis ondersteun)
  let uitgesteldeGebeurtenis = null;

  window.addEventListener("beforeinstallprompt", (gebeurtenis) => {
    gebeurtenis.preventDefault();
    uitgesteldeGebeurtenis = gebeurtenis;

    const wys = () => {
      const balk = bouBalk({ toonKnoppie: true });
      voegBalkIn(balk);

      document.getElementById("pwa-installeer-knoppie").addEventListener("click", async () => {
        if (!uitgesteldeGebeurtenis) return;
        uitgesteldeGebeurtenis.prompt();
        const keuse = await uitgesteldeGebeurtenis.userChoice;
        if (keuse.outcome === "accepted") {
          balk.remove();
        }
        uitgesteldeGebeurtenis = null;
      });

      document.getElementById("pwa-installeer-sluit").addEventListener("click", () => sluitBalk(balk));
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wys);
    } else {
      wys();
    }
  });

  // Verwyder die balk dadelik as die installasie op enige manier voltooi word
  window.addEventListener("appinstalled", () => {
    const balk = document.getElementById("pwa-installeer-balk");
    if (balk) balk.remove();
  });
})();
