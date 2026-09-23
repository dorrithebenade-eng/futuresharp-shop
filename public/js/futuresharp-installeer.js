// public/js/futuresharp-installeer.js
//
// "INSTALLEER AS APP" VIR DIE FUTURE SHARP-PANEEL.
//
// 'n Webblad mag homself nie sonder 'n tik installeer nie; die foon vra altyd
// eers. Wat ons wel kan doen:
//   ANDROID (Chrome): die blaaier gee 'n installeer-geleentheid
//     (beforeinstallprompt). Ons hou dit vas en wys 'n knoppie; een tik en
//     die foon se eie installeer-venster verskyn.
//   IPHONE (Safari): Apple laat geen knoppie toe nie. Ons wys 'n kort
//     aanwysing: Deel, dan Voeg by tuisskerm.
// Klaar geïnstalleer (die bladsy loop reeds as app), of weggewys: niks nie.

(function () {
  const WEG = "fsp-installeer-weg";
  const strook = () => document.getElementById("fsp-installeer");
  let geleentheid = null;

  const as_app = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const weggewys = () => { try { return localStorage.getItem(WEG) === "ja"; } catch { return false; } };
  // Enige blaaier op 'n iPhone: sedert iOS 16.4 kan Chrome ook "Voeg by
  // tuisskerm" doen, via sy eie Deel-knoppie.
  const is_iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const is_android = /android/i.test(navigator.userAgent);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/futuresharp-sw.js", { scope: "/futuresharp" }).catch(() => {});
  }

  function wys(modus) {
    const s = strook();
    if (!s || as_app || weggewys()) return;
    for (const el of s.querySelectorAll("[data-modus]")) el.hidden = el.dataset.modus !== modus;
    s.hidden = false;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    geleentheid = e;
    wys("android");
  });

  window.addEventListener("appinstalled", () => {
    const s = strook();
    if (s) s.hidden = true;
  });

  document.addEventListener("DOMContentLoaded", () => {
    const s = strook();
    if (!s) return;
    if (is_iphone) wys("iphone");

    // ANDROID: Chrome gee die installeer-geleentheid eers ná 'n rukkie op die
    // bladsy (sy eie reëls), of glad nie as die app reeds geïnstalleer is.
    // Kom dit nie binne 'n paar sekondes nie, wys ons die handmatige pad deur
    // Chrome se kieslys. Kom dit later tog, word dit die knoppie.
    if (is_android) setTimeout(() => { if (!geleentheid) wys("android-kieslys"); }, 3000);

    s.querySelector("#fsp-installeer-knop").addEventListener("click", async () => {
      if (!geleentheid) return;
      geleentheid.prompt();
      const keuse = await geleentheid.userChoice.catch(() => null);
      geleentheid = null;
      if (keuse && keuse.outcome === "accepted") s.hidden = true;
    });
    s.querySelector("#fsp-installeer-weg").addEventListener("click", () => {
      try { localStorage.setItem(WEG, "ja"); } catch { /* geen berging: net vir nou weg */ }
      s.hidden = true;
    });
  });
})();
