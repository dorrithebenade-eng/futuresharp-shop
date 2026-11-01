// paneel-geskenke.js
//
// GESKENKE op die paneel (November 2026), bo-aan die afdeling Bestellings.
// Elke geskenk: wie dit gekoop het, vir wie, die boeke, en of dit al ontvang
// is. Personeel kan die geskenkbewys weer stuur, aan die koper of aan 'n
// ander adres. Sien netlify/functions/_geskenke.js.

(function () {
  const API = "/.netlify/functions/geskenke-paneel";
  let geskenke = [];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kop = () => (typeof kry_outorisasie_kop === "function" ? kry_outorisasie_kop() : {});
  const datum = (iso) => (iso ? new Date(new Date(iso).getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "/") : "");

  async function laai() {
    const lys = $("gk-paneel-lys");
    if (!lys) return;
    lys.innerHTML = `<p class="stelsel-boodskap">Word gelaai …</p>`;
    try {
      const resp = await fetch(API, { headers: kop() });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      geskenke = (await resp.json()).geskenke || [];
      teken();
    } catch (fout) {
      console.error("Kon nie geskenke laai nie:", fout);
      lys.innerHTML = `<p class="stelsel-boodskap">Kon nie die geskenke laai nie.</p>`;
    }
  }

  function teken() {
    const lys = $("gk-paneel-lys");
    if (!geskenke.length) {
      lys.innerHTML = `<p class="stelsel-boodskap">Nog geen geskenke nie.</p>`;
      return;
    }
    lys.innerHTML = geskenke
      .map((g) => {
        const status = g.ontvang
          ? `Ontvang ${datum(g.ontvang.op)} deur ${esc(g.ontvang.deur_epos)} (${esc(g.ontvang.bestelnommer)})`
          : "Nog nie ontvang nie";
        return `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${esc(g.kode)}</strong>
            <span class="paneel-produk-outeur">
              ${datum(g.geskep_op)} · ${esc(g.bestelnommer)} · gekoop deur ${esc((g.koper && g.koper.epos) || "")}
              ${g.aan ? ` · vir ${esc(g.aan)}` : ""}${g.van ? ` · van ${esc(g.van)}` : ""}<br>
              ${(g.items || []).map((i) => esc(i.titel)).join(", ")}<br>
              ${status}
            </span>
          </div>
          <div class="paneel-produk-aksies">
            <a class="terug-skakel" href="geskenk.html?kode=${encodeURIComponent(g.kode)}&bewys=1" target="_blank" rel="noopener">Bewys</a>
            <button class="terug-skakel gk-herstuur" data-kode="${esc(g.kode)}">Stuur weer</button>
          </div>
        </div>`;
      })
      .join("");
    lys.querySelectorAll(".gk-herstuur").forEach((b) => b.addEventListener("click", () => herstuur(b)));
  }

  async function herstuur(knoppie) {
    const kode = knoppie.dataset.kode;
    const g = geskenke.find((x) => x.kode === kode) || {};
    const verstek = (g.koper && g.koper.epos) || "";
    const epos = window.prompt("Stuur die geskenkbewys aan watter e-posadres?", verstek);
    if (epos === null) return;
    knoppie.disabled = true;
    try {
      const resp = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...kop() },
        body: JSON.stringify({ aksie: "herstuur", kode, epos: epos.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      knoppie.textContent = resp.ok ? "Gestuur ✓" : data.fout || "Kon nie stuur nie";
    } catch (_) {
      knoppie.textContent = "Kon nie stuur nie";
    }
    setTimeout(() => {
      knoppie.disabled = false;
      knoppie.textContent = "Stuur weer";
    }, 4000);
  }

  function bou() {
    const afdeling = document.querySelector('[data-afdeling-inhoud="bestellings"]');
    if (!afdeling || $("gk-paneel")) return;
    const blok = document.createElement("div");
    blok.id = "gk-paneel";
    blok.style.marginBottom = "20px";
    blok.innerHTML = `
      <details>
        <summary style="cursor:pointer;font-weight:700;font-size:1.05em;padding:6px 0">🎁 Geskenke</summary>
        <p class="paneel-hulp-teks">Elke geskenkkode werk net een keer en verval nie. Die verkoop en die verdeling is by die aankoop aangeteken; die ontvangs is 'n R0-bestelling.</p>
        <div id="gk-paneel-lys"></div>
      </details>
      <hr style="border:0;border-top:1px dashed #E3E0D9;margin:16px 0">`;
    const kop_el = afdeling.querySelector(".paneel-afdeling-kop");
    if (kop_el) kop_el.insertAdjacentElement("afterend", blok);
    else afdeling.prepend(blok);
    blok.querySelector("details").addEventListener("toggle", (e) => {
      if (e.target.open) laai();
    });
  }

  document.addEventListener("DOMContentLoaded", bou);
})();
