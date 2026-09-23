// public/js/futuresharp-paneel.js
//
// Die Future Sharp-area: studievaardigheidskonsultasies.
//
// DIE KONSULTASIE IS DIE HOOFSAAK. 'n Registrasie kry eers 'n datum; 'n
// vraelys ter voorbereiding is opsioneel en kom daarna.
//
// ALLES LOOP DEUR /.netlify/functions/portaal, wat die boekhouding-rol
// afdwing en na die registrasieportaal deurstuur. Die skerm is nie die slot
// nie; hy wys net nie 'n leë bladsy sonder verduideliking nie.
//
// Hierdie paneel is Afrikaans. Die boodskappe wat na leerders en ouers gaan,
// is in die leerder se voorkeurtaal.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const DAG = 86400000;
  const SPER_MS = 48 * 3600000;
  const GELDIG_MS = 30 * DAG;
  const SONE = "Africa/Johannesburg";

  let LYS = [];
  let REGSKAKEL = "";
  let INSTR = [];
  let ADRES = "";
  let HUIDIG = null;          // { registrasie, bladsye }
  let filter = "aandag";
  let soek = "";

  // ---------- Hulpies ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const MAANDE = { af: ["Januarie", "Februarie", "Maart", "April", "Mei", "Junie", "Julie", "Augustus", "September", "Oktober", "November", "Desember"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] };
  const DAE = { af: ["Sondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrydag", "Saterdag"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] };

  function dele(ms) {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: SONE, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const p = {};
    for (const d of f.formatToParts(new Date(ms))) p[d.type] = d.value;
    return { j: +p.year, m: +p.month - 1, d: +p.day, w: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], u: p.hour, min: p.minute };
  }
  // "Dinsdag 6 Oktober om 09:00" of "6 Oktober 2026"
  function dt(ms, taal, met_tyd) {
    const t = taal === "en" ? "en" : "af";
    const d = dele(ms);
    if (!met_tyd) return d.d + " " + MAANDE[t][d.m] + " " + d.j;
    return DAE[t][d.w] + " " + d.d + " " + MAANDE[t][d.m] + (t === "en" ? " at " : " om ") + d.u + ":" + d.min;
  }
  // "6 Okt 09:00"
  function kort(iso) {
    const d = dele(Date.parse(iso));
    return d.d + " " + MAANDE.af[d.m].slice(0, 3) + " " + d.u + ":" + d.min;
  }
  // Die datum- en tydveld se waardes in SA-tyd
  function invoer_waardes(iso) {
    if (!iso) return { d: "", t: "09:00" };
    const d = dele(Date.parse(iso));
    return { d: d.j + "-" + String(d.m + 1).padStart(2, "0") + "-" + String(d.d).padStart(2, "0"), t: d.u + ":" + d.min };
  }

  function kennis(teks) {
    const k = $("#fsp-kennis");
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2600);
  }

  async function kopieer(teks) {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      const t = document.createElement("textarea");
      t.value = teks;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    kennis("Gekopieer");
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kopieer]");
    if (!b) return;
    const el = $(b.dataset.kopieer);
    if (el) kopieer(el.tagName === "TEXTAREA" ? el.value : el.textContent);
  });

  async function portaal(liggaam) {
    const antwoord = await fetch("/.netlify/functions/portaal", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify(liggaam),
    });
    const data = await antwoord.json().catch(() => ({}));
    if (!antwoord.ok) {
      const f = new Error(data.fout || "Fout " + antwoord.status);
      f.status = antwoord.status;
      throw f;
    }
    return data;
  }

  // ---------- Stande ----------
  const STANDE = {
    nuut: "Nuut", gereel: "Konsultasie gereël", gestuur: "Vraelys gestuur",
    deels: "Vraelys deels klaar", voltooi: "Vraelys klaar", verval: "Vraelysskakel verval",
  };

  function stand_van(r) {
    if (!r.kons) return "nuut";
    const bladsye = (r.bladsye || []).filter((b) => !b.vervang);
    if (!bladsye.length) return "gereel";
    let almal = 0, gemerk = 0, verval = false;
    for (const b of bladsye) {
      for (const v of b.vraelyste) { almal += 1; if (b.merk && b.merk[v]) gemerk += 1; }
      if (Date.parse(b.verval_op) < Date.now()) verval = true;
    }
    if (gemerk === almal) return "voltooi";
    if (verval) return "verval";
    return gemerk ? "deels" : "gestuur";
  }

  // ---------- Die lys ----------
  async function laai_lys() {
    try {
      const data = await portaal({ aksie: "lys" });
      LYS = data.registrasies || [];
      REGSKAKEL = data.registrasieskakel || "";
      // Die vraelyste en die adres kom saam met die lys: een oproep, nie twee nie.
      if (Array.isArray(data.instrumente)) {
        INSTR = data.instrumente;
        ADRES = data.adres || "";
        $("#fsp-adres").value = ADRES;
        teken_instr();
      }
      $("#fsp-reg-skakel").textContent = REGSKAKEL;
      // Die Engelse ingang wys 'n Engelse voorskou op WhatsApp.
      $("#fsp-reg-skakel-en").textContent = data.registrasieskakel_en || REGSKAKEL.replace(/\/registrasie$/, "/register");
      teken_lys();
    } catch (f) {
      $("#fsp-lys").innerHTML = '<p class="fsp-leeg">Kon nie die registrasies laai nie: ' + esc(f.message) + "</p>";
    }
  }

  function teken_filters() {
    const tel = {};
    for (const r of LYS) { const s = stand_van(r); tel[s] = (tel[s] || 0) + 1; }
    const aandag = (tel.nuut || 0) + (tel.verval || 0);
    const opsies = [["aandag", "Vra aandag", aandag], ["alles", "Alles", LYS.length]]
      .concat(Object.keys(STANDE).filter((k) => tel[k]).map((k) => [k, STANDE[k], tel[k]]));
    $("#fsp-filterknoppe").innerHTML = opsies.map(([k, n, c]) =>
      '<button type="button" class="fsp-filter' + (filter === k ? " aan" : "") + '" data-f="' + k + '">' + esc(n) + " <b>" + c + "</b></button>").join("");
    for (const b of $$("#fsp-filterknoppe [data-f]")) b.onclick = () => { filter = b.dataset.f; teken_lys(); };
  }

  function teken_lys() {
    teken_filters();
    const s = soek.toLowerCase();
    const lys = LYS.filter((r) => {
      const st = stand_van(r);
      if (filter === "aandag" && !(st === "nuut" || st === "verval")) return false;
      if (filter !== "aandag" && filter !== "alles" && st !== filter) return false;
      if (s && !(r.naam + " " + r.van + " " + r.no + " " + (r.epos || "") + " " + r.rp_epos + " " + r.rp_naam).toLowerCase().includes(s)) return false;
      return true;
    }).sort((a, b) => {
      // Eers wie nog nie 'n datum het nie (nuutste bo), dan volgens die
      // konsultasie wat eerste kom.
      if (!a.kons !== !b.kons) return a.kons ? 1 : -1;
      if (!a.kons) return Date.parse(b.geskep_op) - Date.parse(a.geskep_op);
      return Date.parse(a.kons.op) - Date.parse(b.kons.op);
    });

    const plek = $("#fsp-lys");
    if (!LYS.length) plek.innerHTML = '<p class="fsp-leeg">Nog geen registrasies nie. Stuur die registrasievorm-skakel hierbo aan ouers en studente.</p>';
    else if (!lys.length) plek.innerHTML = '<p class="fsp-leeg">Niks vra nou aandag nie. Kies <b>Alles</b> om elke registrasie te sien.</p>';
    else plek.innerHTML = lys.map((r) => {
      const st = stand_van(r);
      const kons = r.kons
        ? '<div class="fsp-ry-kons">Konsultasie ' + esc(kort(r.kons.op)) + (r.kons.wyse === "aanlyn" ? ", aanlyn" : ", in persoon") + "</div>"
        : '<div class="fsp-ry-kons leeg">Konsultasie nog nie gereël nie</div>';
      return '<div class="fsp-ry" data-stand="' + st + '" data-no="' + esc(r.no) + '" tabindex="0" role="button">' +
        '<div class="fsp-ry-no">' + esc(r.no) + "</div>" +
        '<div><div class="fsp-ry-naam">' + (r.gesien ? "" : '<span class="fsp-nuut" title="Nog nie oopgemaak nie"></span>') + esc(r.naam + " " + r.van) + "</div>" +
        '<div class="fsp-ry-sub">' + esc([r.graad, (r.ouderdom != null ? r.ouderdom + " jaar" : ""), r.taal === "en" ? "Engels" : "Afrikaans"].filter(Boolean).join(", ")) + "</div>" + kons + "</div>" +
        "<div>" + (r.toets ? '<span class="fsp-stand toets">Toets</span>' : "") + '<span class="fsp-stand ' + st + '">' + STANDE[st] + "</span></div></div>";
    }).join("");
    for (const el of $$("#fsp-lys .fsp-ry")) {
      const oop = () => wys_een(el.dataset.no);
      el.onclick = oop;
      el.onkeydown = (e) => { if (e.key === "Enter") oop(); };
    }
    $("#fsp-toets-blok").hidden = !LYS.some((r) => r.toets);
  }

  // ---------- Afdelings ----------
  function wys_afdeling(naam) {
    for (const a of $$(".fsp-afdeling")) a.classList.toggle("wys", a.dataset.afdeling === naam);
    const pil = naam === "een" ? "leerders" : naam;
    for (const p of $$("#fsp-kieslys .fsp-pil")) p.classList.toggle("aktief", p.dataset.gaan === pil);
  }

  // ---------- Een registrasie ----------
  async function wys_een(no) {
    wys_afdeling("een");
    window.scrollTo(0, 0);
    $("#fsp-een").innerHTML = '<p class="fsp-leeg">Word gelaai …</p>';
    try {
      const data = await portaal({ aksie: "een", no });
      HUIDIG = data;
      INSTR = data.instrumente || INSTR;
      ADRES = data.adres || ADRES;
      const r = LYS.find((x) => x.no === no);
      if (r) r.gesien = true;
      teken_een();
    } catch (f) {
      $("#fsp-een").innerHTML = '<p class="fsp-leeg">Kon nie laai nie: ' + esc(f.message) + "</p>";
    }
  }

  function instr(id) {
    return INSTR.find((i) => i.id === id) || { id, naam: { af: id, en: id }, vir: "leerder", aktief: false };
  }

  function voornaam(n) {
    return String(n || "").trim().split(/\s+/)[0] || "";
  }

  // Wie kry die skakel? Dieselfde reël as die bevestiging op die vorm.
  function ontvanger(reg, b) {
    if (b.wie === "ouer") return { naam: reg.rp.naam + " " + reg.rp.van, sel: reg.rp.sel, epos: reg.rp.epos, rol: "die ouer" };
    if (reg.rp.self) return { naam: reg.leerder.naam, sel: reg.leerder.sel, epos: reg.leerder.epos, rol: "die student self" };
    if (reg.leerder.sel) return { naam: reg.leerder.naam, sel: reg.leerder.sel, epos: reg.leerder.epos, rol: "die leerder direk" };
    return { naam: reg.rp.naam + " " + reg.rp.van, sel: reg.rp.sel, epos: reg.rp.epos, rol: "die rekeningpligtige, om aan te stuur" };
  }

  // Die boodskap in die leerder se voorkeurtaal. Minder as 48 uur oor: "so
  // gou moontlik" in plaas van 'n sperdatum wat reeds verby is.
  function boodskap(reg, b) {
    const taal = reg.leerder.voorkeurtaal === "en" ? "en" : "af";
    const en = taal === "en";
    const kons_ms = Date.parse(reg.kons.op);
    const laat = kons_ms - SPER_MS < Date.now();
    const sper = dt(kons_ms - SPER_MS, taal, true);
    const kons = dt(kons_ms, taal, true);
    const voor_af = laat ? "so gou moontlik. Die konsultasie is op " + kons : "voor " + sper;
    const voor_en = laat ? "as soon as possible. The consultation is on " + kons : "before " + sper;
    const rp = voornaam(reg.rp.naam);
    const k = reg.leerder.naam;
    const url = b.skakel;

    if (b.wie === "ouer") {
      return en
        ? "Hi " + rp + "\n\nTo prepare for " + k + "'s study skills consultation, here is your personal link to the parent questionnaire:\n" + url + "\n\nPlease complete it " + voor_en + ", so that we can prepare the report in time.\n\nFuture Sharp"
        : "Hallo " + rp + "\n\nTer voorbereiding van " + k + " se studievaardigheidskonsultasie is hier jou persoonlike skakel na die ouervraelys:\n" + url + "\n\nVoltooi dit asseblief " + voor_af + ", sodat ons die verslag betyds kan opstel.\n\nFuture Sharp";
    }
    if (reg.rp.self || reg.leerder.sel) {
      return en
        ? "Hi " + k + "\n\nTo prepare for your study skills consultation, here is your personal link to the questionnaires:\n" + url + "\n\nPlease complete them " + voor_en + ". The page explains everything step by step.\n\nFuture Sharp"
        : "Hallo " + k + "\n\nTer voorbereiding van jou studievaardigheidskonsultasie is hier jou persoonlike skakel na die vraelyste:\n" + url + "\n\nVoltooi dit asseblief " + voor_af + ". Die bladsy verduidelik alles stap vir stap.\n\nFuture Sharp";
    }
    return en
      ? "Hi " + rp + "\n\nTo prepare for " + k + "'s study skills consultation, here is " + k + "'s personal link to the questionnaires. Please forward it to " + k + ":\n" + url + "\n\nThe questionnaires must be completed " + voor_en + ", so that we can prepare the report before the consultation.\n\nFuture Sharp"
      : "Hallo " + rp + "\n\nTer voorbereiding van " + k + " se studievaardigheidskonsultasie is hier " + k + " se persoonlike skakel na die vraelyste. Stuur dit asseblief vir " + k + " aan:\n" + url + "\n\nDie vraelyste moet " + (laat ? "so gou moontlik voltooi word. Die konsultasie is op " + kons : "voor " + sper + " voltooi wees") + ", sodat ons die verslag voor die konsultasie kan opstel.\n\nFuture Sharp";
  }

  function wa_nommer(s) {
    let d = String(s || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "27" + d.slice(1);
    return d;
  }

  function graad_teks(l) {
    if (l.soort === "student") return { 1: "Eerste jaar", 2: "Tweede jaar", 3: "Derde jaar", 4: "Vierde jaar of later", 5: "Nagraads" }[l.jaar] || "";
    return l.graad ? "Graad " + l.graad : "";
  }

  function teken_een() {
    const reg = HUIDIG.registrasie;
    const bladsye = (HUIDIG.bladsye || []).filter((b) => !b.vervang_deur);
    const opsom = LYS.find((x) => x.no === reg.no) || { ...reg, bladsye: bladsye.map((b) => ({ ...b, vervang: false })) };
    const st = stand_van({ kons: reg.kons, bladsye: bladsye.map((b) => ({ ...b, vervang: false })) });
    const l = reg.leerder;
    const en = l.voorkeurtaal === "en";
    const ouderdom = reg.ouderdom_by_registrasie;
    const volle_naam = l.naam + " " + l.van;
    let h = "";

    // Kop
    h += '<div class="fsp-kaart"><div class="fsp-kop-ry"><div><div class="fsp-ry-no" style="font-size:15px">' + esc(reg.no) + "</div><h2>" + esc(volle_naam) + "</h2></div>" +
      "<div>" + (reg.toets ? '<span class="fsp-stand toets">Toets</span>' : "") + '<span class="fsp-stand ' + st + '">' + STANDE[st] + "</span></div></div></div>";

    // Die konsultasie
    const kv = invoer_waardes(reg.kons && reg.kons.op);
    const aanlyn = reg.kons && reg.kons.wyse === "aanlyn";
    h += '<div class="fsp-kaart"><h3>Konsultasie</h3>' +
      '<div class="fsp-veld"><span class="fsp-et">Datum en tyd</span><div class="fsp-tyd">' +
      '<input type="date" id="k-dag" value="' + kv.d + '" aria-label="Datum"><input type="time" id="k-tyd" value="' + kv.t + '" step="900" aria-label="Tyd"></div></div>' +
      '<div class="fsp-veld"><span class="fsp-et">Hoe</span><div class="fsp-merkies ry">' +
      '<label><input type="radio" name="k-wyse" value="persoon"' + (aanlyn ? "" : " checked") + "> In persoon</label>" +
      '<label><input type="radio" name="k-wyse" value="aanlyn"' + (aanlyn ? " checked" : "") + "> Aanlyn</label></div></div>" +
      '<div class="fsp-veld" id="k-adres-veld"' + (aanlyn ? ' style="display:none"' : "") + '><label class="fsp-et" for="k-plek">Adres</label>' +
      '<input type="text" id="k-plek" class="fsp-invoer" maxlength="300" value="' + esc((reg.kons && reg.kons.adres) || ADRES) + '">' +
      '<p class="fsp-hulp">Die besigheidsadres staan vooraf ingevul. Verander dit net as die konsultasie elders is.</p></div>' +
      '<p class="fsp-hulp" id="k-aanlyn-nota"' + (aanlyn ? "" : ' style="display:none"') + ">Teams of Zoom. Stuur die skakel self per e-pos; die persoonlike bladsy sê dat dit voor die tyd kom.</p>" +
      '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="k-stoor">' + (reg.kons ? "Stoor die verandering" : "Stoor die konsultasie") + "</button></div></div>";

    // Die mense
    h += '<div class="fsp-rooster"><div class="fsp-kaart"><h3>Die leerder of student</h3><dl class="fsp-dl">' +
      "<dt>Ouderdom</dt><dd>" + esc(ouderdom) + " jaar by registrasie</dd>" +
      "<dt>" + (l.soort === "student" ? "Studiejaar" : "Graad") + "</dt><dd>" + esc(graad_teks(l)) + "</dd>" +
      "<dt>Geboortedatum</dt><dd>" + esc(l.geboortedatum) + "</dd>" +
      "<dt>Voorkeurtaal</dt><dd>" + (en ? "Engels" : "Afrikaans") + "</dd>" +
      "<dt>E-pos</dt><dd>" + (l.epos ? esc(l.epos) : '<span style="color:var(--grys-teks)">Nie gegee nie</span>') + "</dd>" +
      "<dt>Selnommer</dt><dd>" + (l.sel ? esc(l.sel) : '<span style="color:var(--grys-teks)">Nie gegee nie</span>') + "</dd>" +
      "<dt>Geregistreer</dt><dd>" + esc(kort(reg.geskep_op)) + "</dd></dl></div>" +
      '<div class="fsp-kaart"><h3>Die rekeningpligtige</h3>' +
      (reg.rp.self ? '<p style="margin:0 0 6px;font-size:14px">Die student is self die rekeningpligtige.</p>'
        : '<dl class="fsp-dl"><dt>Naam</dt><dd>' + esc(reg.rp.naam + " " + reg.rp.van) + "</dd><dt>E-pos</dt><dd>" + esc(reg.rp.epos) + "</dd><dt>Selnommer</dt><dd>" + esc(reg.rp.sel) + "</dd></dl>");
    const klient = (opsom.klient && opsom.klient.nommer) || (reg.klient && reg.klient.nommer);
    if (klient) {
      const reel = "Studievaardigheidskonsultasie: " + volle_naam + " (" + reg.no + ")";
      h += '<a class="fsp-klientskakel" href="faktuurpaneel.html#registers">Kliënt ' + esc(klient) + " in Boekhouding</a>" +
        '<div class="fsp-aksies"><a class="fsp-knop fsp-knop-lig" href="faktuur.html?klient=' + encodeURIComponent(klient) + "&reel=" + encodeURIComponent(reel) + '">Skep \'n faktuur</a></div>' +
        '<p class="fsp-hulp">Die faktuur open met hierdie kliënt gekies en die eerste reël reeds ingevul: <i>' + esc(reel) + "</i>.</p>";
    } else if (reg.toets) {
      h += '<p class="fsp-hulp">Toetsregistrasie: nie in die kliënteregister nie.</p>';
    } else {
      h += '<p class="fsp-waarsku">Nog nie in die kliënteregister nie. Maak die lys weer oop; die koppeling word dan herprobeer.</p>';
    }
    h += "</div></div>";

    // Bestaande persoonlike bladsye
    bladsye.forEach((b, i) => {
      const verval = Date.parse(b.verval_op) < Date.now();
      const o = ontvanger(reg, b);
      h += '<div class="fsp-kaart"><h3>' + (b.wie === "ouer" ? "Vraelys vir die ouer" : "Vraelys vir " + esc(l.naam)) + "</h3>" +
        '<p class="fsp-hulp" style="margin:0 0 10px">Uitgereik ' + esc(kort(b.uitgereik_op)) + ". " +
        (verval ? '<b style="color:#B8451F">Verval op ' + esc(dt(Date.parse(b.verval_op), "af")) + ".</b>" : "Bly oop tot " + esc(dt(Date.parse(b.verval_op), "af")) + ".") + "</p>" +
        b.vraelyste.map((v) => '<div class="fsp-vraelys"><b>' + esc(instr(v).naam[en ? "en" : "af"]) + "</b>" +
          (b.merk && b.merk[v] ? '<span class="fsp-status klaar">Voltooi, gemerk ' + esc(kort(b.merk[v])) + "</span>" : '<span class="fsp-status">Nog nie as voltooi gemerk nie</span>') + "</div>").join("") +
        (verval
          ? '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" data-hernu="' + esc(b.token) + '">Reik \'n nuwe skakel uit</button></div>' +
            '<p class="fsp-hulp">Die ou skakel bly dood. Die nuwe een is weer 30 dae geldig, en merkies wat reeds gemaak is, bly staan.</p>'
          : '<label class="fsp-et" style="margin-top:12px" for="bs-' + i + '">Boodskap in ' + (en ? "Engels" : "Afrikaans") + "</label>" +
            '<textarea class="fsp-boodskap" id="bs-' + i + '">' + esc(reg.kons ? boodskap(reg, b) : b.skakel) + "</textarea>" +
            '<p class="fsp-wie">Gaan na ' + esc(o.rol) + ": " + esc(o.naam) + ", " + esc(o.sel || o.epos) + "</p>" +
            '<div class="fsp-aksies">' +
            (o.sel ? '<a class="fsp-knop fsp-knop-wa" target="_blank" rel="noopener" data-wa="' + i + '" href="#">Stuur per WhatsApp</a>' : "") +
            '<a class="fsp-knop fsp-knop-lig" data-epos="' + i + '" href="#">Stuur per e-pos</a>' +
            '<button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#bs-' + i + '">Kopieer boodskap</button></div>') +
        "</div>";
    });

    // 'n Nuwe bladsy: opsioneel
    const het_leerder = bladsye.some((b) => b.wie === "leerder");
    const het_ouer = bladsye.some((b) => b.wie === "ouer");
    const jonk = ouderdom < 10;
    const lo = !het_leerder && !jonk ? INSTR.filter((i) => i.aktief && i.vir === "leerder") : [];
    const oo = !het_ouer && !reg.rp.self ? INSTR.filter((i) => i.aktief && i.vir === "ouer") : [];
    if (lo.length || oo.length) {
      h += '<div class="fsp-kaart"><h3>' + (bladsye.length ? "Nog 'n vraelys ter voorbereiding" : "Vraelys ter voorbereiding") +
        ' <span style="font-weight:500;color:var(--grys-teks)">(opsioneel)</span></h3>' +
        (reg.kons ? '<div class="fsp-sper" id="k-sper"></div>' : '<p class="fsp-hulp" style="margin:0 0 10px">Stoor eers die konsultasie hierbo; die sperdatum word daaruit bereken.</p>') +
        (lo.length ? '<div class="fsp-veld"><span class="fsp-et">Vir ' + esc(l.naam) + '</span><div class="fsp-merkies">' +
          lo.map((i) => '<label><input type="checkbox" data-kies="' + esc(i.id) + '"> ' + esc(i.naam.af) + "</label>").join("") + "</div>" +
          '<div id="epos-nodig" hidden style="margin-top:10px"><label class="fsp-et" for="l-epos-nuut">' + esc(l.naam) + " se e-posadres</label>" +
          '<input type="email" id="l-epos-nuut" class="fsp-invoer" placeholder="Nodig vir die profiel op futuresharp.co">' +
          '<p class="fsp-hulp">' + esc(l.naam) + " skep met hierdie adres 'n profiel op futuresharp.co, sodat die antwoorde aan hom of haar gekoppel kan word.</p></div></div>" : "") +
        (jonk && !het_leerder ? '<p class="fsp-hulp" style="margin:0 0 10px">' + esc(l.naam) + " is jonger as 10. Daar is tans geen vraelys vir hierdie ouderdom nie.</p>" : "") +
        (oo.length ? '<div class="fsp-veld"><span class="fsp-et">Vir die ouer (' + esc(reg.rp.naam + " " + reg.rp.van) + ')</span><div class="fsp-merkies">' +
          oo.map((i) => '<label><input type="checkbox" data-kies="' + esc(i.id) + '"> ' + esc(i.naam.af) + "</label>").join("") + "</div></div>" : "") +
        '<button type="button" class="fsp-knop fsp-knop-hoof" id="reik-uit"' + (reg.kons ? "" : " disabled") + ">Skep die persoonlike bladsy</button>" +
        '<p class="fsp-hulp">Elke bladsy is 30 dae geldig. Die boodskap om te stuur verskyn sodra dit geskep is.</p></div>';
    } else if (jonk && !bladsye.length) {
      h += '<div class="fsp-kaart"><h3>Vraelys ter voorbereiding</h3><p style="margin:0;font-size:14px">' + esc(l.naam) + " is jonger as 10. Daar is tans geen vraelys vir hierdie ouderdom nie.</p></div>";
    }

    // Toestemming, met die presiese teks soos aanvaar
    h += '<div class="fsp-kaart"><h3>Toestemming</h3>' + (reg.toestemmings || []).map((t) => {
      const naam = { privaatheidsverklaring: "Privaatheidsverklaring gelees", popia: "POPIA-toestemming", vraelys_onder_12: "Toestemming vir 'n vraelys (onder 12)" }[t.soort] || t.soort;
      return '<div class="fsp-toestem">✓ ' + esc(naam) + " deur " + esc(t.deur) + ", " + esc(kort(t.aanvaar_op)) + " (weergawe " + esc(t.weergawe) + ", " + (t.taal === "en" ? "Engels" : "Afrikaans") + ")" +
        "<details><summary>Wys die presiese teks soos aanvaar</summary><blockquote>" + esc(t.teks) + "</blockquote></details></div>";
    }).join("") + "</div>";

    $("#fsp-een").innerHTML = h;
    bind_een(reg, bladsye);
  }

  function bind_een(reg, bladsye) {
    for (const rb of $$('input[name="k-wyse"]')) {
      rb.onchange = () => {
        const a = $('input[name="k-wyse"]:checked').value === "aanlyn";
        $("#k-adres-veld").style.display = a ? "none" : "";
        $("#k-aanlyn-nota").style.display = a ? "" : "none";
      };
    }

    $("#k-stoor").onclick = async (e) => {
      const d = $("#k-dag").value;
      if (!d) { kennis("Kies eers die datum"); $("#k-dag").focus(); return; }
      // Die tyd is Suid-Afrikaanse tyd (UTC+2, geen somertyd nie), ongeag
      // in watter tydsone die toestel self staan.
      const ms = new Date(d + "T" + ($("#k-tyd").value || "09:00") + ":00+02:00").getTime();
      const wyse = $('input[name="k-wyse"]:checked').value;
      e.target.disabled = true;
      try {
        const uit = await portaal({ aksie: "konsultasie", no: reg.no, op: new Date(ms).toISOString(), wyse, adres: wyse === "persoon" ? $("#k-plek").value : "" });
        reg.kons = uit.kons;
        const r = LYS.find((x) => x.no === reg.no);
        if (r) r.kons = uit.kons;
        kennis(ms < Date.now() ? "Gestoor. Let wel: die datum is in die verlede." : "Konsultasie gestoor");
        teken_een();
      } catch (f) {
        kennis("Kon nie stoor nie: " + f.message);
        e.target.disabled = false;
      }
    };

    const ks = $("#k-sper");
    if (ks && reg.kons) {
      const sp = Date.parse(reg.kons.op) - SPER_MS;
      ks.textContent = sp < Date.now()
        ? "Minder as 48 uur voor die konsultasie. Die boodskap en die bladsy vra dan dat die vraelys so gou moontlik voltooi word, sodat die verslag betyds gereed is."
        : "Sperdatum op die bladsy: " + dt(sp, "af", true) + ", 48 uur voor die konsultasie.";
    }

    function werk_epos_nodig() {
      const blok = $("#epos-nodig");
      if (!blok) return;
      const kies = $$("[data-kies]").some((c) => c.checked && instr(c.dataset.kies).vir === "leerder");
      blok.hidden = !(kies && !reg.leerder.epos);
    }
    for (const c of $$("[data-kies]")) c.onchange = werk_epos_nodig;

    for (const a of $$("[data-wa]")) {
      const b = bladsye[+a.dataset.wa];
      a.onclick = () => { a.href = "https://wa.me/" + wa_nommer(ontvanger(reg, b).sel) + "?text=" + encodeURIComponent($("#bs-" + a.dataset.wa).value); };
    }
    for (const a of $$("[data-epos]")) {
      const b = bladsye[+a.dataset.epos];
      a.onclick = () => {
        const onderwerp = reg.leerder.voorkeurtaal === "en" ? "Preparing for your Future Sharp consultation" : "Voorbereiding vir jou Future Sharp-konsultasie";
        a.href = "mailto:" + ontvanger(reg, b).epos + "?subject=" + encodeURIComponent(onderwerp) + "&body=" + encodeURIComponent($("#bs-" + a.dataset.epos).value);
      };
    }
    for (const bt of $$("[data-hernu]")) {
      bt.onclick = async () => {
        bt.disabled = true;
        try {
          await portaal({ aksie: "hernu", token: bt.dataset.hernu });
          kennis("Nuwe skakel uitgereik");
          await herlaai_een(reg.no);
        } catch (f) {
          kennis("Kon nie: " + f.message);
          bt.disabled = false;
        }
      };
    }

    const knop = $("#reik-uit");
    if (knop) {
      knop.onclick = async () => {
        const gekies = $$("[data-kies]").filter((c) => c.checked).map((c) => c.dataset.kies);
        if (!gekies.length) { kennis("Kies ten minste een vraelys"); return; }
        const leerder = gekies.filter((id) => instr(id).vir === "leerder");
        const ouer = gekies.filter((id) => instr(id).vir === "ouer");
        const liggaam = { aksie: "skep_bladsy", no: reg.no, leerder, ouer };
        if (leerder.length && !reg.leerder.epos) {
          const e = ($("#l-epos-nuut").value || "").trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { kennis("Vul eers " + reg.leerder.naam + " se e-posadres in"); $("#l-epos-nuut").focus(); return; }
          liggaam.leerder_epos = e;
        }
        knop.disabled = true;
        try {
          await portaal(liggaam);
          kennis("Bladsy geskep");
          await herlaai_een(reg.no);
        } catch (f) {
          kennis(f.message);
          knop.disabled = false;
        }
      };
    }
  }

  // Na 'n handeling: laai die registrasie weer, en werk die lys se ry
  // plaaslik by (die portaal se lys is dalk nog nie konsekwent nie).
  async function herlaai_een(no) {
    const data = await portaal({ aksie: "een", no });
    HUIDIG = data;
    const r = LYS.find((x) => x.no === no);
    if (r) {
      r.kons = data.registrasie.kons;
      r.bladsye = (data.bladsye || []).map((b) => ({ wie: b.wie, vraelyste: b.vraelyste, merk: b.merk || {}, uitgereik_op: b.uitgereik_op, verval_op: b.verval_op, vervang: Boolean(b.vervang_deur) }));
    }
    teken_een();
  }

  // ---------- Vraelyste en adres ----------
  async function laai_instellings() {
    try {
      const data = await portaal({ aksie: "instellings" });
      INSTR = data.instrumente || [];
      ADRES = data.adres || "";
      $("#fsp-adres").value = ADRES;
      teken_instr();
    } catch (f) {
      $("#fsp-instrumente").innerHTML = '<p class="fsp-leeg">Kon nie laai nie: ' + esc(f.message) + "</p>";
    }
  }

  function teken_instr() {
    $("#fsp-instrumente").innerHTML = INSTR.map((i, n) =>
      '<div class="fsp-instrument' + (i.aktief ? "" : " onaktief") + '" data-n="' + n + '">' +
      '<div class="fsp-instr-kop"><b>' + esc(i.naam.af || "Nuwe vraelys") + "</b>" +
      '<span class="fsp-stand ' + (i.aktief ? "voltooi" : "verval") + '">' + (i.aktief ? "Aktief" : "Gedeaktiveer") + "</span></div>" +
      '<div class="fsp-twee">' +
      '<label><span class="fsp-klein-et">Naam in Afrikaans</span><input type="text" class="fsp-invoer" value="' + esc(i.naam.af) + '" data-v="naam.af"></label>' +
      '<label><span class="fsp-klein-et">Naam in Engels</span><input type="text" class="fsp-invoer" value="' + esc(i.naam.en) + '" data-v="naam.en"></label>' +
      '<label><span class="fsp-klein-et">Afrikaanse skakel</span><input type="url" class="fsp-invoer" value="' + esc(i.skakel.af) + '" placeholder="https://" data-v="skakel.af"></label>' +
      '<label><span class="fsp-klein-et">Engelse skakel</span><input type="url" class="fsp-invoer" value="' + esc(i.skakel.en) + '" placeholder="https://" data-v="skakel.en"></label>' +
      "</div>" +
      '<div class="fsp-instr-onder"><label><span class="fsp-klein-et">Vir wie</span><select data-v="vir">' +
      '<option value="leerder"' + (i.vir === "leerder" ? " selected" : "") + ">Leerder of student</option>" +
      '<option value="ouer"' + (i.vir === "ouer" ? " selected" : "") + ">Ouer</option></select></label>" +
      '<button type="button" class="fsp-knop fsp-knop-lig" data-wissel="' + n + '">' + (i.aktief ? "Deaktiveer" : "Aktiveer weer") + "</button></div></div>"
    ).join("") || '<p class="fsp-leeg">Nog geen vraelyste nie.</p>';
    for (const bt of $$("[data-wissel]")) {
      bt.onclick = () => { lees_instr(); const i = INSTR[+bt.dataset.wissel]; i.aktief = !i.aktief; teken_instr(); kennis(i.aktief ? "Weer aktief. Druk Stoor." : "Gedeaktiveer. Druk Stoor."); };
    }
  }

  function lees_instr() {
    for (const k of $$("#fsp-instrumente .fsp-instrument")) {
      const i = INSTR[+k.dataset.n];
      for (const inp of $$("[data-v]", k)) {
        const [a, b] = inp.dataset.v.split(".");
        if (b) i[a][b] = inp.value.trim();
        else i[a] = inp.value;
      }
    }
  }

  // ---------- Begin ----------
  function geen_toegang(teks) {
    if (teks) $("#fsp-geen-toegang-teks").textContent = teks;
    $("#fsp-geen-toegang").style.display = "";
    $("#fsp-paneel").style.display = "none";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const hoof = $("#fsp-hoof");
    const wys = () => { hoof.style.visibility = "visible"; };

    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie) { geen_toegang(null); wys(); return; }

    const epos = $("#paneel-gebruiker-epos");
    if (epos && sessie.gebruiker) epos.textContent = sessie.gebruiker.email;

    if (!identiteit_het_rol(sessie.gebruiker, "boekhouding")) {
      geen_toegang("Hierdie rekening het nie toegang tot die Future Sharp-area nie. Is die rol pas bygesit, meld een keer af en weer aan.");
      wys();
      return;
    }

    $("#fsp-paneel").style.display = "";
    wys();

    for (const p of $$("#fsp-kieslys .fsp-pil")) {
      p.addEventListener("click", () => {
        HUIDIG = null;
        wys_afdeling(p.dataset.gaan);
        if (p.dataset.gaan === "leerders") teken_lys();
      });
    }
    $("#fsp-terug").onclick = () => { HUIDIG = null; wys_afdeling("leerders"); teken_lys(); };
    $("#fsp-soek").addEventListener("input", (e) => {
      soek = e.target.value;
      if (soek && filter === "aandag") filter = "alles";
      teken_lys();
    });

    $("#fsp-skrap-toets").onclick = async () => {
      if (!confirm("Skrap alle toetsregistrasies en hul bladsye? Die regte registrasies bly staan.")) return;
      try {
        const uit = await portaal({ aksie: "skrap_toets" });
        kennis(uit.geskrap + " toetsregistrasie(s) geskrap");
        await laai_lys();
      } catch (f) { kennis("Kon nie: " + f.message); }
    };

    $("#fsp-nuwe-instr").onclick = () => {
      lees_instr();
      INSTR.push({ id: "", naam: { af: "", en: "" }, vir: "leerder", aktief: true, skakel: { af: "", en: "" } });
      teken_instr();
      const laaste = $$("#fsp-instrumente .fsp-instrument").pop();
      laaste.scrollIntoView({ block: "center" });
      $("input", laaste).focus();
    };
    $("#fsp-stoor-instr").onclick = async (e) => {
      lees_instr();
      if (INSTR.some((i) => i.aktief && (!i.naam.af || !i.naam.en))) { kennis("Elke aktiewe vraelys het 'n naam in albei tale nodig"); return; }
      e.target.disabled = true;
      try {
        const uit = await portaal({ aksie: "stoor_instrumente", lys: INSTR });
        INSTR = uit.instrumente;
        teken_instr();
        kennis("Die vraelyste is gestoor");
      } catch (f) {
        kennis(f.message);
      } finally {
        e.target.disabled = false;
      }
    };
    $("#fsp-stoor-adres").onclick = async () => {
      try {
        const uit = await portaal({ aksie: "stoor_adres", adres: $("#fsp-adres").value });
        ADRES = uit.adres;
        kennis("Die adres is gestoor");
      } catch (f) { kennis(f.message); }
    };

    await laai_lys();
  });
})();
