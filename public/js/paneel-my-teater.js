// paneel-my-teater.js — My Teater in die paneelbord (November 2026).
//
// Net vir die admin (personeel-rol). Lys elke talk, ook gedeaktiveerde, uit
// kry-talks.js (reeds personeel-beskermd). Die gekose talk speel bo-aan die
// afdeling met mux-player; kry-kyk-token.js laat personeel enige talk kyk en
// tel personeel se kyke nie in die statistiek nie.
//
// Die mux-player-skrip laai eers wanneer 'n talk vir die eerste keer
// gekies word, sodat die paneelbord nie daarvoor hoef te wag nie.

const pmt = { talks: [], huidig: null, speler_skrip: null };

function pmt_esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pmt_duur(s) {
  if (!s) return "";
  return `${Math.max(1, Math.round(s / 60))} min`;
}

function pmt_laai_speler_skrip() {
  if (window.customElements && customElements.get("mux-player")) return Promise.resolve();
  if (pmt.speler_skrip) return pmt.speler_skrip;
  pmt.speler_skrip = new Promise((los_op, verwerp) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@mux/mux-player";
    s.onload = () => los_op();
    s.onerror = () => { pmt.speler_skrip = null; verwerp(new Error("mux-player kon nie laai nie")); };
    document.head.appendChild(s);
  });
  return pmt.speler_skrip;
}

function pmt_bou_skelet() {
  const wortel = document.getElementById("pmt-wortel");
  if (!wortel) return;
  wortel.innerHTML = `
    <div class="paneel-afdeling-kop">
      <h2 class="paneel-afdeling-titel">My Teater</h2>
    </div>
    <p class="paneel-hulp-teks">Elke talk, ook gedeaktiveerde. Die gekose talk speel bo-aan.</p>
    <div id="pmt-skerm" class="pmt-skerm"><p class="pmt-skerm-teks">Kies 'n talk hieronder.</p></div>
    <p id="pmt-nou" class="pmt-nou"></p>
    <div id="pmt-status" class="stelsel-boodskap" aria-live="polite"></div>
    <div id="pmt-lys" class="pmt-lys"></div>`;
}

function pmt_kan_speel(t) {
  const v = t.video_stand || {};
  return v.stand === "gereed" || v.speel_nog_ou === true;
}

function pmt_teken_lys() {
  const lys = document.getElementById("pmt-lys");
  if (!lys) return;
  lys.innerHTML = pmt.talks.map((t, i) => {
    const pille = [];
    if (t.aktief === false) pille.push(`<span class="pml-pil pml-pil-grys pmt-pil">Nie aktief nie</span>`);
    if (!pmt_kan_speel(t)) pille.push(`<span class="pml-pil pml-pil-amber pmt-pil">Video nie gereed nie</span>`);
    const duur = t.video_stand && t.video_stand.duur_sekondes;
    const wie = [t.spreker, pmt_duur(duur)].filter(Boolean).join(" · ");
    const gekies = pmt.huidig && pmt.huidig.slug === t.slug ? " pmt-ry-gekies" : "";
    return `
      <div class="pmt-ry${gekies}">
        ${t.omslag ? `<img class="pmt-duimnael" src="${pmt_esc(t.omslag)}" alt="" loading="lazy">` : `<div class="pmt-duimnael pmt-duimnael-leeg"></div>`}
        <div class="pmt-ry-teks">
          <p class="pmt-ry-titel">${pmt_esc(t.titel || t.slug)}</p>
          ${wie ? `<p class="pmt-ry-wie">${pmt_esc(wie)}</p>` : ""}
        </div>
        <div class="pmt-ry-aksies">${pille.join("")}
          ${pmt_kan_speel(t) ? `<button type="button" class="pml-lees pmt-kyk" data-pmt-kyk="${i}">Kyk</button>` : ""}
        </div>
      </div>`;
  }).join("");
  lys.querySelectorAll("[data-pmt-kyk]").forEach((b) => {
    b.addEventListener("click", () => pmt_kies(pmt.talks[Number(b.getAttribute("data-pmt-kyk"))]));
  });
}

async function pmt_kies(talk) {
  if (!talk) return;
  pmt.huidig = talk;
  pmt_teken_lys();
  const skerm = document.getElementById("pmt-skerm");
  document.getElementById("pmt-nou").textContent = talk.titel || talk.slug;
  skerm.innerHTML = `<p class="pmt-skerm-teks">Word gelaai …</p>`;
  skerm.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const [resp] = await Promise.all([
      fetch(`/.netlify/functions/kry-kyk-token?slug=${encodeURIComponent(talk.slug)}`, { headers: await identiteit_kop() }),
      pmt_laai_speler_skrip(),
    ]);
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const data = await resp.json();
    if (pmt.huidig !== talk) return; // intussen 'n ander talk gekies

    const speler = document.createElement("mux-player");
    speler.setAttribute("playback-id", data.playback_id);
    speler.setAttribute("playback-token", data.tokens.playback);
    speler.setAttribute("thumbnail-token", data.tokens.thumbnail);
    speler.setAttribute("storyboard-token", data.tokens.storyboard);
    speler.setAttribute("stream-type", "on-demand");
    speler.setAttribute("accent-color", "#F1BD43");
    speler.setAttribute("primary-color", "#FFFFFF");
    speler.setAttribute("metadata-video-title", talk.titel || talk.slug);
    speler.setAttribute("metadata-video-id", talk.slug);
    skerm.innerHTML = "";
    skerm.appendChild(speler);
  } catch (fout) {
    console.error("Kon nie die talk speel nie:", fout);
    skerm.innerHTML = `<p class="pmt-skerm-teks">Kon nie die video laai nie: ${pmt_esc(fout.message)}</p>`;
  }
}

async function pmt_laai() {
  const status = document.getElementById("pmt-status");
  if (!status) return;
  if (!pmt.talks.length) status.textContent = "Word gelaai …";
  try {
    const resp = await fetch("/.netlify/functions/kry-talks", { headers: await identiteit_kop() });
    if (resp.status === 403) { status.textContent = "Net vir admin."; return; }
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    pmt.talks = ((await resp.json()).talks || [])
      .sort((a, b) => String(a.titel || "").localeCompare(String(b.titel || ""), "af"));
    status.textContent = pmt.talks.length ? "" : "Daar is nog geen talks nie.";
    pmt_teken_lys();
  } catch (fout) {
    console.error("Kon nie My Teater laai nie:", fout);
    status.textContent = "Kon nie die talks laai nie. Probeer weer.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  pmt_bou_skelet();
  document.querySelectorAll('.paneel-kieslys-item[data-afdeling="my-teater"]').forEach((b) => {
    b.addEventListener("click", pmt_laai);
  });
  // Verlaat die admin My Teater, hou die video op: 'n versteekte afdeling
  // speel andersins agter die volgende skerm voort.
  document.querySelectorAll(".paneel-kieslys-item").forEach((b) => {
    if (b.getAttribute("data-afdeling") === "my-teater") return;
    b.addEventListener("click", () => {
      const speler = document.querySelector("#pmt-skerm mux-player");
      if (speler && typeof speler.pause === "function") speler.pause();
    });
  });
});
