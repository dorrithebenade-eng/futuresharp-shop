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
let huidige_zoem = 1;
let huidige_render_taak = null;

const MIN_ZOEM = 0.6;
const MAKS_ZOEM = 3;

function wys_status(teks) {
  const el = document.getElementById("leser-status");
  if (el) el.textContent = teks;
}

// Leen-status sit nou as 'n klein amber etiket in die kopbalk (bv.
// "⏳ 5 dae oor"). 'n Tik daarop maak die leen-paneel onder die kopbalk
// oop met die vervaldatum en, as die bediener dit aanbied, die
// leen-na-koop-knoppie.
function wys_leen_kennisgewing(leen) {
  const etiket = document.getElementById("leser-leen-etiket");
  if (!etiket) return;
  if (!leen.aktief) {
    etiket.hidden = true;
    return;
  }
  const dae_oor = typeof leen.dae_oor === "number"
    ? leen.dae_oor
    : Math.max(0, Math.ceil((new Date(leen.verval_op) - new Date()) / (1000 * 60 * 60 * 24)));
  const eenheid = dae_oor === 1
    ? (window.t ? window.t("dag_enkelvoud") : "dag oor")
    : (window.t ? window.t("dae_oor_meervoud") : "dae oor");
  etiket.textContent = `⏳ ${dae_oor} ${eenheid}`;
  etiket.hidden = false;

  const boodskap = document.getElementById("leser-leen-boodskap");
  if (boodskap) {
    const voorvoegsel = window.t ? window.t("leen_kennisgewing_voorvoegsel") : "Geleen —";
    let teks = `${voorvoegsel} ${dae_oor} ${eenheid}.`;
    if (leen.verval_op) {
      const d = new Date(leen.verval_op);
      const datum = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      teks += ` ${window.t ? window.t("leser_leen_verval_op") : "Toegang verval op"} ${datum}.`;
    }
    boodskap.textContent = teks;
  }
}

function wissel_leen_paneel() {
  const etiket = document.getElementById("leser-leen-etiket");
  const paneel = document.getElementById("leser-leen-paneel");
  if (!etiket || !paneel) return;
  const oop = paneel.hidden;
  paneel.hidden = !oop;
  etiket.setAttribute("aria-expanded", String(oop));
  if (pdf_dokument) wys_bladsy(huidige_bladsy);
}

// Dieselfde leen-na-koop-aanbod as op My Leeskamer (sien my-boeke.js):
// die bediener besluit of dit nou relevant is; ons wys dit net.
function wys_opgradering(boek) {
  const knoppie = document.getElementById("leser-opgradering-knoppie");
  if (!knoppie || !boek || !boek.opgradering) return;
  const bedrag = `R${(boek.opgradering.afslag_sent / 100).toFixed(2)}`;
  knoppie.textContent = window.t
    ? `${window.t("leen_opgradering_knoppie")} ${bedrag} ${window.t("leen_opgradering_afslag_suffix")}`
    : `Koop nou — ${bedrag} afslag`;
  knoppie.hidden = false;
  knoppie.addEventListener("click", () => {
    voeg_by_mandjie({
      produk_slug: boek.produk_slug,
      titel: boek.titel,
      formaat: "eboek",
      prys_sent: boek.opgradering.eboek_prys_sent,
    });
    window.location.href = `/voltooi-betaling.html?koepon=${encodeURIComponent(boek.opgradering.koepon_kode)}`;
  });
}

// Gee die hele boek-rekord uit kry-my-boeke terug (titel, en by 'n leen
// ook die opgradering-aanbod), of null.
async function kry_boek(sessie, produk_slug) {
  try {
    const resp = await fetch("/.netlify/functions/kry-my-boeke", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.boeke || []).find((b) => b.produk_slug === produk_slug) || null;
  } catch {
    return null;
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
  const bladsy_verander = veilige_nommer !== huidige_bladsy;
  huidige_bladsy = veilige_nommer;

  const bladsy = await pdf_dokument.getPage(veilige_nommer);
  const omhulsel = document.querySelector(".leser-bladsy-omhulsel");

  // PAS DIE HELE BLADSY, NIE NET DIE BREEDTE NIE. Voorheen is net volgens
  // breedte geskaal, dus was 'n bladsy altyd hoër as die skerm en moes die
  // leser rol. Nou wen die kleinste van die twee verhoudings, sodat die
  // hele bladsy by 100% in die omhulsel pas. Zoem vergroot van daar af.
  const styl = getComputedStyle(omhulsel);
  const opvul_x = parseFloat(styl.paddingLeft) + parseFloat(styl.paddingRight);
  const opvul_y = parseFloat(styl.paddingTop) + parseFloat(styl.paddingBottom);
  const beskikbaar_b = Math.max(omhulsel.clientWidth - opvul_x, 50);
  const beskikbaar_h = Math.max(omhulsel.clientHeight - opvul_y, 50);
  const basis = bladsy.getViewport({ scale: 1 });
  const pas_skaal = Math.min(beskikbaar_b / basis.width, beskikbaar_h / basis.height);
  const skaal = Math.max(pas_skaal, 0.2) * huidige_zoem;
  const viewport = bladsy.getViewport({ scale: skaal });

  // SKERP OP FONE. Die canvas word teen die skerm se werklike
  // pixeldigtheid geteken en dan terug na CSS-grootte vertoon; sonder dit
  // is die teks op 'n foon (2x of 3x) sigbaar dof, en noudat die bladsy
  // kleiner vertoon, sou dit nog erger wees.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.getElementById("leser-canvas");
  const konteks = canvas.getContext("2d");

  // PDF.js gooi 'n fout as twee render()-oproepe gelyk op een canvas
  // loop (bv. tydens 'n skermdraai of knyp). Kanselleer die vorige een.
  if (huidige_render_taak) {
    huidige_render_taak.cancel();
    huidige_render_taak = null;
  }

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const taak = bladsy.render({
    canvasContext: konteks,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
  });
  huidige_render_taak = taak;
  try {
    await taak.promise;
  } catch (fout) {
    if (fout && fout.name === "RenderingCancelledException") return;
    throw fout;
  } finally {
    if (huidige_render_taak === taak) huidige_render_taak = null;
  }
  await bou_skakel_laag(bladsy, viewport);

  // 'n Nuwe bladsy begin bo-links, ook as die vorige een ingezoem was.
  if (bladsy_verander) {
    omhulsel.scrollTop = 0;
    omhulsel.scrollLeft = 0;
  }

  wys_voortgang();
  stoor_vordering_debounced();
}

// --- Klikbare inhoudsopgawe/verwysings — lees die PDF se EIE ingeboude
// skakel-annotasies (soos 'n outeur dit self in Word/hul PDF-sagteware
// as hiperskakels na 'n opskrif of bladsy opgestel het) en teken
// onsigbare, klikbare gebiede oor die canvas op presies daardie plekke.
// Ons bou hierdie skakels self nie — ons lees net wat reeds in die
// dokument ingebed is.
async function kry_bladsy_indeks_vir_bestemming(bestemming) {
  let eksplisiete_bestemming = bestemming;
  if (typeof bestemming === "string") {
    eksplisiete_bestemming = await pdf_dokument.getDestination(bestemming);
  }
  if (!Array.isArray(eksplisiete_bestemming) || !eksplisiete_bestemming[0]) return null;

  try {
    return await pdf_dokument.getPageIndex(eksplisiete_bestemming[0]);
  } catch {
    return null;
  }
}

async function bou_skakel_laag(bladsy, viewport) {
  const laag = document.getElementById("leser-skakel-laag");
  if (!laag) return;
  laag.innerHTML = "";
  laag.style.width = `${viewport.width}px`;
  laag.style.height = `${viewport.height}px`;

  let anotasies;
  try {
    anotasies = await bladsy.getAnnotations();
  } catch {
    return;
  }

  anotasies.forEach((anotasie) => {
    if (anotasie.subtype !== "Link" || (!anotasie.dest && !anotasie.url)) return;

    const reghoek = viewport.convertToViewportRectangle(anotasie.rect);
    const links = Math.min(reghoek[0], reghoek[2]);
    const bo = Math.min(reghoek[1], reghoek[3]);
    const breedte = Math.abs(reghoek[2] - reghoek[0]);
    const hoogte = Math.abs(reghoek[3] - reghoek[1]);

    const skakel_el = document.createElement("a");
    skakel_el.className = "leser-skakel-area";
    skakel_el.href = "#";
    skakel_el.style.left = `${links}px`;
    skakel_el.style.top = `${bo}px`;
    skakel_el.style.width = `${breedte}px`;
    skakel_el.style.height = `${hoogte}px`;

    if (anotasie.url) {
      // Eksterne skakel (bv. 'n outeur se webwerf) — maak in 'n nuwe
      // oortjie oop, hou die leser self oop.
      skakel_el.href = anotasie.url;
      skakel_el.target = "_blank";
      skakel_el.rel = "noopener noreferrer";
    } else {
      skakel_el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const bladsy_indeks = await kry_bladsy_indeks_vir_bestemming(anotasie.dest);
        if (bladsy_indeks !== null) wys_bladsy(bladsy_indeks + 1);
      });
    }

    laag.appendChild(skakel_el);
  });
}

function is_ingezoem() {
  return huidige_zoem > 1.02;
}

function opdateer_gebaar_modus() {
  const omhulsel = document.querySelector(".leser-bladsy-omhulsel");
  if (omhulsel) {
    omhulsel.classList.toggle("leser-bladsy-omhulsel--gezoem", is_ingezoem());
  }
}

function wys_zoem_persentasie() {
  const el = document.getElementById("leser-zoem-persentasie");
  if (el) el.textContent = `${Math.round(huidige_zoem * 100)}%`;
  opdateer_gebaar_modus();
}

function stel_zoem(nuwe_zoem) {
  huidige_zoem = Math.min(Math.max(nuwe_zoem, MIN_ZOEM), MAKS_ZOEM);
  wys_zoem_persentasie();
  wys_bladsy(huidige_bladsy);
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

  kry_boek(sessie, produk_slug).then((boek) => {
    if (boek && boek.titel) {
      document.getElementById("leser-titel").textContent = boek.titel;
      document.title = `${boek.titel} — Future Shop`;
    }
    wys_opgradering(boek);
  });

  try {
    // Vra EERS die leestoken (goedkoop, vinnig) — dit gee ons ook die
    // leen-status. Ons doen dit VOOR die aflyn-kas-kontrole hieronder,
    // sodat 'n reeds-VERVALDE leen nooit per ongeluk uit 'n plaaslike
    // (IndexedDB) kopie gelees kan word wat van 'n vroeëre, nog-aktiewe
    // besoek af oorgebly het nie.
    const token_resp = await fetch(
      `/.netlify/functions/kry-leser-token?produk_slug=${encodeURIComponent(produk_slug)}`,
      { method: "POST", headers: { Authorization: `Bearer ${sessie.access_token}` } }
    );

    if (token_resp.status === 401) {
      // Sien sessie-verval.js. Geen terug-pad word gegee nie, sodat die
      // helper die huidige adres MET sy ?boek=-parameter gebruik — die
      // koper moet ná aanmelding by dieselfde boek terugkom.
      const status_el = document.getElementById("leser-status");
      if (window.wys_sessie_verval) {
        window.wys_sessie_verval(status_el);
      } else {
        wys_status(window.t ? window.t("sessie_verval_kort") : "Sessie verval.");
      }
      return;
    }
    if (!token_resp.ok) {
      throw new Error(`Onverwagte status: ${token_resp.status}`);
    }

    const { token, leen } = await token_resp.json();

    if (leen && leen.is_leen) {
      wys_leen_kennisgewing(leen);
    }

    if (leen && leen.is_leen && !leen.aktief) {
      wys_status(
        window.t
          ? window.t("leen_verval_boodskap")
          : "Jou leen-tydperk vir hierdie e-boek het verval. Koop dit, of leen dit weer, om verder te lees."
      );
      return;
    }

    // Kyk NOU eers plaaslik (IndexedDB) — as die boek reeds afgelaai is,
    // laai dit direk daarvandaan, GEEN verdere netwerk-versoek of
    // data-gebruik nie. Veilig om hier te doen, aangesien ons hierbo
    // reeds bevestig het die leen (indien enige) nog aktief is.
    let pdf_grepe = await aflyn_kry_boek(produk_slug);
    let aflyn_status = "reeds_plaaslik";

    if (!pdf_grepe) {
      const pdf_url = `/.netlify/functions/kry-eboek-inhoud?produk_slug=${encodeURIComponent(
        produk_slug
      )}&token=${encodeURIComponent(token)}`;

      const pdf_resp = await fetch(pdf_url);
      if (!pdf_resp.ok) {
        if (pdf_resp.status === 403) {
          const fout_data = await pdf_resp.json().catch(() => null);
          if (fout_data && fout_data.leen_verval) {
            wys_status(
              window.t
                ? window.t("leen_verval_boodskap")
                : "Jou leen-tydperk vir hierdie e-boek het verval. Koop dit, of leen dit weer, om verder te lees."
            );
            return;
          }
        }
        throw new Error(`Onverwagte status: ${pdf_resp.status}`);
      }
      pdf_grepe = await pdf_resp.arrayBuffer();
      aflyn_status = "nuut_afgelaai";

      // Stoor plaaslik vir volgende keer — "beste-poging", loop nie die
      // huidige lees-sessie in gedrang as dit misluk nie.
      aflyn_stoor_boek(produk_slug, pdf_grepe);
    }

    pdf_dokument = await pdfjsLib.getDocument({ data: pdf_grepe }).promise;
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
    } else if (!navigator.onLine) {
      wys_status(
        window.t
          ? window.t("leser_vanlyn_nie_beskikbaar")
          : "Jy is vanlyn, en hierdie boek is nog nie plaaslik gestoor nie — koppel eers een keer aan die internet om dit oop te maak."
      );
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

  document.getElementById("leser-leen-etiket").addEventListener("click", wissel_leen_paneel);

  // Die soekveld is toegevou tot die leser dit nodig het, sodat die
  // bladsy die ruimte kry.
  document.getElementById("leser-soek-knoppie").addEventListener("click", () => {
    const vorm = document.getElementById("leser-soek-vorm");
    const knoppie = document.getElementById("leser-soek-knoppie");
    vorm.hidden = !vorm.hidden;
    knoppie.setAttribute("aria-expanded", String(!vorm.hidden));
    if (!vorm.hidden) document.getElementById("leser-soek-invoer").focus();
    if (pdf_dokument) wys_bladsy(huidige_bladsy);
  });

  document.getElementById("leser-zoom-in").addEventListener("click", () => stel_zoem(huidige_zoem + 0.2));
  document.getElementById("leser-zoom-uit").addEventListener("click", () => stel_zoem(huidige_zoem - 0.2));

  document.addEventListener("keydown", (ev) => {
    if (!pdf_dokument) return;
    if (ev.target && ev.target.matches && ev.target.matches("input, textarea")) return;
    if (ev.key === "ArrowRight") wys_bladsy(huidige_bladsy + 1);
    if (ev.key === "ArrowLeft") wys_bladsy(huidige_bladsy - 1);
  });

  let grootte_tydsaanwyser = null;
  window.addEventListener("resize", () => {
    clearTimeout(grootte_tydsaanwyser);
    grootte_tydsaanwyser = setTimeout(() => {
      if (pdf_dokument) wys_bladsy(huidige_bladsy);
    }, 120);
  });

  // Eksplisiete skerm-draai-luisteraar — bo-op die gewone "resize" hierbo.
  // Sommige foon-blaaiers (veral iOS Safari) vuur "resize" soms te vroeg
  // tydens die draai-oorgang, voor die skerm se nuwe afmetings finaal is
  // — 'n klein vertraging hier verseker ons herteken NADAT die draai
  // werklik voltooi is, sodat die bladsy altyd korrek geskaal bly.
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (pdf_dokument) wys_bladsy(huidige_bladsy);
    }, 200);
  });

  // --- Swipe-gebare (foon/tablet) — links blaai vorentoe, regs blaai terug.
  // Net op die bladsy-omhulsel self, sodat 'n normale vertikale
  // bladsy-rol (bv. as die skerm laer as die bladsy is) nie per ongeluk
  // as 'n blaai-gebaar gelees word nie.
  const MIN_SWIPE_AFSTAND = 50;
  const MAKS_VERTIKALE_AFWYKING = 60;
  let swipe_begin_x = null;
  let swipe_begin_y = null;

  // --- Knyp-om-te-zoem (twee vingers) — op dieselfde omhulsel as die
  // swipe-gebare. 'n Knyp begin sodra 'n TWEEDE vinger raak; ons kanselleer
  // dan enige lopende swipe-opsporing sodat die vinger wat afgelig word ná
  // die knyp nie per ongeluk as 'n eenvinger-swipe gelees word nie.
  let knyp_begin_afstand = null;
  let knyp_begin_zoem = 1;
  let knyp_render_hangende = false;

  function kry_knyp_afstand(ev) {
    const [a, b] = ev.touches;
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  const omhulsel = document.querySelector(".leser-bladsy-omhulsel");
  if (omhulsel) {
    omhulsel.addEventListener(
      "touchstart",
      (ev) => {
        if (!pdf_dokument) return;

        if (ev.touches.length === 2) {
          swipe_begin_x = null;
          swipe_begin_y = null;
          knyp_begin_afstand = kry_knyp_afstand(ev);
          knyp_begin_zoem = huidige_zoem;
          return;
        }

        if (ev.touches.length === 1 && !is_ingezoem()) {
          swipe_begin_x = ev.touches[0].clientX;
          swipe_begin_y = ev.touches[0].clientY;
        }
      },
      { passive: true }
    );

    omhulsel.addEventListener(
      "touchmove",
      (ev) => {
        if (!pdf_dokument || ev.touches.length !== 2 || knyp_begin_afstand === null) return;

        const huidige_afstand = kry_knyp_afstand(ev);
        const nuwe_zoem = knyp_begin_zoem * (huidige_afstand / knyp_begin_afstand);
        huidige_zoem = Math.min(Math.max(nuwe_zoem, MIN_ZOEM), MAKS_ZOEM);
        wys_zoem_persentasie();

        // Herteken die bladsy hoogstens een keer per animasie-raam — 'n
        // knyp-gebeurtenis skiet baie vinniger as wat PDF.js kan herteken.
        if (!knyp_render_hangende) {
          knyp_render_hangende = true;
          requestAnimationFrame(() => {
            wys_bladsy(huidige_bladsy);
            knyp_render_hangende = false;
          });
        }
      },
      { passive: true }
    );

    omhulsel.addEventListener(
      "touchend",
      (ev) => {
        if (ev.touches.length < 2) {
          knyp_begin_afstand = null;
        }

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
