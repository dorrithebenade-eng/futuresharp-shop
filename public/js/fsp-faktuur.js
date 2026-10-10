// public/js/fsp-faktuur.js
//
// SESSIES EN FAKTUUR BY 'N REGISTRASIE (10 Oktober 2026). Eie lêer: dit haak
// self in by een registrasie, sonder dat futuresharp-paneel.js hoef te
// verander. Dit vervang daardie lêer se enkele knoppie "Skep 'n faktuur".
//
// DIE SESSIES is net vir die rekord, vir as 'n ouer vra: die eerste
// konsultasie se datum kom uit die konsultasie wat reeds gestoor is, en die
// opvolgsessies se datums word saam met die registrasie in die portaal gestoor
// (aksie "sessies"). Die datums kom NIE op die faktuur nie.
//
// DIE FAKTUUR bly eenvoudig. Julle merk watter sessies op die faktuur moet
// kom, en die konsep open in Boekhouding met:
//   - Studievaardigheidskonsultasie × die gemerkte sessies, teen die opvolgbedrag;
//   - Vraelyste en verslag × 1, net as die eerste konsultasie gemerk is, teen
//     die verskil tussen die eerste bedrag en die opvolgbedrag.
// By R1 400 / R1 000 is dit R1 000 per konsultasie plus R400.
//
// Die bedrae is dié wat by registrasie aanvaar is; anders die huidige bedrae
// uit die koste-instellings. Die verdeling, die uitreiking en die stuur gebeur
// net in Boekhouding.
//
// Die registrasienommer staan op albei reëls, sodat die faktuurslot (fakture_vir
// in _portaal.js) die registrasie herken.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rand = (n) => "R" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const datum_lank = (iso) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("af-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }) : "";
  };

  const REEL = {
    af: { kons: "Studievaardigheidskonsultasie", vrae: "Vraelyste en verslag" },
    en: { kons: "Study skills consultation", vrae: "Questionnaires and report" },
  };

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
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2200);
  }

  // Die bedrae: eers die aanvaarde (koste of koste_kennis), dan die huidige.
  function pryse_vir(reg, huidig) {
    const t = (reg.toestemmings || []).find((x) => (x.soort === "koste" || x.soort === "koste_kennis") && x.bedrae);
    const p = (t && t.bedrae) || huidig || {};
    const eerste = Number(p.eerste), opvolg = Number(p.opvolg);
    if (!(eerste > 0) || !(opvolg > 0)) return null;
    return { kons: opvolg, vrae: Math.max(0, eerste - opvolg) };
  }

  let besig = null;

  async function bou(een) {
    const nr = $(".fsp-ry-no", een);
    if (!nr || $("#fsp-ff-kaart", een)) return;
    const no = nr.textContent.trim();
    if (besig === no) return;
    besig = no;
    try {
      const [data, inst] = await Promise.all([portaal({ aksie: "een", no }), portaal({ aksie: "instellings" }).catch(() => ({}))]);
      // Die bladsy kon intussen na 'n ander registrasie gegaan het.
      const nu = $(".fsp-ry-no", een);
      if (!nu || nu.textContent.trim() !== no || $("#fsp-ff-kaart", een)) return;
      teken(een, data, inst.pryse);
    } catch (f) {
      console.error("fsp-faktuur:", f);
    } finally {
      besig = null;
    }
  }

  function teken(een, data, huidige_pryse) {
    const reg = data.registrasie;
    const gefaktureer = data.gefaktureer || [];
    const pryse = pryse_vir(reg, huidige_pryse);

    // Die paneel se eie knoppie en sy hulpsin gaan weg; die kliënt kom uit sy skakel.
    const ou = $('a[href^="faktuur.html?klient="]', een);
    let klient = null;
    if (ou) {
      klient = new URLSearchParams(ou.getAttribute("href").split("?")[1]).get("klient");
      const aksies = ou.closest(".fsp-aksies");
      const hulp = aksies && aksies.nextElementSibling;
      if (hulp && hulp.classList.contains("fsp-hulp")) hulp.remove();
      if (aksies) aksies.remove();
    }

    // Die nuwe kaart kom ná die rooster met die leerder en die rekeningpligtige.
    const rp_kop = $$(".fsp-kaart h3", een).find((h) => h.textContent.trim() === "Die rekeningpligtige");
    const rooster = rp_kop && rp_kop.closest(".fsp-rooster");
    if (!rooster) return;

    const S = {
      eerste: !gefaktureer.length,
      sessies: (reg.sessies || []).map((s) => ({ datum: s.datum || "", merk: false })),
    };

    const k = document.createElement("div");
    k.className = "fsp-kaart fsp-ff-kaart";
    k.id = "fsp-ff-kaart";
    rooster.insertAdjacentElement("afterend", k);

    let stoor_belofte = Promise.resolve();
    function stoor() {
      const lys = S.sessies.map((s) => s.datum);
      stoor_belofte = stoor_belofte.then(() => portaal({ aksie: "sessies", no: reg.no, lys }))
        .then(() => kennis("Sessies gestoor"))
        .catch((f) => kennis("Kon nie stoor nie: " + f.message));
      return stoor_belofte;
    }

    function totaal() {
      const n = (S.eerste ? 1 : 0) + S.sessies.filter((s) => s.merk).length;
      return { n, bedrag: pryse ? n * pryse.kons + (S.eerste ? pryse.vrae : 0) : 0 };
    }

    function skakel() {
      const t = totaal();
      if (!klient || !pryse || !t.n) return null;
      const taal = reg.vorm_taal === "en" ? "en" : "af";
      const naam = reg.leerder.naam + " " + reg.leerder.van;
      const agter = ": " + naam + " (" + reg.no + ")";
      const q = new URLSearchParams({ klient, reel: REEL[taal].kons + agter, prys: String(pryse.kons), aantal: String(t.n), taal });
      if (S.eerste && pryse.vrae > 0) { q.set("reel2", REEL[taal].vrae + agter); q.set("prys2", String(pryse.vrae)); }
      return "faktuur.html?" + q.toString();
    }

    function opsom() {
      const t = totaal();
      const deel = [];
      if (t.n) deel.push(t.n + " × konsultasie teen " + rand(pryse.kons));
      if (S.eerste && pryse.vrae > 0) deel.push("vraelyste en verslag " + rand(pryse.vrae));
      return t.n ? "Op die faktuur: " + deel.join(" plus ") + ". Totaal " + rand(t.bedrag) + "." : "Merk ten minste een sessie.";
    }

    function herteken() {
      let h = "<h3>Sessies</h3>";
      if (gefaktureer.length) h += '<p class="fsp-ff-reeds">Reeds gefaktureer: ' + esc(gefaktureer.map((f) => f.nommer).join(", ")) + ".</p>";
      h += '<p class="fsp-hulp fsp-ff-bo">Merk die sessies wat op die faktuur moet kom. Die datums is net vir julle rekord en kom nie op die faktuur nie.</p>';
      h += '<div class="fsp-ff-ry"><input type="checkbox" id="fsp-ff-eerste"' + (S.eerste ? " checked" : "") + '><label for="fsp-ff-eerste">Eerste konsultasie</label>' +
        '<span class="fsp-ff-datum">' + (reg.kons ? esc(datum_lank(reg.kons.op)) : '<span class="fsp-ff-geen">Nog geen datum nie</span>') + "</span><span></span></div>";
      S.sessies.forEach((s, i) => {
        h += '<div class="fsp-ff-ry"><input type="checkbox" id="fsp-ff-s' + i + '" data-merk="' + i + '"' + (s.merk ? " checked" : "") + '><label for="fsp-ff-s' + i + '">Opvolgsessie ' + (i + 1) + "</label>" +
          '<input type="date" class="fsp-invoer" data-datum="' + i + '" value="' + esc(s.datum) + '" aria-label="Datum van opvolgsessie ' + (i + 1) + '">' +
          '<button type="button" class="fsp-ff-weg" data-weg="' + i + '" title="Haal weg" aria-label="Haal opvolgsessie ' + (i + 1) + ' weg">×</button></div>';
      });
      h += '<button type="button" class="fsp-ff-by" id="fsp-ff-by">+ Voeg \'n opvolgsessie by</button>';
      if (!klient) {
        h += '<p class="fsp-hulp">' + (reg.toets ? "Toetsregistrasie: nie in die kliënteregister nie, dus geen faktuur nie." : "Die rekeningpligtige is nog nie in die kliënteregister nie; die faktuur kan eers daarna geskep word.") + "</p>";
      } else if (!pryse) {
        h += '<p class="fsp-waarsku">Geen bedrae gevind nie. Stel die koste in by Instellings.</p>';
      } else {
        h += '<p class="fsp-ff-som">' + esc(opsom()) + "</p>";
        h += '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsp-ff-skep"' + (totaal().n ? "" : " disabled") + ">Skep 'n faktuur</button></div>";
        h += '<p class="fsp-hulp">Die faktuur open as konsep in Boekhouding met die kliënt gekies. Die verdeling, die uitreiking en die stuur gebeur daar.</p>';
      }
      k.innerHTML = h;
    }

    k.addEventListener("change", (e) => {
      const el = e.target;
      if (el.id === "fsp-ff-eerste") { S.eerste = el.checked; herteken(); }
      else if (el.dataset.merk != null) { S.sessies[Number(el.dataset.merk)].merk = el.checked; herteken(); }
      else if (el.dataset.datum != null) { S.sessies[Number(el.dataset.datum)].datum = el.value; stoor(); }
    });
    k.addEventListener("click", async (e) => {
      const el = e.target.closest("button");
      if (!el) return;
      if (el.id === "fsp-ff-by") {
        if (S.sessies.length >= 30) return kennis("Hoogstens 30 sessies");
        S.sessies.push({ datum: "", merk: true });
        herteken();
        stoor();
        const d = $$('input[type="date"]', k).pop();
        if (d) d.focus();
      } else if (el.dataset.weg != null) {
        S.sessies.splice(Number(el.dataset.weg), 1);
        herteken();
        stoor();
      } else if (el.id === "fsp-ff-skep") {
        const u = skakel();
        if (!u) return;
        el.disabled = true;
        await stoor_belofte;
        window.location.href = u;
      }
    });

    herteken();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const een = document.getElementById("fsp-een");
    if (een) new MutationObserver(() => bou(een)).observe(een, { childList: true, subtree: true });
  });
})();
