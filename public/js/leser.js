// public/js/leser.js
//
// Gebruik PDF.js (Mozilla se eie PDF-enjin, dieselfde een in Firefox)
// om die e-boek binne ons eie koppelvlak te vertoon — nie die blaaier
// se ingeboude PDF-bekyker (<iframe>) nie. Dit gee ons volle beheer:
// regte bladsy-teller, voortgang wat onthou word, en soek binne die
// boek.
//
// PDF.js laai die PDF via HTTP Range-versoeke (nodig vir groot lêers)
// — kry-eboek-inhoud.js ondersteun dit reeds, dus is geen
// bediener-kant-verandering vir die PDF self nodig nie.
//
// Vereis identiteit.js reeds gelaai. Lees die produk-slug uit die
// "?boek="-URL-parameter.

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js";

let pdf_dokument = null;
let huidige_bladsy = 1;
let totale_bladsye = 0;
let produk_slug_globaal = null;
let sessie_globaal = null;
let vordering_stoor_tydsaanwyser = null;

function wys_status(teks) {
  const el = document.getElementById("leser-status");
  if (el) el.textContent = teks;
}

async function kry_boek_titel(sessie, produk_slug) {
  try {
    const resp = await fetch("/.netlify/functions/kry-my-boeke", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    const gevind = (data.boeke || []).find((b) => b.produk_slug === produk_slug);
    return gevind ? gevind.titel : "";
  } catch {
    return "";
  }
}

async function kry_gestoorde_bladsy(sessie, produk_slug) {
  try {
    const resp = await fetch(
      `/.netlify/functions/kry-lees-vordering?produk_slug=${encodeURIComponent(produk_slug)}`,
      { headers: { Authorization: `Bearer ${sessie.access_token}` } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.bladsy || null;
  } catch {
    return null;
  }
}

function stoor_vordering_debounced() {
  // Wag 'n oomblik ná die laaste bladsy-verandering voordat ons stoor —
  // vermy 'n stortvloed versoeke as iemand vinnig deur bladsye blaai.
  clearTimeout(vordering_stoor_tydsaanwyser);
  vordering_stoor_tydsaanwyser = setTimeout(async () => {
    try {
      await fetch("/.netlify/functions/stoor-lees-vordering", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessie_globaal.access_token}`,
        },
        body: JSON.stringify({ produk_slug: produk_slug_globaal, bladsy: huidige_bladsy }),
      });
    } catch (fout) {
      console.warn("Kon nie leesvordering stoor nie:", fout);
    }
  }, 600);
}

function wys_voortgang() {
  document.getElementById("leser-bladsy-invoer").value = huidige_bladsy;
  document.getElementById("leser-totaal-bladsye").textContent = totale_bladsye;
  const persentasie = totale_bladsye ? Math.round((huidige_bladsy / totale_bladsye) * 100) : 0;
  document.getElementById("leser-voortgang-balk").style.width = `${persentasie}%`;
}

async function wys_bladsy(nommer) {
  if (!pdf_dokument) return;
  const veilige_nommer = Math.min(Math.max(1, nommer), totale_bladsye);
  huidige_bladsy = veilige_nommer;

  const bladsy = await pdf_dokument.getPage(veilige_nommer);
  const omhulsel = document.querySelector(".leser-bladsy-omhulsel");
  const skaal = (omhulsel.clientWidth - 32) / bladsy.getViewport({ scale: 1 }).width;
  const viewport = bladsy.getViewport({ scale: Math.max(skaal, 0.3) });

  const canvas = document.getElementById("leser-canvas");
  const konteks = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await bladsy.render({ canvasContext: konteks, viewport }).promise;

  wys_voortgang();
  stoor_vordering_debounced();
}

async function soek_in_boek(soekterm) {
  const statusWrap = document.getElementById("leser-soek-status");
  if (!soekterm.trim()) {
    statusWrap.textContent = "";
    return;
  }
  statusWrap.textContent = window.t ? window.t("leser_soek_besig") : "Soek …";

  const soekterm_klein = soekterm.trim().toLowerCase();
  for (let n = 1; n <= totale_bladsye; n++) {
    const bladsy = await pdf_dokument.getPage(n);
    const teksinhoud = await bladsy.getTextContent();
    const teks = teksinhoud.items.map((item) => item.str).join(" ").toLowerCase();
    if (teks.includes(soekterm_klein)) {
      statusWrap.textContent = window.t
        ? `${window.t("leser_soek_gevind")} ${n}`
        : `Gevind op bladsy ${n}`;
      wys_bladsy(n);
      return;
    }
  }
  statusWrap.textContent = window.t ? window.t("leser_soek_niks") : "Geen resultate gevind nie.";
}

async function laai_leser() {
  const parms = new URLSearchParams(window.location.search);
  const produk_slug = parms.get("boek");
  produk_slug_globaal = produk_slug;

  if (!produk_slug) {
    wys_status(window.t ? window.t("leser_geen_boek") : "Geen boek gespesifiseer nie.");
    return;
  }

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) {
    window.location.href = `/aanmeld.html?terug=${encodeURIComponent(
      `/leser.html?boek=${produk_slug}`
    )}`;
    return;
  }
  sessie_globaal = sessie;

  const lisensie_nota_el = document.getElementById("leser-lisensie-nota");
  if (lisensie_nota_el && sessie.gebruiker && sessie.gebruiker.email) {
    const patroon = window.t ? window.t("leser_lisensie_nota") : "Hierdie eksemplaar is aan %epos% gekoppel — nie vir herverspreiding nie.";
    lisensie_nota_el.textContent = patroon.replace("%epos%", sessie.gebruiker.email);
  }

  wys_status(window.t ? window.t("leser_laai_tans") : "Jou boek word gelaai...");

  kry_boek_titel(sessie, produk_slug).then((titel) => {
    if (titel) document.getElementById("leser-titel").textContent = titel;
  });

  try {
    const token_resp = await fetch(
      `/.netlify/functions/kry-leser-token?produk_slug=${encodeURIComponent(produk_slug)}`,
      { method: "POST", headers: { Authorization: `Bearer ${sessie.access_token}` } }
    );

    if (token_resp.status === 401) {
      wys_status(window.t ? window.t("sessie_verval") : "Jou sessie het verval — meld gerus weer aan.");
      return;
    }
    if (!token_resp.ok) {
      throw new Error(`Onverwagte status: ${token_resp.status}`);
    }

    const { token } = await token_resp.json();
    const pdf_url = `/.netlify/functions/kry-eboek-inhoud?produk_slug=${encodeURIComponent(
      produk_slug
    )}&token=${encodeURIComponent(token)}`;

    pdf_dokument = await pdfjsLib.getDocument(pdf_url).promise;
    totale_bladsye = pdf_dokument.numPages;

    const gestoorde_bladsy = await kry_gestoorde_bladsy(sessie, produk_slug);

    wys_status("");
    document.getElementById("leser-bekyker").hidden = false;
    await wys_bladsy(gestoorde_bladsy || 1);
  } catch (fout) {
    console.error("Kon nie e-boek laai nie:", fout);
    if (fout && fout.message === "Onverwagte status: 403") {
      wys_status(window.t ? window.t("leser_nie_gekoop") : "Jy het nie hierdie e-boek gekoop nie.");
    } else if (fout && fout.message === "Onverwagte status: 404") {
      wys_status(window.t ? window.t("leser_nog_nie_beskikbaar") : "Hierdie e-boek is nog nie beskikbaar nie.");
    } else {
      wys_status(window.t ? window.t("leser_fout") : "Kon nie jou boek laai nie — probeer later weer.");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  laai_leser();

  document.getElementById("leser-vorige").addEventListener("click", () => wys_bladsy(huidige_bladsy - 1));
  document.getElementById("leser-volgende").addEventListener("click", () => wys_bladsy(huidige_bladsy + 1));

  document.getElementById("leser-bladsy-invoer").addEventListener("change", (ev) => {
    const nommer = parseInt(ev.target.value, 10);
    if (Number.isFinite(nommer)) wys_bladsy(nommer);
  });

  document.getElementById("leser-soek-vorm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    soek_in_boek(document.getElementById("leser-soek-invoer").value);
  });

  document.addEventListener("keydown", (ev) => {
    if (!pdf_dokument) return;
    if (ev.key === "ArrowRight") wys_bladsy(huidige_bladsy + 1);
    if (ev.key === "ArrowLeft") wys_bladsy(huidige_bladsy - 1);
  });

  window.addEventListener("resize", () => {
    if (pdf_dokument) wys_bladsy(huidige_bladsy);
  });

  // --- Swipe-gebare (foon/tablet) — links blaai vorentoe, regs blaai terug.
  // Net op die bladsy-omhulsel self, sodat 'n normale vertikale
  // bladsy-rol (bv. as die skerm laer as die bladsy is) nie per ongeluk
  // as 'n blaai-gebaar gelees word nie.
  const MIN_SWIPE_AFSTAND = 50;
  const MAKS_VERTIKALE_AFWYKING = 60;
  let swipe_begin_x = null;
  let swipe_begin_y = null;

  const omhulsel = document.querySelector(".leser-bladsy-omhulsel");
  if (omhulsel) {
    omhulsel.addEventListener(
      "touchstart",
      (ev) => {
        if (!pdf_dokument || ev.touches.length !== 1) return;
        swipe_begin_x = ev.touches[0].clientX;
        swipe_begin_y = ev.touches[0].clientY;
      },
      { passive: true }
    );

    omhulsel.addEventListener(
      "touchend",
      (ev) => {
        if (!pdf_dokument || swipe_begin_x === null) return;
        const eind_x = ev.changedTouches[0].clientX;
        const eind_y = ev.changedTouches[0].clientY;
        const delta_x = eind_x - swipe_begin_x;
        const delta_y = eind_y - swipe_begin_y;

        swipe_begin_x = null;
        swipe_begin_y = null;

        if (Math.abs(delta_x) < MIN_SWIPE_AFSTAND || Math.abs(delta_y) > MAKS_VERTIKALE_AFWYKING) return;

        if (delta_x < 0) {
          wys_bladsy(huidige_bladsy + 1);
        } else {
          wys_bladsy(huidige_bladsy - 1);
        }
      },
      { passive: true }
    );
  }
});
