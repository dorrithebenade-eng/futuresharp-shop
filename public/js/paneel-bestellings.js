// paneel-bestellings.js — die "Bestellings"-oortjie: volledige lys van
// alle bestellings, met soek/filter, en 'n manier om harde-kopie-
// bestellings se drukstatus te merk. kry_outorisasie_kop() kom van
// paneelbord.js.

let ALLE_BESTELLINGS = [];

function formateer_prys_sent_bestelling(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function formateer_datum_vol_bestelling(iso_string) {
  if (!iso_string) return "—";
  const d = new Date(iso_string);
  return (
    d.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("af-ZA", { hour: "2-digit", minute: "2-digit" })
  );
}

function etiket_vir_formaat_bestelling(formaat) {
  return formaat === "harde_kopie" ? "Harde kopie" : "E-boek";
}

function bou_bestelling_kaart(b) {
  const status_klas = b.status === "Nuut" ? "paneel-status-merker--voltooi" : "paneel-status-merker--wag";

  const items_html = (b.items || [])
    .map(
      (i) =>
        `<li>${i.titel} <span class="paneel-bestelling-item-formaat">(${etiket_vir_formaat_bestelling(i.formaat)})</span> — ${formateer_prys_sent_bestelling(i.prys_sent)}</li>`
    )
    .join("");

  const koepon_html = b.koepon_toegepas
    ? `<p class="paneel-bestelling-koepon">🎟️ Koepon toegepas: <strong>${b.koepon_toegepas.kode}</strong></p>`
    : "";

  const gratis_html = b.paystack && b.paystack.gratis_via_koepon
    ? `<p class="paneel-bestelling-koepon">🎁 100%-koepon — geen Paystack-transaksie nie</p>`
    : "";

  const split_fout_html = b.split_fout
    ? `<p class="paneel-bestelling-waarskuwing">⚠️ Split-vangnet geaktiveer: ${b.split_fout}</p>`
    : "";

  let drukker_html = "";
  if (b.bevat_harde_kopie) {
    const geplaas = b.drukker && b.drukker.bestelling_geplaas;
    drukker_html = `
      <div class="paneel-bestelling-drukker">
        <span class="paneel-bestelling-drukker-status">
          📦 Drukwerk: ${geplaas ? `✅ Geplaas — ${formateer_datum_vol_bestelling(b.drukker.geplaas_op)}` : "⏳ Nog nie geplaas nie"}
        </span>
        <button type="button" class="terug-skakel paneel-bestelling-drukker-knoppie" data-bestelnommer="${b.bestelnommer}" data-huidige="${geplaas ? "1" : "0"}">
          ${geplaas ? "Merk as onvoltooid" : "Merk as geplaas"}
        </button>
      </div>
    `;
  }

  return `
    <div class="paneel-bestelling-kaart">
      <div class="paneel-bestelling-kop">
        <strong>${b.bestelnommer}</strong>
        <span class="paneel-status-merker ${status_klas}">${b.status}</span>
      </div>
      <p class="paneel-bestelling-meta">
        ${formateer_datum_vol_bestelling(b.geskep_op)} · ${(b.koper && b.koper.epos) || "—"} · <strong>${formateer_prys_sent_bestelling(b.totaal_sent)}</strong>
      </p>
      <ul class="paneel-bestelling-items">${items_html}</ul>
      ${koepon_html}
      ${gratis_html}
      ${split_fout_html}
      ${drukker_html}
    </div>
  `;
}

function pas_bestellings_filter_toe() {
  const soek_teks = document.getElementById("bestellings-soek").value.trim().toLowerCase();
  const status_filter = document.getElementById("bestellings-status-filter").value;
  const net_onafgehandelde_druk = document.getElementById("bestellings-net-onafgehandelde-druk").checked;

  const gefiltreer = ALLE_BESTELLINGS.filter((b) => {
    if (status_filter && b.status !== status_filter) return false;
    if (net_onafgehandelde_druk && !(b.bevat_harde_kopie && !(b.drukker && b.drukker.bestelling_geplaas))) {
      return false;
    }
    if (soek_teks) {
      const bestelnommer_pas = b.bestelnommer.toLowerCase().includes(soek_teks);
      const epos_pas = (b.koper && b.koper.epos || "").toLowerCase().includes(soek_teks);
      if (!bestelnommer_pas && !epos_pas) return false;
    }
    return true;
  });

  const wrap = document.getElementById("paneel-bestellings-lys");
  if (!gefiltreer.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">Geen bestellings pas by hierdie filter nie.</p>`;
    return;
  }
  wrap.innerHTML = gefiltreer.map(bou_bestelling_kaart).join("");

  wrap.querySelectorAll(".paneel-bestelling-drukker-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => hanteer_drukker_merk(knoppie));
  });
}

async function hanteer_drukker_merk(knoppie) {
  const bestelnommer = knoppie.dataset.bestelnommer;
  const huidige_geplaas = knoppie.dataset.huidige === "1";
  const nuwe_status = !huidige_geplaas;

  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const resp = await fetch("/.netlify/functions/wysig-bestelling-drukker", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ bestelnommer, bestelling_geplaas: nuwe_status }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const bygewerkte_bestelling = await resp.json();
    const idx = ALLE_BESTELLINGS.findIndex((b) => b.bestelnommer === bestelnommer);
    if (idx !== -1) ALLE_BESTELLINGS[idx] = bygewerkte_bestelling;
    pas_bestellings_filter_toe();
  } catch (fout) {
    console.error("Kon nie drukstatus wysig nie:", fout);
    alert("Kon nie drukstatus wysig nie — probeer weer.");
    knoppie.disabled = false;
    knoppie.textContent = huidige_geplaas ? "Merk as onvoltooid" : "Merk as geplaas";
  }
}

async function paneel_bestellings_laai() {
  const wrap = document.getElementById("paneel-bestellings-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">Word gelaai …</p>`;

  try {
    const resp = await fetch("/.netlify/functions/kry-alle-bestellings", {
      headers: kry_outorisasie_kop(),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    ALLE_BESTELLINGS = data.bestellings || [];
    pas_bestellings_filter_toe();
  } catch (fout) {
    console.error("Kon nie bestellings laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie bestellings laai nie.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("bestellings-soek").addEventListener("input", pas_bestellings_filter_toe);
  document.getElementById("bestellings-status-filter").addEventListener("change", pas_bestellings_filter_toe);
  document.getElementById("bestellings-net-onafgehandelde-druk").addEventListener("change", pas_bestellings_filter_toe);
});

// Selfde "wag totdat paneel-inhoud sigbaar raak"-patroon as elders
(function paneel_bestellings_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_bestellings_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_bestellings_laai();
  }
})();
