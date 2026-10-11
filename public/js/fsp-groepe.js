// public/js/fsp-groepe.js
//
// GROEPSKAKELS IN DIE FUTURE SHARP-PANEEL (Oktober 2026). Eie lêer: dit sit
// self die pil "Groepskakels" en sy afdeling by, en die sjablone onder Vraelyste,
// sonder dat futuresharp-paneel.js hoef te verander.
//
// Een skakel vir 'n hele skool of groep: die ouers, die leerders of die
// onderwysers. Die skakel bly aktief tot julle dit deaktiveer. Die portaal bou die
// bladsy (/portaal/g/<slug>) en heg die skool se naam aan elke vraelysskakel,
// sodat julle die groep se antwoorde in FSF kan uitsorteer.
//
// Die boodskap kom uit die sjabloon vir die gehoor: {skool} word die naam en
// {skakel} die skakel, met ?taal= sodat elke taal se deel die bladsy in sy
// eie taal oopmaak. Geen WhatsApp-knoppie nie: julle kopieer die boodskap na
// die WhatsApp-oortjie wat reeds oop is.
//
// DIE VOORSKOU IN WHATSAPP (beeld, titel, beskrywing) is tweetalig, Afrikaans
// of English, per groep gekies. WhatsApp wys die voorskou van die eerste
// skakel in die boodskap, dus bepaal die groep dit, nie die skakel nie. Dit
// kan later verander sonder 'n nuwe skakel.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const VOORSKOU = { tw: "Tweetalig", af: "Afrikaans", en: "English" };
  const GEHOOR = { ouer: ["ouers", "Ouers"], leerder: ["leerders", "Leerders"], onderwyser: ["onderwysers", "Onderwysers"] };
  const MAANDE = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const kort = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.getDate() + " " + MAANDE[d.getMonth()] + " " + d.getFullYear() : ""; };

  const S = { groepe: [], instr: [], sjablone: null, gekies: null, filter: "oop", soek: "", tale: ["af", "en"], sj_gehoor: "ouer" };

  async function portaal(liggaam) {
    const r = await fetch("/.netlify/functions/portaal", {
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
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2600);
  }

  // ---------- Die boodskap ----------
  function boodskap(g) {
    const sj = (S.sjablone && S.sjablone[g.vir]) || {};
    return g.tale
      .map((t) => String(sj[t] || "").replace(/\{skool\}/g, g.naam).replace(/\{skakel\}/g, g.skakel + (g.tale.length > 1 ? "?taal=" + t : "")))
      .join("\n\n---\n\n");
  }

  function voorskou_opsies(tale, kies) {
    const moontlik = tale.length > 1 ? ["tw", "af", "en"] : tale;
    return moontlik.map((v) => '<option value="' + v + '"' + (v === kies ? " selected" : "") + ">" + VOORSKOU[v] + "</option>").join("");
  }

  function vraelys_name(g) {
    return g.vraelyste.map((id) => { const i = S.instr.find((x) => x.id === id); return i ? i.naam.af : id; }).join(", ");
  }

  // ---------- Bou die afdeling ----------
  function bou() {
    const nav = $("#fsp-kieslys");
    const vraelyste = $('section[data-afdeling="vraelyste"]');
    if (!nav || !vraelyste || $('[data-gaan="groepe"]', nav)) return;

    const pil = document.createElement("button");
    pil.type = "button";
    pil.className = "fsp-pil";
    pil.dataset.gaan = "groepe";
    pil.textContent = "Groepskakels";
    // Tussen Konsultasies en Vraelyste: die eerste twee is mense aan wie
    // julle skakels stuur, Vraelyste is wat albei gebruik.
    const leerders = $('[data-gaan="leerders"]', nav);
    if (leerders) leerders.insertAdjacentElement("afterend", pil);
    else nav.appendChild(pil);

    const afd = document.createElement("section");
    afd.className = "fsp-afdeling";
    afd.dataset.afdeling = "groepe";
    afd.innerHTML =
      '<div class="fsp-kaart">' +
        "<h2>Nuwe groepskakel</h2>" +
        '<p class="fsp-hulp fsp-hulp-bo">Een skakel vir \'n hele skool of groep. Die skool se naam gaan saam met elke antwoord na die vraelys, sodat julle die groep se antwoorde kan uitsorteer. Die skakel bly aktief tot julle dit deaktiveer.</p>' +
        '<div class="fsp-rooster fsp-gr-rooster">' +
          '<div class="fsp-veld"><label class="fsp-et" for="fsp-gr-naam">Skool of groep</label><input class="fsp-invoer" id="fsp-gr-naam" maxlength="120" placeholder="Bv. Paul Roos Gimnasium"></div>' +
          '<div class="fsp-veld"><label class="fsp-et" for="fsp-gr-soort">Soort skool</label><select id="fsp-gr-soort"><option value="hoer">Hoërskool</option><option value="laer">Laerskool</option></select></div>' +
          '<div class="fsp-veld"><label class="fsp-et" for="fsp-gr-vir">Vir wie</label><select id="fsp-gr-vir"><option value="ouer">Ouer</option><option value="leerder">Leerder of student</option><option value="onderwyser">Onderwyser</option></select></div>' +
        "</div>" +
        '<div class="fsp-veld"><span class="fsp-et">Vraelyste</span><div id="fsp-gr-vrae"></div><p class="fsp-hulp" id="fsp-gr-vrae-hulp"></p></div>' +
        '<div class="fsp-rooster fsp-gr-rooster2">' +
          '<div class="fsp-veld"><span class="fsp-et">Tale</span><div class="fsp-filters fsp-gr-tale"><button type="button" class="fsp-filter aan" data-taal="af">Afrikaans</button><button type="button" class="fsp-filter aan" data-taal="en">English</button></div></div>' +
          '<div class="fsp-veld"><label class="fsp-et" for="fsp-gr-voorskou">WhatsApp-voorskou</label><select id="fsp-gr-voorskou">' + voorskou_opsies(["af", "en"], "tw") + "</select></div>" +
        "</div>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsp-gr-skep">Skep die skakel</button></div>' +
      "</div>" +
      '<div id="fsp-gr-uit" hidden></div>' +
      '<div class="fsp-filters"><input type="search" id="fsp-gr-soek" placeholder="Soek op skool of groep" aria-label="Soek"></div>' +
      '<div class="fsp-filters" id="fsp-gr-filters" role="group" aria-label="Filter"></div>' +
      '<div class="fsp-lys" id="fsp-gr-lys"><p class="fsp-leeg">Word gelaai …</p></div>';
    vraelyste.insertAdjacentElement("afterend", afd);

    // Die sjablone, onder Vraelyste.
    const sj = document.createElement("div");
    sj.className = "fsp-kaart";
    sj.id = "fsp-gr-sjablone";
    sj.innerHTML =
      "<h2>Boodskappe vir groepskakels</h2>" +
      '<p class="fsp-hulp fsp-hulp-bo">Die boodskap wat saam met \'n groepskakel gaan. <b>{skool}</b> word die skool of groep se naam, en <b>{skakel}</b> die skakel. Kies die gehoor om sy boodskap te sien.</p>' +
      '<div class="fsp-filters" id="fsp-gr-sj-gehoor"><button type="button" class="fsp-filter aan" data-sj="ouer">Ouers</button><button type="button" class="fsp-filter" data-sj="leerder">Leerders</button><button type="button" class="fsp-filter" data-sj="onderwyser">Onderwysers</button></div>' +
      '<div class="fsp-twee fsp-gr-sj-twee">' +
        '<label><span class="fsp-klein-et">Afrikaans</span><textarea class="fsp-invoer fsp-gr-sj" data-t="af" rows="12"></textarea></label>' +
        '<label><span class="fsp-klein-et">English</span><textarea class="fsp-invoer fsp-gr-sj" data-t="en" rows="12"></textarea></label>' +
      "</div>" +
      '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsp-gr-sj-stoor">Stoor die boodskappe</button></div>';
    vraelyste.appendChild(sj);

    pil.addEventListener("click", wys);
    afd.addEventListener("click", klik);
    afd.addEventListener("change", (e) => {
      if (e.target.id === "fsp-gr-vir" || e.target.id === "fsp-gr-soort") teken_vrae();
      if (e.target.id === "fsp-gr-vs") verander_voorskou(e.target);
    });
    $("#fsp-gr-soek").addEventListener("input", (e) => { S.soek = e.target.value; teken_lys(); });
    sj.addEventListener("click", klik_sj);
    sj.addEventListener("input", (e) => { if (e.target.classList.contains("fsp-gr-sj") && S.sjablone) S.sjablone[S.sj_gehoor][e.target.dataset.t] = e.target.value; });
    $('[data-gaan="vraelyste"]', nav).addEventListener("click", laai_sjablone);
  }

  function wys() {
    for (const a of $$(".fsp-afdeling")) a.classList.toggle("wys", a.dataset.afdeling === "groepe");
    for (const p of $$("#fsp-kieslys .fsp-pil")) p.classList.toggle("aktief", p.dataset.gaan === "groepe");
    laai();
  }

  async function laai() {
    try {
      const d = await portaal({ aksie: "groepe" });
      S.groepe = d.groepe || [];
      S.instr = d.instrumente || [];
      S.sjablone = d.sjablone || S.sjablone;
      teken_vrae();
      teken_lys();
    } catch (f) {
      $("#fsp-gr-lys").innerHTML = '<p class="fsp-leeg">Kon nie laai nie: ' + esc(f.message) + "</p>";
    }
  }

  // ---------- Die vorm ----------
  function teken_vrae() {
    const vir = $("#fsp-gr-vir").value;
    const soort = $("#fsp-gr-soort").value;
    const ouderdom = soort === "laer" ? ["alle", "laer"] : ["alle", "hoer"];
    const lys = S.instr.filter((i) => i.aktief && i.vir === vir && ouderdom.includes(i.ouderdom || "alle"));
    $("#fsp-gr-vrae").innerHTML = lys.length
      ? lys.map((i) => '<label class="fsp-instrument fsp-gr-vraag"><input type="checkbox" value="' + esc(i.id) + '" checked><b>' + esc(i.naam.af) + '</b><span class="fsp-hulp">' + esc(i.naam.en) + "</span></label>").join("")
      : '<p class="fsp-waarsku">Daar is nog geen aktiewe vraelys vir ' + GEHOOR[vir][0] + (vir === "leerder" ? (soort === "laer" ? " van 9 tot 13" : " van 13 en ouer") : "") + " nie. Voeg dit by onder <b>Vraelyste</b>.</p>";
    $("#fsp-gr-vrae-hulp").innerHTML = "Net die aktiewe vraelyste vir " + GEHOOR[vir][0] + (soort === "laer" ? " by 'n laerskool (9 tot 13 en alle ouderdomme)" : " by 'n hoërskool (13 en ouer en alle ouderdomme)") + " word gewys. Die lys kom uit <b>Vraelyste</b>.";
  }

  async function skep(knop) {
    const naam = $("#fsp-gr-naam").value.trim();
    const vraelyste = $$("#fsp-gr-vrae input:checked").map((c) => c.value);
    const tale = $$(".fsp-gr-tale .fsp-filter.aan").map((b) => b.dataset.taal);
    if (naam.length < 2) return kennis("Tik die skool of groep se naam");
    if (!vraelyste.length) return kennis("Kies ten minste een vraelys");
    if (!tale.length) return kennis("Kies ten minste een taal");
    knop.disabled = true;
    try {
      const d = await portaal({ aksie: "skep_groep", naam, soort: $("#fsp-gr-soort").value, vir: $("#fsp-gr-vir").value, vraelyste, tale, voorskou: $("#fsp-gr-voorskou").value });
      S.groepe.unshift(d.groep);
      S.filter = "oop";
      $("#fsp-gr-naam").value = "";
      kies(d.groep.slug);
      teken_lys();
      kennis("Groepskakel geskep");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
    }
  }

  // ---------- Een groep: skakel, boodskap, sluit ----------
  function kies(slug) {
    S.gekies = slug;
    const g = S.groepe.find((x) => x.slug === slug);
    const uit = $("#fsp-gr-uit");
    if (!g) { uit.hidden = true; return; }
    const vs = g.voorskou || (g.tale.length > 1 ? "tw" : g.tale[0]);
    const beeld = "/portaal/beeld/deel-" + g.vir + "-" + vs + ".jpg?v=1";
    uit.innerHTML =
      '<div class="fsp-strook">' +
        '<div class="fsp-strook-titel">' + esc(g.naam) + " · " + GEHOOR[g.vir][0] + (g.oop ? "" : ' <span class="fsp-stand verval">Onaktief</span>') + "</div>" +
        '<span class="fsp-strook-taal">Skakel</span>' +
        '<code id="fsp-gr-skakel">' + esc(g.skakel) + "</code>" +
        '<button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsp-gr-skakel">Kopieer</button>' +
      "</div>" +
      '<div class="fsp-epos fsp-gr-bod">' +
        '<div class="fsp-gr-beeld"><img src="' + esc(beeld) + '" alt="Voorskou"><div class="fsp-epos-hulp">Voorskou in WhatsApp</div>' +
          '<select id="fsp-gr-vs" aria-label="Taal van die voorskou">' + voorskou_opsies(g.tale, vs) + "</select></div>" +
        '<div class="fsp-epos-titel">Boodskap aan die ' + GEHOOR[g.vir][0] + "</div>" +
        '<div class="fsp-epos-hulp">Uit die sjabloon onder Vraelyste; net die naam en die skakel verander. Jy kan dit hier nog aanpas voor jy kopieer.</div>' +
        '<textarea class="fsp-invoer fsp-gr-teks" id="fsp-gr-teks" rows="14">' + esc(boodskap(g)) + "</textarea>" +
        '<div class="fsp-epos-ry">' +
          '<button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsp-gr-teks">Kopieer boodskap</button>' +
          '<button type="button" class="fsp-knop fsp-knop-lig" id="fsp-gr-pos">Nuwe e-pos</button>' +
          '<button type="button" class="fsp-knop ' + (g.oop ? "fsp-knop-gevaar" : "fsp-knop-lig") + '" id="fsp-gr-sluit">' + (g.oop ? "Deaktiveer die skakel" : "Aktiveer weer") + "</button>" +
        "</div>" +
        '<p class="fsp-hulp">' + vraelys_name(g) + " · " + g.tale.map((t) => (t === "af" ? "Afrikaans" : "English")).join(" en ") + " · " + (g.soort === "laer" ? "laerskool" : "hoërskool") + " · geskep " + kort(g.geskep_op) + (g.oop ? "" : " · gedeaktiveer " + kort(g.gesluit_op)) + "</p>" +
      "</div>";
    uit.hidden = false;
    uit.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function sluit(knop) {
    const g = S.groepe.find((x) => x.slug === S.gekies);
    if (!g) return;
    if (g.oop && !confirm("Deaktiveer die skakel vir " + g.naam + "?")) return;
    knop.disabled = true;
    try {
      const d = await portaal({ aksie: "sluit_groep", slug: g.slug, oop: !g.oop });
      Object.assign(g, d.groep);
      kies(g.slug);
      teken_lys();
      kennis(g.oop ? "Die skakel is weer aktief" : "Die skakel is gedeaktiveer");
    } catch (f) {
      kennis(f.message);
      knop.disabled = false;
    }
  }

  async function verander_voorskou(sel) {
    const g = S.groepe.find((x) => x.slug === S.gekies);
    if (!g) return;
    sel.disabled = true;
    try {
      const d = await portaal({ aksie: "stel_voorskou", slug: g.slug, voorskou: sel.value });
      Object.assign(g, d.groep);
      $(".fsp-gr-beeld img").src = "/portaal/beeld/deel-" + g.vir + "-" + g.voorskou + ".jpg?v=1";
      kennis("Voorskou: " + VOORSKOU[g.voorskou]);
    } catch (f) {
      kennis(f.message);
    } finally {
      sel.disabled = false;
    }
  }

  function pos() {
    const g = S.groepe.find((x) => x.slug === S.gekies);
    if (!g) return;
    const onderwerp = "Future Sharp: " + (g.tale[0] === "en" ? "questionnaire for " : "vraelys vir ") + g.naam;
    location.href = "mailto:?subject=" + encodeURIComponent(onderwerp) + "&body=" + encodeURIComponent($("#fsp-gr-teks").value);
  }

  // ---------- Die lys ----------
  function teken_lys() {
    const oop = S.groepe.filter((g) => g.oop).length;
    const toe = S.groepe.length - oop;
    $("#fsp-gr-filters").innerHTML =
      '<button type="button" class="fsp-filter' + (S.filter === "oop" ? " aan" : "") + '" data-filter="oop">Aktief <b>' + oop + "</b></button>" +
      '<button type="button" class="fsp-filter' + (S.filter === "toe" ? " aan" : "") + '" data-filter="toe">Onaktief <b>' + toe + "</b></button>";
    const q = S.soek.trim().toLowerCase();
    const lys = S.groepe.filter((g) => (S.filter === "oop" ? g.oop : !g.oop) && (!q || g.naam.toLowerCase().includes(q)));
    $("#fsp-gr-lys").innerHTML = lys.length
      ? lys.map((g) =>
          '<div class="fsp-ry" role="button" tabindex="0" data-slug="' + esc(g.slug) + '" data-stand="' + (g.oop ? "gereel" : "verval") + '">' +
            '<div class="fsp-ry-no">' + esc(kort(g.geskep_op)) + "</div>" +
            '<div><div class="fsp-ry-naam">' + esc(g.naam) + '</div><div class="fsp-ry-sub">' + esc(GEHOOR[g.vir][1] + " · " + vraelys_name(g) + " · " + g.tale.map((t) => (t === "af" ? "Afrikaans" : "English")).join(" en ")) + "</div></div>" +
            '<div><span class="fsp-stand ' + (g.oop ? "gereel" : "verval") + '">' + (g.oop ? "Aktief" : "Onaktief") + "</span></div>" +
          "</div>").join("")
      : '<p class="fsp-leeg">' + (S.groepe.length ? "Niks hier nie." : "Nog geen groepskakels nie. Skep die eerste een hierbo.") + "</p>";
  }

  function klik(e) {
    const b = e.target.closest("button, .fsp-ry[data-slug]");
    if (!b) return;
    if (b.dataset.taal) {
      b.classList.toggle("aan");
      const tale = $$(".fsp-gr-tale .fsp-filter.aan").map((x) => x.dataset.taal);
      $("#fsp-gr-voorskou").innerHTML = voorskou_opsies(tale.length ? tale : ["af", "en"], tale.length === 1 ? tale[0] : "tw");
      return;
    }
    if (b.id === "fsp-gr-skep") return skep(b);
    if (b.id === "fsp-gr-sluit") return sluit(b);
    if (b.id === "fsp-gr-pos") return pos();
    if (b.dataset.filter) { S.filter = b.dataset.filter; teken_lys(); return; }
    if (b.dataset.slug) kies(b.dataset.slug);
  }

  // ---------- Die sjablone ----------
  async function laai_sjablone() {
    try {
      const d = await portaal({ aksie: "instellings" });
      S.sjablone = d.sjablone || S.sjablone;
      teken_sj();
    } catch (f) {
      console.error("fsp-groepe sjablone:", f);
    }
  }

  function teken_sj() {
    if (!S.sjablone) return;
    for (const b of $$("#fsp-gr-sj-gehoor .fsp-filter")) b.classList.toggle("aan", b.dataset.sj === S.sj_gehoor);
    for (const t of $$("#fsp-gr-sjablone .fsp-gr-sj")) t.value = S.sjablone[S.sj_gehoor][t.dataset.t] || "";
  }

  async function klik_sj(e) {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sj) { S.sj_gehoor = b.dataset.sj; teken_sj(); return; }
    if (b.id === "fsp-gr-sj-stoor" && S.sjablone) {
      b.disabled = true;
      try {
        const d = await portaal({ aksie: "stoor_sjablone", sjablone: S.sjablone });
        S.sjablone = d.sjablone;
        kennis("Boodskappe gestoor");
      } catch (f) {
        kennis(f.message);
      } finally {
        b.disabled = false;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bou();
    $("#fsp-gr-lys") && $("#fsp-gr-lys").addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.dataset.slug) { e.preventDefault(); kies(e.target.dataset.slug); }
    });
  });
})();
