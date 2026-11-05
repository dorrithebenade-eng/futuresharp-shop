// paneel-my-leeskamer.js — My Leeskamer in die paneelbord (November 2026).
//
// Net vir die admin (personeel-rol). Wys elke e-boek in die katalogus, ook
// wat nie op die rak is nie, met 'n soekveld en 'n filter. "Lees" maak die
// boek in dieselfde oortjie oop in paneel-leser.html, wat die paneel se
// aanmelding gebruik en met 'n terugskakel hierheen kom
// (paneelbord.html#my-leeskamer).
//
// Die afdeling word hier gebou, in #pml-wortel; paneelbord.html dra net die
// kieslysitem en die leë houer. Hang af van identiteit.js (identiteit_kop)
// en paneel-kieslys.js (paneel_kieslys_wys_afdeling).

const pml = { boeke: [], gelaai: false };

function pml_esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// JJJJ-MM-DD na JJJJ/MM/DD, die stelsel se datumvorm.
function pml_datum(iso) {
  return String(iso || "").slice(0, 10).replace(/-/g, "/");
}

function pml_bou_skelet() {
  const wortel = document.getElementById("pml-wortel");
  if (!wortel) return;
  wortel.innerHTML = `
    <div class="paneel-afdeling-kop">
      <h2 class="paneel-afdeling-titel">My Leeskamer</h2>
    </div>
    <p class="paneel-hulp-teks">Elke e-boek in die katalogus, ook wat nog nie op die rak is nie. Net vir admin.</p>
    <div class="pml-filters">
      <input type="search" id="pml-soek" class="veld-invoer pml-soek" placeholder="Soek titel of outeur" aria-label="Soek titel of outeur">
      <select id="pml-filter" class="veld-invoer pml-filter" aria-label="Filter">
        <option value="alle">Alle boeke</option>
        <option value="op_rak">Op die rak</option>
        <option value="nie_op_rak">Nie op die rak nie</option>
      </select>
    </div>
    <div id="pml-status" class="stelsel-boodskap" aria-live="polite"></div>
    <div id="pml-rooster" class="pml-rooster"></div>`;
  document.getElementById("pml-soek").addEventListener("input", pml_teken);
  document.getElementById("pml-filter").addEventListener("change", pml_teken);
}

function pml_kaart(b) {
  let pil = "";
  if (b.stand === "nie_op_rak") pil = `<span class="pml-pil pml-pil-grys">Nie op die rak nie</span>`;
  else if (b.stand === "vrystelling") pil = `<span class="pml-pil pml-pil-amber">Vanaf ${pml_esc(pml_datum(b.vrystelling_datum))}</span>`;

  const omslag = b.omslag
    ? `<img class="pml-omslag" src="${pml_esc(b.omslag)}" alt="" loading="lazy">`
    : `<div class="pml-omslag pml-omslag-leeg">${pml_esc(b.titel)}</div>`;

  const knop = b.lees_bladsy ? `Lees verder · bl. ${b.lees_bladsy}` : "Lees nou";

  return `
    <a class="pml-kaart" href="/paneel-leser.html?boek=${encodeURIComponent(b.slug)}">
      <div class="pml-omslag-wrap">${omslag}${pil}</div>
      <p class="pml-titel">${pml_esc(b.titel)}</p>
      ${b.outeur ? `<p class="pml-outeur">${pml_esc(b.outeur)}</p>` : ""}
      <span class="pml-lees">${pml_esc(knop)}</span>
    </a>`;
}

function pml_teken() {
  const rooster = document.getElementById("pml-rooster");
  const status = document.getElementById("pml-status");
  const filter_el = document.getElementById("pml-filter");
  if (!rooster || !filter_el) return;

  const op_rak = pml.boeke.filter((b) => b.stand === "op_rak").length;
  filter_el.options[0].textContent = `Alle boeke (${pml.boeke.length})`;
  filter_el.options[1].textContent = `Op die rak (${op_rak})`;
  filter_el.options[2].textContent = `Nie op die rak nie (${pml.boeke.length - op_rak})`;

  const soek = document.getElementById("pml-soek").value.trim().toLowerCase();
  const filter = filter_el.value;
  const sigbaar = pml.boeke.filter((b) => {
    if (filter === "op_rak" && b.stand !== "op_rak") return false;
    if (filter === "nie_op_rak" && b.stand === "op_rak") return false;
    if (!soek) return true;
    return `${b.titel} ${b.outeur}`.toLowerCase().includes(soek);
  });

  status.textContent = sigbaar.length ? "" : "Geen boeke pas by die soektog nie.";
  rooster.innerHTML = sigbaar.map(pml_kaart).join("");
}

async function pml_laai() {
  const status = document.getElementById("pml-status");
  if (!status) return;
  if (!pml.gelaai) status.textContent = "Word gelaai …";
  try {
    const resp = await fetch("/.netlify/functions/kry-admin-leeskamer", { headers: await identiteit_kop() });
    if (resp.status === 403) { status.textContent = "Net vir admin."; return; }
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    pml.boeke = (await resp.json()).boeke || [];
    pml.gelaai = true;
    pml_teken();
  } catch (fout) {
    console.error("Kon nie My Leeskamer laai nie:", fout);
    status.textContent = "Kon nie die boeke laai nie. Probeer weer.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  pml_bou_skelet();
  document.querySelectorAll('.paneel-kieslys-item[data-afdeling="my-leeskamer"]').forEach((b) => {
    b.addEventListener("click", pml_laai);
  });
  // Terug uit die paneel-leser: maak My Leeskamer weer oop.
  if (window.location.hash === "#my-leeskamer" && typeof paneel_kieslys_wys_afdeling === "function") {
    paneel_kieslys_wys_afdeling("my-leeskamer");
    pml_laai();
  }
});
