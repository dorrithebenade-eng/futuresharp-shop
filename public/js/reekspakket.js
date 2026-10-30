// reekspakket.js
//
// REEKSPAKKETTE (Oktober 2026). Wie al die e-boeke van 'n reeks in die
// mandjie het, betaal die pakketprys (bv. die 6 Speel-Slim-boeke vir R1 000).
// Die bediener bereken die prys (kry-mandjie-prys, begin-betaling); hierdie
// lêer wys dit net:
//
//   produk.html          -> 'n blok onder die koop-knoppies met
//                           "Sit die hele reeks in my mandjie"
//   mandjie.html         -> 'n reël "Reekspakket: ..." met die afslag, en die
//                           regte totaal
//   voltooi-betaling.html-> gebruik reekspakket_kry_mandjie_prys() (sien
//                           voltooi-betaling.js)

(function () {
  const PAKKETTE_ENDPOINT = "/.netlify/functions/reekspakkette";
  const MANDJIE_PRYS_ENDPOINT = "/.netlify/functions/kry-mandjie-prys";

  const formateer = (sent) => `R${(sent / 100).toFixed(2)}`;
  // R1 000, sonder sent, vir opskrifte.
  const formateer_rond = (sent) => "R" + Math.round(sent / 100).toLocaleString("en-ZA").replace(/,/g, " ");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const taal = () => (typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af");
  const naam = (p) => (taal() === "en" ? p.naam_en || p.naam_af : p.naam_af);
  const tt = (sleutel, terugval) => (typeof t === "function" ? t(sleutel) : terugval) || terugval;

  function datum_kort(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(taal() === "en" ? "en-ZA" : "af-ZA", {
        day: "numeric",
        month: "long",
        timeZone: "Africa/Johannesburg",
      });
    } catch (_) {
      return "";
    }
  }

  // Vir voltooi-betaling.js en die mandjie: die bediener se berekening.
  async function kry_mandjie_prys(items) {
    if (!items || !items.length) return null;
    const resp = await fetch(MANDJIE_PRYS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((i) => ({ produk_slug: i.produk_slug, formaat: i.formaat })) }),
    });
    if (!resp.ok) return null;
    return resp.json();
  }

  function pakket_lyne_html(pakkette, klas) {
    return (pakkette || [])
      .map(
        (p) => `
      <div class="${klas} reekspakket-ry">
        <span>${esc(tt("pakket_reel", "Reekspakket"))}: ${esc(naam(p))}</span>
        <span>−${formateer(p.afslag_sent)}</span>
      </div>`
      )
      .join("");
  }

  window.reekspakket_kry_mandjie_prys = kry_mandjie_prys;
  window.reekspakket_lyne_html = pakket_lyne_html;

  // ----------------------------------------------------------- produkbladsy

  async function produkbladsy() {
    const wrap = document.getElementById("produk-wrap");
    if (!wrap) return;
    const slug = new URLSearchParams(location.search).get("produk");
    if (!slug) return;

    let pakkette = [];
    try {
      const resp = await fetch(PAKKETTE_ENDPOINT);
      if (resp.ok) pakkette = (await resp.json()).pakkette || [];
    } catch (_) {
      return;
    }
    const pakket = pakkette.find((p) => p.slugs.includes(slug));
    if (!pakket || !(pakket.prys_sent < pakket.los_sent)) return;

    const teken = () => {
      const aksies = wrap.querySelector(".produk-aksies");
      if (!aksies || wrap.querySelector(".reekspakket-blok")) return;
      // Wie die boek reeds besit, kan nie die hele reeks in een keer koop nie.
      if (aksies.querySelector(".produk-alreeds-eie-knoppie")) return;

      const tot = datum_kort(pakket.tot);
      const blok = document.createElement("div");
      blok.className = "reekspakket-blok";
      blok.innerHTML = `
        ${tot ? `<span class="reekspakket-etiket">${esc(tt("pakket_tot", "Tot"))} ${esc(tot)}</span>` : ""}
        <p class="reekspakket-teks">
          <strong>${esc(naam(pakket))} ${esc(tt("pakket_vir", "vir"))} ${formateer_rond(pakket.prys_sent)}</strong><br>
          ${esc(tt("pakket_al", "Al"))} ${pakket.slugs.length} ${esc(tt("pakket_eboeke", "e-boeke"))}. <s>${formateer_rond(pakket.los_sent)}</s>
        </p>
        <button type="button" class="kaart-aksie reekspakket-knoppie">${esc(tt("pakket_knoppie", "Sit die hele reeks in my mandjie"))}</button>
      `;
      aksies.insertAdjacentElement("afterend", blok);

      blok.querySelector(".reekspakket-knoppie").addEventListener("click", () => {
        for (const boek of pakket.boeke) {
          if (typeof voeg_by_mandjie === "function") {
            voeg_by_mandjie({ produk_slug: boek.slug, titel: boek.titel, formaat: "eboek", prys_sent: boek.prys_sent });
          }
        }
        window.location.href = "mandjie.html";
      });
    };

    teken();
    new MutationObserver(teken).observe(wrap, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------- mandjie

  let mandjie_besig = false;
  async function mandjiebladsy() {
    const wrap = document.getElementById("mandjie-inhoud");
    if (!wrap) return;

    const werk_by = async () => {
      if (mandjie_besig) return;
      const totaal_ry = wrap.querySelector(".mandjie-totaal-ry");
      if (!totaal_ry || wrap.querySelector(".reekspakket-ry") || totaal_ry.dataset.nagegaan) return;
      mandjie_besig = true;
      totaal_ry.dataset.nagegaan = "1";
      try {
        const prys = await kry_mandjie_prys(typeof kry_mandjie === "function" ? kry_mandjie() : []);
        if (prys && prys.pakkette && prys.pakkette.length && wrap.contains(totaal_ry)) {
          totaal_ry.insertAdjacentHTML("beforebegin", pakket_lyne_html(prys.pakkette, "mandjie-totaal-ry"));
          const bedrag = totaal_ry.querySelector(".mandjie-totaal-bedrag");
          if (bedrag) bedrag.textContent = formateer(prys.totaal_sent);
        }
      } catch (_) {
        /* die gewone totaal bly staan */
      } finally {
        mandjie_besig = false;
      }
    };

    werk_by();
    new MutationObserver(werk_by).observe(wrap, { childList: true, subtree: true });
  }

  function styl() {
    if (document.getElementById("reekspakket-styl")) return;
    const s = document.createElement("style");
    s.id = "reekspakket-styl";
    s.textContent = `
      .reekspakket-blok{margin-top:16px;border:2px dashed var(--teal,#479F91);border-radius:12px;padding:14px 16px;background:#eef7f5}
      .reekspakket-etiket{display:inline-block;background:#171717;color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;padding:4px 8px;border-radius:4px;text-transform:uppercase}
      .reekspakket-teks{margin:8px 0 10px;font-size:15px;line-height:1.45}
      .reekspakket-teks s{color:#999}
      .reekspakket-knoppie{width:100%;background:var(--teal,#479F91);border-color:var(--teal,#479F91)}
      .reekspakket-ry{color:var(--teal,#479F91);font-weight:700}
    `;
    document.head.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", () => {
    styl();
    produkbladsy();
    mandjiebladsy();
  });
})();
