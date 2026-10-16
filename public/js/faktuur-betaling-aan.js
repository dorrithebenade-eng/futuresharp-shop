// public/js/faktuur-betaling-aan.js
//
// Die knoppie en die oorlegsel waarmee 'n betaling aangeteken word wat NIE
// deur die betaalskakel gekom het nie.
//
// 'N EIE LÊER, nie 'n uitbreiding van faktuur-uitreik.js nie. Daardie lêer
// dra die uitreiking, die kansellasie en die QR, en hy werk. 'n Vierde
// handeling daarin sou beteken 'n fout hier kan die uitreiking breek.
//
// HY LEEN NIKS BY faktuur-uitreik.js NIE, ook nie fu_wys() nie — 'n hulpstuk
// wat oor twee lêers gedeel word, bind hulle aan mekaar en dan is die eie lêer
// niks werd nie. Wat hy WEL deel, is die oorlegsel se DOM (`fu-skerm` /
// `fu-paneel`) en die CSS-klasse, want twee oorlegsels op een bladsy sou
// beteken albei kan gelyk oop wees.
//
// DIE KNOPPIE VERSKYN SLEGS BY 'N UITGEREIKTE FAKTUUR. By 'n konsep is daar
// niks om teen te betaal nie; by 'n betaalde faktuur is dit klaar gedoen; by
// 'n gekanselleerde een word 'n nuwe faktuur uitgereik.
//
// HY STAAN IN DIE KOPBALK EN NIE IN DIE BACKOFFICE NIE. Onder 620px verdwyn
// die hele backoffice, en 'n bank-SMS kom op 'n foon. 'n Knoppie wat net by 'n
// rekenaar werk, sou beteken 'n mens moet huis toe ry om R10 000 af te merk.

const FB_VERWYSING_MIN = 2;
const FB_AANVAAR = ".pdf,application/pdf,image/*";

// NETLIFY SE FOUTBLAD IS GEEN BOODSKAP NIE. Gee 'n funksie nie betyds
// antwoord nie, stuur Netlify se proxy 'n rou HTML-blad ("Inactivity
// Timeout"), en dit het op 16 Okt 2026 so op die skerm beland. Ons eie
// foute is altyd gewone teks.
function fb_is_html(teks) {
  return /^\s*</.test(String(teks || ""));
}

function fb_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function fb_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fb_rand(sent) {
  return window.t_rand ? t_rand(sent, kry_huidige_taal()) : "R" + (sent / 100).toFixed(2);
}

// Wat 'n mens intik, is nie noodwendig wat 'n rekenaar 'n getal noem. "9 950,00"
// kom uit die bankstaat gekopieer, met 'n gewone spasie of 'n harde spasie, en
// 'n komma waar 'n punt hoort. Al drie moet werk.
function fb_sent_uit_teks(teks) {
  const skoon = String(teks || "")
    .replace(/[\s\u00A0]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(skoon)) return NaN;
  return Math.round(parseFloat(skoon) * 100);
}

// Vandag in die blaaier se eie tyd. new Date().toISOString() sou in SAST voor
// 02:00 gisteraand se datum gee.
function fb_vandag() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// DIE TOTAAL WORD GEREKEN, NIE GELEES NIE.
//
// V dra geen `totaal_sent` nie \u2014 faktuur-vorm.js bere die totaal nerens op die
// vormrekord nie; die dokument teken hom elke keer uit die reels. Lees 'n mens
// hom as 'n veld, kry hy nul, en dan begin die bedragveld op R0 terwyl die
// faktuur R10 000 se.
//
// DIT IS PRESIES DIESELFDE FORMULE as fu_totaal_sent() in faktuur-uitreik.js
// en as stoor-faktuur.js s'n: reelsom, minus die afslag maar nooit onder nul,
// plus die skenking. Die skenking tel by die totaal en bly buite die verdeling.
function fb_totaal_sent() {
  if (typeof V === "undefined" || !V) return 0;
  const reelsom = (V.reels || []).reduce(
    (s, r) => s + Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)),
    0
  );
  return Math.max(0, reelsom - (V.afslag_sent || 0)) + (V.skenking_sent || 0);
}

/* ═══ die oorlegsel ═══ */

function fb_wys(html) {
  const paneel = document.getElementById("fu-paneel");
  const skerm = document.getElementById("fu-skerm");
  if (!paneel || !skerm) return;
  paneel.innerHTML = html;
  skerm.hidden = false;
}

function fb_toe() {
  const skerm = document.getElementById("fu-skerm");
  if (skerm) skerm.hidden = true;
}

function fb_vra() {
  const totaal = fb_totaal_sent();
  const vandag = fb_vandag();

  fb_wys(`
    <h2>${fb_t("fb_kop", "Teken 'n betaling aan")}</h2>
    <p>${fb_t(
      "fb_teks",
      "Vir geld wat buite die betaalskakel om ontvang is. Die faktuur gaan na Betaal en kan daarna nie verander word nie."
    )}</p>
    <div class="fb-band">${fb_t(
      "fb_waarsku",
      "Die betaling is nie deur Paystack hanteer nie, dus het die outomatiese verdeling nie plaasgevind nie en sal handmatig hanteer moet word. Die ontvangers verskyn onder State, by die begunstigdes wat uit die hoofrekening betaal moet word."
    )}</div>

    <label class="fu-etiket" for="fb-bedrag">${fb_t("fb_bedrag", "Bedrag ontvang")}</label>
    <input class="fu-teksveld" id="fb-bedrag" inputmode="decimal" autocomplete="off"
           value="${fb_ontsnap((totaal / 100).toFixed(2).replace(".", ","))}">
    <p class="fb-verskil" id="fb-verskil" hidden></p>

    <label class="fu-etiket" for="fb-datum">${fb_t("fb_datum", "Datum ontvang")}</label>
    <input class="fu-teksveld" type="date" id="fb-datum" value="${vandag}" max="${vandag}">

    <!-- DIE FAKTUURNOMMER STAAN REEDS DAAR.
         Dit is die verwysing wat op die faktuur gevra word, dus is dit die
         een wat nege uit tien keer op die bankstaat verskyn \u2014 dan druk 'n
         mens net deur. Staan daar iets anders, word dit oorgetik. Die veld
         bly wat hy is: wat WERKLIK op die staat staan, nie wat gevra is nie.
         Ses maande later soek Ignatius op daardie teks, nie op die nommer. -->
    <label class="fu-etiket" for="fb-verwysing">${fb_t(
      "fb_verwysing",
      "Verwysing op die bankstaat"
    )}</label>
    <input class="fu-teksveld" id="fb-verwysing" maxlength="100" autocomplete="off"
           spellcheck="false" value="${fb_ontsnap(V && V.nommer ? V.nommer : "")}">

    <label class="fu-etiket" for="fb-nota">${fb_t("fb_nota", "Aantekening")}</label>
    <textarea class="fu-teksveld" id="fb-nota" rows="2" maxlength="300"></textarea>

    <!-- DIE BETALINGSBEWYS (16 Okt 2026). Opsioneel. Gewoonlik 'n PDF van die
         skool; 'n foto van die skerm gaan ook. Dit word ná die aantekening
         opgelaai (bewys.js) en kan later by die faktuur bygevoeg word. -->
    <label class="fu-etiket" for="fb-bewys">${fb_t("fb_bewys", "Betalingsbewys (opsioneel)")}</label>
    <input class="fb-leer" type="file" id="fb-bewys" accept="${FB_AANVAAR}">

    <p class="fu-keer-fout" id="fb-fout" hidden></p>

    <div class="fu-knoppe">
      <button type="button" class="kaart-aksie fu-stil" id="fb-terug">${fb_t(
        "fu_terug",
        "Terug"
      )}</button>
      <button type="button" class="kaart-aksie fu-doen" id="fb-doen">${fb_t(
        "fb_bevestig",
        "Teken die betaling aan"
      )}</button>
    </div>`);

  document.getElementById("fb-terug").addEventListener("click", fb_toe);
  document.getElementById("fb-doen").addEventListener("click", fb_doen);

  // DIE VERSKIL WORD GEWYS TERWYL 'N MENS TIK, nie eers by die knoppie nie.
  // 'n Tikfout van R9 500 in plaas van R9 950 sluit die faktuur af op die
  // verkeerde bedrag, en dit kan nie teruggedraai word nie.
  const bedrag = document.getElementById("fb-bedrag");
  bedrag.addEventListener("input", fb_wys_verskil);
  fb_wys_verskil();
  bedrag.focus();
  bedrag.select();
}

function fb_wys_verskil() {
  const el = document.getElementById("fb-verskil");
  const veld = document.getElementById("fb-bedrag");
  if (!el || !veld) return;

  const sent = fb_sent_uit_teks(veld.value);
  const verskil = sent - fb_totaal_sent();

  if (!Number.isFinite(sent) || sent <= 0 || verskil === 0) {
    el.hidden = true;
    return;
  }

  el.textContent =
    (verskil < 0
      ? fb_t("fb_te_min", "Dit is minder as die faktuur —")
      : fb_t("fb_te_veel", "Dit is meer as die faktuur —")) +
    " " +
    fb_rand(Math.abs(verskil)) +
    ". " +
    fb_t(
      "fb_verskil_lei",
      "Dit word aangeteken soos dit ontvang is. Die ontvangers kry steeds elkeen presies wat op die faktuur gevries is."
    );
  el.hidden = false;
}

async function fb_doen() {
  const b_veld = document.getElementById("fb-bedrag");
  const d_veld = document.getElementById("fb-datum");
  const v_veld = document.getElementById("fb-verwysing");
  const n_veld = document.getElementById("fb-nota");
  const fout_el = document.getElementById("fb-fout");
  const knop = document.getElementById("fb-doen");

  const wys_fout = (teks, veld) => {
    if (fout_el) {
      fout_el.textContent = teks;
      fout_el.hidden = false;
    }
    if (veld) veld.focus();
  };

  if (fout_el) fout_el.hidden = true;

  const ontvang_sent = fb_sent_uit_teks(b_veld.value);
  if (!Number.isFinite(ontvang_sent) || ontvang_sent <= 0) {
    return wys_fout(fb_t("fb_bedrag_kort", "Gee die bedrag wat ontvang is."), b_veld);
  }

  const ontvang_op = String(d_veld.value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ontvang_op)) {
    return wys_fout(
      fb_t("fb_datum_kort", "Gee die datum waarop die geld ontvang is."),
      d_veld
    );
  }

  const verwysing = String(v_veld.value || "").trim();
  if (verwysing.length < FB_VERWYSING_MIN) {
    return wys_fout(
      fb_t("fb_verwysing_kort", "Gee die verwysing soos dit op die bankstaat lees."),
      v_veld
    );
  }

  knop.disabled = true;
  knop.textContent = fb_t("fu_besig", "Besig …");

  try {
    const resp = await fetch("/.netlify/functions/teken-betaling-aan", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await identiteit_kop()) },
      body: JSON.stringify({
        sleutel: V.sleutel,
        ontvang_sent,
        ontvang_op,
        verwysing,
        nota: String((n_veld && n_veld.value) || "").trim(),
      }),
    });
    if (!resp.ok) {
      const teks = await resp.text().catch(() => "");
      if (fb_is_html(teks) || resp.status === 502 || resp.status === 504) {
        throw new Error(fb_t(
          "fb_tydsgrens",
          "Die bediener het nie betyds geantwoord nie. Die betaling is dalk wel aangeteken. Herlaai die bladsy en kyk of die faktuur op Betaal staan voor jy weer probeer."
        ));
      }
      throw new Error(teks);
    }

    // DIE BETALING STAAN. Wat volg, mag haar nie ongedaan maak nie: 'n bewys
    // wat nie oplaai nie, word gemeld en die skerm gaan voort.
    const leers = document.getElementById("fb-bewys");
    if (leers && leers.files && leers.files.length && window.bw_laai_op) {
      knop.textContent = fb_t("bw_besig", "Word opgelaai \u2026");
      try {
        await window.bw_laai_op({ faktuur: V.sleutel }, leers.files);
      } catch (fout) {
        window.alert(
          fb_t("fb_bewys_nie", "Die betaling is aangeteken, maar die bewys nie: {f}. Laai dit weer op by Betalingsbewys.")
            .replace("{f}", String(fout.message || fout))
        );
      }
    }

    // DIE EPOSSE in die agtergrond (stuur-betaalposte-background.js). Netlify
    // antwoord dadelik met 202; die skerm wag nie op die pos nie.
    try {
      await fetch("/.netlify/functions/stuur-betaalposte-background", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await identiteit_kop()) },
        body: JSON.stringify({ sleutel: V.sleutel }),
      });
    } catch (fout) {
      console.error("Kon nie die betaalposte begin nie:", fout);
    }

    // Herlaai, sodat die hele skerm as betaal teken sonder dat hierdie lêer
    // weet hoe faktuur-vorm.js sy dokument bou. Dieselfde keuse as die
    // kansellasie.
    window.location.reload();
  } catch (fout) {
    console.error("Kon nie die betaling aanteken nie:", fout);
    knop.disabled = false;
    knop.textContent = fb_t("fb_bevestig", "Teken die betaling aan");
    wys_fout(
      String(fout.message || "").trim() ||
        fb_t("fb_fout", "Kon nie die betaling aanteken nie."),
      null
    );
  }
}

/* ═══ die betalingsbewys by 'n betaalde faktuur (16 Okt 2026) ═══

   DIESELFDE OORLEGSEL, 'n ander inhoud: die betaling soos aangeteken, die
   bewyse om af te laai of te verwyder, en 'n veld om nog een by te voeg. Die
   leers leef in die bewysstukke-store (_bewysstukke.js), net vir die
   boekhouding-rol. */

let FB_DOKS = [];

function fb_datum(iso) {
  return String(iso || "").slice(0, 10).replace(/-/g, "/");
}

function fb_bewys_wys(boodskap) {
  const b = (V && V.betaling) || {};
  const ry = [
    b.ontvang_sent ? fb_rand(b.ontvang_sent) : "",
    b.ontvang_op ? fb_datum(b.ontvang_op) : "",
    b.verwysing || "",
  ].filter(Boolean).join(" \u00B7 ");

  const lys = FB_DOKS.length
    ? `<ul class="fb-doks">${FB_DOKS.map((d) => `<li>
        <button type="button" class="fb-dok-naam" data-fb-af="${fb_ontsnap(d.sleutel)}" data-fb-naam="${fb_ontsnap(d.naam)}">${fb_ontsnap(d.naam)}</button>
        <button type="button" class="fb-dok-weg" data-fb-weg="${fb_ontsnap(d.sleutel)}" aria-label="${fb_ontsnap(fb_t("bw_verwyder", "Verwyder"))}">&#215;</button>
      </li>`).join("")}</ul>`
    : `<p class="fb-leeg">${fb_t("fb_bewys_geen", "Nog geen bewys gelaai nie.")}</p>`;

  fb_wys(`
    <h2>${fb_t("fb_bewys_kop", "Betalingsbewys")}</h2>
    ${ry ? `<p>${fb_ontsnap(ry)}</p>` : ""}
    ${lys}
    <label class="fu-etiket" for="fb-bewys-by">${fb_t("fb_bewys_by", "Voeg 'n bewys by")}</label>
    <input class="fb-leer" type="file" id="fb-bewys-by" accept="${FB_AANVAAR}">
    <p class="fu-keer-fout" id="fb-fout" ${boodskap ? "" : "hidden"}>${fb_ontsnap(boodskap || "")}</p>
    <div class="fu-knoppe">
      <button type="button" class="kaart-aksie fu-stil" id="fb-terug">${fb_t("fu_terug", "Terug")}</button>
    </div>`);

  document.getElementById("fb-terug").addEventListener("click", fb_toe);

  document.getElementById("fb-bewys-by").addEventListener("change", async (e) => {
    const veld = e.target;
    if (!veld.files || !veld.files.length) return;
    veld.disabled = true;
    try {
      const uit = await window.bw_laai_op({ faktuur: V.sleutel }, veld.files);
      if (uit && uit.faktuur) FB_DOKS = uit.faktuur.dokumente || [];
      fb_bewys_wys();
    } catch (fout) {
      fb_bewys_wys(String(fout.message || fout));
    }
  });

  document.querySelectorAll("[data-fb-af]").forEach((k) => {
    k.addEventListener("click", () =>
      window.bw_laai_af(k.getAttribute("data-fb-af"), k.getAttribute("data-fb-naam"))
        .catch((fout) => fb_bewys_wys(String(fout.message || fout))));
  });

  document.querySelectorAll("[data-fb-weg]").forEach((k) => {
    k.addEventListener("click", async () => {
      if (!window.confirm(fb_t("bw_skrap_vra", "Vee hierdie bewys uit?"))) return;
      try {
        const uit = await window.bw_skrap({ faktuur: V.sleutel }, k.getAttribute("data-fb-weg"));
        if (uit && uit.faktuur) FB_DOKS = uit.faktuur.dokumente || [];
        fb_bewys_wys();
      } catch (fout) {
        fb_bewys_wys(String(fout.message || fout));
      }
    });
  });
}

function fb_bewys_knop_teks() {
  const knop = document.getElementById("fv-bewys");
  if (!knop) return;
  const n = FB_DOKS.length;
  knop.textContent = fb_t("fb_bewys_kop", "Betalingsbewys") + (n ? ` (${n})` : "");
}

/* ═══ begin ═══ */

(async function fb_begin() {
  // Dieselfde wagpatroon as faktuur-uitreik.js. faktuur-vorm.js se
  // DOMContentLoaded loop eerste en stel SESSIE en V.
  for (let i = 0; i < 60 && !SESSIE; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!SESSIE) return;

  // WAG OP DIE SEIN, NIE OP 'N KLOK NIE. laai_faktuur() is 'n netwerkoproep,
  // en 'n vaste wag lees op 'n stadige verbinding 'n uitgereikte faktuur as 'n
  // konsep — dan verskyn die knoppie nooit op die een faktuur waar hy hoort.
  for (let i = 0; i < 60 && !FV_GELAAI; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const knop = document.getElementById("fv-betaling");
  if (!knop) return;

  if (V && V.stand === "gestuur") {
    knop.style.display = "";
    knop.addEventListener("click", fb_vra);
  } else {
    knop.style.display = "none";
  }

  // DIE BEWYSKNOPPIE: net by 'n betaalde faktuur, en net as bewys.js gelaai is.
  const bewys_knop = document.getElementById("fv-bewys");
  if (bewys_knop && V && V.stand === "betaal" && V.betaling && window.bw_laai_op) {
    FB_DOKS = Array.isArray(V.betaling.dokumente) ? V.betaling.dokumente : [];
    bewys_knop.style.display = "";
    bewys_knop.addEventListener("click", () => fb_bewys_wys());
    // Die oorlegsel verander FB_DOKS; die telling op die knoppie volg wanneer
    // hy toemaak.
    const skerm = document.getElementById("fu-skerm");
    if (skerm) new MutationObserver(fb_bewys_knop_teks).observe(skerm, { attributes: true, attributeFilter: ["hidden"] });
    fb_bewys_knop_teks();
  } else if (bewys_knop) {
    bewys_knop.style.display = "none";
  }

  // Escape sluit die oorlegsel. faktuur-uitreik.js haak dieselfde luisteraar
  // op `fu-skerm` en roep sy eie fu_toe(); albei versteek dieselfde element,
  // dus doen die tweede oproep eenvoudig niks.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fb_toe();
  });
})();
