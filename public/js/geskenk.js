// geskenk.js
//
// GESKENKE (November 2026). Die bladsy geskenk.html het twee gesigte:
//
//   geskenk.html?kode=…&bewys=1  -> die GESKENKBEWYS: om te druk, te deel of
//                                   die kode te kopieer (vir die koper)
//   geskenk.html[?kode=…]        -> ONTVANG: die ontvanger tik die kode in,
//                                   meld aan en kry die boeke in sy leeskamer
//
// Sien netlify/functions/_geskenke.js vir die reëls.

(function () {
  const wrap = () => document.getElementById("geskenk-wrap");
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const params = new URLSearchParams(location.search);
  const WERF = "https://futureshop.futuresharp.co.za";

  function styl() {
    const s = document.createElement("style");
    s.textContent = `
      .geskenk-wrap{max-width:560px;margin:0 auto;padding:28px 16px 48px}
      .gk-titel{font-size:26px;margin:0 0 6px}
      .gk-sub{color:#6b6b6b;margin:0 0 18px}
      .gk-bewys{background:#479F91;color:#fff;border-radius:16px;padding:22px 20px;position:relative;overflow:hidden}
      .gk-bewys:before{content:"";position:absolute;top:0;left:0;height:8px;width:120px;background:linear-gradient(90deg,#F5C043 0 65%,#EC5832 65%)}
      .gk-etiket{font-size:12px;letter-spacing:.1em;opacity:.85;margin-top:6px}
      .gk-bewys h2{margin:8px 0 2px;font-size:24px;line-height:1.25}
      .gk-boodskap{background:rgba(255,255,255,.15);border-radius:10px;padding:10px 12px;font-style:italic;margin:14px 0}
      .gk-omslae{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
      .gk-omslae img{width:58px;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,.3);background:#fff}
      .gk-boeke{font-size:14px;margin:0;padding-left:18px}
      .gk-kode{background:#fff;color:#171717;border:2px dashed #F5C043;border-radius:10px;padding:10px 12px;margin-top:14px}
      .gk-kode small{display:block;color:#6b6b6b;font-size:12px}
      .gk-kode b{font-size:24px;letter-spacing:.08em}
      .gk-stappe{font-size:14px;margin:14px 0 0;padding-left:20px}
      .gk-knoppies{display:flex;flex-direction:column;gap:8px;margin-top:16px}
      .gk-knoppies .kaart-aksie{text-align:center;text-decoration:none}
      .gk-lyn{background:#fff !important;color:#479F91 !important;border:2px solid #479F91 !important}
      .gk-invoer{width:100%;font-size:18px;letter-spacing:.06em;text-transform:uppercase}
      .gk-fout{color:#EC5832;font-weight:600;margin:10px 0}
      .gk-sukses{background:#eef7f5;border-radius:12px;padding:16px;margin-top:14px}
      @media print{.mini-kop,.gk-knoppies,.gk-sub{display:none !important}.gk-bewys{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
    document.head.appendChild(s);
  }

  async function haal(kode) {
    const resp = await fetch("/.netlify/functions/kry-geskenk?kode=" + encodeURIComponent(kode));
    if (resp.status === 404) return { fout: "ONBEKEND" };
    if (!resp.ok) return { fout: "FOUT" };
    return resp.json();
  }

  function omslae_html(g) {
    return `<div class="gk-omslae">${g.items
      .map((i) => (i.omslag ? `<img src="${esc(i.omslag)}" alt="${esc(i.titel)}">` : ""))
      .join("")}</div>
      <ul class="gk-boeke">${g.items.map((i) => `<li>${esc(i.titel)}</li>`).join("")}</ul>`;
  }

  function bewys_kaart(g) {
    return `
      <div class="gk-bewys">
        <div class="gk-etiket">FUTURE SHOP · ${esc(t("geskenk_bewys_etiket"))}</div>
        <h2>${g.aan ? esc(t("geskenk_vir")) + " " + esc(g.aan) : esc(t("geskenk_vir_jou"))}</h2>
        ${g.van ? `<div>${esc(t("geskenk_van_kort"))} ${esc(g.van)}</div>` : ""}
        ${g.boodskap ? `<div class="gk-boodskap">“${esc(g.boodskap)}”</div>` : ""}
        ${omslae_html(g)}
        <div class="gk-kode"><small>${esc(t("geskenk_kode_etiket"))}</small><b>${esc(g.kode)}</b></div>
        <ol class="gk-stappe">
          <li>${esc(t("geskenk_stap_1"))} futureshop.futuresharp.co.za/geskenk.html</li>
          <li>${esc(t("geskenk_stap_2"))}</li>
          <li>${esc(t("geskenk_stap_3"))}</li>
        </ol>
      </div>`;
  }

  // ------------------------------------------------------------- bewys

  async function wys_bewys(kode) {
    const g = await haal(kode);
    if (g.fout) {
      wrap().innerHTML = `<p class="gk-fout">${esc(t("geskenk_fout_onbekend"))}</p>`;
      return;
    }
    const deel_teks =
      `🎁 ${g.aan ? t("geskenk_vir") + " " + g.aan : t("geskenk_vir_jou")}` +
      `${g.van ? " " + t("geskenk_van_kort").toLowerCase() + " " + g.van : ""}\n\n` +
      `${g.items.map((i) => "• " + i.titel).join("\n")}\n\n` +
      `${t("geskenk_kode_etiket")}: ${g.kode}\n` +
      `${WERF}/geskenk.html?kode=${encodeURIComponent(g.kode)}`;

    wrap().innerHTML = `
      <h1 class="gk-titel">🎁 ${esc(t("geskenk_bewys_titel"))}</h1>
      <p class="gk-sub">${esc(g.ontvang ? t("geskenk_reeds_ontvang") : t("geskenk_bewys_sub"))}</p>
      ${bewys_kaart(g)}
      <div class="gk-knoppies">
        <a class="kaart-aksie" href="https://wa.me/?text=${encodeURIComponent(deel_teks)}" target="_blank" rel="noopener">💬 ${esc(t("geskenk_deel_whatsapp"))}</a>
        <button type="button" class="kaart-aksie gk-lyn" id="gk-druk">🖨️ ${esc(t("geskenk_druk"))}</button>
        <button type="button" class="kaart-aksie gk-lyn" id="gk-kopieer">${esc(t("geskenk_kopieer_kode"))}</button>
      </div>`;
    document.getElementById("gk-druk").addEventListener("click", () => window.print());
    document.getElementById("gk-kopieer").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(g.kode);
        e.target.textContent = "✓ " + t("geskenk_gekopieer");
      } catch (_) {
        /* die kode staan op die skerm */
      }
    });
  }

  // ------------------------------------------------------------ ontvang

  function wys_invoer(kode, fout) {
    wrap().innerHTML = `
      <h1 class="gk-titel">🎁 ${esc(t("geskenk_ontvang_titel"))}</h1>
      <p class="gk-sub">${esc(t("geskenk_ontvang_sub"))}</p>
      <label class="veld-etiket" for="gk-kode">${esc(t("geskenk_kode_etiket"))}</label>
      <input id="gk-kode" class="veld-invoer gk-invoer" placeholder="GESKENK-XXXX-XXXX" value="${esc(kode || "")}">
      ${fout ? `<p class="gk-fout">${esc(fout)}</p>` : ""}
      <div class="gk-knoppies"><button type="button" class="kaart-aksie" id="gk-kyk">${esc(t("geskenk_kyk"))}</button></div>`;
    const kyk = () => {
      const k = document.getElementById("gk-kode").value.trim().toUpperCase();
      if (k) wys_geskenk(k);
    };
    document.getElementById("gk-kyk").addEventListener("click", kyk);
    document.getElementById("gk-kode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") kyk();
    });
  }

  async function wys_geskenk(kode) {
    const g = await haal(kode);
    if (g.fout) return wys_invoer(kode, t(g.fout === "ONBEKEND" ? "geskenk_fout_onbekend" : "geskenk_fout_algemeen"));
    if (g.ontvang) return wys_invoer(kode, t("geskenk_fout_reeds"));

    wrap().innerHTML = `
      <h1 class="gk-titel">🎁 ${esc(t("geskenk_ontvang_titel"))}</h1>
      ${bewys_kaart(g)}
      <p id="gk-fout" class="gk-fout" hidden></p>
      <div class="gk-knoppies"><button type="button" class="kaart-aksie" id="gk-ontvang">${esc(t("geskenk_ontvang_knoppie"))}</button></div>
      <p class="gk-sub" style="margin-top:10px">${esc(t("geskenk_ontvang_nota"))}</p>`;
    document.getElementById("gk-ontvang").addEventListener("click", () => ontvang(g.kode));
  }

  async function ontvang(kode) {
    const knoppie = document.getElementById("gk-ontvang");
    const fout_el = document.getElementById("gk-fout");
    const terug = `/geskenk.html?kode=${encodeURIComponent(kode)}`;

    const sessie = typeof identiteit_kry_huidige_sessie === "function" ? await identiteit_kry_huidige_sessie() : null;
    if (!sessie || !sessie.access_token) {
      location.href = "/aanmeld.html?terug=" + encodeURIComponent(terug);
      return;
    }

    knoppie.disabled = true;
    knoppie.textContent = t("besig");
    try {
      const resp = await fetch("/.netlify/functions/ontvang-geskenk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessie.access_token}` },
        body: JSON.stringify({ kode }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401) {
        location.href = "/aanmeld.html?terug=" + encodeURIComponent(terug);
        return;
      }
      if (!resp.ok) {
        const sleutel = {
          ONBEKEND: "geskenk_fout_onbekend",
          REEDS_ONTVANG: "geskenk_fout_reeds",
          BESIT_ALMAL: "geskenk_fout_besit_almal",
          GEEN_KOPERPROFIEL: "geen_koperprofiel",
        }[data.fout] || "geskenk_fout_algemeen";
        fout_el.textContent = t(sleutel);
        fout_el.hidden = false;
        knoppie.disabled = false;
        knoppie.textContent = t("geskenk_ontvang_knoppie");
        return;
      }
      wrap().innerHTML = `
        <h1 class="gk-titel">🎉 ${esc(t("geskenk_sukses_titel"))}</h1>
        <div class="gk-sukses">
          <p style="margin:0 0 8px">${esc(t("geskenk_sukses_teks"))}</p>
          <ul class="gk-boeke">${(data.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          ${(data.oorgeslaan || []).length
            ? `<p style="margin:10px 0 0;font-size:14px">${esc(t("geskenk_oorgeslaan"))} ${data.oorgeslaan.map(esc).join(", ")}</p>`
            : ""}
        </div>
        <div class="gk-knoppies"><a class="kaart-aksie" href="my-boeke.html">${esc(t("gaan_na_my_boeke"))}</a></div>`;
    } catch (_) {
      fout_el.textContent = t("geskenk_fout_algemeen");
      fout_el.hidden = false;
      knoppie.disabled = false;
      knoppie.textContent = t("geskenk_ontvang_knoppie");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    styl();
    const kode = (params.get("kode") || "").trim().toUpperCase();
    if (kode && params.get("bewys") === "1") return wys_bewys(kode);
    if (kode) return wys_geskenk(kode);
    wys_invoer("");
  });
})();
