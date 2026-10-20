// public/js/fsp-verslae.js
//
// VERSLAGSKAKELS VIR SKOLE IN DIE FUTURE SHARP-PANEEL (Oktober 2026). Eie
// lêer, soos fsp-groepe.js: dit sit self die pil "Verslae" en sy afdeling by.
//
// Kies die skool en sy Google Drive-vouer; die paneel deel die vouer as kyker,
// teken die WhatsApp-beeld (fsp-verslag-beeld.js) en maak 'n eie skakel,
// /verslae/<slug>, wat na die vouer deurstuur. Die boodskap kom uit 'n
// sjabloon met {skool} en {skakel}, en gaan per WhatsApp of e-pos.
//
// Die bediener: netlify/functions/verslae.js en verslae-bladsy.js.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Tweetalig is in Oktober 2026 weggeneem; ou tweetalige skakels wys nog
  // reg (die naam bly hier), maar 'n mens kies net Afrikaans of English.
  const TAAL = { af: "Afrikaans", en: "English", tw: "Tweetalig" };
  const KIESBAAR = ["af", "en"];
  const ETIKET = { af: "Verslae", en: "Reports", tw: "Verslae · Reports" };
  const BESKRYWING = { af: "Julle skool se Future Sharp-verslae op een plek.", en: "Your school's Future Sharp reports in one place.", tw: "Julle skool se Future Sharp-verslae op een plek." };
  const MAANDE = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const kort = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.getDate() + " " + MAANDE[d.getMonth()] + " " + d.getFullYear() : ""; };
  const ANDER = "__ander__";

  const S = {
    google: { gekoppel: false }, skakels: [], skole: [], sjablone: null,
    vouers: null, vouer: null, vouer_soek: "", taal: "af",
    gekies: null, filter: "oop", soek: "", gelaai: false,
  };

  async function bediener(liggaam) {
    const r = await fetch("/.netlify/functions/verslae", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify(liggaam),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.fout || "Fout " + r.status);
    return data;
  }

  function kennis(teks) {
    const k = $("#fsp-kennis");
    if (!k) return;
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2800);
  }

  // ---------- Die beeld ----------
  async function beeld_data(skool, taal) {
    const c = document.createElement("canvas");
    await window.teken_verslag_beeld(c, { skool, taal });
    return { canvas: c, url: c.toDataURL("image/jpeg", 0.88) };
  }

  // ---------- Die boodskap ----------
  // {groet}: "Beste Pieter" met 'n voornaam, anders "Goeie dag".
  function groet(t, voornaam) {
    const v = String(voornaam || "").trim();
    return t === "en" ? (v ? "Dear " + v : "Good day") : (v ? "Beste " + v : "Goeie dag");
  }

  function boodskap(s, voornaam) {
    const sj = S.sjablone || {};
    const tale = s.taal === "tw" ? ["af", "en"] : [s.taal];
    return tale.map((t) => String(sj[t] || "").replace(/\{groet\}/g, groet(t, voornaam)).replace(/\{skool\}/g, s.skool).replace(/\{skakel\}/g, s.skakel)).join("\n\n---\n\n");
  }

  // Die handtekening onderaan die WhatsApp-boodskap: naam en titel.
  function hand_reels() {
    const h = S.handtekening;
    return h && h.naam ? [h.naam, h.titel].filter(Boolean).join("\n") : "Future Sharp";
  }
  const wa_teks = () => $("#fsv-teks").value.replace(/\s+$/, "") + "\n" + hand_reels();

  // ---------- Bou die afdeling ----------
  function bou() {
    const nav = $("#fsp-kieslys");
    const vraelyste = $('section[data-afdeling="vraelyste"]');
    if (!nav || !vraelyste || $('[data-gaan="verslae"]', nav)) return;

    const pil = document.createElement("button");
    pil.type = "button";
    pil.className = "fsp-pil";
    pil.dataset.gaan = "verslae";
    pil.textContent = "Verslae";
    const voor = $('[data-gaan="groepe"]', nav) || $('[data-gaan="leerders"]', nav);
    if (voor) voor.insertAdjacentElement("afterend", pil);
    else nav.appendChild(pil);

    const afd = document.createElement("section");
    afd.className = "fsp-afdeling";
    afd.dataset.afdeling = "verslae";
    afd.innerHTML =
      '<div id="fsv-opstel"></div>' +
      '<div class="fsp-kaart" id="fsv-nuut" hidden>' +
        "<h2>Nuwe verslagskakel</h2>" +
        '<p class="fsp-hulp fsp-hulp-bo">Kies die skool en die Google Drive-vouer met sy verslae. Die paneel deel die vouer sodat enigiemand met die skakel dit kan oopmaak en lees (kyker, nie redigeerder nie), en maak \'n eie Future Sharp-skakel met die skool se beeld vir WhatsApp en e-pos.</p>' +
        '<div class="fsv-rooster">' +
          "<div>" +
            '<div class="fsp-veld"><label class="fsp-et" for="fsv-skool">Skool</label>' +
              '<select id="fsv-skool" class="fsp-invoer"></select>' +
              '<input id="fsv-skool-ander" class="fsp-invoer fsv-ander" maxlength="120" placeholder="Tik die skool se naam" hidden>' +
              '<p class="fsp-hulp">Die skole kom uit Groepskakels. Kies "\'n Ander skool" om \'n nuwe naam te tik.</p></div>' +
            '<div class="fsp-veld"><span class="fsp-et">Taal op die beeld en in die boodskap</span>' +
              '<div class="fsp-filters fsv-taal" id="fsv-taal">' + KIESBAAR.map((t) => '<button type="button" class="fsp-filter' + (t === "af" ? " aan" : "") + '" data-taal="' + t + '">' + TAAL[t] + "</button>").join("") + "</div></div>" +
          "</div>" +
          '<div class="fsp-veld"><span class="fsp-et">Google Drive-vouer</span>' +
            '<div class="fsv-vouers"><input class="fsv-soek" id="fsv-vouer-soek" placeholder="Soek" aria-label="Soek \'n vouer"><div class="fsv-vouer-lys" id="fsv-vouer-lys"><div class="fsv-vouer-leeg">Word gelaai …</div></div></div>' +
            '<div class="fsv-deel nog" id="fsv-deel-nota">Wanneer jy die skakel skep, deel die paneel die vouer: enigiemand met die skakel kan kyk.</div>' +
            '<p class="fsp-hulp">Is die vouer nie in die lys nie? <button type="button" class="fsv-skakelknop" id="fsv-plak-wys">Plak sy skakel</button></p>' +
            '<div class="fsv-plak" id="fsv-plak"><input class="fsp-invoer" id="fsv-plak-skakel" placeholder="https://drive.google.com/drive/folders/…"></div>' +
          "</div>" +
        "</div>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsv-skep">Skep die skakel</button></div>' +
      "</div>" +
      '<div id="fsv-uit" hidden></div>' +
      '<div id="fsv-lys-blok" hidden>' +
        '<div class="fsp-filters"><input type="search" id="fsv-soek" placeholder="Soek op skool" aria-label="Soek"></div>' +
        '<div class="fsp-filters" id="fsv-filters" role="group" aria-label="Filter"></div>' +
        '<div class="fsp-lys" id="fsv-lys"></div>' +
      "</div>" +
      '<div id="fsv-meer"></div>';
    vraelyste.insertAdjacentElement("beforebegin", afd);

    pil.addEventListener("click", wys);
    afd.addEventListener("click", klik);
    afd.addEventListener("change", verander);
    afd.addEventListener("input", invoer);
    afd.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.slug) { e.preventDefault(); kies(e.target.dataset.slug); }
    });
  }

  function wys() {
    for (const a of $$(".fsp-afdeling")) a.classList.toggle("wys", a.dataset.afdeling === "verslae");
    for (const p of $$("#fsp-kieslys .fsp-pil")) p.classList.toggle("aktief", p.dataset.gaan === "verslae");
    laai();
  }

  async function laai() {
    try {
      neem(await bediener({ aksie: "stand" }));
      teken();
      if (S.google.gekoppel && S.google.hoofvouer) laai_vouers();
    } catch (f) {
      $("#fsv-opstel").innerHTML = '<div class="fsp-kaart"><p class="fsp-waarsku">Kon nie laai nie: ' + esc(f.message) + "</p></div>";
    }
  }

  function neem(d) {
    S.google = d.google || S.google;
    S.skakels = d.skakels || S.skakels;
    S.skole = d.skole || S.skole;
    S.sjablone = d.sjablone || S.sjablone;
    if ("handtekening" in d) S.handtekening = d.handtekening;
    if ("epos_gereed" in d) S.epos_gereed = d.epos_gereed;
    S.gelaai = true;
  }

  async function laai_vouers() {
    try {
      S.vouers = (await bediener({ aksie: "vouers" })).vouers || [];
    } catch (f) {
      S.vouers = [];
      $("#fsv-vouer-lys").innerHTML = '<div class="fsv-vouer-leeg">Kon nie die vouers laai nie: ' + esc(f.message) + "</div>";
      return;
    }
    if (!S.vouer) pas_vouer();
    teken_vouers();
  }

  // ---------- Teken ----------
  function teken() {
    const klaar = S.google.gekoppel && S.google.hoofvouer;
    teken_opstel();
    $("#fsv-nuut").hidden = !klaar;
    $("#fsv-lys-blok").hidden = !S.skakels.length;
    if (klaar) teken_skole();
    teken_lys();
    teken_meer();
  }

  function teken_opstel() {
    const o = $("#fsv-opstel");
    if (S.google.gekoppel && S.google.hoofvouer) { o.innerHTML = ""; return; }
    if (!S.google.gekoppel) {
      o.innerHTML =
        '<div class="fsp-kaart">' +
          "<h2>Koppel Google Drive</h2>" +
          '<p class="fsp-hulp fsp-hulp-bo">Eenmalig. Die paneel kry \'n eie Google-rekening (\'n diensrekening) wat net die vouers sien wat julle met hom deel.</p>' +
          '<ol class="fsv-stappe">' +
            '<li>Gaan na <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> en kies die projek waarin FSVS loop (of skep \'n nuwe projek).</li>' +
            '<li>Soek <b>Google Drive API</b> en klik <b>Enable</b>.</li>' +
            '<li>Gaan na <b>IAM &amp; Admin › Service Accounts</b>, klik <b>Create service account</b> en noem dit <code>verslae</code>. Rolle is nie nodig nie; klik net <b>Done</b>.</li>' +
            '<li>Klik op die nuwe diensrekening, gaan na <b>Keys › Add key › Create new key</b>, kies <b>JSON</b>. \'n Lêer word afgelaai.</li>' +
            "<li>Laai daardie lêer hier op.</li>" +
          "</ol>" +
          '<div class="fsp-aksies"><label class="fsp-knop fsp-knop-hoof" for="fsv-sleutel">Laai die JSON-lêer op</label><input type="file" id="fsv-sleutel" accept=".json,application/json" hidden></div>' +
          '<p class="fsp-hulp">Die sleutel word veilig op die bediener gestoor en nooit weer gewys nie. Vee die afgelaaide lêer daarna van jou rekenaar af.</p>' +
        "</div>";
      return;
    }
    o.innerHTML =
      '<div class="fsp-kaart">' +
        "<h2>Kies die hoofvouer</h2>" +
        '<p class="fsp-hulp fsp-hulp-bo">Google Drive is gekoppel. Deel nou die hoofvouer met die skole se vouers daarin (bv. <b>Future Sharp Verslae 2026</b>) met hierdie adres, as <b>Redigeerder</b> (Editor):</p>' +
        '<div class="fsp-ry-knop"><code class="fsv-epos-sa" id="fsv-sa">' + esc(S.google.epos) + '</code><button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsv-sa">Kopieer</button></div>' +
        '<p class="fsp-hulp">In Google Drive: regsklik op die vouer › <b>Share</b> › plak die adres › kies <b>Editor</b> › haal die merkie by <b>Notify people</b> af › <b>Share</b>. Redigeerder is nodig sodat die paneel die skole se vouers kan deel; die paneel verander of skrap nooit lêers nie.</p>' +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsv-hoof-soek">Ek het gedeel: wys die vouers</button></div>' +
        '<div id="fsv-hoof-lys"></div>' +
      "</div>";
  }

  function teken_skole() {
    const sel = $("#fsv-skool");
    const huidig = sel.value;
    sel.innerHTML = '<option value="">Kies die skool</option>' +
      S.skole.map((n) => '<option value="' + esc(n) + '">' + esc(n) + "</option>").join("") +
      '<option value="' + ANDER + '">+ \'n Ander skool …</option>';
    if (huidig && [...sel.options].some((o) => o.value === huidig)) sel.value = huidig;
    $("#fsv-skool-ander").hidden = sel.value !== ANDER;
  }

  function gekose_skool() {
    const v = $("#fsv-skool").value;
    return (v === ANDER ? $("#fsv-skool-ander").value : v).trim();
  }

  // Kies vanself die vouer met dieselfde naam as die skool.
  function pas_vouer() {
    const skool = gekose_skool().toLowerCase();
    if (!skool || !S.vouers) return;
    const v = S.vouers.find((x) => x.naam.trim().toLowerCase() === skool) ||
      S.vouers.find((x) => x.naam.toLowerCase().includes(skool) || skool.includes(x.naam.toLowerCase()));
    if (v) { S.vouer = v.id; $("#fsv-plak-skakel").value = ""; }
  }

  function teken_vouers() {
    const lys = $("#fsv-vouer-lys");
    if (!S.vouers) return;
    const q = S.vouer_soek.trim().toLowerCase();
    const sigbaar = S.vouers.filter((v) => !q || v.naam.toLowerCase().includes(q));
    lys.innerHTML = sigbaar.length
      ? sigbaar.map((v) => '<button type="button" class="fsv-vouer' + (v.id === S.vouer ? " aan" : "") + '" data-vouer="' + esc(v.id) + '"><span class="fsv-ik"></span>' + esc(v.naam) + "<small>" + esc(kort(v.verander)) + "</small></button>").join("")
      : '<div class="fsv-vouer-leeg">' + (S.vouers.length ? "Geen vouer pas nie." : "Die hoofvouer (" + esc(S.google.hoofvouer.naam) + ") het nog geen subvouers nie. Skep een per skool in Google Drive.") + "</div>";
    $("#fsv-vouer-soek").placeholder = "Soek in " + S.google.hoofvouer.naam;
    const plak = $("#fsv-plak-skakel").value.trim();
    const nota = $("#fsv-deel-nota");
    nota.className = "fsv-deel nog";
    nota.textContent = S.vouer || plak
      ? "Wanneer jy die skakel skep, deel die paneel die vouer: enigiemand met die skakel kan kyk."
      : "Kies die skool se vouer.";
  }

  function teken_taal() {
    for (const b of $$("#fsv-taal .fsp-filter")) b.classList.toggle("aan", b.dataset.taal === S.taal);
  }

  function teken_lys() {
    const blok = $("#fsv-lys-blok");
    if (!blok) return;
    const oop = S.skakels.filter((s) => s.oop).length;
    $("#fsv-filters").innerHTML =
      '<button type="button" class="fsp-filter' + (S.filter === "oop" ? " aan" : "") + '" data-filter="oop">Aktief <b>' + oop + "</b></button>" +
      '<button type="button" class="fsp-filter' + (S.filter === "toe" ? " aan" : "") + '" data-filter="toe">Onaktief <b>' + (S.skakels.length - oop) + "</b></button>";
    const q = S.soek.trim().toLowerCase();
    const lys = S.skakels.filter((s) => (S.filter === "oop" ? s.oop : !s.oop) && (!q || s.skool.toLowerCase().includes(q)));
    $("#fsv-lys").innerHTML = lys.length
      ? lys.map((s) =>
          '<div class="fsp-ry" role="button" tabindex="0" data-slug="' + esc(s.slug) + '" data-stand="' + (s.oop ? "gereel" : "verval") + '">' +
            '<div class="fsp-ry-no">' + esc(kort(s.geskep_op)) + "</div>" +
            '<div><div class="fsp-ry-naam">' + esc(s.skool) + '</div><div class="fsp-ry-sub">' + esc(ETIKET[s.taal] + " · " + TAAL[s.taal] + " · Drive › " + s.vouer_naam) + "</div></div>" +
            '<div><span class="fsp-stand ' + (s.oop ? "gereel" : "verval") + '">' + (s.oop ? "Aktief" : "Onaktief") + "</span></div>" +
          "</div>").join("")
      : '<p class="fsp-leeg">Niks hier nie.</p>';
    blok.hidden = !S.skakels.length;
  }

  function teken_meer() {
    const m = $("#fsv-meer");
    if (!S.google.gekoppel) { m.innerHTML = ""; return; }
    const sj = S.sjablone || {};
    m.innerHTML =
      '<details class="fsv-meer"><summary>Boodskappe vir verslagskakels</summary><div>' +
        '<p class="fsp-hulp fsp-hulp-bo"><b>{groet}</b> word "Beste Pieter" as julle \'n voornaam intik (anders "Goeie dag"), <b>{skool}</b> die skool se naam en <b>{skakel}</b> die skakel. Die handtekening van wie stuur, kom vanself onderaan.</p>' +
        '<div class="fsv-sj-twee">' +
          '<label><span class="fsp-klein-et">Afrikaans</span><textarea class="fsp-invoer" id="fsv-sj-af" rows="11">' + esc(sj.af || "") + "</textarea></label>" +
          '<label><span class="fsp-klein-et">English</span><textarea class="fsp-invoer" id="fsv-sj-en" rows="11">' + esc(sj.en || "") + "</textarea></label>" +
        "</div>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsv-sj-stoor">Stoor die boodskappe</button></div>' +
      "</div></details>" +
      '<details class="fsv-meer" id="fsv-hand-kaart"><summary>My handtekening</summary><div>' +
        '<p class="fsp-hulp fsp-hulp-bo">Eenmalig, vir jou eie aanmelding. Dit kom onderaan elke verslae-boodskap wat jy stuur, en antwoorde op die e-pos gaan na die adres hier.</p>' +
        '<div class="fsv-aan">' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-h-naam">Naam soos dit onderaan staan</label><input class="fsp-invoer" id="fsv-h-naam" maxlength="80" placeholder="Bv. Prof. Ignatius Gous" value="' + esc((S.handtekening || {}).naam || "") + '"></div>' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-h-titel">Titel <span class="fsv-klein">(opsioneel)</span></label><input class="fsp-invoer" id="fsv-h-titel" maxlength="100" placeholder="Bv. Direkteur, Future Sharp NPC" value="' + esc((S.handtekening || {}).titel || "") + '"></div>' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-h-epos">E-posadres vir antwoorde</label><input class="fsp-invoer" id="fsv-h-epos" type="email" maxlength="120" value="' + esc((S.handtekening || {}).epos || "") + '"></div>' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-h-sel">Selfoon <span class="fsv-klein">(opsioneel, net in die e-pos)</span></label><input class="fsp-invoer" id="fsv-h-sel" maxlength="30" value="' + esc((S.handtekening || {}).selfoon || "") + '"></div>' +
        "</div>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsv-h-stoor">Stoor my handtekening</button></div>' +
      "</div></details>" +
      '<details class="fsv-meer"><summary>Google-koppeling</summary><div>' +
        '<p class="fsp-hulp fsp-hulp-bo">Die paneel se Google-adres. Enige vouer wat die paneel moet sien, word met hierdie adres gedeel.</p>' +
        '<div class="fsp-ry-knop"><code class="fsv-epos-sa" id="fsv-sa2">' + esc(S.google.epos) + '</code><button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsv-sa2">Kopieer</button></div>' +
        '<p class="fsp-hulp">Hoofvouer: <b>' + esc(S.google.hoofvouer ? S.google.hoofvouer.naam : "nog nie gekies nie") + "</b></p>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-lig" id="fsv-hoof-ander">Kies \'n ander hoofvouer</button>' +
        '<label class="fsp-knop fsp-knop-lig" for="fsv-sleutel2">Vervang die sleutel</label><input type="file" id="fsv-sleutel2" accept=".json,application/json" hidden></div>' +
        '<div id="fsv-hoof-lys2"></div>' +
      "</div></details>";
  }

  // ---------- Een skakel ----------
  async function kies(slug) {
    S.gekies = slug;
    const s = S.skakels.find((x) => x.slug === slug);
    const uit = $("#fsv-uit");
    if (!s) { uit.hidden = true; return; }
    const titel = s.skool + " · Future Sharp " + ETIKET[s.taal];
    uit.innerHTML =
      '<div class="fsp-strook">' +
        '<div class="fsp-strook-titel">' + esc(s.skool) + " · " + esc(ETIKET[s.taal]) + (s.oop ? "" : ' <span class="fsp-stand verval">Onaktief</span>') + "</div>" +
        '<span class="fsp-strook-taal">Skakel</span>' +
        '<code id="fsv-skakel">' + esc(s.skakel) + "</code>" +
        '<button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsv-skakel">Kopieer</button>' +
      "</div>" +
      '<div class="fsp-epos"><div class="fsv-uit">' +
        '<div class="fsv-wa"><div class="fsv-wa-et">So lyk dit in WhatsApp</div><div class="fsv-wa-bel">' +
          '<div class="fsv-wa-kaart"><img id="fsv-wa-beeld" src="/verslae-beeld/' + esc(s.slug) + ".jpg?v=" + (s.beeld_v || 1) + '" alt="">' +
            '<div class="t">' + esc(titel) + '</div><div class="d">' + esc(BESKRYWING[s.taal]) + '</div><div class="u">futureshop.futuresharp.co.za</div></div>' +
          '<div class="fsv-wa-teks" id="fsv-wa-teks"></div><div class="fsv-wa-tyd">✓✓</div>' +
        "</div></div>" +
        "<div>" +
          '<div class="fsp-epos-titel">Stuur aan</div>' +
          '<div class="fsp-epos-hulp">Die voornaam en jou handtekening gaan in albei: WhatsApp en e-pos.</div>' +
          '<div class="fsv-aan fsv-aan3">' +
            '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-voornaam">Voornaam <span class="fsv-klein">(opsioneel)</span></label><input class="fsp-invoer" id="fsv-voornaam" maxlength="60" placeholder="Bv. Pieter" autocomplete="off"></div>' +
            '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-sel">Selfoon</label><input class="fsp-invoer" id="fsv-sel" inputmode="tel" placeholder="082 123 4567"></div>' +
            '<div class="fsp-veld"><label class="fsp-klein-et" for="fsv-epos">E-posadres</label><input class="fsp-invoer" id="fsv-epos" type="email" placeholder="hoof@skool.co.za"></div>' +
          "</div>" +
          '<div class="fsv-hand" id="fsv-hand"></div>' +
          '<div class="fsp-epos-titel" style="margin-top:12px">Boodskap</div>' +
          '<div class="fsp-epos-hulp">Uit die sjabloon; die voornaam, die skool en die skakel word ingevul en jou handtekening kom vanself onderaan. Pas gerus aan voor jy stuur.</div>' +
          '<textarea class="fsp-invoer" id="fsv-teks" rows="10">' + esc(boodskap(s, "")) + "</textarea>" +
          '<label class="fsv-chk"><input type="checkbox" id="fsv-afskrif" checked> Stuur vir my \'n afskrif van die e-pos</label>' +
          '<div class="fsp-epos-ry">' +
            '<button type="button" class="fsp-knop fsp-knop-wa" id="fsv-wa"' + (s.oop ? "" : " disabled") + ">Stuur op WhatsApp</button>" +
            '<button type="button" class="fsp-knop fsp-knop-hoof" id="fsv-pos"' + (s.oop && S.epos_gereed ? "" : " disabled") + ">Stuur e-pos</button>" +
            '<button type="button" class="fsp-knop fsp-knop-lig" id="fsv-kopieer">Kopieer boodskap</button>' +
            '<a class="fsp-knop fsp-knop-lig" href="/verslae-beeld/' + esc(s.slug) + ".jpg?v=" + (s.beeld_v || 1) + '" download="' + esc(s.slug) + '.jpg">Laai beeld af</a>' +
          "</div>" +
          (S.epos_gereed ? "" : '<p class="fsp-waarsku">Stuur e-pos werk sodra die verslae@-posbus se wagwoord in Netlify gestel is.</p>') +
          '<p class="fsp-hulp">WhatsApp maak oop op jou eie foon of rekenaar met die boodskap klaar ingetik, en gaan dus uit jou eie WhatsApp. Die e-pos gaan uit verslae@futuresharp.co.za met jou naam as afsender; antwoorde gaan na jou adres.</p>' +
          (s.gestuur && s.gestuur.length ? '<p class="fsp-hulp">Laas per e-pos gestuur: ' + esc(s.gestuur[0].aan.join(", ")) + " op " + kort(s.gestuur[0].op) + "</p>" : "") +
          '<div class="fsv-deel nog" id="fsv-deel-stand">' + (s.oop ? "Kyk of die vouer nog gedeel is …" : "Die vouer word nie meer gedeel nie.") + "</div>" +
          '<div class="fsv-wysig"><span class="fsp-klein-et">Taal</span>' +
            KIESBAAR.map((t) => '<button type="button" class="fsp-filter' + (t === s.taal ? " aan" : "") + '" data-wtaal="' + t + '">' + TAAL[t] + "</button>").join("") +
          "</div>" +
          '<p class="fsp-hulp"><a href="' + esc(s.drive) + '" target="_blank" rel="noopener">Drive › ' + esc(s.vouer_naam) + "</a> · geskep " + kort(s.geskep_op) + (s.oop ? "" : " · gedeaktiveer " + kort(s.gesluit_op)) + "</p>" +
          '<div class="fsp-aksies"><button type="button" class="fsp-knop ' + (s.oop ? "fsp-knop-gevaar" : "fsp-knop-lig") + '" id="fsv-sluit">' + (s.oop ? "Deaktiveer die skakel" : "Aktiveer weer") + "</button></div>" +
          (s.oop ? "" :
            '<div class="fsp-toets-skrap"><b>Skrap hierdie verslagskakel</b>' +
            '<p class="fsp-hulp">Tik <b>' + esc(s.skool) + "</b> om te bevestig. Die vouer en die verslae in Google Drive bly staan.</p>" +
            '<div class="fsp-skrap-ry"><input type="text" class="fsp-invoer" id="fsv-skrap-naam" autocomplete="off" placeholder="' + esc(s.skool) + '">' +
            '<button type="button" class="fsp-knop fsp-knop-gevaar" id="fsv-skrap" disabled>Skrap</button></div></div>') +
        "</div>" +
      "</div></div>";
    S.groet_nou = { af: groet("af", ""), en: groet("en", "") };
    teken_hand();
    teken_wa_teks();
    uit.hidden = false;
    uit.scrollIntoView({ behavior: "smooth", block: "start" });
    if (s.oop) {
      try {
        const d = await bediener({ aksie: "kontroleer", slug });
        const el = $("#fsv-deel-stand");
        if (!el || S.gekies !== slug) return;
        el.className = "fsv-deel" + (d.gedeel ? "" : " fout");
        el.innerHTML = d.gedeel
          ? "✓ <span><b>Gedeel:</b> enigiemand met die skakel kan kyk</span>"
          : '<span><b>Nie meer gedeel nie.</b> Iemand het die deling in Drive verander. <button type="button" class="fsv-skakelknop" id="fsv-deel-weer">Deel weer as kyker</button></span>';
      } catch (f) {
        const el = $("#fsv-deel-stand");
        if (el) { el.className = "fsv-deel fout"; el.textContent = "Kon nie die deling nagaan nie: " + f.message; }
      }
    }
  }

  function teken_wa_teks() {
    const s = S.skakels.find((x) => x.slug === S.gekies);
    const el = $("#fsv-wa-teks");
    if (!s || !el) return;
    el.innerHTML = esc(wa_teks()).split(esc(s.skakel)).join("<a>" + esc(s.skakel) + "</a>");
  }

  function teken_hand() {
    const el = $("#fsv-hand");
    if (!el) return;
    const h = S.handtekening;
    el.innerHTML = h && h.naam
      ? '<div><span class="fsp-klein-et">Onderteken deur</span><div><b>' + esc(h.naam) + "</b>" + (h.titel ? " · " + esc(h.titel) : "") + (h.epos ? '<div class="fsv-klein">Antwoorde na ' + esc(h.epos) + "</div>" : "") + "</div></div>" +
        '<button type="button" class="fsv-skakelknop" id="fsv-hand-wysig">Wysig my handtekening</button>'
      : '<div><span class="fsp-klein-et">Onderteken deur</span><div>Nog geen handtekening nie; die boodskap eindig met <b>Future Sharp</b>.</div></div>' +
        '<button type="button" class="fsv-skakelknop" id="fsv-hand-wysig">Stel my handtekening op</button>';
  }

  // Die voornaam verander die eerste reël, ook as die res al aangepas is.
  function verander_voornaam(v) {
    const t = $("#fsv-teks");
    let x = t.value;
    for (const taal of ["af", "en"]) {
      const ou = S.groet_nou[taal], nuut = groet(taal, v);
      if (ou && x.includes(ou)) x = x.replace(ou, nuut);
      S.groet_nou[taal] = nuut;
    }
    t.value = x;
    teken_wa_teks();
  }

  function wys_handtekening_vorm() {
    const d = $("#fsv-hand-kaart");
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
    const n = $("#fsv-h-naam");
    if (n) setTimeout(() => n.focus(), 400);
  }

  async function stoor_handtekening(knop) {
    knop.disabled = true;
    try {
      const d = await bediener({ aksie: "stoor_handtekening", handtekening: { naam: $("#fsv-h-naam").value, titel: $("#fsv-h-titel").value, epos: $("#fsv-h-epos").value, selfoon: $("#fsv-h-sel").value } });
      S.handtekening = d.handtekening;
      teken_hand();
      teken_wa_teks();
      kennis("Handtekening gestoor");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
    }
  }

  async function stuur_epos(knop) {
    const s = S.skakels.find((x) => x.slug === S.gekies);
    if (!s) return;
    const aan = $("#fsv-epos").value.trim();
    if (!aan) { $("#fsv-epos").focus(); return kennis("Tik die e-posadres"); }
    if (!confirm("Stuur die e-pos aan " + aan + "?")) return;
    knop.disabled = true;
    knop.textContent = "Stuur …";
    try {
      const d = await bediener({ aksie: "stuur_epos", slug: s.slug, aan, boodskap: $("#fsv-teks").value, afskrif: $("#fsv-afskrif").checked });
      Object.assign(s, d.skakel);
      kennis("E-pos gestuur aan " + d.gestuur.join(", "));
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
      knop.textContent = "Stuur e-pos";
    }
  }

  async function kopieer_boodskap() {
    const t = wa_teks();
    try { await navigator.clipboard.writeText(t); }
    catch (_) { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); }
    kennis("Gekopieer");
  }

  // ---------- Aksies ----------
  async function skep(knop) {
    const skool = gekose_skool();
    const vouer = $("#fsv-plak-skakel").value.trim() || S.vouer;
    if (skool.length < 2) return kennis("Kies of tik die skool se naam");
    if (!vouer) return kennis("Kies die skool se vouer");
    knop.disabled = true;
    knop.textContent = "Besig …";
    try {
      const { url } = await beeld_data(skool, S.taal);
      const d = await bediener({ aksie: "skep", skool, vouer, taal: S.taal, beeld: url });
      S.skakels.unshift(d.skakel);
      if (!S.skole.includes(skool)) { S.skole.push(skool); S.skole.sort((a, b) => a.localeCompare(b, "af")); }
      S.filter = "oop";
      $("#fsv-skool").value = "";
      $("#fsv-skool-ander").value = "";
      $("#fsv-plak-skakel").value = "";
      S.vouer = null;
      teken_skole();
      teken_vouers();
      teken_lys();
      kies(d.skakel.slug);
      kennis("Skakel geskep en die vouer gedeel");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
      knop.textContent = "Skep die skakel";
    }
  }

  async function verander_taal(taal) {
    const s = S.skakels.find((x) => x.slug === S.gekies);
    if (!s || s.taal === taal) return;
    try {
      const { url } = await beeld_data(s.skool, taal);
      const d = await bediener({ aksie: "wysig", slug: s.slug, taal, beeld: url });
      Object.assign(s, d.skakel);
      teken_lys();
      kies(s.slug);
      kennis("Taal: " + TAAL[taal]);
    } catch (f) {
      kennis(f.message);
    }
  }

  async function sluit(knop) {
    const s = S.skakels.find((x) => x.slug === S.gekies);
    if (!s) return;
    if (s.oop && !confirm("Deaktiveer die skakel vir " + s.skool + "? Die vouer word dan ook nie meer met enigiemand met die skakel gedeel nie.")) return;
    knop.disabled = true;
    try {
      const d = await bediener({ aksie: "sluit", slug: s.slug, oop: !s.oop });
      Object.assign(s, d.skakel);
      teken_lys();
      kies(s.slug);
      kennis(s.oop ? "Die skakel is weer aktief en die vouer gedeel" : "Die skakel is gedeaktiveer");
    } catch (f) {
      kennis(f.message);
      knop.disabled = false;
    }
  }

  async function deel_weer() {
    const s = S.skakels.find((x) => x.slug === S.gekies);
    if (!s) return;
    try {
      await bediener({ aksie: "sluit", slug: s.slug, oop: true });
      kies(s.slug);
      kennis("Die vouer is weer gedeel");
    } catch (f) { kennis(f.message); }
  }

  async function skrap(knop) {
    const s = S.skakels.find((x) => x.slug === S.gekies);
    if (!s) return;
    knop.disabled = true;
    try {
      await bediener({ aksie: "skrap", slug: s.slug, naam: $("#fsv-skrap-naam").value.trim() });
      S.skakels = S.skakels.filter((x) => x.slug !== s.slug);
      S.gekies = null;
      $("#fsv-uit").hidden = true;
      teken_lys();
      kennis("Verslagskakel geskrap");
    } catch (f) {
      kennis(f.message);
      knop.disabled = false;
    }
  }

  // 082 123 4567 of +27 82 123 4567 -> 27821234567
  function wa_nommer(teks) {
    let n = String(teks || "").replace(/[^\d+]/g, "");
    if (!n) return "";
    if (n.startsWith("+")) n = n.slice(1);
    else if (n.startsWith("00")) n = n.slice(2);
    else if (n.startsWith("0")) n = "27" + n.slice(1);
    return /^\d{8,15}$/.test(n) ? n : null;
  }

  function stuur_wa() {
    const n = wa_nommer($("#fsv-sel").value);
    if (n === null) return kennis("Die selfoonnommer lyk nie reg nie");
    window.open("https://wa.me/" + n + "?text=" + encodeURIComponent(wa_teks()), "_blank", "noopener");
  }


  async function laai_sleutel(inv) {
    const lêer = inv.files && inv.files[0];
    if (!lêer) return;
    try {
      const teks = await lêer.text();
      kennis("Koppel …");
      neem(await bediener({ aksie: "stoor_sleutel", sleutel: teks }));
      teken();
      kennis("Google Drive is gekoppel");
    } catch (f) {
      kennis(f.message);
    } finally {
      inv.value = "";
    }
  }

  async function wys_hoofvouers(houer) {
    houer.innerHTML = '<p class="fsp-leeg">Word gelaai …</p>';
    try {
      const { vouers } = await bediener({ aksie: "hoofvouers" });
      houer.innerHTML = vouers.length
        ? '<div class="fsv-vouers" style="margin-top:12px"><div class="fsv-vouer-lys">' +
            vouers.map((v) => '<button type="button" class="fsv-vouer" data-hoof="' + esc(v.id) + '"><span class="fsv-ik"></span>' + esc(v.naam) + "<small>Kies</small></button>").join("") +
          "</div></div>"
        : '<p class="fsp-waarsku">Nog geen vouer is met die paneel gedeel nie. Google kan \'n minuut of twee neem; probeer dan weer.</p>';
    } catch (f) {
      houer.innerHTML = '<p class="fsp-waarsku">' + esc(f.message) + "</p>";
    }
  }

  async function stel_hoofvouer(id) {
    try {
      neem(await bediener({ aksie: "stel_hoofvouer", vouer: id }));
      S.vouers = null;
      S.vouer = null;
      teken();
      laai_vouers();
      kennis("Hoofvouer: " + S.google.hoofvouer.naam);
    } catch (f) { kennis(f.message); }
  }

  async function stoor_sjablone(knop) {
    knop.disabled = true;
    try {
      const d = await bediener({ aksie: "stoor_sjablone", sjablone: { af: $("#fsv-sj-af").value, en: $("#fsv-sj-en").value } });
      S.sjablone = d.sjablone;
      kennis("Boodskappe gestoor");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
    }
  }

  // ---------- Gebeure ----------
  function klik(e) {
    const b = e.target.closest("button, .fsp-ry[data-slug]");
    if (!b) return;
    if (b.dataset.taal) { S.taal = b.dataset.taal; teken_taal(); return; }
    if (b.dataset.wtaal) return verander_taal(b.dataset.wtaal);
    if (b.dataset.vouer) { S.vouer = b.dataset.vouer; $("#fsv-plak-skakel").value = ""; teken_vouers(); return; }
    if (b.dataset.hoof) return stel_hoofvouer(b.dataset.hoof);
    if (b.dataset.filter) { S.filter = b.dataset.filter; teken_lys(); return; }
    if (b.dataset.slug) return kies(b.dataset.slug);
    switch (b.id) {
      case "fsv-skep": return skep(b);
      case "fsv-sluit": return sluit(b);
      case "fsv-skrap": return skrap(b);
      case "fsv-wa": return stuur_wa();
      case "fsv-pos": return stuur_epos(b);
      case "fsv-kopieer": return kopieer_boodskap();
      case "fsv-hand-wysig": return wys_handtekening_vorm();
      case "fsv-h-stoor": return stoor_handtekening(b);
      case "fsv-deel-weer": return deel_weer();
      case "fsv-sj-stoor": return stoor_sjablone(b);
      case "fsv-hoof-soek": return wys_hoofvouers($("#fsv-hoof-lys"));
      case "fsv-hoof-ander": return wys_hoofvouers($("#fsv-hoof-lys2"));
      case "fsv-plak-wys": $("#fsv-plak").classList.toggle("wys"); $("#fsv-plak-skakel").focus(); return;
    }
  }

  function verander(e) {
    const id = e.target.id;
    if (id === "fsv-skool") {
      $("#fsv-skool-ander").hidden = e.target.value !== ANDER;
      if (e.target.value === ANDER) $("#fsv-skool-ander").focus();
      else { pas_vouer(); teken_vouers(); }
    }
    if (id === "fsv-sleutel" || id === "fsv-sleutel2") laai_sleutel(e.target);
  }

  function invoer(e) {
    const id = e.target.id;
    if (id === "fsv-vouer-soek") { S.vouer_soek = e.target.value; teken_vouers(); }
    if (id === "fsv-plak-skakel") { if (e.target.value.trim()) S.vouer = null; teken_vouers(); }
    if (id === "fsv-soek") { S.soek = e.target.value; teken_lys(); }
    if (id === "fsv-teks") teken_wa_teks();
    if (id === "fsv-voornaam") verander_voornaam(e.target.value);
    if (id === "fsv-skrap-naam") {
      const s = S.skakels.find((x) => x.slug === S.gekies);
      $("#fsv-skrap").disabled = !s || e.target.value.trim() !== s.skool;
    }
  }

  document.addEventListener("DOMContentLoaded", bou);
})();
