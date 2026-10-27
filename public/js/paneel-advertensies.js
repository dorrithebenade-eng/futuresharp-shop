// paneel-advertensies.js
//
// ADVERTENSIES (Oktober 2026). Al die klaar advertensies op een plek, elk met
// sy WhatsApp-boodskap, om vinnig van die foon af te deel:
//
//   Deel prent  -> die foon se deel-venster met die beeld en die boodskap.
//                  Die boodskap word ook gekopieer, want sommige fone (veral
//                  iPhone na WhatsApp) laat die teks val as daar 'n prent by is.
//   Deel skakel -> die boodskap met die skakel /a/<slug>. WhatsApp wys die
//                  advertensie as voorskou; wie tik, gaan na die winkel.
//
// Op 'n rekenaar (geen deel-venster vir lêers nie) laai "Deel prent" die
// beeld af en kopieer die boodskap, om in WhatsApp Web te plak.
//
// Bediener: advertensies.js (lys, stoor, skrap) en advertensie-bladsy.js
// (die publieke skakel en die beelde).

(function () {
  const API = "/.netlify/functions/advertensies";
  const WERF = "https://futureshop.futuresharp.co.za";

  let advertensies = [];
  let filter_groep = "";
  let filter_taal = "";
  let wys_versteek = false;
  let wysig_slug = null;
  const lêer_kas = new Map(); // slug -> File

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kop = () => (typeof kry_outorisasie_kop === "function" ? kry_outorisasie_kop() : {});

  // ---------------------------------------------------------------- adresse

  const skakel_van = (a) => `${WERF}/a/${a.slug}`;
  function og_url(a) {
    if (a.beeld && a.beeld.og) return a.beeld.og;
    return `/a-beeld/${a.slug}.jpg?v=${(a.beeld && a.beeld.v) || 1}`;
  }
  function vol_url(a) {
    if (a.beeld && a.beeld.vol) return a.beeld.vol;
    return `/a-beeld/${a.slug}-vol.jpg?v=${(a.beeld && a.beeld.v) || 1}`;
  }
  const lêernaam = (a) => `${a.slug}.jpg`;

  // Die boodskap sonder adresse, met die advertensie se eie skakel onderaan.
  // So is die eerste skakel in die boodskap ons s'n en wys WhatsApp die
  // advertensie as voorskou, nie die winkel se gewone een nie.
  function skakel_boodskap(a) {
    const kaal = String(a.boodskap || "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/futureshop\.futuresharp\.co\.za\S*/gi, "")
      .split("\n").map((r) => r.replace(/[ \t]+$/, "")).join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // Eindig die teks op 'n dubbelpunt ("... wanneer jy betaal:"), kom die
    // skakel direk daaronder.
    return `${kaal}${kaal.endsWith(":") ? "\n" : "\n\n"}${skakel_van(a)}`;
  }

  // ------------------------------------------------------------------ boodskap

  function toast(teks) {
    let t = $("adv-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "adv-toast";
      t.className = "adv-toast";
      document.body.appendChild(t);
    }
    t.textContent = teks;
    t.classList.add("adv-toast-sigbaar");
    clearTimeout(t._tydhouer);
    t._tydhouer = setTimeout(() => t.classList.remove("adv-toast-sigbaar"), 3600);
  }

  function kopieer(teks) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(teks);
    } catch (_) { /* val terug */ }
    const ta = document.createElement("textarea");
    ta.value = teks;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) { /* niks */ }
    ta.remove();
    return Promise.resolve();
  }

  // -------------------------------------------------------------------- lêers

  async function haal_lêer(a) {
    if (lêer_kas.has(a.slug)) return lêer_kas.get(a.slug);
    const resp = await fetch(vol_url(a));
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const blob = await resp.blob();
    const lêer = new File([blob], lêernaam(a), { type: "image/jpeg" });
    lêer_kas.set(a.slug, lêer);
    return lêer;
  }

  function laai_af(lêer) {
    const url = URL.createObjectURL(lêer);
    const skakel = document.createElement("a");
    skakel.href = url;
    skakel.download = lêer.name;
    document.body.appendChild(skakel);
    skakel.click();
    skakel.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const kan_lêers_deel = (lêer) => {
    try {
      return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [lêer] }));
    } catch (_) {
      return false;
    }
  };

  // WhatsApp (Web en Desktop) aanvaar 'n geplakte prent, maar net as PNG op
  // die knipbord, en die knipbord hou een ding op 'n slag. Daarom twee stappe
  // op die rekenaar: eers die prent, dan die boodskap as onderskrif.
  async function na_png(lêer) {
    const bron = await createImageBitmap(lêer);
    const b = Math.min(1600, bron.width);
    const h = Math.round(bron.height * (b / bron.width));
    const c = document.createElement("canvas");
    c.width = b; c.height = h;
    c.getContext("2d").drawImage(bron, 0, 0, b, h);
    return new Promise((klaar) => c.toBlob(klaar, "image/png"));
  }

  function kan_prent_kopieer() {
    return !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
  }

  async function kopieer_prent(a) {
    // Die ClipboardItem kry 'n belofte, sodat die skryf binne die tik begin.
    const item = new ClipboardItem({ "image/png": haal_lêer(a).then(na_png) });
    await navigator.clipboard.write([item]);
  }

  // Stap 2 op die rekenaar: dieselfde knoppie kopieer dan die boodskap.
  function stel_stap_twee(knoppie, a) {
    const oud = knoppie.dataset.oud || knoppie.textContent;
    knoppie.dataset.oud = oud;
    knoppie.dataset.stap = "2";
    knoppie.textContent = "2. Kopieer boodskap";
    knoppie.classList.add("adv-stap-twee");
    clearTimeout(knoppie._tydhouer);
    knoppie._tydhouer = setTimeout(() => herstel_knoppie(knoppie), 60000);
  }

  function herstel_knoppie(knoppie) {
    if (!knoppie.dataset.oud) return;
    knoppie.textContent = knoppie.dataset.oud;
    delete knoppie.dataset.stap;
    knoppie.classList.remove("adv-stap-twee");
  }

  // ------------------------------------------------------------------- deel

  async function deel_prent(a, knoppie) {
    const teks = a.boodskap || "";

    if (knoppie.dataset.stap === "2") {
      await kopieer(teks);
      herstel_knoppie(knoppie);
      toast("Boodskap gekopieer. Plak dit in WhatsApp as onderskrif by die prent (Ctrl+V) en stuur.");
      return;
    }

    // Rekenaar sonder deel-venster vir lêers: kopieer die prent.
    const op_rekenaar = !(navigator.canShare && navigator.share) || !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (op_rekenaar && kan_prent_kopieer()) {
      try {
        await kopieer_prent(a);
        stel_stap_twee(knoppie, a);
        toast("1. Prent gekopieer. Plak dit in WhatsApp (Ctrl+V). Tik dan hier op \"2. Kopieer boodskap\".");
      } catch (_) {
        try { laai_af(await haal_lêer(a)); } catch (__) { /* niks */ }
        if (teks) kopieer(teks).catch(() => {});
        toast("Kon nie die prent kopieer nie. Dit is afgelaai en die boodskap is gekopieer.");
      }
      return;
    }

    // Begin die kopieer binne die tik, voor enige wag.
    if (teks) kopieer(teks).catch(() => {});

    const in_kas = lêer_kas.get(a.slug);
    if (in_kas && kan_lêers_deel(in_kas)) {
      try {
        await navigator.share({ files: [in_kas], text: teks });
        toast("Gedeel. Die boodskap is ook gekopieer, plak dit as dit nie saamgekom het nie.");
      } catch (e) {
        if (e && e.name === "AbortError") return;
        toast("Kon nie deel nie. Probeer weer.");
      }
      return;
    }

    const oud = knoppie.textContent;
    knoppie.disabled = true;
    knoppie.textContent = "Word gelaai …";
    let lêer;
    try {
      lêer = await haal_lêer(a);
    } catch (_) {
      knoppie.disabled = false;
      knoppie.textContent = oud;
      toast("Kon nie die prent laai nie.");
      return;
    }
    knoppie.disabled = false;
    knoppie.textContent = oud;

    if (kan_lêers_deel(lêer)) {
      try {
        await navigator.share({ files: [lêer], text: teks });
        toast("Gedeel. Die boodskap is ook gekopieer, plak dit as dit nie saamgekom het nie.");
      } catch (e) {
        if (e && e.name === "AbortError") return;
        // Die blaaier het die tik "vergeet" terwyl die prent gelaai het.
        knoppie.textContent = "Tik weer om te deel";
        setTimeout(() => { knoppie.textContent = oud; }, 6000);
      }
      return;
    }

    // Rekenaar: laai af en kopieer.
    laai_af(lêer);
    toast(teks ? "Prent afgelaai en boodskap gekopieer. Plak albei in WhatsApp Web." : "Prent afgelaai.");
  }

  async function deel_skakel(a) {
    const teks = skakel_boodskap(a);
    if (navigator.share) {
      try {
        await navigator.share({ text: teks });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    await kopieer(teks);
    toast("Boodskap met skakel gekopieer. Plak dit in WhatsApp.");
  }

  // ------------------------------------------------------------------- data

  async function laai() {
    const lys = $("adv-lys");
    if (!lys) return;
    lys.innerHTML = `<p class="stelsel-boodskap">Advertensies word gelaai …</p>`;
    try {
      const resp = await fetch(API, { headers: kop() });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();
      advertensies = data.advertensies || [];
      teken();
    } catch (fout) {
      console.error("Kon nie advertensies laai nie:", fout);
      lys.innerHTML = `<p class="stelsel-boodskap">Kon nie die advertensies laai nie.</p>`;
    }
  }

  function groepe() {
    return [...new Set(advertensies.map((a) => a.groep || "Ander"))];
  }

  // ------------------------------------------------------------------ teken

  function teken_filters() {
    const wrap = $("adv-filters");
    const g = groepe();
    const knop = (waarde, etiket, aktief, data) =>
      `<button type="button" class="adv-filter${aktief ? " aktief" : ""}" data-${data}="${esc(waarde)}">${esc(etiket)}</button>`;
    wrap.innerHTML = `
      <div class="adv-filter-ry">${knop("", "Alles", !filter_groep, "groep")}${g.map((x) => knop(x, x, filter_groep === x, "groep")).join("")}</div>
      <div class="adv-filter-ry">
        ${knop("", "Albei tale", !filter_taal, "taal")}${knop("af", "Afrikaans", filter_taal === "af", "taal")}${knop("en", "Engels", filter_taal === "en", "taal")}
        <label class="adv-versteek"><input type="checkbox" id="adv-wys-versteek" ${wys_versteek ? "checked" : ""}> Wys versteekte</label>
      </div>`;
    wrap.querySelectorAll("[data-groep]").forEach((b) => b.addEventListener("click", () => { filter_groep = b.dataset.groep; teken(); }));
    wrap.querySelectorAll("[data-taal]").forEach((b) => b.addEventListener("click", () => { filter_taal = b.dataset.taal; teken(); }));
    $("adv-wys-versteek").addEventListener("change", (e) => { wys_versteek = e.target.checked; teken(); });
  }

  let waarnemer = null;

  function teken() {
    teken_filters();
    const lys = $("adv-lys");
    const sigbaar = advertensies.filter((a) =>
      (!filter_groep || (a.groep || "Ander") === filter_groep) &&
      (!filter_taal || a.taal === filter_taal) &&
      (wys_versteek || a.aktief !== false));

    if (!sigbaar.length) {
      lys.innerHTML = `<p class="stelsel-boodskap">Geen advertensies hier nie.</p>`;
      return;
    }

    lys.innerHTML = sigbaar.map((a) => `
      <article class="adv-kaart${a.aktief === false ? " adv-versteek-kaart" : ""}" data-slug="${esc(a.slug)}">
        <img class="adv-beeld" src="${esc(og_url(a))}" alt="${esc(a.titel)}" loading="lazy">
        <div class="adv-inhoud">
          <div class="adv-titel">${esc(a.titel)}</div>
          <div class="adv-etiket">${esc(a.groep || "Ander")} · ${a.taal === "en" ? "Engels" : "Afrikaans"}${a.aktief === false ? " · versteek" : ""}</div>
          <div class="adv-hoof-knoppies">
            <button type="button" class="kaart-aksie adv-deel-prent">📲 Deel prent</button>
            <button type="button" class="kaart-aksie adv-deel-skakel">🔗 Deel skakel</button>
          </div>
          <div class="adv-ander-knoppies">
            <button type="button" class="terug-skakel adv-laai-af">Laai af</button>
            <button type="button" class="terug-skakel adv-kopieer-prent">Kopieer prent</button>
            <button type="button" class="terug-skakel adv-kopieer-boodskap">Kopieer boodskap</button>
            <button type="button" class="terug-skakel adv-kopieer-skakel">Kopieer skakel</button>
            ${a.beeld && a.beeld.pdf ? `<a class="terug-skakel" href="${esc(a.beeld.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""}
            <button type="button" class="terug-skakel adv-wysig">Wysig</button>
            <button type="button" class="terug-skakel adv-wissel">${a.aktief === false ? "Wys weer" : "Versteek"}</button>
          </div>
        </div>
      </article>`).join("");

    const vind = (el) => advertensies.find((a) => a.slug === el.closest(".adv-kaart").dataset.slug);
    lys.querySelectorAll(".adv-deel-prent").forEach((b) => b.addEventListener("click", () => deel_prent(vind(b), b)));
    lys.querySelectorAll(".adv-deel-skakel").forEach((b) => b.addEventListener("click", () => deel_skakel(vind(b))));
    lys.querySelectorAll(".adv-laai-af").forEach((b) => b.addEventListener("click", async () => {
      try { laai_af(await haal_lêer(vind(b))); } catch (_) { toast("Kon nie die prent laai nie."); }
    }));
    lys.querySelectorAll(".adv-kopieer-prent").forEach((b) => b.addEventListener("click", async () => {
      try {
        await kopieer_prent(vind(b));
        toast("Prent gekopieer. Plak dit in WhatsApp (Ctrl+V).");
      } catch (_) {
        toast("Hierdie blaaier kan nie 'n prent kopieer nie. Gebruik Laai af.");
      }
    }));
    lys.querySelectorAll(".adv-kopieer-boodskap").forEach((b) => b.addEventListener("click", async () => {
      await kopieer(vind(b).boodskap || "");
      toast("Boodskap gekopieer.");
    }));
    lys.querySelectorAll(".adv-kopieer-skakel").forEach((b) => b.addEventListener("click", async () => {
      await kopieer(skakel_van(vind(b)));
      toast("Skakel gekopieer.");
    }));
    lys.querySelectorAll(".adv-wysig").forEach((b) => b.addEventListener("click", () => maak_vorm_oop(vind(b))));
    lys.querySelectorAll(".adv-wissel").forEach((b) => b.addEventListener("click", () => wissel_aktief(vind(b), b)));

    // Laai die volle prent vooraf vir kaarte op die skerm, sodat "Deel prent"
    // dadelik kan oopmaak (die blaaier laat net deel binne 'n vars tik toe).
    if (waarnemer) waarnemer.disconnect();
    if ("IntersectionObserver" in window) {
      waarnemer = new IntersectionObserver((inskrywings) => {
        inskrywings.forEach((i) => {
          if (!i.isIntersecting) return;
          waarnemer.unobserve(i.target);
          const a = advertensies.find((x) => x.slug === i.target.dataset.slug);
          if (a) haal_lêer(a).catch(() => {});
        });
      }, { rootMargin: "120px" });
      lys.querySelectorAll(".adv-kaart").forEach((k) => waarnemer.observe(k));
    }
  }

  // ------------------------------------------------------------------ stoor

  async function stuur(liggaam) {
    const resp = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kop() },
      body: JSON.stringify(liggaam),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.fout || `Status ${resp.status}`);
    return data;
  }

  async function wissel_aktief(a, knoppie) {
    knoppie.disabled = true;
    try {
      await stuur({ aksie: "stoor", advertensie: { ...a, aktief: a.aktief === false } });
      await laai();
    } catch (fout) {
      toast(fout.message);
      knoppie.disabled = false;
    }
  }

  // Maak van enige prent 'n volle JPG (hoogstens 2400 breed) en 'n
  // 1200x630-voorskou (gesny om te vul), soos WhatsApp dit wil hê.
  function lees_prent(lêer) {
    return new Promise((klaar, fout) => {
      const url = URL.createObjectURL(lêer);
      const beeld = new Image();
      beeld.onload = () => {
        const b = Math.min(2400, beeld.naturalWidth);
        const h = Math.round(beeld.naturalHeight * (b / beeld.naturalWidth));
        const c1 = document.createElement("canvas");
        c1.width = b; c1.height = h;
        c1.getContext("2d").drawImage(beeld, 0, 0, b, h);

        const c2 = document.createElement("canvas");
        c2.width = 1200; c2.height = 630;
        const skaal = Math.max(1200 / beeld.naturalWidth, 630 / beeld.naturalHeight);
        const sb = beeld.naturalWidth * skaal, sh = beeld.naturalHeight * skaal;
        const k2 = c2.getContext("2d");
        k2.fillStyle = "#ffffff";
        k2.fillRect(0, 0, 1200, 630);
        k2.drawImage(beeld, (1200 - sb) / 2, (630 - sh) / 2, sb, sh);

        URL.revokeObjectURL(url);
        klaar({
          vol: c1.toDataURL("image/jpeg", 0.88).split(",")[1],
          og: c2.toDataURL("image/jpeg", 0.82).split(",")[1],
        });
      };
      beeld.onerror = () => { URL.revokeObjectURL(url); fout(new Error("Kon nie die prent lees nie")); };
      beeld.src = url;
    });
  }

  function maak_vorm_oop(a) {
    wysig_slug = a ? a.slug : null;
    $("adv-vorm-titel-kop").textContent = a ? "Wysig advertensie" : "Nuwe advertensie";
    $("adv-v-titel").value = a ? a.titel : "";
    $("adv-v-groep").value = a ? a.groep || "" : filter_groep || "";
    $("adv-v-taal").value = a ? a.taal : "af";
    $("adv-v-bestemming").value = a ? a.bestemming || "" : "https://futureshop.futuresharp.co.za/";
    $("adv-v-boodskap").value = a ? a.boodskap || "" : "";
    $("adv-v-beeld").value = "";
    $("adv-v-beeld-wenk").textContent = a ? "Laat leeg om die huidige prent te hou." : "";
    $("adv-v-skrap").style.display = a ? "" : "none";
    $("adv-v-fout").textContent = "";
    $("adv-groep-lys").innerHTML = groepe().map((g) => `<option value="${esc(g)}">`).join("");
    $("adv-vorm").hidden = false;
    $("adv-v-titel").focus();
  }

  function maak_vorm_toe() {
    $("adv-vorm").hidden = true;
    wysig_slug = null;
  }

  async function stoor_vorm(e) {
    e.preventDefault();
    const knop = $("adv-v-stoor");
    const fout = $("adv-v-fout");
    fout.textContent = "";
    const bestaande = wysig_slug ? advertensies.find((a) => a.slug === wysig_slug) : null;
    const lêer = $("adv-v-beeld").files[0];
    if (!bestaande && !lêer) { fout.textContent = "Kies 'n prent."; return; }

    knop.disabled = true;
    knop.textContent = "Word gestoor …";
    try {
      const liggaam = {
        aksie: "stoor",
        advertensie: {
          ...(bestaande || {}),
          slug: bestaande ? bestaande.slug : "",
          titel: $("adv-v-titel").value,
          groep: $("adv-v-groep").value,
          taal: $("adv-v-taal").value,
          bestemming: $("adv-v-bestemming").value,
          boodskap: $("adv-v-boodskap").value,
          aktief: bestaande ? bestaande.aktief !== false : true,
        },
      };
      if (lêer) {
        const p = await lees_prent(lêer);
        liggaam.beeld_vol_b64 = p.vol;
        liggaam.beeld_og_b64 = p.og;
        if (bestaande) lêer_kas.delete(bestaande.slug);
      }
      await stuur(liggaam);
      maak_vorm_toe();
      await laai();
      toast("Gestoor.");
    } catch (f) {
      fout.textContent = f.message;
    } finally {
      knop.disabled = false;
      knop.textContent = "Stoor";
    }
  }

  async function skrap_vorm() {
    if (!wysig_slug) return;
    if (!window.confirm("Skrap hierdie advertensie? Die deelskakel sal dan na die winkel se tuisblad gaan.")) return;
    try {
      await stuur({ aksie: "skrap", slug: wysig_slug });
      maak_vorm_toe();
      await laai();
      toast("Geskrap.");
    } catch (f) {
      $("adv-v-fout").textContent = f.message;
    }
  }

  // ------------------------------------------------------------------ skelet

  function bou_skelet() {
    const afdeling = document.querySelector('[data-afdeling-inhoud="advertensies"]');
    if (!afdeling || afdeling.dataset.gebou) return;
    afdeling.dataset.gebou = "1";
    afdeling.innerHTML = `
      <div class="paneel-afdeling-kop">
        <h2 class="paneel-afdeling-titel">Advertensies</h2>
        <button id="adv-nuut" class="kaart-aksie paneel-voeg-by-knoppie" type="button">+ Nuwe advertensie</button>
      </div>
      <p class="paneel-hulp-teks">Tik op <b>Deel prent</b> om die advertensie met sy boodskap op WhatsApp te stuur, of op <b>Deel skakel</b> om net 'n skakel te stuur wat die advertensie as voorskou wys.</p>
      <div id="adv-filters" class="adv-filters"></div>
      <div id="adv-lys" class="adv-lys"></div>

      <div id="adv-vorm" class="adv-vorm-agter" hidden>
        <form class="adv-vorm" id="adv-vorm-self">
          <h3 id="adv-vorm-titel-kop">Nuwe advertensie</h3>
          <label class="veld-etiket" for="adv-v-titel">Titel</label>
          <input id="adv-v-titel" class="veld-invoer" maxlength="120" required placeholder="Bv. Black Friday · Speel-Slim">
          <label class="veld-etiket" for="adv-v-groep">Groep</label>
          <input id="adv-v-groep" class="veld-invoer" maxlength="60" list="adv-groep-lys" placeholder="Bv. Black Friday">
          <datalist id="adv-groep-lys"></datalist>
          <label class="veld-etiket" for="adv-v-taal">Taal</label>
          <select id="adv-v-taal" class="veld-invoer"><option value="af">Afrikaans</option><option value="en">Engels</option></select>
          <label class="veld-etiket" for="adv-v-beeld">Prent (JPG of PNG)</label>
          <input id="adv-v-beeld" class="veld-invoer" type="file" accept="image/*">
          <p id="adv-v-beeld-wenk" class="paneel-hulp-teks"></p>
          <label class="veld-etiket" for="adv-v-boodskap">WhatsApp-boodskap</label>
          <textarea id="adv-v-boodskap" class="veld-invoer" rows="7" maxlength="2000"></textarea>
          <label class="veld-etiket" for="adv-v-bestemming">Waarheen die skakel gaan</label>
          <input id="adv-v-bestemming" class="veld-invoer" maxlength="500">
          <p id="adv-v-fout" class="adv-fout"></p>
          <div class="adv-vorm-knoppies">
            <button type="submit" id="adv-v-stoor" class="kaart-aksie">Stoor</button>
            <button type="button" id="adv-v-kanselleer" class="terug-skakel">Kanselleer</button>
            <button type="button" id="adv-v-skrap" class="terug-skakel adv-skrap">Skrap</button>
          </div>
        </form>
      </div>`;

    $("adv-nuut").addEventListener("click", () => maak_vorm_oop(null));
    $("adv-vorm-self").addEventListener("submit", stoor_vorm);
    $("adv-v-kanselleer").addEventListener("click", maak_vorm_toe);
    $("adv-v-skrap").addEventListener("click", skrap_vorm);
    $("adv-vorm").addEventListener("click", (e) => { if (e.target.id === "adv-vorm") maak_vorm_toe(); });
  }

  function styl() {
    if ($("adv-styl")) return;
    const s = document.createElement("style");
    s.id = "adv-styl";
    s.textContent = `
      .adv-filters{margin:10px 0 14px}
      .adv-filter-ry{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}
      .adv-filter{border:1px solid #cfd8d6;background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer}
      .adv-filter.aktief{background:#479F91;border-color:#479F91;color:#fff}
      .adv-versteek{font-size:13px;margin-left:8px;display:inline-flex;gap:6px;align-items:center}
      .adv-lys{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
      .adv-kaart{border:1px solid #e3e0d9;border-radius:12px;overflow:hidden;background:#fff;display:flex;flex-direction:column}
      .adv-versteek-kaart{opacity:.55}
      .adv-beeld{width:100%;aspect-ratio:1200/630;object-fit:cover;display:block;background:#eef3f2}
      .adv-inhoud{padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px}
      .adv-titel{font-weight:700}
      .adv-etiket{font-size:13px;color:#5b5b5b}
      .adv-hoof-knoppies{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .adv-hoof-knoppies .kaart-aksie{margin:0;width:100%;padding:12px 8px;font-size:15px}
      .adv-stap-twee{background:#171717!important;border-color:#171717!important}
      .adv-ander-knoppies{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px}
      .adv-ander-knoppies .terug-skakel{font-size:13px;padding:2px 0;margin:0;background:none;border:0;color:#2f7f73;text-decoration:underline;cursor:pointer}
      .adv-vorm-agter{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;z-index:1000;overflow:auto;padding:24px 12px}
      .adv-vorm-agter[hidden]{display:none!important}
      .adv-vorm{background:#fff;border-radius:12px;max-width:560px;width:100%;padding:18px 18px 16px}
      .adv-vorm h3{margin:0 0 8px}
      .adv-vorm textarea{resize:vertical;font-family:inherit}
      .adv-vorm-knoppies{display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap}
      .adv-skrap{color:#EC5832;margin-left:auto}
      .adv-fout{color:#EC5832;font-size:14px;min-height:1em;margin:8px 0 0}
      .adv-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#171717;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;max-width:min(92vw,520px);text-align:center;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:2000}
      .adv-toast-sigbaar{opacity:1;transform:translateX(-50%) translateY(0)}
      @media (max-width:560px){.adv-lys{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", () => {
    styl();
    bou_skelet();
    document.querySelectorAll('.paneel-kieslys-item[data-afdeling="advertensies"]').forEach((b) => {
      b.addEventListener("click", () => {
        if ($("adv-vorm") && $("adv-vorm").hidden) laai();
      });
    });
  });
})();
