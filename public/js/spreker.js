// spreker.js — die Sprekerspaneel (spreker.html). FutureSharp Talks.
//
// Een oproep na kry-my-spreker.js gee alles: die profiel, die talks met hul
// syfers, en elke aankoop vir die staat. Hier word dit net vertoon.
//
// Soos by die outeurs: per aankoop drie geldsyfers (prys, jou deel, Future
// Sharp), en die res word nooit verder uitgesplits nie.
//
// Laai na taal.js, spreker-taal.js, identiteit.js, nav-rekening.js en
// paneel-rol-skakelaar.js.

const sp = { data: null, maand: null };

function sp_esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sp_rand(sent) {
  return t_rand(sent || 0, kry_huidige_taal());
}

function sp_status(html) {
  const el = document.getElementById("sp-status");
  el.innerHTML = html || "";
  el.hidden = !html;
}

function sp_duur(s) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function sp_maand_naam(jjjj_mm) {
  const [j, m] = jjjj_mm.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, 1)).toLocaleDateString(kry_huidige_taal() === "en" ? "en-ZA" : "af-ZA", { month: "long", year: "numeric", timeZone: "UTC" });
}

function sp_dag(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(kry_huidige_taal() === "en" ? "en-ZA" : "af-ZA", { day: "numeric", month: "short", timeZone: "UTC" });
}

// ------------------------------------------------------------------ band

function sp_teken_band() {
  const { spreker, talks, aankope } = sp.data;
  document.getElementById("sp-naam").textContent = spreker.naam;
  document.getElementById("sp-uitbetaling-wag").hidden = spreker.uitbetaling_gereed;

  const besoeke = talks.reduce((s, x) => s + x.besoeke.totaal, 0);
  const verdien = aankope.reduce((s, a) => s + a.jou_deel_sent, 0);
  const syfer = (waarde, etiket, goud) =>
    `<div class="sp-syfer${goud ? " sp-syfer-goud" : ""}"><b>${sp_esc(waarde)}</b><span>${sp_esc(etiket)}</span></div>`;
  document.getElementById("sp-syfers").innerHTML =
    syfer(talks.length, t("sp_syfer_talks")) +
    syfer(besoeke, t("sp_syfer_besoeke")) +
    syfer(aankope.length, t("sp_syfer_kopers")) +
    syfer(sp_rand(verdien), t("sp_syfer_deel"), true);
}

// ----------------------------------------------------------------- talks

function sp_balke(per_maand) {
  // Die laaste ses maande, ook dié sonder besoeke, sodat die grafiek eerlik is.
  const maande = [];
  const nou = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(nou.getUTCFullYear(), nou.getUTCMonth() - i, 1));
    maande.push(d.toISOString().slice(0, 7));
  }
  const maks = Math.max(1, ...maande.map((m) => per_maand[m] || 0));
  const kort = (m) => sp_maand_naam(m).split(" ")[0].slice(0, 3);
  return `<div class="sp-balke">${maande.map((m) => {
    const n = per_maand[m] || 0;
    return `<div class="sp-balk" title="${sp_esc(sp_maand_naam(m))}: ${n}"><i style="height:${Math.max(n ? 6 : 2, Math.round((n / maks) * 100))}%"></i><span>${sp_esc(kort(m))}</span></div>`;
  }).join("")}</div>`;
}

function sp_teken_talks() {
  const { talks } = sp.data;
  const wrap = document.getElementById("sp-talks");
  if (!talks.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${sp_esc(t("sp_geen_talks"))}</p>`;
    return;
  }
  const hierdie_maand = new Date().toISOString().slice(0, 7);
  wrap.innerHTML = talks.map((x) => {
    const stand = !x.aktief ? t("sp_onaktief") : x.beskikbaar && x.video_gereed ? t("sp_te_koop") : t("sp_binnekort");
    return `
      <article class="sp-talk">
        <a class="sp-omslag" href="/talks/${encodeURIComponent(x.slug)}">${x.omslag ? `<img src="${sp_esc(x.omslag)}" alt="">` : ""}</a>
        <div>
          <h3><a href="/talks/${encodeURIComponent(x.slug)}">${sp_esc(x.titel)}</a></h3>
          <div class="sp-chips">
            <span class="sp-chip${x.aktief ? "" : " sp-chip-grys"}">${sp_esc(stand)} · ${sp_esc(sp_rand(x.prys_sent))}</span>
            ${x.duur_sekondes ? `<span class="sp-chip sp-chip-grys">${sp_esc(sp_duur(x.duur_sekondes))}</span>` : ""}
          </div>
          <div class="sp-metrieke">
            <div class="sp-m"><b>${x.besoeke.totaal}</b><span>${sp_esc(t("sp_besoeke"))}</span><small>${x.besoeke.per_maand[hierdie_maand] || 0} ${sp_esc(t("sp_hierdie_maand"))}</small></div>
            <div class="sp-m"><b>${x.kopers}</b><span>${sp_esc(t("sp_kopers"))}</span>${x.kopers > x.betaalde_kopers ? `<small>${x.kopers - x.betaalde_kopers} ${sp_esc(t("sp_gratis"))}</small>` : ""}</div>
            <div class="sp-m"><b>${sp_esc(sp_rand(x.jou_deel_sent))}</b><span>${sp_esc(t("sp_jou_deel"))}</span></div>
          </div>
          <p class="sp-balk-kop">${sp_esc(t("sp_besoeke_per_maand"))}</p>
          ${sp_balke(x.besoeke.per_maand)}
        </div>
      </article>`;
  }).join("");
}

// ----------------------------------------------------------------- staat

function sp_teken_staat() {
  const { aankope } = sp.data;
  const wrap = document.getElementById("sp-staat");
  const nou = new Date().toISOString().slice(0, 7);
  const maande = [...new Set([nou, ...aankope.map((a) => a.datum.slice(0, 7))])].sort().reverse();
  if (!sp.maand) sp.maand = maande[0];

  const hierdie = aankope.filter((a) => a.datum.slice(0, 7) === sp.maand);
  const som = (veld) => hierdie.reduce((s, a) => s + a[veld], 0);
  const uitstaande = som("uitstaande_sent");

  wrap.innerHTML = `
    <div class="sp-staat-kop">
      <label class="sp-maand"><span>${sp_esc(t("sp_maand"))}</span>
        <select id="sp-maand-keuse">${maande.map((m) => `<option value="${m}" ${m === sp.maand ? "selected" : ""}>${sp_esc(sp_maand_naam(m))}</option>`).join("")}</select>
      </label>
    </div>
    <div class="sp-kaart">
      ${hierdie.length ? `
      <div class="sp-tabel-rol"><table class="sp-tabel">
        <thead><tr><th>${sp_esc(t("sp_datum"))}</th><th>${sp_esc(t("sp_talk"))}</th><th class="r">${sp_esc(t("sp_prys"))}</th><th class="r">${sp_esc(t("sp_jou_deel"))}</th><th class="r">${sp_esc(t("sp_future_sharp"))}</th></tr></thead>
        <tbody>${hierdie.map((a) => `
          <tr>
            <td>${sp_esc(sp_dag(a.datum))}</td>
            <td>${sp_esc(a.titel)}${a.gratis && a.koepon ? ` <span class="sp-gratis">· ${sp_esc(t("sp_koepon"))}</span>` : a.gratis ? ` <span class="sp-gratis">· ${sp_esc(t("sp_gratis"))}</span>` : ""}${a.uitstaande_sent ? ` <span class="sp-uitstaande">· ${sp_esc(sp_rand(a.uitstaande_sent))} ${sp_esc(t("sp_uitstaande"))}</span>` : ""}</td>
            <td class="r">${sp_esc(sp_rand(a.prys_sent))}</td>
            <td class="r">${sp_esc(sp_rand(a.jou_deel_sent))}</td>
            <td class="r">${sp_esc(sp_rand(a.future_sharp_sent))}</td>
          </tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="2">${sp_esc(sp_maand_naam(sp.maand))}</td><td class="r">${sp_esc(sp_rand(som("prys_sent")))}</td><td class="r">${sp_esc(sp_rand(som("jou_deel_sent")))}</td><td class="r">${sp_esc(sp_rand(som("future_sharp_sent")))}</td></tr></tfoot>
      </table></div>` : `<p class="stelsel-boodskap">${sp_esc(t("sp_geen_aankope"))}</p>`}
    </div>
    ${hierdie.length ? `<div class="sp-uitbetaal"><span>${sp_esc(t("sp_uitbetaal"))}</span><b>${sp_esc(sp_rand(som("jou_deel_sent")))}</b></div>` : ""}
    ${uitstaande ? `<div class="sp-uitbetaal sp-uitbetaal-uit"><span>${sp_esc(t("sp_uitstaande"))}</span><b>${sp_esc(sp_rand(uitstaande))}</b></div>` : ""}`;

  document.getElementById("sp-maand-keuse").addEventListener("change", (e) => {
    sp.maand = e.target.value;
    sp_teken_staat();
  });
}

// ---------------------------------------------------------- besonderhede

function sp_teken_besonderhede() {
  const k = sp.data.spreker.kontak || {};
  const ry = (etiket, waarde) => (waarde ? `<div class="sp-veld"><span>${sp_esc(etiket)}</span><b>${sp_esc(waarde)}</b></div>` : "");
  document.getElementById("sp-besonderhede").innerHTML = `<div class="sp-kaart sp-besonderhede">
    ${ry(t("sp_epos"), k.epos)}${ry(t("sp_selfoon"), k.selfoon)}${ry(t("sp_adres"), k.adres)}
    ${ry(t("sp_bank"), k.bank_naam)}${ry(t("sp_rekening"), k.bank_rekeningnommer)}
  </div>`;
}

// ------------------------------------------------------------------ pille

function sp_gaan(doel) {
  document.querySelectorAll(".sp-pil").forEach((p) => p.setAttribute("aria-pressed", p.dataset.gaan === doel));
  document.querySelectorAll(".sp-afdeling").forEach((a) => { a.hidden = a.dataset.afdeling !== doel; });
}

// ----------------------------------------------------------------- begin

async function sp_laai() {
  sp_status(`<p>${sp_esc(t("sp_laai"))}</p>`);
  const sessie = await identiteit_kry_huidige_sessie().catch(() => null);
  if (!sessie) {
    sp_status(`<p>${sp_esc(t("sp_meld_aan"))}</p><p><a class="kaart-aksie" href="aanmeld.html?terug=${encodeURIComponent("/spreker.html")}">${sp_esc(t("sp_meld_aan_knop"))}</a></p>`);
    return;
  }
  try {
    const resp = await fetch("/.netlify/functions/kry-my-spreker", { headers: await identiteit_kop() });
    if (resp.status === 404) { sp_status(`<p>${sp_esc(t("sp_nie_spreker"))}</p>`); return; }
    if (!resp.ok) throw new Error(await resp.text());
    sp.data = await resp.json();
  } catch (fout) {
    console.error("Kon nie die Sprekerspaneel laai nie:", fout);
    sp_status(`<p>${sp_esc(t("sp_fout"))}</p>`);
    return;
  }
  sp_status("");
  document.getElementById("sp-inhoud").hidden = false;
  sp_teken_band();
  sp_teken_talks();
  sp_teken_staat();
  sp_teken_besonderhede();
  paneel_rol_skakelaar("spreker");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".sp-pil").forEach((p) => p.addEventListener("click", () => sp_gaan(p.dataset.gaan)));
  sp_laai();
});
