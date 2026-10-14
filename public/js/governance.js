// public/js/governance.js
//
// Die Governance-area: Future Sharp NPC se bestuurs- en nakomingsdokumente,
// volgens die Future Sharp Directory (Oktober 2026).
//
// DRIE FUNCTIONS, almal met die boekhouding-rol:
//   gov          metadata, een POST met 'n aksie
//   gov-laai-op  'n lêer oplaai (base64 in JSON, hoogstens 4 MB)
//   gov-aflaai   'n lêer haal; die blaaier stuur die Authorization-kop, dus
//                word die lêer as blob gehaal en plaaslik oopgemaak
//
// Die skerm is nie die slot nie. Elke Function dwing die rol self af.
//
// DIE VOUERS. Die hoofafdelings en subvouers kom van die bediener. Elke
// hoofafdeling het 'n Work in Progress (id "NN.W") en daar is een argief
// (id "7"). Sperdatums staan by 01.1 en 03.1; die besluiteregister by 01.2.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ARGIEF = "7";
  const MET_SPER = ["01.1", "03.1"];
  const MET_BESLUITE = ["01.2"];
  const MAKS_GREPE = 4 * 1024 * 1024;
  const BEKYKBAAR = ["pdf", "jpg", "png"];
  const SOORT_NAAM = { direksievergadering: "Direksievergadering", skriftelik: "Skriftelike besluit", lede: "Lede se besluit" };
  const HERHAAL_NAAM = { "": "Eenmalig", jaarliks: "Jaarliks", maandeliks: "Maandeliks" };
  const AKSIE_NAAM = { opgelaai: "Opgelaai", geskuif: "Geskuif", geargiveer: "Geargiveer", herstel: "Herstel", gewysig: "Gewysig" };
  const TIPES = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };

  let VOUERS = [];
  let DOKUMENTE = [];
  let SPERDATUMS = [];
  let BESLUITE = [];
  let VANDAG = "";
  let huidig = "oorsig";
  let soek = "";
  const oop_groepe = new Set();

  // ---------- Hulpies ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function datum_af(d) { return d ? String(d).slice(0, 10).replace(/-/g, "/") : ""; }
  function iso_sa(iso) {
    if (!iso) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date(iso));
  }
  function tyd_sa(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    return datum_af(iso_sa(iso)) + " " + t;
  }
  function dae_tot(d) { return Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(VANDAG + "T00:00:00Z")) / 86400000); }
  function dae_klas(n) { return n <= 14 ? "dringend" : n <= 45 ? "binnekort" : "ver"; }
  function dae_teks(n) {
    if (n < 0) return Math.abs(n) + (n === -1 ? " dag oorsy" : " dae oorsy");
    if (n === 0) return "vandag";
    return n + (n === 1 ? " dag" : " dae");
  }
  function grootte(g) {
    if (!g) return "";
    if (g < 1024 * 1024) return Math.max(1, Math.round(g / 1024)) + " KB";
    return (g / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
  }
  function wie(epos) {
    if (!epos) return "";
    return String(epos).split("@")[0];
  }
  function dok_tel(n) { return n + (n === 1 ? " dokument" : " dokumente"); }

  function kennis(teks) {
    const k = $("#gov-kennis");
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2600);
  }

  function wys_fout(id, teks) {
    const el = $("#" + id);
    if (!el) { kennis(teks); return; }
    el.textContent = teks;
    el.hidden = !teks;
  }

  // ---------- Vouers ----------
  function vouer_naam(id) {
    if (id === ARGIEF) return "07 Archive";
    for (const g of VOUERS) {
      if (id === g.id + ".W") return g.id + " " + g.titel + " · Work in Progress";
      for (const s of g.subs) if (s.id === id) return s.id + " " + s.titel;
    }
    if (/^\d\d$/.test(id)) {
      const g = VOUERS.find((x) => x.id === id);
      if (g) return g.id + " " + g.titel;
    }
    return id;
  }
  function kort_naam(id) {
    if (id === ARGIEF) return "07 Archive";
    for (const g of VOUERS) {
      if (id === g.id + ".W") return "Work in Progress";
      for (const s of g.subs) if (s.id === id) return s.id + " " + s.titel;
    }
    return id;
  }
  function vind_sub(id) {
    for (const g of VOUERS) {
      const s = g.subs.find((x) => x.id === id);
      if (s) return { groep: g, sub: s };
    }
    return null;
  }
  function in_groep(dok_vouer, groep_id) { return dok_vouer.split(".")[0] === groep_id && dok_vouer !== ARGIEF; }
  function tel_in(id) {
    if (id === ARGIEF) return DOKUMENTE.filter((d) => d.vouer === ARGIEF).length;
    if (/^\d\d$/.test(id)) return DOKUMENTE.filter((d) => in_groep(d.vouer, id)).length;
    return DOKUMENTE.filter((d) => d.vouer === id).length;
  }
  function vouer_opsies(uitsluit, gekies) {
    return VOUERS.map((g) =>
      '<optgroup label="' + esc(g.id + " " + g.titel) + '">' +
      g.subs.concat([{ id: g.id + ".W", titel: "Work in Progress" }])
        .filter((s) => s.id !== uitsluit)
        .map((s) => '<option value="' + esc(s.id) + '"' + (s.id === gekies ? " selected" : "") + ">" +
          esc(s.id.endsWith(".W") ? g.id + " Work in Progress" : s.id + " " + s.titel) + "</option>").join("") +
      "</optgroup>"
    ).join("");
  }

  // ---------- Bediener ----------
  async function sessie_verval() {
    kennis("Die sessie het verval. Meld weer aan.");
    if (typeof identiteit_verwyder_sessie === "function") identiteit_verwyder_sessie();
    setTimeout(() => window.location.reload(), 1600);
  }

  async function gov(liggaam) {
    const antwoord = await fetch("/.netlify/functions/gov", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify(liggaam),
    });
    const data = await antwoord.json().catch(() => ({}));
    if (antwoord.status === 401) { sessie_verval(); throw new Error(data.fout || "Sessie het verval"); }
    if (!antwoord.ok) throw new Error(data.fout || "Fout " + antwoord.status);
    return data;
  }

  async function laai() {
    const data = await gov({ aksie: "lys" });
    VOUERS = data.vouers || [];
    DOKUMENTE = data.dokumente || [];
    SPERDATUMS = data.sperdatums || [];
    BESLUITE = data.besluite || [];
    VANDAG = data.vandag || iso_sa(new Date().toISOString());
    teken();
  }

  function vervang_dok(dok) {
    const i = DOKUMENTE.findIndex((d) => d.id === dok.id);
    if (i >= 0) DOKUMENTE[i] = dok; else DOKUMENTE.push(dok);
  }

  // ---------- Teken ----------
  function teken() {
    teken_boom();
    teken_sperstrook();
    teken_inhoud();
  }

  function teken_boom() {
    if (/^\d\d\./.test(huidig)) oop_groepe.add(huidig.slice(0, 2));
    let h = '<button type="button" class="gov-boom-hoof' + (huidig === "oorsig" ? " aktief" : "") + '" data-vouer="oorsig"><span class="gov-pyl"></span>Oorsig</button><div class="gov-boom-skeier"></div>';
    for (const g of VOUERS) {
      h += '<div class="gov-boom-groep' + (oop_groepe.has(g.id) ? " oop" : "") + '">' +
        '<button type="button" class="gov-boom-hoof" data-ooptoe="' + esc(g.id) + '"><span class="gov-pyl">&#9654;</span>' + esc(g.id + " " + g.titel) +
        '<span class="gov-tel">' + tel_in(g.id) + "</span></button><div class=\"gov-boom-subs\">";
      for (const s of g.subs) {
        h += '<button type="button" class="gov-boom-sub' + (huidig === s.id ? " aktief" : "") + '" data-vouer="' + esc(s.id) + '">' +
          esc(s.id + " " + s.titel) + '<span class="gov-tel">' + tel_in(s.id) + "</span></button>";
      }
      const w = g.id + ".W";
      h += '<button type="button" class="gov-boom-sub wip' + (huidig === w ? " aktief" : "") + '" data-vouer="' + w + '">Work in Progress<span class="gov-tel">' + tel_in(w) + "</span></button>";
      h += '<button type="button" class="gov-boom-sub gov-boom-nuut" data-nuwe-vouer="' + esc(g.id) + '">+ Subvouer</button>';
      h += "</div></div>";
    }
    h += '<div class="gov-boom-skeier"></div><button type="button" class="gov-boom-hoof' + (huidig === ARGIEF ? " aktief" : "") + '" data-vouer="' + ARGIEF + '"><span class="gov-pyl"></span>07 Archive<span class="gov-tel">' + tel_in(ARGIEF) + "</span></button>";
    $("#gov-boom").innerHTML = h;

    let o = '<option value="oorsig">Oorsig</option>';
    for (const g of VOUERS) {
      o += '<optgroup label="' + esc(g.id + " " + g.titel) + '">';
      for (const s of g.subs) o += '<option value="' + esc(s.id) + '">' + esc(s.id + " " + s.titel) + " (" + tel_in(s.id) + ")</option>";
      o += '<option value="' + g.id + '.W">' + esc(g.id) + " Work in Progress (" + tel_in(g.id + ".W") + ")</option></optgroup>";
    }
    o += '<option value="' + ARGIEF + '">07 Archive (' + tel_in(ARGIEF) + ")</option>";
    const keuse = $("#gov-foon-keuse");
    keuse.innerHTML = o;
    keuse.value = huidig;
  }

  function teken_sperstrook() {
    const oop = SPERDATUMS.filter((s) => !s.klaar && dae_tot(s.datum) <= 90)
      .sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 4);
    const strook = $("#gov-sper-strook");
    strook.hidden = !oop.length;
    $("#gov-sper-items").innerHTML = oop.map((s) => {
      const n = dae_tot(s.datum);
      return '<button type="button" class="gov-sper-item" data-vouer="' + esc(s.vouer) + '"><b>' + esc(s.naam) + "</b>" +
        datum_af(s.datum) + ' · <span class="gov-dae ' + dae_klas(n) + '">' + dae_teks(n) + "</span> · " + esc(s.vouer) + "</button>";
    }).join("");
  }

  function dok_ry(d, wys_vouer) {
    const uit = (d.uitbreiding || "").toLowerCase();
    const in_argief = d.vouer === ARGIEF;
    const sub = [d.dokument_datum ? datum_af(d.dokument_datum) : "", wie(d.opgelaai_deur), grootte(d.grootte)].filter(Boolean).join(" · ");
    let h = '<div class="gov-dok"><div class="gov-tipe gov-tipe-' + esc(uit) + '">' + esc(uit.toUpperCase()) + "</div><div>" +
      '<div class="gov-dok-naam">' + esc(d.naam) + "</div>" +
      '<div class="gov-dok-sub">' + esc(sub) + "</div>";
    if (in_argief && d.oorsprong) h += '<div class="gov-dok-vouer">Oorspronklik: ' + esc(vouer_naam(d.oorsprong)) + "</div>";
    else if (wys_vouer) h += '<div class="gov-dok-vouer">' + esc(vouer_naam(d.vouer)) + "</div>";
    if (d.nota) h += '<div class="gov-dok-nota">' + esc(d.nota) + "</div>";
    h += '</div><div class="gov-dok-aksies">';
    if (BEKYKBAAR.includes(uit)) h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-bekyk="' + esc(d.id) + '">Bekyk</button>';
    h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-aflaai="' + esc(d.id) + '">Laai af</button>';
    h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-wysig="' + esc(d.id) + '">Wysig</button>';
    if (in_argief) {
      h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-herstel="' + esc(d.id) + '">Herstel</button>';
      h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein gov-knop-gevaar" data-skrap-dok="' + esc(d.id) + '">Skrap</button>';
    } else {
      h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-skuif="' + esc(d.id) + '">Skuif</button>';
      h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein gov-knop-gevaar" data-argiveer="' + esc(d.id) + '">Argiveer</button>';
    }
    return h + "</div></div>";
  }

  function teken_oorsig() {
    let h = '<div class="gov-kaart"><div class="gov-kaart-kop"><h2>Oorsig</h2>' +
      '<button type="button" class="gov-knop gov-knop-hoof" data-oplaai>+ Laai op</button></div>' +
      '<input type="search" class="gov-soek" id="gov-soek" placeholder="Soek in alle dokumente op naam of nota" value="' + esc(soek) + '" aria-label="Soek">';

    if (soek.trim()) {
      const s = soek.trim().toLowerCase();
      const treffers = DOKUMENTE.filter((d) => (d.naam + " " + (d.nota || "") + " " + (d["lêernaam"] || "")).toLowerCase().includes(s))
        .sort((a, b) => a.naam.localeCompare(b.naam, "af", { sensitivity: "base", numeric: true }));
      h += treffers.length ? treffers.map((d) => dok_ry(d, true)).join("") : '<p class="gov-leeg">Geen dokument pas nie.</p>';
      return h + "</div>";
    }

    h += '<div class="gov-oorsig">' + VOUERS.map((g) =>
      '<button type="button" class="gov-oorsig-kaart" data-groep="' + esc(g.id) + '"><b>' + esc(g.id + " " + g.titel) + "</b><span>" +
      dok_tel(tel_in(g.id)) + " · " + tel_in(g.id + ".W") + " in Work in Progress</span></button>").join("") +
      '<button type="button" class="gov-oorsig-kaart" data-vouer="' + ARGIEF + '"><b>07 Archive</b><span>' + dok_tel(tel_in(ARGIEF)) + "</span></button></div></div>";

    const onlangs = DOKUMENTE.filter((d) => d.vouer !== ARGIEF)
      .sort((a, b) => String(b.opgelaai_op).localeCompare(String(a.opgelaai_op))).slice(0, 8);
    h += '<div class="gov-kaart"><div class="gov-kaart-kop"><h2>Onlangs opgelaai</h2></div>' +
      (onlangs.length ? onlangs.map((d) => dok_ry(d, true)).join("") : '<p class="gov-leeg">Nog geen dokumente nie.</p>') + "</div>";
    return h;
  }

  function teken_sperdatums() {
    const lys = SPERDATUMS.filter((s) => s.vouer === huidig)
      .sort((a, b) => (a.klaar - b.klaar) || (a.klaar ? b.datum.localeCompare(a.datum) : a.datum.localeCompare(b.datum)));
    let h = '<div class="gov-kaart"><div class="gov-kaart-kop"><h2>Sperdatums</h2>' +
      '<button type="button" class="gov-knop gov-knop-lig" data-nuwe-sper>+ Sperdatum</button></div>';
    if (!lys.length) return h + '<p class="gov-leeg">Nog geen sperdatums nie.</p></div>';
    h += '<table class="gov-tabel"><thead><tr><th>Beskrywing</th><th>Sperdatum</th><th>Herhaal</th><th>Stand</th><th></th></tr></thead><tbody>';
    for (const s of lys) {
      const n = dae_tot(s.datum);
      h += '<tr class="' + (s.klaar ? "klaar" : "") + '"><td>' + esc(s.naam) + (s.nota ? '<div class="gov-hulp">' + esc(s.nota) + "</div>" : "") + "</td>" +
        "<td>" + datum_af(s.datum) + (s.klaar ? "" : ' <span class="gov-dae ' + dae_klas(n) + '">(' + dae_teks(n) + ")</span>") + "</td>" +
        "<td>" + esc(HERHAAL_NAAM[s.herhaal || ""]) + "</td>" +
        '<td><span class="gov-merk ' + (s.klaar ? "gov-merk-klaar" : "gov-merk-oop") + '">' + (s.klaar ? "Afgehandel" : "Oop") + "</span>" +
        (s.klaar && s.afgehandel_op ? '<div class="gov-hulp">' + datum_af(iso_sa(s.afgehandel_op)) + " · " + esc(wie(s.afgehandel_deur)) + "</div>" : "") + "</td>" +
        '<td class="gov-sel-aksies">' +
        (s.klaar
          ? '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-heropen="' + esc(s.id) + '">Heropen</button>'
          : '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-afhandel="' + esc(s.id) + '">Merk afgehandel</button> ' +
            '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-wysig-sper="' + esc(s.id) + '">Wysig</button>') +
        "</td></tr>";
    }
    return h + '</tbody></table><p class="gov-hulp">\'n Jaarlikse of maandelikse sperdatum skep by afhandeling die volgende een.</p></div>';
  }

  function teken_besluite() {
    const lys = [...BESLUITE].sort((a, b) => String(b.no).localeCompare(String(a.no), "af", { numeric: true }));
    let h = '<div class="gov-kaart"><div class="gov-kaart-kop"><h2>Besluiteregister</h2>' +
      '<button type="button" class="gov-knop gov-knop-lig" data-nuwe-besluit>+ Besluit</button></div>';
    if (!lys.length) return h + '<p class="gov-leeg">Nog geen besluite nie.</p></div>';
    h += '<table class="gov-tabel"><thead><tr><th>Nommer</th><th>Datum</th><th>Besluit</th><th>Soort</th><th>Stand</th><th>Dokument</th><th></th></tr></thead><tbody>';
    for (const b of lys) {
      const d = b.dok_id ? DOKUMENTE.find((x) => x.id === b.dok_id) : null;
      h += '<tr><td class="gov-no">' + esc(b.no) + "</td><td>" + datum_af(b.datum) + '</td><td class="gov-teks">' + esc(b.teks) + "</td>" +
        "<td>" + esc(SOORT_NAAM[b.soort] || b.soort) + "</td>" +
        '<td><span class="gov-merk ' + (b.stand === "aanvaar" ? "gov-merk-klaar" : "gov-merk-konsep") + '">' + (b.stand === "aanvaar" ? "Aanvaar" : "Konsep") + "</span></td>" +
        "<td>" + (d ? '<button type="button" class="gov-skakel" data-wys-vouer="' + esc(d.vouer) + '">' + esc(d.naam) + "</button>" : "-") + "</td>" +
        '<td class="gov-sel-aksies"><button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-wysig-besluit="' + esc(b.no) + '">Wysig</button></td></tr>';
    }
    return h + "</tbody></table></div>";
  }

  function teken_inhoud() {
    const plek = $("#gov-inhoud");
    if (huidig === "oorsig") {
      plek.innerHTML = teken_oorsig();
      const veld = $("#gov-soek");
      if (veld && soek) { veld.focus(); veld.setSelectionRange(veld.value.length, veld.value.length); }
      return;
    }

    const is_argief = huidig === ARGIEF;
    const is_wip = huidig.endsWith(".W");
    const gevind = vind_sub(huidig);
    const lys = DOKUMENTE.filter((d) => d.vouer === huidig)
      .sort((a, b) => is_argief
        ? String(b.geargiveer_op || "").localeCompare(String(a.geargiveer_op || ""))
        : String(b.dokument_datum || b.opgelaai_op).localeCompare(String(a.dokument_datum || a.opgelaai_op)));

    let h = '<div class="gov-kaart"><div class="gov-kaart-kop"><h2>' + esc(vouer_naam(huidig)) + "</h2>";
    if (gevind) h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein" data-hernoem="' + esc(huidig) + '">Hernoem</button>';
    if (gevind && gevind.sub.bygevoeg && !lys.length) h += '<button type="button" class="gov-knop gov-knop-lig gov-knop-klein gov-knop-gevaar" data-verwyder-vouer="' + esc(huidig) + '">Verwyder vouer</button>';
    if (!is_argief) h += '<button type="button" class="gov-knop gov-knop-hoof" data-oplaai>+ Laai op</button>';
    h += "</div>";
    if (is_argief) h += '<p class="gov-pad">Geargiveerde dokumente behou hul oorspronklike vouer. Herstel skuif hulle terug.</p>';
    if (is_wip) h += '<p class="gov-pad">Konsepte. Skuif \'n dokument na sy vouer wanneer dit final is.</p>';
    h += lys.length ? lys.map((d) => dok_ry(d, false)).join("") : '<p class="gov-leeg">Geen dokumente in hierdie vouer nie.</p>';
    h += "</div>";

    if (MET_SPER.includes(huidig)) h += teken_sperdatums();
    if (MET_BESLUITE.includes(huidig)) h += teken_besluite();
    plek.innerHTML = h;
  }

  function gaan(v) {
    huidig = v;
    teken();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Dialoë ----------
  function maak_oop(id) {
    $$("#" + id + " .gov-waarsku").forEach((w) => { w.hidden = true; });
    $("#" + id).classList.add("wys");
    const eerste = $("#" + id + " input:not([type=file]):not(:disabled), #" + id + " textarea, #" + id + " select");
    if (eerste) setTimeout(() => eerste.focus(), 30);
  }
  function maak_toe(id) { $("#" + id).classList.remove("wys"); }
  function besig(vorm, aan) {
    for (const b of $$("button[type=submit]", vorm)) b.disabled = aan;
  }

  // Laai op
  let gekose_leer = null;
  function maak_oplaai() {
    gekose_leer = null;
    $("#gov-oplaai-vorm").reset();
    $("#gov-sleep").classList.remove("gekies");
    $("#gov-sleep-teks").innerHTML = "Sleep 'n lêer hierheen of <u>kies 'n lêer</u>";
    const verstek = huidig === "oorsig" || huidig === ARGIEF ? "" : huidig;
    $("#gov-o-vouer").innerHTML = (verstek ? "" : '<option value="">Kies \'n vouer</option>') + vouer_opsies(null, verstek);
    $("#gov-o-datum").value = VANDAG;
    maak_oop("gov-d-oplaai");
  }
  function kies_leer(leer) {
    if (!leer) return;
    const uit = (leer.name.split(".").pop() || "").toLowerCase();
    if (!TIPES[uit]) { wys_fout("gov-o-fout", "Slegs PDF, Word, Excel, PowerPoint, CSV, JPG of PNG."); return; }
    if (leer.size > MAKS_GREPE) { wys_fout("gov-o-fout", "Die lêer is groter as 4 MB."); return; }
    wys_fout("gov-o-fout", "");
    gekose_leer = leer;
    $("#gov-sleep").classList.add("gekies");
    $("#gov-sleep-teks").textContent = leer.name + " · " + grootte(leer.size);
    if (!$("#gov-o-naam").value.trim()) $("#gov-o-naam").value = leer.name.replace(/\.[^.]+$/, "");
  }
  function lees_base64(leer) {
    return new Promise((los, verwerp) => {
      const r = new FileReader();
      r.onload = () => los(String(r.result).split(",")[1] || "");
      r.onerror = () => verwerp(new Error("Kon nie die lêer lees nie."));
      r.readAsDataURL(leer);
    });
  }
  async function stoor_oplaai(e) {
    e.preventDefault();
    const vorm = e.target;
    if (!gekose_leer) return wys_fout("gov-o-fout", "Kies 'n lêer.");
    const naam = $("#gov-o-naam").value.trim();
    const vouer = $("#gov-o-vouer").value;
    if (!naam) return wys_fout("gov-o-fout", "Die naam is verpligtend.");
    if (!vouer) return wys_fout("gov-o-fout", "Kies 'n vouer.");
    besig(vorm, true);
    try {
      const uit = gekose_leer.name.split(".").pop().toLowerCase();
      const antwoord = await fetch("/.netlify/functions/gov-laai-op", {
        method: "POST",
        headers: await identiteit_kop({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          naam, vouer,
          dokument_datum: $("#gov-o-datum").value || "",
          nota: $("#gov-o-nota").value.trim(),
          "lêernaam": gekose_leer.name,
          inhoud_tipe: TIPES[uit],
          data_base64: await lees_base64(gekose_leer),
        }),
      });
      const data = await antwoord.json().catch(() => ({}));
      if (antwoord.status === 401) { sessie_verval(); return; }
      if (!antwoord.ok) throw new Error(data.fout || "Fout " + antwoord.status);
      vervang_dok(data.dokument);
      maak_toe("gov-d-oplaai");
      huidig = data.dokument.vouer;
      teken();
      kennis("Opgelaai na " + kort_naam(data.dokument.vouer));
    } catch (f) {
      wys_fout("gov-o-fout", f.message);
    } finally {
      besig(vorm, false);
    }
  }

  // Wysig dokument
  let wysig_id = null;
  function maak_wysig(id) {
    const d = DOKUMENTE.find((x) => x.id === id);
    if (!d) return;
    wysig_id = id;
    $("#gov-w-naam").value = d.naam;
    $("#gov-w-datum").value = d.dokument_datum || "";
    $("#gov-w-nota").value = d.nota || "";
    const reels = (d.geskiedenis || []).slice().reverse().map((g) => {
      let t = (AKSIE_NAAM[g.aksie] || g.aksie);
      if (g.van && g.na) t += ": " + kort_naam(g.van) + " → " + kort_naam(g.na);
      else if (g.na) t += ": " + kort_naam(g.na);
      else if (g.van) t += " uit " + kort_naam(g.van);
      return "<div>" + esc(tyd_sa(g.op)) + " · " + esc(wie(g.deur)) + " · " + esc(t) + "</div>";
    }).join("");
    $("#gov-w-geskiedenis").innerHTML = "<b>Geskiedenis</b><div>Lêer: " + esc(d["lêernaam"] || "") + "</div>" + reels;
    maak_oop("gov-d-wysig");
  }
  async function stoor_wysig(e) {
    e.preventDefault();
    const vorm = e.target;
    besig(vorm, true);
    try {
      const data = await gov({ aksie: "dok_wysig", id: wysig_id, naam: $("#gov-w-naam").value, dokument_datum: $("#gov-w-datum").value, nota: $("#gov-w-nota").value });
      vervang_dok(data.dokument);
      maak_toe("gov-d-wysig");
      teken();
      kennis("Gestoor");
    } catch (f) {
      wys_fout("gov-w-fout", f.message);
    } finally {
      besig(vorm, false);
    }
  }

  // Skuif
  let skuif_id = null;
  function maak_skuif(id) {
    const d = DOKUMENTE.find((x) => x.id === id);
    if (!d) return;
    skuif_id = id;
    $("#gov-s-wat").textContent = d.naam + " · tans in " + vouer_naam(d.vouer);
    $("#gov-s-vouer").innerHTML = vouer_opsies(d.vouer, null);
    maak_oop("gov-d-skuif");
  }
  async function stoor_skuif(e) {
    e.preventDefault();
    const vorm = e.target;
    besig(vorm, true);
    try {
      const data = await gov({ aksie: "dok_skuif", id: skuif_id, na: $("#gov-s-vouer").value });
      vervang_dok(data.dokument);
      maak_toe("gov-d-skuif");
      teken();
      kennis("Geskuif na " + kort_naam(data.dokument.vouer));
    } catch (f) {
      wys_fout("gov-s-fout", f.message);
    } finally {
      besig(vorm, false);
    }
  }

  async function argiveer(id) {
    try {
      const data = await gov({ aksie: "dok_argiveer", id });
      vervang_dok(data.dokument);
      teken();
      kennis("Na 07 Archive geskuif");
    } catch (f) { kennis(f.message); }
  }
  async function herstel(id) {
    try {
      const data = await gov({ aksie: "dok_herstel", id });
      vervang_dok(data.dokument);
      teken();
      kennis("Herstel na " + kort_naam(data.dokument.vouer));
    } catch (f) { kennis(f.message); }
  }
  async function skrap_dok(id) {
    const d = DOKUMENTE.find((x) => x.id === id);
    if (!d) return;
    if (!window.confirm("Skrap \"" + d.naam + "\" permanent? Die lêer kan nie herwin word nie.")) return;
    try {
      await gov({ aksie: "dok_skrap", id });
      DOKUMENTE = DOKUMENTE.filter((x) => x.id !== id);
      teken();
      kennis("Geskrap");
    } catch (f) { kennis(f.message); }
  }

  // Bekyk en aflaai: die lêer word met die Authorization-kop gehaal.
  async function haal_leer(id, wys) {
    const antwoord = await fetch("/.netlify/functions/gov-aflaai?id=" + encodeURIComponent(id) + (wys ? "&wys=1" : ""), {
      headers: await identiteit_kop(),
    });
    if (antwoord.status === 401) { sessie_verval(); throw new Error("Sessie het verval"); }
    if (!antwoord.ok) {
      const data = await antwoord.json().catch(() => ({}));
      throw new Error(data.fout || "Fout " + antwoord.status);
    }
    return antwoord.blob();
  }
  async function bekyk(id) {
    // Die oortjie word dadelik oopgemaak, anders keer die blaaier dit.
    const oortjie = window.open("about:blank", "_blank");
    try {
      const blob = await haal_leer(id, true);
      const url = URL.createObjectURL(blob);
      if (oortjie) oortjie.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (f) {
      if (oortjie) oortjie.close();
      kennis(f.message);
    }
  }
  async function aflaai(id) {
    const d = DOKUMENTE.find((x) => x.id === id);
    try {
      kennis("Word afgelaai …");
      const blob = await haal_leer(id, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (d && d["lêernaam"]) || "dokument";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (f) { kennis(f.message); }
  }

  // Sperdatums
  let sper_id = null;
  function maak_sper(id) {
    const s = id ? SPERDATUMS.find((x) => x.id === id) : null;
    sper_id = s ? s.id : null;
    $("#gov-sper-vorm").reset();
    $("#gov-d-sper-t").textContent = s ? "Wysig sperdatum" : "Nuwe sperdatum";
    $("#gov-p-naam").value = s ? s.naam : "";
    $("#gov-p-datum").value = s ? s.datum : "";
    $("#gov-p-herhaal").value = s ? (s.herhaal || "") : "jaarliks";
    $("#gov-p-herinner").value = s ? (s.herinner || "30_7") : "30_7";
    $("#gov-p-nota").value = s ? (s.nota || "") : "";
    $("#gov-p-skrap").hidden = !s;
    maak_oop("gov-d-sper");
  }
  async function stoor_sper(e) {
    e.preventDefault();
    const vorm = e.target;
    const bestaande = sper_id ? SPERDATUMS.find((x) => x.id === sper_id) : null;
    besig(vorm, true);
    try {
      const data = await gov({
        aksie: "sper_stoor", id: sper_id || undefined,
        vouer: bestaande ? bestaande.vouer : huidig,
        naam: $("#gov-p-naam").value, datum: $("#gov-p-datum").value,
        herhaal: $("#gov-p-herhaal").value, herinner: $("#gov-p-herinner").value, nota: $("#gov-p-nota").value,
      });
      SPERDATUMS = SPERDATUMS.filter((x) => x.id !== data.sperdatum.id).concat([data.sperdatum]);
      maak_toe("gov-d-sper");
      teken();
      kennis("Gestoor");
    } catch (f) {
      wys_fout("gov-p-fout", f.message);
    } finally {
      besig(vorm, false);
    }
  }
  async function skrap_sper() {
    if (!sper_id || !window.confirm("Skrap hierdie sperdatum?")) return;
    try {
      await gov({ aksie: "sper_skrap", id: sper_id });
      SPERDATUMS = SPERDATUMS.filter((x) => x.id !== sper_id);
      maak_toe("gov-d-sper");
      teken();
      kennis("Geskrap");
    } catch (f) { wys_fout("gov-p-fout", f.message); }
  }
  async function afhandel(id) {
    try {
      const data = await gov({ aksie: "sper_afhandel", id });
      SPERDATUMS = SPERDATUMS.filter((x) => x.id !== data.sperdatum.id).concat([data.sperdatum]);
      if (data.volgende) SPERDATUMS.push(data.volgende);
      teken();
      kennis(data.volgende ? "Afgehandel. Volgende: " + datum_af(data.volgende.datum) : "Afgehandel");
    } catch (f) { kennis(f.message); }
  }
  async function heropen(id) {
    try {
      const data = await gov({ aksie: "sper_heropen", id });
      SPERDATUMS = SPERDATUMS.filter((x) => x.id !== data.sperdatum.id).concat([data.sperdatum]);
      teken();
      kennis("Heropen");
    } catch (f) { kennis(f.message); }
  }

  // Besluite
  let besluit_no = null;
  function voorlopige_no(datum) {
    const jaar = (datum || VANDAG).slice(0, 4);
    let hoogste = 0;
    for (const b of BESLUITE) {
      const m = /^B-(\d{4})-(\d+)$/.exec(b.no || "");
      if (m && m[1] === jaar) hoogste = Math.max(hoogste, Number(m[2]));
    }
    return "B-" + jaar + "-" + String(hoogste + 1).padStart(3, "0");
  }
  function maak_besluit(no) {
    const b = no ? BESLUITE.find((x) => x.no === no) : null;
    besluit_no = b ? b.no : null;
    const vas = !!(b && b.stand === "aanvaar");
    $("#gov-besluit-vorm").reset();
    $("#gov-d-besluit-t").textContent = b ? "Besluit " + b.no : "Nuwe besluit";
    $("#gov-b-datum").value = b ? b.datum : VANDAG;
    $("#gov-b-no").value = b ? b.no : voorlopige_no(VANDAG);
    $("#gov-b-teks").value = b ? b.teks : "";
    $("#gov-b-soort").value = b ? b.soort : "direksievergadering";
    $("#gov-b-stand").value = b ? b.stand : "konsep";
    const doks = DOKUMENTE.filter((d) => d.vouer !== ARGIEF || (b && d.id === b.dok_id))
      .sort((x, y) => x.naam.localeCompare(y.naam, "af", { sensitivity: "base", numeric: true }));
    $("#gov-b-dok").innerHTML = '<option value="">Geen</option>' +
      doks.map((d) => '<option value="' + esc(d.id) + '"' + (b && b.dok_id === d.id ? " selected" : "") + ">" + esc(d.naam) + " (" + esc(d.vouer) + ")</option>").join("");
    for (const id of ["gov-b-datum", "gov-b-teks", "gov-b-soort", "gov-b-stand"]) $("#" + id).disabled = vas;
    $("#gov-b-vas").hidden = !vas;
    $("#gov-b-skrap").hidden = !b || vas;
    maak_oop("gov-d-besluit");
  }
  async function stoor_besluit(e) {
    e.preventDefault();
    const vorm = e.target;
    const stand = $("#gov-b-stand").value;
    const bestaande = besluit_no ? BESLUITE.find((x) => x.no === besluit_no) : null;
    if (stand === "aanvaar" && (!bestaande || bestaande.stand !== "aanvaar") &&
        !window.confirm("'n Aanvaarde besluit staan daarna vas. Gaan voort?")) return;
    besig(vorm, true);
    try {
      const data = await gov({
        aksie: "besluit_stoor", no: besluit_no || undefined,
        datum: $("#gov-b-datum").value, teks: $("#gov-b-teks").value, soort: $("#gov-b-soort").value,
        stand, dok_id: $("#gov-b-dok").value,
      });
      BESLUITE = BESLUITE.filter((x) => x.no !== besluit_no && x.no !== data.besluit.no).concat([data.besluit]);
      maak_toe("gov-d-besluit");
      teken();
      kennis("Gestoor as " + data.besluit.no);
    } catch (f) {
      wys_fout("gov-b-fout", f.message);
    } finally {
      besig(vorm, false);
    }
  }
  async function skrap_besluit() {
    if (!besluit_no || !window.confirm("Skrap konsepbesluit " + besluit_no + "?")) return;
    try {
      await gov({ aksie: "besluit_skrap", no: besluit_no });
      BESLUITE = BESLUITE.filter((x) => x.no !== besluit_no);
      maak_toe("gov-d-besluit");
      teken();
      kennis("Geskrap");
    } catch (f) { wys_fout("gov-b-fout", f.message); }
  }

  // Vouers
  let vouer_modus = null; // { nuut: groep_id } of { hernoem: sub_id }
  function maak_vouer(modus) {
    vouer_modus = modus;
    $("#gov-vouer-vorm").reset();
    if (modus.nuut) {
      const g = VOUERS.find((x) => x.id === modus.nuut);
      $("#gov-d-vouer-t").textContent = "Nuwe subvouer in " + (g ? g.id + " " + g.titel : modus.nuut);
    } else {
      const v = vind_sub(modus.hernoem);
      $("#gov-d-vouer-t").textContent = "Hernoem " + modus.hernoem;
      $("#gov-v-titel").value = v ? v.sub.titel : "";
    }
    maak_oop("gov-d-vouer");
  }
  async function stoor_vouer(e) {
    e.preventDefault();
    const vorm = e.target;
    besig(vorm, true);
    try {
      const titel = $("#gov-v-titel").value;
      const data = vouer_modus.nuut
        ? await gov({ aksie: "vouer_voeg_by", groep: vouer_modus.nuut, titel })
        : await gov({ aksie: "vouer_hernoem", id: vouer_modus.hernoem, titel });
      VOUERS = data.vouers;
      maak_toe("gov-d-vouer");
      if (data.vouer) huidig = data.vouer.id;
      teken();
      kennis("Gestoor");
    } catch (f) {
      wys_fout("gov-v-fout", f.message);
    } finally {
      besig(vorm, false);
    }
  }
  async function verwyder_vouer(id) {
    if (!window.confirm("Verwyder vouer " + vouer_naam(id) + "?")) return;
    try {
      const data = await gov({ aksie: "vouer_skrap", id });
      VOUERS = data.vouers;
      huidig = id.slice(0, 2) + ".W";
      teken();
      kennis("Vouer verwyder");
    } catch (f) { kennis(f.message); }
  }

  // ---------- Kliks ----------
  function bind() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("button, [data-vouer]");
      if (!t) return;
      const d = t.dataset;
      if (d.vouer) return gaan(d.vouer);
      if (d.wysVouer) return gaan(d.wysVouer);
      if (d.groep) { oop_groepe.add(d.groep); const g = VOUERS.find((x) => x.id === d.groep); return gaan(g && g.subs[0] ? g.subs[0].id : d.groep + ".W"); }
      if (d.ooptoe) { t.parentElement.classList.toggle("oop"); if (t.parentElement.classList.contains("oop")) oop_groepe.add(d.ooptoe); else oop_groepe.delete(d.ooptoe); return; }
      if (d.oplaai !== undefined) return maak_oplaai();
      if (d.bekyk) return bekyk(d.bekyk);
      if (d.aflaai) return aflaai(d.aflaai);
      if (d.wysig) return maak_wysig(d.wysig);
      if (d.skuif) return maak_skuif(d.skuif);
      if (d.argiveer) return argiveer(d.argiveer);
      if (d.herstel) return herstel(d.herstel);
      if (d.skrapDok) return skrap_dok(d.skrapDok);
      if (d.nuweSper !== undefined) return maak_sper(null);
      if (d.wysigSper) return maak_sper(d.wysigSper);
      if (d.afhandel) return afhandel(d.afhandel);
      if (d.heropen) return heropen(d.heropen);
      if (d.nuweBesluit !== undefined) return maak_besluit(null);
      if (d.wysigBesluit) return maak_besluit(d.wysigBesluit);
      if (d.nuweVouer) return maak_vouer({ nuut: d.nuweVouer });
      if (d.hernoem) return maak_vouer({ hernoem: d.hernoem });
      if (d.verwyderVouer) return verwyder_vouer(d.verwyderVouer);
      if (d.sluit !== undefined) return t.closest(".gov-agter").classList.remove("wys");
    });

    // 'n Klik op die donker agtergrond maak die dialoog toe; Escape ook.
    for (const agter of $$(".gov-agter")) {
      agter.addEventListener("mousedown", (e) => { if (e.target === agter) agter.classList.remove("wys"); });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") for (const a of $$(".gov-agter.wys")) a.classList.remove("wys");
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "gov-soek") { soek = e.target.value; teken_inhoud(); }
    });
    $("#gov-foon-keuse").addEventListener("change", (e) => gaan(e.target.value));

    $("#gov-oplaai-vorm").addEventListener("submit", stoor_oplaai);
    $("#gov-wysig-vorm").addEventListener("submit", stoor_wysig);
    $("#gov-skuif-vorm").addEventListener("submit", stoor_skuif);
    $("#gov-sper-vorm").addEventListener("submit", stoor_sper);
    $("#gov-besluit-vorm").addEventListener("submit", stoor_besluit);
    $("#gov-vouer-vorm").addEventListener("submit", stoor_vouer);
    $("#gov-p-skrap").addEventListener("click", skrap_sper);
    $("#gov-b-skrap").addEventListener("click", skrap_besluit);
    $("#gov-b-datum").addEventListener("change", (e) => { if (!besluit_no) $("#gov-b-no").value = voorlopige_no(e.target.value); });

    const sleep = $("#gov-sleep");
    $("#gov-o-leer").addEventListener("change", (e) => kies_leer(e.target.files[0]));
    sleep.addEventListener("dragover", (e) => { e.preventDefault(); sleep.classList.add("oor"); });
    sleep.addEventListener("dragleave", () => sleep.classList.remove("oor"));
    sleep.addEventListener("drop", (e) => {
      e.preventDefault();
      sleep.classList.remove("oor");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) kies_leer(e.dataTransfer.files[0]);
    });
  }

  // ---------- Begin ----------
  document.addEventListener("DOMContentLoaded", async () => {
    const hoof = $("#gov-hoof");
    const wys = () => { hoof.style.visibility = "visible"; };

    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }

    if (!sessie) {
      $("#gov-aanmeld").hidden = false;
      wys();
      $("#gov-aanmeld-epos").focus();
      $("#gov-aanmeld-vorm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const knop = $("#gov-aanmeld-knop");
        wys_fout("gov-aanmeld-fout", "");
        knop.disabled = true;
        try {
          await identiteit_meld_aan($("#gov-aanmeld-epos").value.trim(), $("#gov-aanmeld-wagwoord").value, $("#gov-aanmeld-bly").checked);
          window.location.reload();
        } catch (f) {
          wys_fout("gov-aanmeld-fout", "Kon nie aanmeld nie: " + f.message);
          knop.disabled = false;
        }
      });
      return;
    }

    const epos = $("#paneel-gebruiker-epos");
    if (epos && sessie.gebruiker) epos.textContent = sessie.gebruiker.email;
    const afmeld = $("#gov-meld-af");
    afmeld.hidden = false;
    afmeld.addEventListener("click", () => { identiteit_meld_af(); window.location.reload(); });

    if (!identiteit_het_rol(sessie.gebruiker, "boekhouding")) {
      $("#gov-geen-toegang-teks").textContent = "Jy is aangemeld as " +
        ((sessie.gebruiker && sessie.gebruiker.email) || "'n ander rekening") + ". Hierdie rekening het nie toegang tot Governance nie.";
      $("#gov-geen-toegang").hidden = false;
      $("#gov-ander-rekening").addEventListener("click", () => { identiteit_verwyder_sessie(); window.location.reload(); });
      wys();
      return;
    }

    $("#gov-paneel").hidden = false;
    wys();
    bind();
    try {
      await laai();
    } catch (f) {
      $("#gov-inhoud").innerHTML = '<div class="gov-kaart"><p class="gov-leeg">Kon nie laai nie: ' + esc(f.message) + "</p></div>";
    }
  });
})();
