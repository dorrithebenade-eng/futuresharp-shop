// koop.js (November 2026), vir koop.html.
//
// ?produk=<slug>&formaat=eboek|harde_kopie
// ?produk=<slug>&opsie=<sleutel>   (harde-kopie-opsie; formaat volg vanself)
// ?boeke=<slug>,<slug>,...&formaat=eboek&koepon=<KODE>   (November 2026)
//    'n Paar boeke gelyk, bv. uit die "Kies jou boeke"-blok op 'n boek se
//    webblad. Die koeponkode gaan saam na die betaalbladsy (ook ná aanmelding,
//    via localStorage "future_shop_koepon").
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

  const KOEPON_SLEUTEL = "future_shop_koepon";

  function skoon_kode(k) {
    return String(k || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  }

  function na_betaling(koepon) {
    if (koepon) {
      try {
        localStorage.setItem(KOEPON_SLEUTEL, JSON.stringify({ kode: koepon, op: Date.now() }));
      } catch (_) {
        /* die URL dra dit steeds */
      }
      window.location.replace(`voltooi-betaling.html?koepon=${encodeURIComponent(koepon)}`);
    } else {
      window.location.replace("voltooi-betaling.html");
    }
  }

  async function kry_produk(slug) {
    try {
      const r = await fetch(`/.netlify/functions/kry-katalogus?slug=${encodeURIComponent(slug)}`);
      if (r.ok) return ((await r.json()).produkte || [])[0] || null;
    } catch (_) {
      /* hanteer by die roeper */
    }
    return null;
  }

  // 'n Paar boeke in een formaat (net e-boeke en harde kopieë sonder opsies).
  async function koop_meer(slugs, formaat, koepon) {
    const produkte = await Promise.all(slugs.map(kry_produk));
    let bygevoeg = 0;
    for (const produk of produkte) {
      const data = produk && produk.formate && produk.formate[formaat];
      if (!produk || !data || !data.beskikbaar) continue;
      if (formaat === "harde_kopie" && Array.isArray(data.opsies) && data.opsies.length) continue;
      const item = { produk_slug: produk.slug, titel: produk.titel, formaat, prys_sent: Number(data.prys_sent) || 0 };
      if (formaat === "harde_kopie" && produk.kaartjie_boodskap === true) item.kaartjie = true;
      voeg_by_mandjie(item);
      bygevoeg++;
    }
    if (!bygevoeg) {
      wys_fout("koop_nie_beskikbaar");
      return;
    }
    na_betaling(koepon);
  }

  async function begin() {
    if (typeof pas_i18n_toe === "function") pas_i18n_toe();

    const params = new URLSearchParams(window.location.search);
    const koepon = skoon_kode(params.get("koepon"));
    const boeke = (params.get("boeke") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (boeke.length) {
      const f = (params.get("formaat") || "eboek").trim();
      if (!GELDIGE_FORMATE.includes(f)) {
        wys_fout("koop_ongeldig");
        return;
      }
      await koop_meer([...new Set(boeke)], f, koepon);
      return;
    }
    const slug = (params.get("produk") || "").trim();
    const opsie = (params.get("opsie") || "").trim();
    const formaat = opsie ? "harde_kopie" : (params.get("formaat") || "eboek").trim();

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

    // Harde-kopie-opsies (sien netlify/functions/_harde-kopie-opsies.js):
    // het die boek opsies, moet een gekies wees.
    const opsies = formaat === "harde_kopie" && Array.isArray(data.opsies) ? data.opsies : [];
    const gekose = opsies.length ? opsies.find((o) => o.sleutel === opsie) : null;
    if (opsies.length && (!gekose || gekose.beskikbaar === false)) {
      wys_fout("koop_nie_beskikbaar");
      return;
    }

    const item = {
      produk_slug: produk.slug,
      titel: produk.titel,
      formaat,
      prys_sent: Number(gekose ? gekose.prys_sent : data.prys_sent) || 0,
    };
    if (gekose) {
      item.opsie = gekose.sleutel;
      item.opsie_naam = gekose.naam;
      if (gekose.kaartjie === true) item.kaartjie = true;
    } else if (formaat === "harde_kopie" && produk.kaartjie_boodskap === true) {
      item.kaartjie = true;
    }

    voeg_by_mandjie(item);

    // Terug na die boek se webblad (sien terug-webblad.js): net as die
    // produk 'n eie webblad het.
    if (produk.eie_webblad && typeof stoor_terug_webblad === "function") {
      stoor_terug_webblad(produk.slug, String(produk.eie_webblad).replace(/#.*$/, "") + "#formate");
    }
    na_betaling(koepon);
  }

  document.addEventListener("DOMContentLoaded", begin);
})();
