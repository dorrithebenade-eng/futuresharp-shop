// terug-webblad.js (November 2026), vir mandjie.html en voltooi-betaling.html.
//
// 'n Koper wat van 'n boek se eie webblad af kom (koop.html), kry bo-aan
// die bladsy 'n skakel terug na die webblad se formate, sodat hy nog iets
// kan kies. koop.js skryf die adres in localStorage; die skakel wys net
// solank daardie boek nog in die mandjie is, en hoogstens twee dae lank.

const TERUG_WEBBLAD_SLEUTEL = "future_shop_terug_webblad";
const TERUG_WEBBLAD_MAKS_MS = 2 * 24 * 60 * 60 * 1000;

function stoor_terug_webblad(produk_slug, url) {
  try {
    localStorage.setItem(TERUG_WEBBLAD_SLEUTEL, JSON.stringify({ produk_slug, url, op: Date.now() }));
  } catch (_) {
    /* sonder localStorage is daar net geen skakel nie */
  }
}

(function () {
  function kry() {
    try {
      const d = JSON.parse(localStorage.getItem(TERUG_WEBBLAD_SLEUTEL) || "null");
      if (!d || !d.url || !d.produk_slug) return null;
      if (Date.now() - (d.op || 0) > TERUG_WEBBLAD_MAKS_MS) return null;
      if (!/^https:\/\//.test(d.url)) return null;
      return d;
    } catch (_) {
      return null;
    }
  }

  function wys() {
    if (!document.querySelector(".vb-wrap, .mandjie-wrap")) return;
    const d = kry();
    if (!d || typeof kry_mandjie !== "function") return;
    if (!kry_mandjie().some((i) => i.produk_slug === d.produk_slug)) return;
    if (document.getElementById("terug-webblad")) return;

    const skakel = document.createElement("a");
    skakel.id = "terug-webblad";
    skakel.className = "terug-skakel";
    skakel.href = d.url;
    skakel.textContent = "← " + (typeof t === "function" ? t("terug_webblad") : "Kies nog iets op die webblad");
    skakel.style.cssText = "display:inline-block;margin:0 16px 0 0;";

    const wrap = document.querySelector(".vb-wrap, .mandjie-wrap");
    wrap.insertBefore(skakel, wrap.firstChild);
  }

  document.addEventListener("DOMContentLoaded", wys);
})();
