// paneel-waarskuwings.js — wys bestellings waar die split-vangnet
// geaktiveer is (foutiewe subrekening-kode, betaling het steeds op die
// hoofrekening deurgegaan). kry_outorisasie_kop() kom van paneelbord.js.

function formateer_datum_vol(iso_string) {
  if (!iso_string) return "—";
  const d = new Date(iso_string);
  return d.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("af-ZA", { hour: "2-digit", minute: "2-digit" });
}

function formateer_prys_sent_waarskuwing(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

async function paneel_waarskuwings_laai() {
  const wrap = document.getElementById("paneel-waarskuwings-lys");

  try {
    const resp = await fetch("/.netlify/functions/kry-betaling-waarskuwings", {
      headers: kry_outorisasie_kop(),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    const lys = data.waarskuwings || [];

    if (!lys.length) {
      wrap.innerHTML = `<p class="stelsel-boodskap">Geen betaling-waarskuwings nie — alles werk soos verwag. ✅</p>`;
      return;
    }

    wrap.innerHTML = lys
      .map((b) => {
        const items_teks = (b.items || [])
          .map((i) => `${i.titel} (${i.formaat === "harde_kopie" ? "Harde kopie" : "E-boek"})`)
          .join(", ");
        return `
          <div class="paneel-waarskuwing-ry">
            <div class="paneel-waarskuwing-kop">
              <strong>${b.bestelnommer}</strong>
              <span class="paneel-waarskuwing-datum">${formateer_datum_vol(b.geskep_op)}</span>
            </div>
            <p class="paneel-waarskuwing-items">${items_teks} — ${formateer_prys_sent_waarskuwing(b.totaal_sent)}</p>
            <p class="paneel-waarskuwing-boodskap">⚠️ ${b.split_fout}</p>
          </div>
        `;
      })
      .join("");
  } catch (fout) {
    console.error("Kon nie betaling-waarskuwings laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie waarskuwings laai nie.</p>`;
  }
}

// Selfde "wag totdat paneel-inhoud sigbaar raak"-patroon as elders
(function paneel_waarskuwings_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_waarskuwings_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_waarskuwings_laai();
  }
})();
