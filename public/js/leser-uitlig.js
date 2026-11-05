// leser-uitlig.js — teks kies en uitlig in die leser (November 2026).
//
// DIE TEKSLAAG. Die leser teken elke bladsy as 'n prent (canvas). PDF.js se
// renderTextLayer sit die bladsy se woorde as onsigbare, kiesbare teks
// presies bo-oor die prent. Kies die leser teks, verskyn 'n strokie met
// drie kleure (geel, groen, pienk) en "Nota". Die uitlig word as reghoeke
// in breuke van die bladsy gestoor (0 tot 1), sodat dit by elke zoemvlak en
// skermgrootte op dieselfde plek val. 'n Tik op 'n bestaande uitlig gee die
// kleure weer, plus Verwyder.
//
// GEEN KOPIEER NIE. Die tekslaag maak die woorde kiesbaar, nie kopieerbaar
// nie: "copy", "cut" en die regsklik-kieslys word op die bladsy gekeer.
//
// Die lys "My uitligte" in die Inhoud-paneel is leser-inhoud.js s'n; dit
// lees die data via window.LeserUitlig. Laai NA leser.js en voor
// leser-inhoud.js. Luister na leser.js se "leser-bladsy"-gebeurtenis, wat
// ná elke tekening van 'n bladsy kom (ook ná zoem en skermdraai).

(function () {
  const KLEURE = {
    geel: "#F2CB4C",
    groen: "#7CC46B",
    pienk: "#E98AAB",
  };
  const WOORDTEKEN = /[\p{L}\p{N}'’\-]/u;

  const ul = {
    uitligte: [],
    gelaai: false,
    teken_beurt: 0,
    luisteraars: [],
    strook_vir: null, // null = nuwe keuse; anders die id van 'n bestaande uitlig
    besig: false,
  };

  const v = (sleutel, terugval) => (window.t ? window.t(sleutel) : terugval);

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ------------------------------------------------------------- lae

  const posisie = document.querySelector(".leser-bladsy-posisie");
  const canvas = document.getElementById("leser-canvas");
  const skakels = document.getElementById("leser-skakel-laag");
  if (!posisie || !canvas) return;

  const uitlig_laag = document.createElement("div");
  uitlig_laag.className = "leser-uitlig-laag";
  uitlig_laag.setAttribute("aria-hidden", "true");

  const teks_laag = document.createElement("div");
  teks_laag.className = "leser-teks-laag";

  // Volgorde: prent, uitligte, teks, skakels. Die skakels bly bo, sodat 'n
  // skakel in die inhoudsopgawe steeds werk.
  posisie.insertBefore(uitlig_laag, skakels || null);
  posisie.insertBefore(teks_laag, skakels || null);

  const strook = document.createElement("div");
  strook.className = "leser-uitlig-strook";
  strook.hidden = true;
  strook.setAttribute("role", "toolbar");
  document.querySelector(".leser-skerm").appendChild(strook);

  teks_laag.addEventListener("mousedown", () => teks_laag.classList.add("leser-teks-kies"));
  document.addEventListener("mouseup", () => teks_laag.classList.remove("leser-teks-kies"));

  ["copy", "cut", "contextmenu"].forEach((naam) =>
    teks_laag.addEventListener(naam, (e) => e.preventDefault())
  );
  document.addEventListener("copy", (e) => {
    const s = window.getSelection();
    if (s && s.rangeCount && teks_laag.contains(s.getRangeAt(0).commonAncestorContainer)) e.preventDefault();
  });

  // ------------------------------------------------------------- data

  function kop() {
    return { Authorization: `Bearer ${sessie_globaal.access_token}` };
  }

  function sein() {
    ul.luisteraars.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  }

  // Die bladsy waarop 'n uitlig NOU val. Is die PDF opgedateer, skuif dit
  // relatief, soos die leesplek; op die bladsy self word dit dan nie
  // geteken nie, want die teks staan dalk elders (sien teken_uitligte).
  function bladsy_van(u) {
    if (typeof bepaal_beginbladsy !== "function") return u.bladsy;
    return bepaal_beginbladsy(
      { bladsy: u.bladsy, weergawe: u.weergawe, totaal_bladsye: u.totaal_bladsye },
      huidige_weergawe,
      totale_bladsye
    ).bladsy;
  }

  function is_verouderd(u) {
    return Boolean(u.weergawe && huidige_weergawe && u.weergawe !== huidige_weergawe);
  }

  async function laai() {
    try {
      const resp = await fetch(
        `/.netlify/functions/kry-uitligte?produk_slug=${encodeURIComponent(produk_slug_globaal)}`,
        { headers: kop() }
      );
      if (resp.ok) ul.uitligte = (await resp.json()).uitligte || [];
    } catch { /* leser werk steeds sonder uitligte */ }
    ul.gelaai = true;
    teken_uitligte();
    sein();
  }

  async function stuur(liggaam) {
    const resp = await fetch("/.netlify/functions/stoor-uitlig", {
      method: "POST",
      headers: { ...kop(), "Content-Type": "application/json" },
      body: JSON.stringify({ produk_slug: produk_slug_globaal, ...liggaam }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    return (await resp.json()).uitligte || [];
  }

  function fout_kennis() {
    const el = document.getElementById("leser-inhoud-kennis");
    const teks = v("leser_uitlig_fout", "Kon nie die uitlig stoor nie. Probeer weer.");
    if (!el) return;
    el.textContent = teks;
    el.hidden = false;
    clearTimeout(fout_kennis.t);
    fout_kennis.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function verander(optimisties, liggaam) {
    const voorheen = ul.uitligte.slice();
    optimisties();
    teken_uitligte();
    sein();
    try {
      ul.uitligte = await stuur(liggaam);
    } catch (fout) {
      console.error("Uitlig:", fout);
      ul.uitligte = voorheen;
      fout_kennis();
    }
    teken_uitligte();
    sein();
    return ul.uitligte;
  }

  // ------------------------------------------------------------- tekslaag

  async function teken_tekslaag() {
    const beurt = ++ul.teken_beurt;
    teks_laag.innerHTML = "";
    if (!pdf_dokument) return;
    try {
      const bladsy = await pdf_dokument.getPage(huidige_bladsy);
      const breedte = parseFloat(canvas.style.width) || canvas.clientWidth;
      const basis = bladsy.getViewport({ scale: 1 });
      // DUBBELE GROOTTE, DAN HALF. By klein letters (minder as ongeveer 12px,
      // byvoorbeeld 'n hele bladsy op 'n skootrekenaar of foon) misgis
      // Chrome die posisie van die onsigbare letters, en 'n keuse wat in die
      // middel van 'n reël begin, bly leeg. Die laag word dus teen twee keer
      // die grootte gebou en met CSS terug geskaal: dieselfde plek op die
      // skerm, maar groot genoeg letters om akkuraat te kies.
      const VERGROOT = 2;
      const viewport = bladsy.getViewport({ scale: (breedte / basis.width) * VERGROOT });
      const inhoud = await bladsy.getTextContent();
      if (beurt !== ul.teken_beurt) return;
      teks_laag.style.width = `${viewport.width}px`;
      teks_laag.style.height = `${viewport.height}px`;
      teks_laag.style.transform = `scale(${1 / VERGROOT})`;
      await pdfjsLib.renderTextLayer({ textContent: inhoud, container: teks_laag, viewport, textDivs: [] }).promise;
      // Soos PDF.js se eie leser: 'n leë blok agter die teks wat tydens 'n
      // keuse die hele laag dek, sodat die keuse nie spring wanneer die muis
      // tussen reëls of oor 'n leë stuk beweeg nie.
      const einde = document.createElement("div");
      einde.className = "leser-teks-einde";
      teks_laag.appendChild(einde);
    } catch (fout) {
      console.warn("Tekslaag:", fout);
    }
  }

  function teken_uitligte() {
    uitlig_laag.innerHTML = "";
    if (typeof huidige_bladsy === "undefined") return;
    for (const u of ul.uitligte) {
      if (u.bladsy !== huidige_bladsy || is_verouderd(u)) continue;
      for (const [x, y, b, h] of u.reghoeke) {
        const d = document.createElement("div");
        d.className = `leser-uitlig leser-uitlig-${u.kleur}`;
        d.dataset.id = u.id;
        d.style.left = `${x * 100}%`;
        d.style.top = `${y * 100}%`;
        d.style.width = `${b * 100}%`;
        d.style.height = `${h * 100}%`;
        uitlig_laag.appendChild(d);
      }
    }
  }

  // ------------------------------------------------------------- keuse

  // Brei die keuse uit na hele woorde, soos Kindle. 'n PDF verdeel 'n reël
  // dikwels in stukke, soms midde-in 'n woord ("social" + "-learning"); die
  // uitbreiding loop dan oor na die stuk langsaan, maar net op dieselfde reël.
  // Lei- en sleepstreepies, -spasies en -leestekens val weg.
  const RAND_WEG = /[\s\u2013\u2014,;:]/;

  function stukke() {
    return [...teks_laag.querySelectorAll(":scope > span")];
  }

  function langsaan(node, rigting) {
    const span = node.parentNode;
    const lys = stukke();
    const i = lys.indexOf(span);
    const ander = lys[i + rigting];
    if (!ander || !ander.firstChild || ander.firstChild.nodeType !== 3) return null;
    const a = span.getBoundingClientRect();
    const b = ander.getBoundingClientRect();
    if (Math.abs(a.top - b.top) > a.height * 0.5) return null; // ander reël
    return ander.firstChild;
  }

  function heel_woorde(reeks) {
    const r = reeks.cloneRange();
    let begin = r.startContainer;
    let o = r.startOffset;
    if (begin.nodeType === 3) {
      for (let stap = 0; stap < 4; stap++) {
        while (o > 0 && WOORDTEKEN.test(begin.data[o - 1])) o--;
        if (o > 0) break;
        const vorige = langsaan(begin, -1);
        if (!vorige || !WOORDTEKEN.test(vorige.data.slice(-1))) break;
        begin = vorige;
        o = vorige.data.length;
      }
      while (o < begin.data.length && RAND_WEG.test(begin.data[o])) o++;
      r.setStart(begin, o);
    }
    let einde = r.endContainer;
    let e = r.endOffset;
    if (einde.nodeType === 3) {
      for (let stap = 0; stap < 4; stap++) {
        while (e < einde.data.length && WOORDTEKEN.test(einde.data[e])) e++;
        if (e < einde.data.length) break;
        const volgende = langsaan(einde, 1);
        if (!volgende || !WOORDTEKEN.test(volgende.data[0] || "")) break;
        einde = volgende;
        e = 0;
      }
      while (e > 0 && RAND_WEG.test(einde.data[e - 1])) e--;
      r.setEnd(einde, e);
    }
    return r;
  }

  function keuse_in_laag() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    const r = s.getRangeAt(0);
    if (!teks_laag.contains(r.commonAncestorContainer)) return null;
    return r;
  }

  // Die keuse se reghoeke as breuke van die bladsy, met stukke op dieselfde
  // reël saamgevoeg sodat daar nie nate tussen woorde is nie.
  function reghoeke_van(reeks) {
    const vlak = canvas.getBoundingClientRect();
    if (!vlak.width || !vlak.height) return [];
    const ruwe = [...reeks.getClientRects()]
      .filter((r) => r.width > 0.5 && r.height > 0.5)
      .map((r) => ({ l: r.left - vlak.left, t: r.top - vlak.top, r: r.right - vlak.left, b: r.bottom - vlak.top }))
      .sort((a, b) => a.t - b.t || a.l - b.l);
    const reels = [];
    for (const r of ruwe) {
      const laaste = reels[reels.length - 1];
      const middel = (r.t + r.b) / 2;
      if (laaste && middel > laaste.t && middel < laaste.b && r.l - laaste.r < 14) {
        laaste.l = Math.min(laaste.l, r.l);
        laaste.r = Math.max(laaste.r, r.r);
        laaste.t = Math.min(laaste.t, r.t);
        laaste.b = Math.max(laaste.b, r.b);
      } else {
        reels.push({ ...r });
      }
    }
    return reels.map((r) => [
      Math.max(0, r.l / vlak.width),
      Math.max(0, r.t / vlak.height),
      Math.min(1, (r.r - r.l) / vlak.width),
      Math.min(1, (r.b - r.t) / vlak.height),
    ]);
  }

  // ------------------------------------------------------------- strokie

  function wys_strook(anker_reghoek, vir_id) {
    ul.strook_vir = vir_id || null;
    const bestaande = vir_id && ul.uitligte.find((u) => u.id === vir_id);
    const kleur_knoppies = Object.keys(KLEURE).map((k) => {
      const aan = bestaande && bestaande.kleur === k ? " leser-uitlig-kleur-aan" : "";
      return `<button type="button" class="leser-uitlig-kleur${aan}" data-kleur="${k}" style="background:${KLEURE[k]}" aria-label="${esc(v(`leser_kleur_${k}`, k))}" title="${esc(v(`leser_kleur_${k}`, k))}"></button>`;
    }).join("");
    const derde = bestaande
      ? `<button type="button" class="leser-uitlig-aksie" data-aksie="verwyder">${esc(v("leser_uitlig_verwyder", "Verwyder"))}</button>`
      : "";
    strook.innerHTML = `${kleur_knoppies}<span class="leser-uitlig-skei"></span>
      <button type="button" class="leser-uitlig-aksie" data-aksie="nota">${esc(v("leser_uitlig_nota", "Nota"))}</button>${derde}`;
    strook.hidden = false;

    const skerm = document.querySelector(".leser-skerm").getBoundingClientRect();
    const sb = strook.offsetWidth;
    const sh = strook.offsetHeight;
    let links = anker_reghoek.left + anker_reghoek.width / 2 - skerm.left - sb / 2;
    links = Math.max(8, Math.min(links, skerm.width - sb - 8));
    // Op 'n aanraakskerm sit die blaaier se eie strokie bo die keuse; ons
    // s'n gaan dan onder. Met 'n muis bo, soos Kindle.
    const onder = (typeof IS_AANRAAK !== "undefined" && IS_AANRAAK) || anker_reghoek.top - skerm.top < sh + 70;
    const bo = onder ? anker_reghoek.bottom - skerm.top + 10 : anker_reghoek.top - skerm.top - sh - 10;
    strook.style.left = `${links}px`;
    strook.style.top = `${bo}px`;
  }

  function versteek_strook() {
    strook.hidden = true;
    ul.strook_vir = null;
  }

  async function maak_nuut(kleur, met_nota) {
    const reeks = keuse_in_laag();
    if (!reeks || ul.besig) return;
    const heel = heel_woorde(reeks);
    const teks = heel.toString().replace(/\s+/g, " ").trim();
    const reghoeke = reghoeke_van(heel);
    window.getSelection().removeAllRanges();
    versteek_strook();
    if (!teks || !reghoeke.length) return;

    ul.besig = true;
    const tydelik = { id: "_nuut", bladsy: huidige_bladsy, kleur, teks, reghoeke, weergawe: huidige_weergawe, totaal_bladsye: totale_bladsye, nota: "" };
    const voor = new Set(ul.uitligte.map((u) => u.id));
    await verander(
      () => { ul.uitligte = ul.uitligte.concat([tydelik]); },
      { aksie: "voeg_by", bladsy: huidige_bladsy, kleur, teks, reghoeke, weergawe: huidige_weergawe, totaal_bladsye: totale_bladsye }
    );
    ul.besig = false;
    if (met_nota) {
      const nuut = ul.uitligte.find((u) => !voor.has(u.id));
      if (nuut && typeof window.leser_inhoud_wysig_nota === "function") window.leser_inhoud_wysig_nota("uitlig", nuut.id);
    }
  }

  strook.addEventListener("mousedown", (e) => e.preventDefault()); // hou die keuse
  strook.addEventListener("click", (e) => {
    const knop = e.target.closest("button");
    if (!knop) return;
    const kleur = knop.getAttribute("data-kleur");
    const aksie = knop.getAttribute("data-aksie");
    const id = ul.strook_vir;

    if (!id) {
      if (kleur) maak_nuut(kleur, false);
      else if (aksie === "nota") maak_nuut("geel", true);
      return;
    }
    versteek_strook();
    if (kleur) {
      verander(() => { ul.uitligte = ul.uitligte.map((u) => (u.id === id ? { ...u, kleur } : u)); }, { aksie: "kleur", id, kleur });
    } else if (aksie === "verwyder") {
      verander(() => { ul.uitligte = ul.uitligte.filter((u) => u.id !== id); }, { aksie: "verwyder", id });
    } else if (aksie === "nota" && typeof window.leser_inhoud_wysig_nota === "function") {
      window.leser_inhoud_wysig_nota("uitlig", id);
    }
  });

  // Keuse klaar (muis los, of die handvatsels op 'n foon het stilgestaan).
  let keuse_tydsaanwyser = null;
  function toets_keuse() {
    clearTimeout(keuse_tydsaanwyser);
    keuse_tydsaanwyser = setTimeout(() => {
      const reeks = keuse_in_laag();
      if (reeks) {
        const rr = [...reeks.getClientRects()].filter((r) => r.width > 0.5);
        if (!rr.length) return;
        const eerste = rr[0];
        const laaste = rr[rr.length - 1];
        const onder = typeof IS_AANRAAK !== "undefined" && IS_AANRAAK;
        wys_strook(onder ? laaste : eerste, null);
      } else if (!ul.strook_vir) {
        versteek_strook();
      }
    }, 220);
  }
  document.addEventListener("selectionchange", toets_keuse);

  // 'n Tik of klik op 'n bestaande uitlig (sonder om teks te kies).
  function uitlig_by(x, y) {
    for (const d of uitlig_laag.children) {
      const r = d.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return d;
    }
    return null;
  }
  teks_laag.addEventListener("click", (e) => {
    if (keuse_in_laag()) return;
    const d = uitlig_by(e.clientX, e.clientY);
    if (!d) {
      if (ul.strook_vir) versteek_strook();
      return;
    }
    const stukke = [...uitlig_laag.querySelectorAll(`[data-id="${CSS.escape(d.dataset.id)}"]`)];
    wys_strook(stukke[0].getBoundingClientRect(), d.dataset.id);
  });

  document.addEventListener("mousedown", (e) => {
    if (strook.hidden || strook.contains(e.target) || teks_laag.contains(e.target)) return;
    versteek_strook();
  });
  const omhulsel = document.querySelector(".leser-bladsy-omhulsel");
  if (omhulsel) {
    omhulsel.addEventListener("scroll", () => { if (!strook.hidden) versteek_strook(); }, { passive: true });
    // 'n Vinger wat 'n keuse se handvatsels sleep, mag nie as 'n swipe na
    // die volgende bladsy tel nie (leser.js se touchend op die omhulsel).
    const bekyker = document.getElementById("leser-bekyker");
    if (bekyker) {
      bekyker.addEventListener("touchend", (e) => {
        if (keuse_in_laag() && omhulsel.contains(e.target)) e.stopPropagation();
      }, { capture: true });
    }
  }

  // ------------------------------------------------------------- koppelvlak

  window.LeserUitlig = {
    lys: () => ul.uitligte,
    gelaai: () => ul.gelaai,
    bladsy_van,
    is_verouderd,
    kleur: (naam) => KLEURE[naam] || KLEURE.geel,
    luister: (f) => ul.luisteraars.push(f),
    verwyder: (id) => verander(() => { ul.uitligte = ul.uitligte.filter((u) => u.id !== id); }, { aksie: "verwyder", id }),
    stel_nota: (id, nota) => verander(() => { ul.uitligte = ul.uitligte.map((u) => (u.id === id ? { ...u, nota } : u)); }, { aksie: "nota", id, nota }),
  };

  // ------------------------------------------------------------- begin

  document.addEventListener("leser-bladsy", () => {
    if (typeof pdf_dokument === "undefined" || !pdf_dokument) return;
    versteek_strook();
    if (!ul.gelaai && !ul.laai_begin) {
      ul.laai_begin = true;
      laai();
    }
    teken_tekslaag();
    teken_uitligte();
  });
})();
