// public/js/faktuurpaneel-teenwoordigheid.js
//
// Wie is nou ook hier? Een reël onder die titel, of niks.
//
// WAAROM 'N EIE LEER
//
// faktuurpaneel.js weet niks hiervan nie en hoef nie. Dieselfde patroon as
// faktuurpaneel-verfris.js: die skrip hang homself aan die bestaande skerm
// sonder om iets bestaande te wysig.
//
// DIE KOSTE, EN WAAROM DIT KLEIN IS
//
// Een oproep elke halfminuut, en slegs terwyl die oortjie SIGBAAR is. Netlify
// roep niks uit sy eie nie -- die pols leef in die blaaier, dus is daar geen
// oproepe wanneer die bladsy toe is nie, en `visibilitychange` stop hom ook
// wanneer die oortjie bloot versteek is. 'n Vergete venster oor 'n naweek
// pols nie.
//
// Twee mense, twee uur per dag elk, is sowat 16 000 oproepe per maand teen 'n
// perk van 125 000.
//
// 'N VROEeR WEERGAWE HET ELKE TWEE MINUTE GEPOLS. Dit is verander omdat die
// argument daarvoor nie gehou het nie: dit het geoptimaliseer vir 'n koste
// wat nie bestaan nie, en daarvoor betaal met 'n vertraging wat 'n mens wel
// merk. Twee direkteure gaan nie tot 'n vlak groei waar die verskil tel nie.
//
// EEN OPROEP DOEN ALBEI DINGE -- dit skryf jou eie merk EN lees die ander
// s'n terug. Sien teenwoordigheid.js.
//
// WAT DIT NIE IS NIE
//
// Geen slot, geen "Ignatius het hierdie faktuur oop". Dit is 'n bewustheid,
// nie 'n beskerming nie.

const TW_MS = 30 * 1000;

let TW_TIK = null;
// Onthou wat laas gewys is. Sonder dit herteken die reël elke twee minute
// dieselfde teks, en 'n leser se oog word getrek na iets wat nie verander het
// nie.
let TW_LAAS = "";

function tw_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function tw_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Die reël leef tussen die titel en die pille. Sy word geskep wanneer daar
// iets is om te sê en verwyder wanneer daar niks is nie -- 'n leë element sou
// 'n gaping los waar niks is.
function tw_plek(skep) {
  let el = document.getElementById("fp-teenwoordig");
  if (el) return el;
  if (!skep) return null;

  const kieslys = document.getElementById("fp-kieslys");
  if (!kieslys || !kieslys.parentNode) return null;

  el = document.createElement("p");
  el.id = "fp-teenwoordig";
  el.className = "fp-teenwoordig";
  // aria-live: 'n leser wat nie kyk nie, hoor dat iemand aangekom het.
  el.setAttribute("aria-live", "polite");
  kieslys.parentNode.insertBefore(el, kieslys);
  return el;
}

function tw_teken(ander) {
  const lys = Array.isArray(ander) ? ander : [];

  if (!lys.length) {
    const bestaande = document.getElementById("fp-teenwoordig");
    if (bestaande) bestaande.remove();
    TW_LAAS = "";
    return;
  }

  // "Ignatius is aanlyn" by een; "Ignatius en Eugene is aanlyn" by twee. Met
  // meer as twee word dit 'n telling -- vier name in 'n reël lees soos 'n
  // lys en nie soos 'n mededeling nie. In die praktyk is dit nooit meer as
  // twee, maar die reel moet nie breek as dit ooit gebeur.
  let teks;
  if (lys.length === 1) {
    teks = tw_t("tw_een", "{naam} is aanlyn").replace("{naam}", lys[0].naam);
  } else if (lys.length === 2) {
    teks = tw_t("tw_twee", "{a} en {b} is aanlyn")
      .replace("{a}", lys[0].naam)
      .replace("{b}", lys[1].naam);
  } else {
    teks = tw_t("tw_baie", "{n} ander is aanlyn").replace("{n}", lys.length);
  }

  if (teks === TW_LAAS) return;
  TW_LAAS = teks;

  const el = tw_plek(true);
  if (!el) return;
  el.innerHTML = `<span class="fp-teenwoordig-stip"></span>${tw_ontsnap(teks)}`;
}

async function tw_pols() {
  try {
    const sessie =
      typeof identiteit_kry_huidige_sessie === "function"
        ? await identiteit_kry_huidige_sessie()
        : null;
    if (!sessie || !sessie.access_token) return;

    const resp = await fetch("/.netlify/functions/teenwoordigheid", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return;

    const data = await resp.json();
    tw_teken(data && data.ander);
  } catch (fout) {
    // STIL. Dit is die minste belangrike ding op die skerm; 'n mislukte pols
    // mag nie 'n foutboodskap oor iemand se werk gooi nie. Die vorige reel
    // bly staan tot die volgende pols slaag.
    console.error("Kon nie teenwoordigheid pols nie:", fout);
  }
}

/* ═══ die klok ═══ */

function tw_stop() {
  if (TW_TIK) clearInterval(TW_TIK);
  TW_TIK = null;
}

function tw_begin() {
  tw_stop();
  TW_TIK = setInterval(tw_pols, TW_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("fp-kieslys")) return;

  // 'N VERSTEEKTE OORTJIE POLS NIE. Dieselfde reël as
  // faktuurpaneel-verfris.js. Kom die oortjie terug, pols ons dadelik: dit is
  // presies die oomblik waarop 'n mens wil weet wie daar is.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      tw_stop();
    } else {
      tw_pols();
      tw_begin();
    }
  });

  if (!document.hidden) {
    // DIE EERSTE POLS WAG. faktuurpaneel.js moet eers die sessie verifieer en
    // die paneel wys; pols ons dadelik, kry ons 'n 403 by iemand wat wel
    // toegang het, bloot omdat die token nog nie gereed is nie.
    setTimeout(tw_pols, 3000);
    tw_begin();
  }
});
