// public/js/fsp-konsultant.js
//
// KONSULTANTE IN DIE FUTURE SHARP-PANEEL (November 2026). Eie lêer, soos die
// ander fsp-*.js-lêers.
//
// 1. VIR DORRITHÉ EN IGNATIUS (rol boekhouding): 'n kaart "Konsultante" bo-aan
//    die Vraelyste-afdeling. Elke konsultant het 'n naam, 'n kode vir haar
//    skakel, die e-pos waarmee sy aanmeld, en die vraelyste wat sy mag kies.
//    Stoor gaan na konsultante.js.
//
// 2. VIR 'N KONSULTANT (body.fsp-is-konsultant, gestel deur
//    futuresharp-paneel.js): die strook bo die lys heet "Jou
//    registrasieskakel". Die res wat sy nie mag sien nie, verberg
//    fsp-konsultant.css. DIE SKERM IS NIE DIE SLOT NIE: portaal.js weier elke
//    aksie wat nie hare is nie.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PORTAAL = "https://futureshop.futuresharp.co.za/portaal";

  function kennis(teks) {
    const k = $("#fsp-kennis");
    if (!k) return;
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2200);
  }

  async function roep(pad, opsies = {}) {
    const r = await fetch("/.netlify/functions/" + pad, {
      ...opsies,
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.fout || "Fout " + r.status);
    return data;
  }

  // ---------- 2. Die konsultant ----------
  function pas_konsultant_aan() {
    const titel = $(".fsp-strook-titel");
    if (titel && titel.textContent !== "Jou registrasieskakel") titel.textContent = "Jou registrasieskakel";
    const strook = $(".fsp-strook");
    if (strook && !$(".fsp-strook-hulp", strook)) {
      const p = document.createElement("p");
      p.className = "fsp-hulp fsp-strook-hulp";
      p.textContent = "Wie deur hierdie skakel registreer, word outomaties jou kliënt. Jy kry 'n e-pos by elke nuwe registrasie.";
      strook.appendChild(p);
    }
  }

  // ---------- 1. Die Konsultante-kaart ----------
  let KONS = [];
  let INSTR = [];

  function leeg_rekord() {
    return { kode: "", naam: "", epos: "", vraelyste: [], aktief: true };
  }

  function teken_kaart() {
    const kaart = $("#fsp-kons-kaart");
    if (!kaart) return;
    const leerder_instr = INSTR.filter((i) => i.aktief && i.vir !== "ouer");
    let h = "<h2>Konsultante</h2>" +
      '<p class="fsp-hulp fsp-hulp-bo">Elke konsultant meld aan met die e-pos hier en die rol <b>konsultant</b> in Netlify Identity. ' +
      "Sy sien net die registrasies wat deur haar eie skakel kom, en kies net uit die vraelyste wat hier gemerk is. Verander nie 'n kode nadat die skakel uitgestuur is nie.</p>";
    if (!KONS.length) h += '<p class="fsp-leeg">Nog geen konsultante nie.</p>';
    KONS.forEach((k, i) => {
      const skakel = k.kode ? PORTAAL + "/registreer?k=" + k.kode : "";
      h += '<div class="fsp-kons-ry" data-i="' + i + '">' +
        '<div class="fsp-kons-velde">' +
        '<label><span class="fsp-klein-et">Naam</span><input type="text" class="fsp-invoer" data-v="naam" maxlength="120" value="' + esc(k.naam) + '"></label>' +
        '<label><span class="fsp-klein-et">Kode vir die skakel</span><input type="text" class="fsp-invoer" data-v="kode" maxlength="30" placeholder="bv. caitlyn" value="' + esc(k.kode) + '"></label>' +
        '<label class="fsp-kons-breed"><span class="fsp-klein-et">E-pos waarmee sy aanmeld</span><input type="email" class="fsp-invoer" data-v="epos" maxlength="200" value="' + esc(k.epos) + '"></label>' +
        "</div>" +
        '<div class="fsp-klein-et" style="margin-top:8px">Vraelyste wat sy mag kies (leerder of student)</div><div class="fsp-merkies">' +
        (leerder_instr.length
          ? leerder_instr.map((ins) => '<label><input type="checkbox" data-vraelys="' + esc(ins.id) + '"' + (k.vraelyste.includes(ins.id) ? " checked" : "") + "> " + esc((ins.naam && ins.naam.af) || ins.id) + "</label>").join("")
          : '<span class="fsp-hulp">Geen aktiewe leerdervraelyste nie.</span>') +
        "</div>" +
        '<div class="fsp-kons-onder"><label><input type="checkbox" data-v="aktief"' + (k.aktief !== false ? " checked" : "") + "> Aktief</label>" +
        (skakel ? '<code class="fsp-kons-skakel">' + esc(skakel) + '</code><button type="button" class="fsp-knop fsp-knop-lig" data-kopieer-kons="' + esc(skakel) + '">Kopieer</button>' : "") +
        '<button type="button" class="fsp-knop fsp-knop-lig fsp-kons-weg" data-weg="' + i + '">Haal weg</button></div>' +
        "</div>";
    });
    h += '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-lig" id="fsp-kons-nuut">+ Voeg \'n konsultant by</button>' +
      '<button type="button" class="fsp-knop fsp-knop-hoof" id="fsp-kons-stoor">Stoor die konsultante</button></div>';
    kaart.innerHTML = h;
  }

  function lees_vorm() {
    for (const ry of $$("#fsp-kons-kaart .fsp-kons-ry")) {
      const k = KONS[+ry.dataset.i];
      k.naam = $('[data-v="naam"]', ry).value.trim();
      k.kode = $('[data-v="kode"]', ry).value.trim().toLowerCase();
      k.epos = $('[data-v="epos"]', ry).value.trim().toLowerCase();
      k.aktief = $('[data-v="aktief"]', ry).checked;
      k.vraelyste = $$("[data-vraelys]", ry).filter((c) => c.checked).map((c) => c.dataset.vraelys);
    }
  }

  async function laai_kaart() {
    const kaart = $("#fsp-kons-kaart");
    if (!kaart) return;
    kaart.innerHTML = '<h2>Konsultante</h2><p class="fsp-leeg">Word gelaai …</p>';
    try {
      const [k, inst] = await Promise.all([
        roep("konsultante", { method: "GET" }),
        roep("portaal", { method: "POST", body: JSON.stringify({ aksie: "instellings" }) }),
      ]);
      KONS = k.konsultante || [];
      INSTR = inst.instrumente || [];
      teken_kaart();
    } catch (f) {
      kaart.innerHTML = '<h2>Konsultante</h2><p class="fsp-waarsku">Kon nie laai nie: ' + esc(f.message) + "</p>";
    }
  }

  function bou_kaart() {
    const afd = $('section[data-afdeling="vraelyste"]');
    if (!afd || $("#fsp-kons-kaart")) return;
    const kaart = document.createElement("div");
    kaart.className = "fsp-kaart";
    kaart.id = "fsp-kons-kaart";
    afd.insertBefore(kaart, afd.firstChild);

    kaart.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.id === "fsp-kons-nuut") {
        lees_vorm();
        KONS.push(leeg_rekord());
        teken_kaart();
      } else if (b.dataset.weg != null) {
        lees_vorm();
        const k = KONS[+b.dataset.weg];
        if (!window.confirm("Haal " + (k.naam || "hierdie konsultant") + " weg? Sy kom dan nie meer in nie. Om haar net te keer, haal liewer die merkie by Aktief weg.")) return;
        KONS.splice(+b.dataset.weg, 1);
        teken_kaart();
      } else if (b.dataset.kopieerKons) {
        try { await navigator.clipboard.writeText(b.dataset.kopieerKons); kennis("Gekopieer"); } catch (f) { kennis("Kon nie kopieer nie"); }
      } else if (b.id === "fsp-kons-stoor") {
        lees_vorm();
        b.disabled = true;
        try {
          const uit = await roep("konsultante", { method: "POST", body: JSON.stringify({ konsultante: KONS }) });
          KONS = uit.konsultante || [];
          teken_kaart();
          kennis("Konsultante gestoor");
        } catch (f) {
          kennis(f.message);
          b.disabled = false;
        }
      }
    });

    laai_kaart();
  }

  // ---------- Begin ----------
  function begin() {
    if (document.body.classList.contains("fsp-is-konsultant")) {
      pas_konsultant_aan();
      return true;
    }
    const paneel = $("#fsp-paneel");
    if (paneel && paneel.style.display !== "none") {
      bou_kaart();
      return true;
    }
    return false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (begin()) return;
    // Die paneel word eers ná die aanmeldkontrole gewys.
    const waarnemer = new MutationObserver(() => {
      if (begin()) waarnemer.disconnect();
    });
    waarnemer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
  });
})();
