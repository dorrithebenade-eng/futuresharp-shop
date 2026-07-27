// paneelbord-installeer-app.js — Future Shop Paneelbord installeer-balk
//
// Soortgelyk aan installeer-app.js (koper-kant), maar met eie teks en
// verwys na paneel-manifest.json se installasie-vloei. Wys 'n eie
// "Installeer app"-balk sodat personeel nie deur die kieslys hoef te
// grawe nie.

(function () {
  const WEGWYS_SLEUTEL = "fs-pwa-paneel-installeer-toegemaak";
  const WEGWYS_DAE = 14;

  function reedsGeinstalleer() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
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
      ? `<strong>Installeer Paneelbord</strong>Vinniger toegang tot die personeel-paneelbord — reg vanaf jou tuisskerm.`
      : `<strong>Installeer Paneelbord</strong>Tik <strong style="display:inline;font-family:inherit;">Deel</strong> onderaan jou skerm, kies dan "Voeg by Tuisskerm".`;

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
    if (plekhouer) plekhouer.appendChild(balk);
  }

  function sluitBalk(balk) {
    localStorage.setItem(WEGWYS_SLEUTEL, String(Date.now()));
    balk.remove();
  }

  if (reedsGeinstalleer() || onlangsToegemaak()) {
    return;
  }

  if (isIOS()) {
    document.addEventListener("DOMContentLoaded", () => {
      const balk = bouBalk({ toonKnoppie: false });
      voegBalkIn(balk);
      document.getElementById("pwa-installeer-sluit").addEventListener("click", () => sluitBalk(balk));
    });
    return;
  }

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

  window.addEventListener("appinstalled", () => {
    const balk = document.getElementById("pwa-installeer-balk");
    if (balk) balk.remove();
  });
})();
