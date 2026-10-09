// public/js/fsp-bevestig.js
//
// DIE REKENINGPLIGTIGE SE BEVESTIGING IN DIE FUTURE SHARP-PANEEL. Eie lêer:
// dit haak self in by die lys en by een registrasie, sonder dat
// futuresharp-paneel.js hoef te verander.
//
// As die leerder of student self ingevul het en iemand anders die rekening
// hanteer, bevestig daardie persoon via 'n eie skakel. Tot dan:
//   - die lys wys "Wag op bevestiging" (of "Rekeningpligtige onbekend");
//   - die registrasie gaan nie na die kliënteregister nie (die portaal hou
//     die e-pos terug), en
//   - hier is die skakel en 'n gereedgemaakte boodskap, as julle self wil
//     opvolg.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let kas = null, kas_op = 0, besig = null;

  async function lys() {
    if (kas && Date.now() - kas_op < 20000) return kas;
    if (besig) return besig;
    besig = (async () => {
      const r = await fetch("/.netlify/functions/portaal", {
        method: "POST",
        headers: await identiteit_kop({ "Content-Type": "application/json" }),
        body: JSON.stringify({ aksie: "lys" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.fout || "Fout " + r.status);
      kas = data; kas_op = Date.now();
      return data;
    })();
    try { return await besig; } finally { besig = null; }
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rand = (n) => "R" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sa_nommer = (s) => { let d = String(s || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "27" + d.slice(1); return d; };

  const STAND = { wag: ["Wag op bevestiging", "wag"], nie_ek: ["Rekeningpligtige onbekend", "nie-ek"] };

  function boodskap(r, pryse) {
    const l = (r.naam + " " + r.van).trim();
    const kind = r.bevestig.minderjarig;
    if (r.taal === "en") {
      return "*Future Sharp: study skills consultation for " + l + "*\n\nPlease confirm " + (kind ? "the registration, the cost and the consent" : "the cost") + " at the link below.\n\nCost: first consultation, with two preparatory questionnaires, " + rand(pryse.eerste) + ". Follow-up consultation if needed: " + rand(pryse.opvolg) + " per session.\n\n" + r.bevestig.skakel + "\nRegistration number: " + r.no;
    }
    return "*Future Sharp: studievaardigheidskonsultasie vir " + l + "*\n\nBevestig asseblief " + (kind ? "die registrasie, die koste en die toestemming" : "die koste") + " by die skakel hieronder.\n\nKoste: eerste konsultasie, met twee voorbereidende vraelyste, " + rand(pryse.eerste) + ". Opvolgkonsultasie indien nodig: " + rand(pryse.opvolg) + " per sessie.\n\n" + r.bevestig.skakel + "\nRegistrasienommer: " + r.no;
  }

  function kennis(teks) {
    const k = $("#fsp-kennis");
    if (!k) return;
    k.textContent = teks; k.classList.add("wys");
    clearTimeout(kennis.t); kennis.t = setTimeout(() => k.classList.remove("wys"), 2600);
  }

  // ---- Die lys ----
  async function merk_lys() {
    const rye = $$("#fsp-lys .fsp-ry[data-no]");
    if (!rye.length) return;
    let data;
    try { data = await lys(); } catch { return; }
    const per_no = new Map((data.registrasies || []).map((r) => [r.no, r]));
    for (const ry of rye) {
      if (ry.querySelector(".fsp-bv")) continue;
      const r = per_no.get(ry.dataset.no);
      if (!r || !r.bevestig || !STAND[r.bevestig.stand]) continue;
      const [teks, klas] = STAND[r.bevestig.stand];
      const s = document.createElement("span");
      s.className = "fsp-stand fsp-bv " + klas;
      s.textContent = teks;
      const plek = ry.lastElementChild;
      plek.insertBefore(s, plek.firstChild);
    }
  }

  // ---- Een registrasie ----
  async function merk_een() {
    const een = $("#fsp-een");
    const nr = een && $(".fsp-ry-no", een);
    const eerste = een && $(".fsp-kaart", een);
    if (!nr || !eerste || $("#fsp-bv-kaart", een)) return;
    const no = nr.textContent.trim();
    let data;
    try { data = await lys(); } catch { return; }
    const r = (data.registrasies || []).find((x) => x.no === no);
    if (!r || !r.bevestig || $("#fsp-bv-kaart", een)) return;
    const b = r.bevestig;
    const k = document.createElement("div");
    k.className = "fsp-kaart fsp-bv-kaart";
    k.id = "fsp-bv-kaart";
    let h = "<h3>Bevestiging deur die rekeningpligtige</h3>";
    h += '<p class="fsp-hulp" style="margin-top:0">Die ' + (r.soort === "student" ? "student" : "leerder") + " het self ingevul; " + esc(r.rp_naam) + " hanteer die rekening.</p>";
    if (b.stand === "bevestig") {
      h += '<p class="fsp-bv-ok">✓ Bevestig' + (b.op ? " op " + esc(new Date(b.op).toLocaleDateString("af-ZA")) : "") + ".</p>";
    } else {
      h += '<p class="fsp-bv-stand ' + STAND[b.stand][1] + '">' + STAND[b.stand][0] + (b.stand === "nie_ek" ? ": die persoon het aangedui dat hy of sy nie die rekeningpligtige is nie. Kontak die leerder of student self." : ". " + (b.minderjarig ? "Die vraelyste maak eers oop wanneer dit bevestig is." : "Die registrasie gaan eers ná bevestiging na die kliënteregister.")) + "</p>";
      if (b.stand === "wag") {
        h += '<textarea class="fsp-boodskap" id="fsp-bv-boodskap" readonly>' + esc(boodskap(r, data.pryse || { eerste: 1400, opvolg: 1000 })) + "</textarea>";
        h += '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsp-bv-boodskap">Kopieer boodskap</button>' +
          (r.rp_sel ? '<a class="fsp-knop fsp-knop-lig" target="_blank" rel="noopener" href="https://wa.me/' + sa_nommer(r.rp_sel) + "?text=" + encodeURIComponent(boodskap(r, data.pryse || { eerste: 1400, opvolg: 1000 })) + '">WhatsApp</a>' : "") + "</div>";
      }
    }
    k.innerHTML = h;
    eerste.insertAdjacentElement("afterend", k);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const lys_el = document.getElementById("fsp-lys");
    const een = document.getElementById("fsp-een");
    if (lys_el) new MutationObserver(() => merk_lys()).observe(lys_el, { childList: true });
    if (een) new MutationObserver(() => merk_een()).observe(een, { childList: true, subtree: true });
    // Ná 'n verandering in die paneel moet die lys vars gelaai word.
    document.addEventListener("click", (e) => { if (e.target.closest("#fsp-terug, [data-f]")) kas = null; });
  });
})();
