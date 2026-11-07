// koop.js (November 2026), vir koop.html.
//
// ?produk=<slug>&formaat=eboek|harde_kopie
//
// Haal die produk op (ook as dit ongelys is), sit die gekose formaat in die
// mandjie en gaan na voltooi-betaling.html. Die prys hier is net vir die
// mandjie se vertoning; begin-betaling.js bereken die werklike bedrag
// weer uit die katalogus.
//
// 'n Item wat reeds in die mandjie is, word nie gedupliseer nie; die koper
// gaan steeds na die betaalbladsy.

(function () {
  const GELDIGE_FORMATE = ["eboek", "harde_kopie"];

  function wys_fout(sleutel) {
    const el = document.getElementById("koop-boodskap");
    el.innerHTML = `${t(sleutel)} <a href="index.html">${t("koop_na_winkel")}</a>`;
  }

  async function begin() {
    if (typeof pas_i18n_toe === "function") pas_i18n_toe();

    const params = new URLSearchParams(window.location.search);
    const slug = (params.get("produk") || "").trim();
    const formaat = (params.get("formaat") || "eboek").trim();

    if (!slug || !GELDIGE_FORMATE.includes(formaat)) {
      wys_fout("koop_ongeldig");
      return;
    }

    let produk = null;
    try {
      const r = await fetch(`/.netlify/functions/kry-katalogus?slug=${encodeURIComponent(slug)}`);
      if (r.ok) produk = ((await r.json()).produkte || [])[0] || null;
    } catch (_) {
      /* hanteer hieronder */
    }

    const data = produk && produk.formate && produk.formate[formaat];
    if (!produk || !data || !data.beskikbaar) {
      wys_fout("koop_nie_beskikbaar");
      return;
    }

    const item = {
      produk_slug: produk.slug,
      titel: produk.titel,
      formaat,
      prys_sent: Number(data.prys_sent) || 0,
    };
    if (formaat === "harde_kopie" && produk.kaartjie_boodskap === true) {
      item.kaartjie = true;
    }

    voeg_by_mandjie(item);
    window.location.replace("voltooi-betaling.html");
  }

  document.addEventListener("DOMContentLoaded", begin);
})();
