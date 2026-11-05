// leser-inhoud.js — Inhoud en My boekmerke in die leser (November 2026).
//
// Twee knoppies in die kopbalk, langs die zoem-groep:
//   - Boekmerk: merk die huidige bladsy, of haal die merk weg.
//   - Inhoud: 'n lys met Hoofstukke (die PDF se ingeboude hoofstuklys, met
//     die inhoudsopgawe bo-aan) en My boekmerke. Het die boek geen
//     hoofstuklys en geen boekmerke nie, maar wel 'n gevonde
//     inhoudsopgawe, spring die knoppie direk daarheen. Word niks gevind
//     nie, bly die knoppie weg tot die eerste boekmerk.
//
// Die inhoudsopgawe word gesoek in die eerste 15 bladsye: 'n teksreël wat
// net "Inhoudsopgawe", "Inhoud", "Contents" of "Table of contents" is.
//
// Laai NA leser.js en gebruik sy globale veranderlikes (pdf_dokument,
// huidige_bladsy, totale_bladsye, huidige_weergawe, sessie_globaal,
// produk_slug_globaal) en funksies (wys_bladsy, bepaal_beginbladsy).
// leser.js stuur by elke bladsywissel die gebeurtenis "leser-bladsy".
// Geld vir leser.html (kopers) en paneel-leser.html (admin).

(function () {
  const TOC_PATROON = /^(inhoudsopgawe|inhoud|contents|table of contents)\s*:?$/i;
  const TOC_SOEK_BLADSYE = 15;

  const ink = {
    begin: false,
    hoofstukke: [], // { titel, bladsy, vlak }
    toc_bladsy: null,
    merke: [],
    oop: false,
    besig: false,
  };

  const v = (sleutel, terugval) => (window.t ? window.t(sleutel) : terugval);
  const bl = () => v("mb_bladsy_kort", "bl.");

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const IKOON_MERK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>';
  const IKOON_LYS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>';
  const IKOON_POTLOOD = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
  const IKOON_BEVESTIG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const IKOON_X = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---------------------------------------------------------------- bou

  function bou_knoppies() {
    const kop = document.querySelector(".leser-kopbalk");
    const voor = document.querySelector(".leser-zoom-groep");
    if (!kop || !voor) return;

    const merk = document.createElement("button");
    merk.type = "button";
    merk.id = "leser-merk-knoppie";
    merk.className = "leser-nutsknoppie leser-merk-knoppie";
    merk.innerHTML = `${IKOON_MERK}<span class="leser-knoppie-woord leser-merk-woord">${esc(v("leser_merk", "Merk"))}</span>`;
    merk.hidden = true;
    merk.addEventListener("click", wissel_merk);

    const inhoud = document.createElement("button");
    inhoud.type = "button";
    inhoud.id = "leser-inhoud-knoppie";
    inhoud.className = "leser-nutsknoppie leser-inhoud-knoppie";
    inhoud.setAttribute("aria-expanded", "false");
    inhoud.setAttribute("aria-controls", "leser-inhoud-paneel");
    inhoud.innerHTML = `${IKOON_LYS}<span class="leser-knoppie-woord">${esc(v("leser_inhoud", "Inhoud"))}</span>`;
    inhoud.hidden = true;
    inhoud.addEventListener("click", klik_inhoud);

    kop.insertBefore(merk, voor);
    kop.insertBefore(inhoud, voor);

    const paneel = document.createElement("div");
    paneel.id = "leser-inhoud-paneel";
    paneel.className = "leser-inhoud-paneel";
    paneel.hidden = true;
    document.querySelector(".leser-skerm").appendChild(paneel);

    const kennis = document.createElement("div");
    kennis.id = "leser-inhoud-kennis";
    kennis.className = "leser-inhoud-kennis";
    kennis.setAttribute("role", "status");
    kennis.hidden = true;
    document.body.appendChild(kennis);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ink.oop) maak_toe();
    });
    document.addEventListener("click", (e) => {
      if (!ink.oop) return;
      // 'n Knoppie in die paneel wat die lys herteken, is teen hierdie tyd
      // reeds uit die bladsy weg; dit was steeds 'n klik binne die paneel.
      if (!document.contains(e.target)) return;
      if (e.target.closest("#leser-inhoud-paneel, #leser-inhoud-knoppie, #leser-merk-knoppie, .leser-uitlig-strook")) return;
      maak_toe();
    });
  }

  function wys_kennis(teks) {
    const el = document.getElementById("leser-inhoud-kennis");
    if (!el) return;
    el.textContent = teks;
    el.hidden = false;
    clearTimeout(wys_kennis.t);
    wys_kennis.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  // ------------------------------------------------------- hoofstukke en toc

  async function bladsy_vir_bestemming(bestemming) {
    try {
      let d = bestemming;
      if (typeof d === "string") d = await pdf_dokument.getDestination(d);
      if (!Array.isArray(d) || d[0] == null) return null;
      const ref = d[0];
      if (typeof ref === "object") return (await pdf_dokument.getPageIndex(ref)) + 1;
      if (Number.isInteger(ref)) return ref + 1;
    } catch { /* onbekende bestemming */ }
    return null;
  }

  async function laai_hoofstukke() {
    let buitelyn = null;
    try {
      buitelyn = await pdf_dokument.getOutline();
    } catch {
      return;
    }
    if (!Array.isArray(buitelyn)) return;
    const lys = [];
    for (const item of buitelyn) {
      const bladsy = await bladsy_vir_bestemming(item.dest);
      if (bladsy) lys.push({ titel: String(item.title || "").trim(), bladsy, vlak: 0 });
      for (const sub of item.items || []) {
        const b2 = await bladsy_vir_bestemming(sub.dest);
        if (b2) lys.push({ titel: String(sub.title || "").trim(), bladsy: b2, vlak: 1 });
      }
    }
    ink.hoofstukke = lys.filter((h) => h.titel);
  }

  async function soek_inhoudsopgawe() {
    // Is die inhoudsopgawe self 'n hoofstuk in die lys, gebruik dit.
    const in_lys = ink.hoofstukke.find((h) => TOC_PATROON.test(h.titel));
    if (in_lys) {
      ink.toc_bladsy = in_lys.bladsy;
      return;
    }
    const tot = Math.min(TOC_SOEK_BLADSYE, totale_bladsye || 0);
    for (let n = 1; n <= tot; n++) {
      try {
        const bladsy = await pdf_dokument.getPage(n);
        const inhoud = await bladsy.getTextContent();
        const stukke = inhoud.items.map((i) => String(i.str || "").trim()).filter(Boolean);
        for (let i = 0; i < stukke.length; i++) {
          if (TOC_PATROON.test(stukke[i]) || (stukke[i + 1] && TOC_PATROON.test(`${stukke[i]} ${stukke[i + 1]}`))) {
            ink.toc_bladsy = n;
            return;
          }
        }
      } catch { /* bladsy sonder teks */ }
    }
  }

  // ---------------------------------------------------------------- merke

  function kop() {
    return { Authorization: `Bearer ${sessie_globaal.access_token}` };
  }

  // Die bladsy waarop 'n boekmerk NOU val. Is die PDF intussen opgedateer,
  // skuif dit op dieselfde relatiewe plek, net soos die leesplek.
  function bladsy_van(m) {
    if (typeof bepaal_beginbladsy !== "function") return m.bladsy;
    return bepaal_beginbladsy(
      { bladsy: m.bladsy, weergawe: m.weergawe, totaal_bladsye: m.totaal_bladsye },
      huidige_weergawe,
      totale_bladsye
    ).bladsy;
  }

  function merk_op_huidige() {
    return ink.merke.find((m) => bladsy_van(m) === huidige_bladsy) || null;
  }

  async function laai_merke() {
    try {
      const resp = await fetch(
        `/.netlify/functions/kry-boekmerke?produk_slug=${encodeURIComponent(produk_slug_globaal)}`,
        { headers: kop() }
      );
      if (!resp.ok) return;
      ink.merke = (await resp.json()).merke || [];
    } catch { /* leser werk steeds sonder boekmerke */ }
  }

  async function stuur(liggaam) {
    const resp = await fetch("/.netlify/functions/stoor-boekmerk", {
      method: "POST",
      headers: { ...kop(), "Content-Type": "application/json" },
      body: JSON.stringify({ produk_slug: produk_slug_globaal, ...liggaam }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    return (await resp.json()).merke || [];
  }

  async function wissel_merk() {
    if (ink.besig) return;
    ink.besig = true;
    const voorheen = ink.merke.slice();
    const bestaande = merk_op_huidige();
    try {
      if (bestaande) {
        ink.merke = ink.merke.filter((m) => m.id !== bestaande.id);
        werk_by();
        ink.merke = await stuur({ aksie: "verwyder", id: bestaande.id });
      } else {
        ink.merke = ink.merke.concat([{ id: "_nuut", bladsy: huidige_bladsy, weergawe: huidige_weergawe, totaal_bladsye: totale_bladsye, nota: "" }]);
        werk_by();
        ink.merke = await stuur({ aksie: "voeg_by", bladsy: huidige_bladsy, weergawe: huidige_weergawe, totaal_bladsye: totale_bladsye });
      }
    } catch (fout) {
      console.error("Boekmerk:", fout);
      ink.merke = voorheen;
      wys_kennis(v("leser_boekmerk_fout", "Kon nie die boekmerk stoor nie. Probeer weer."));
    } finally {
      ink.besig = false;
      werk_by();
    }
  }

  async function verwyder(id) {
    const voorheen = ink.merke.slice();
    ink.merke = ink.merke.filter((m) => m.id !== id);
    werk_by();
    try {
      ink.merke = await stuur({ aksie: "verwyder", id });
    } catch {
      ink.merke = voorheen;
      wys_kennis(v("leser_boekmerk_fout", "Kon nie die boekmerk stoor nie. Probeer weer."));
    }
    werk_by();
  }

  async function stel_nota(id, nota) {
    const voorheen = ink.merke.slice();
    ink.merke = ink.merke.map((m) => (m.id === id ? { ...m, nota } : m));
    werk_by();
    try {
      ink.merke = await stuur({ aksie: "nota", id, nota });
    } catch {
      ink.merke = voorheen;
      wys_kennis(v("leser_boekmerk_fout", "Kon nie die boekmerk stoor nie. Probeer weer."));
    }
    werk_by();
  }

  // ---------------------------------------------------------------- paneel

  function net_toc() {
    return !ink.hoofstukke.length && !ink.merke.length && !uitligte().length && ink.toc_bladsy;
  }

  function klik_inhoud() {
    if (net_toc()) {
      wys_bladsy(ink.toc_bladsy);
      return;
    }
    if (ink.oop) maak_toe();
    else maak_oop();
  }

  function maak_oop() {
    const paneel = document.getElementById("leser-inhoud-paneel");
    const kopbalk = document.querySelector(".leser-kopbalk");
    paneel.style.top = `${kopbalk.offsetTop + kopbalk.offsetHeight}px`;
    ink.oop = true;
    paneel.hidden = false;
    document.getElementById("leser-inhoud-knoppie").setAttribute("aria-expanded", "true");
    teken_paneel();
    const gekies = paneel.querySelector(".leser-inhoud-ry-huidig");
    if (gekies) gekies.scrollIntoView({ block: "nearest" });
  }

  function maak_toe() {
    ink.oop = false;
    const paneel = document.getElementById("leser-inhoud-paneel");
    if (paneel) paneel.hidden = true;
    const knop = document.getElementById("leser-inhoud-knoppie");
    if (knop) knop.setAttribute("aria-expanded", "false");
  }

  function spring(bladsy) {
    maak_toe();
    wys_bladsy(bladsy);
  }

  function teken_paneel() {
    const paneel = document.getElementById("leser-inhoud-paneel");
    if (!paneel || !ink.oop) return;

    // Die hoofstuk waarin die leser nou is: die laaste een wat op of voor
    // die huidige bladsy begin.
    let huidig = -1;
    ink.hoofstukke.forEach((h, i) => { if (h.bladsy <= huidige_bladsy) huidig = i; });

    let html = "";
    if (ink.hoofstukke.length || ink.toc_bladsy) {
      if (ink.hoofstukke.length) html += `<p class="leser-inhoud-kop">${esc(v("leser_hoofstukke", "Hoofstukke"))}</p>`;
      if (ink.toc_bladsy) {
        html += `<button type="button" class="leser-inhoud-ry leser-inhoud-ry-toc" data-bladsy="${ink.toc_bladsy}">
          <span>${esc(v("leser_inhoudsopgawe", "Inhoudsopgawe"))}</span><span class="leser-inhoud-bl">${bl()} ${ink.toc_bladsy}</span></button>`;
      }
      ink.hoofstukke.forEach((h, i) => {
        if (ink.toc_bladsy && h.bladsy === ink.toc_bladsy && TOC_PATROON.test(h.titel)) return;
        const klas = `leser-inhoud-ry${h.vlak ? " leser-inhoud-ry-sub" : ""}${i === huidig ? " leser-inhoud-ry-huidig" : ""}`;
        html += `<button type="button" class="${klas}" data-bladsy="${h.bladsy}">
          <span>${esc(h.titel)}</span><span class="leser-inhoud-bl">${bl()} ${h.bladsy}</span></button>`;
      });
    }

    html += `<p class="leser-inhoud-kop${html ? " leser-inhoud-kop-skei" : ""}">${esc(v("leser_my_boekmerke", "My boekmerke"))}</p>`;
    if (!ink.merke.length) {
      html += `<p class="leser-inhoud-leeg">${esc(v("leser_geen_boekmerke", "Tik die boekmerk-ikoon om 'n bladsy te merk."))}</p>`;
    } else {
      const gesorteer = ink.merke.slice().sort((a, b) => bladsy_van(a) - bladsy_van(b));
      for (const m of gesorteer) {
        const b = bladsy_van(m);
        const nota = m.nota
          ? `<span class="leser-inhoud-nota">${esc(m.nota)}</span>`
          : `<span class="leser-inhoud-nota leser-inhoud-nota-leeg">${esc(v("leser_voeg_nota_by", "+ Voeg 'n nota by"))}</span>`;
        html += `<div class="leser-inhoud-merk${b === huidige_bladsy ? " leser-inhoud-ry-huidig" : ""}" data-id="${esc(m.id)}" data-soort="merk">
          <button type="button" class="leser-inhoud-merk-spring" data-bladsy="${b}">
            <span class="leser-inhoud-merk-ikoon">${IKOON_MERK}</span>
            <span class="leser-inhoud-merk-teks"><span>${bl()} ${b}</span>${nota}</span>
          </button>
          <button type="button" class="leser-inhoud-klein" data-nota="${esc(m.id)}" data-soort="merk" aria-label="${esc(v("leser_wysig_nota", "Wysig nota"))}" title="${esc(v("leser_wysig_nota", "Wysig nota"))}">${IKOON_POTLOOD}</button>
          <button type="button" class="leser-inhoud-klein" data-weg="${esc(m.id)}" data-soort="merk" aria-label="${esc(v("leser_verwyder_boekmerk", "Verwyder boekmerk"))}" title="${esc(v("leser_verwyder_boekmerk", "Verwyder boekmerk"))}">${IKOON_X}</button>
        </div>`;
      }
    }
    html += teken_uitligte_afdeling();
    paneel.innerHTML = html;

    paneel.querySelectorAll("[data-bladsy]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".leser-inhoud-nota-leeg")) {
          const ry = el.closest("[data-id]");
          if (ry) { e.stopPropagation(); wysig_nota(ry.getAttribute("data-soort"), ry.getAttribute("data-id")); return; }
        }
        spring(Number(el.getAttribute("data-bladsy")));
      });
    });
    paneel.querySelectorAll("[data-nota]").forEach((el) => el.addEventListener("click", () => wysig_nota(el.getAttribute("data-soort"), el.getAttribute("data-nota"))));
    paneel.querySelectorAll("[data-weg]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-weg");
      if (el.getAttribute("data-soort") === "uitlig") window.LeserUitlig.verwyder(id);
      else verwyder(id);
    }));
  }

  // MY UITLIGTE (leser-uitlig.js hou die data). Elke reël: die kleur as 'n
  // strepie, die gekose teks, die nota en die bladsy. Is die boek intussen
  // opgedateer, staan dit steeds in die lys, met 'n merker.
  function uitligte() {
    return (window.LeserUitlig && window.LeserUitlig.lys()) || [];
  }

  function teken_uitligte_afdeling() {
    if (!window.LeserUitlig) return "";
    const lys = uitligte();
    let html = `<p class="leser-inhoud-kop leser-inhoud-kop-skei">${esc(v("leser_my_uitligte", "My uitligte"))}</p>`;
    if (!lys.length) {
      return html + `<p class="leser-inhoud-leeg">${esc(v("leser_geen_uitligte", "Kies teks op die bladsy om dit uit te lig."))}</p>`;
    }
    for (const u of lys) {
      const b = window.LeserUitlig.bladsy_van(u);
      const teks = u.teks.length > 140 ? `${u.teks.slice(0, 137)}…` : u.teks;
      const nota = u.nota
        ? `<span class="leser-inhoud-nota">${esc(u.nota)}</span>`
        : `<span class="leser-inhoud-nota leser-inhoud-nota-leeg">${esc(v("leser_voeg_nota_by", "+ Voeg 'n nota by"))}</span>`;
      const ou = window.LeserUitlig.is_verouderd(u)
        ? ` · <span class="leser-inhoud-ou">${esc(v("leser_uitlig_ou", "boek bygewerk"))}</span>` : "";
      html += `<div class="leser-inhoud-merk leser-inhoud-uitlig${b === huidige_bladsy ? " leser-inhoud-ry-huidig" : ""}" data-id="${esc(u.id)}" data-soort="uitlig">
        <button type="button" class="leser-inhoud-merk-spring" data-bladsy="${b}">
          <span class="leser-inhoud-strepie" style="background:${window.LeserUitlig.kleur(u.kleur)}"></span>
          <span class="leser-inhoud-merk-teks"><span class="leser-inhoud-aanhaling">“${esc(teks)}”</span>${nota}<span class="leser-inhoud-bl">${bl()} ${b}${ou}</span></span>
        </button>
        <button type="button" class="leser-inhoud-klein" data-nota="${esc(u.id)}" data-soort="uitlig" aria-label="${esc(v("leser_wysig_nota", "Wysig nota"))}" title="${esc(v("leser_wysig_nota", "Wysig nota"))}">${IKOON_POTLOOD}</button>
        <button type="button" class="leser-inhoud-klein" data-weg="${esc(u.id)}" data-soort="uitlig" aria-label="${esc(v("leser_verwyder_uitlig", "Verwyder uitlig"))}" title="${esc(v("leser_verwyder_uitlig", "Verwyder uitlig"))}">${IKOON_X}</button>
      </div>`;
    }
    return html;
  }

  // DIE NOTAVELD STAAN NIE IN DIE SPRING-KNOPPIE NIE. 'n <input> binne 'n
  // <button> stuur sy klikke na die knoppie, en dan spring die leser na die
  // bladsy sodra 'n mens in die veld klik om te tik. Terwyl die nota
  // geskryf word, vervang 'n gewone redigeerreël die hele boekmerkreël.
  function wysig_nota(soort, id) {
    const is_uitlig = soort === "uitlig";
    const m = is_uitlig ? uitligte().find((x) => x.id === id) : ink.merke.find((x) => x.id === id);
    const ry = document.querySelector(`.leser-inhoud-merk[data-soort="${is_uitlig ? "uitlig" : "merk"}"][data-id="${CSS.escape(id)}"]`);
    if (!m || !ry || id === "_nuut") return;

    const b = is_uitlig ? window.LeserUitlig.bladsy_van(m) : bladsy_van(m);
    const voor = is_uitlig
      ? `<span class="leser-inhoud-strepie" style="background:${window.LeserUitlig.kleur(m.kleur)}"></span>`
      : `<span class="leser-inhoud-merk-ikoon">${IKOON_MERK}</span>`;
    const kop_teks = is_uitlig
      ? `<span class="leser-inhoud-aanhaling">“${esc(m.teks.length > 80 ? `${m.teks.slice(0, 77)}…` : m.teks)}”</span>`
      : `<span>${bl()} ${b}</span>`;
    ry.classList.add("leser-inhoud-merk-wysig");
    ry.innerHTML = `
      ${voor}
      <span class="leser-inhoud-merk-teks">${kop_teks}</span>
      <button type="button" class="leser-inhoud-klein leser-inhoud-bevestig" aria-label="${esc(v("leser_stoor_nota", "Stoor nota"))}" title="${esc(v("leser_stoor_nota", "Stoor nota"))}">${IKOON_BEVESTIG}</button>`;
    const invoer = document.createElement("input");
    invoer.type = "text";
    invoer.maxLength = 80;
    invoer.className = "leser-inhoud-nota-invoer";
    invoer.value = m.nota || "";
    invoer.placeholder = v("leser_voeg_nota_by", "+ Voeg 'n nota by").replace(/^\+\s*/, "");
    ry.querySelector(".leser-inhoud-merk-teks").appendChild(invoer);

    let klaar = false;
    const stoor = () => {
      if (klaar) return;
      klaar = true;
      const nuut = invoer.value.replace(/\s+/g, " ").trim();
      if (nuut !== (m.nota || "")) {
        if (is_uitlig) window.LeserUitlig.stel_nota(id, nuut);
        else stel_nota(id, nuut);
      }
      else teken_paneel();
    };
    invoer.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); stoor(); }
      if (e.key === "Escape") { e.preventDefault(); klaar = true; teken_paneel(); }
    });
    invoer.addEventListener("blur", stoor);
    // mousedown, nie click nie: so stoor die ✓ voordat die veld sy fokus verloor.
    ry.querySelector(".leser-inhoud-bevestig").addEventListener("mousedown", (e) => { e.preventDefault(); stoor(); });
    invoer.focus();
  }

  // ---------------------------------------------------------------- bywerk

  function werk_by() {
    const merk = document.getElementById("leser-merk-knoppie");
    const inhoud = document.getElementById("leser-inhoud-knoppie");
    if (!merk || !inhoud) return;

    const gemerk = Boolean(merk_op_huidige());
    merk.classList.toggle("leser-merk-aan", gemerk);
    merk.setAttribute("aria-pressed", gemerk ? "true" : "false");
    const etiket = gemerk ? v("leser_haal_merk_weg", "Haal die boekmerk weg") : v("leser_merk_bladsy", "Merk hierdie bladsy");
    merk.setAttribute("aria-label", etiket);
    merk.title = etiket;
    const woord = merk.querySelector(".leser-merk-woord");
    if (woord) woord.textContent = gemerk ? v("leser_gemerk", "Gemerk") : v("leser_merk", "Merk");

    inhoud.hidden = !(ink.hoofstukke.length || ink.toc_bladsy || ink.merke.length || uitligte().length);
    const inhoud_etiket = net_toc()
      ? `${v("leser_na_inhoudsopgawe", "Na die inhoudsopgawe")} (${bl()} ${ink.toc_bladsy})`
      : v("leser_inhoud", "Inhoud");
    inhoud.title = inhoud_etiket;
    inhoud.setAttribute("aria-label", inhoud_etiket);
    if (inhoud.hidden && ink.oop) maak_toe();

    teken_paneel();
  }

  // Die uitlig-strokie se "Nota": maak die lys oop by daardie uitlig.
  window.leser_inhoud_wysig_nota = (soort, id) => {
    if (!ink.begin) return;
    werk_by();
    if (!ink.oop) maak_oop();
    wysig_nota(soort, id);
    const ry = document.querySelector(`.leser-inhoud-merk[data-id="${CSS.escape(id)}"]`);
    if (ry) ry.scrollIntoView({ block: "nearest" });
  };

  async function begin() {
    ink.begin = true;
    if (window.LeserUitlig) window.LeserUitlig.luister(werk_by);
    bou_knoppies();
    const merk = document.getElementById("leser-merk-knoppie");
    if (merk) merk.hidden = false;
    werk_by();
    // Hoofstukke eers, want die inhoudsopgawe kan een daarvan wees.
    await Promise.all([laai_merke(), laai_hoofstukke().then(soek_inhoudsopgawe)]);
    werk_by();
  }

  document.addEventListener("leser-bladsy", () => {
    if (typeof pdf_dokument === "undefined" || !pdf_dokument) return;
    if (!ink.begin) { begin(); return; }
    werk_by();
  });
})();
