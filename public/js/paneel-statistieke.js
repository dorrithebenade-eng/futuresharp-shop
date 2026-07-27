// paneel-statistieke.js — laai die 4 besoek-tellers en wys dit bo-aan
// die paneelbord. kry_outorisasie_kop() kom van paneelbord.js.

function formateer_maand_etiket(maand_sleutel) {
  const [jaar, maand_nommer] = maand_sleutel.split("-");
  const maande_af = [
    "Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
    "Julie", "Augustus", "September", "Oktober", "November", "Desember",
  ];
  return `${maande_af[Number(maand_nommer) - 1]} ${jaar}`;
}

function wys_maandelikse_geskiedenis(geskiedenis) {
  const plek = document.getElementById("paneel-statistieke-geskiedenis-plek");

  if (!geskiedenis || !geskiedenis.length) {
    plek.innerHTML = "";
    return;
  }

  plek.innerHTML = `
    <details class="paneel-statistieke-geskiedenis">
      <summary>Maandelikse geskiedenis (${geskiedenis.length})</summary>
      <ul class="paneel-statistieke-geskiedenis-lys">
        ${geskiedenis
          .map((m) => `<li><span>${formateer_maand_etiket(m.maand)}</span><strong>${m.telling}</strong></li>`)
          .join("")}
      </ul>
    </details>
  `;
}

async function paneel_statistieke_laai() {
  try {
    const resp = await fetch("/.netlify/functions/kry-statistieke", {
      headers: kry_outorisasie_kop(),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();

    document.getElementById("statistiek-totaal").textContent = data.totaal;
    document.getElementById("statistiek-vandag").textContent = data.vandag;
    document.getElementById("statistiek-week").textContent = data.hierdie_week;
    document.getElementById("statistiek-maand").textContent = data.hierdie_maand;
    wys_maandelikse_geskiedenis(data.maandelikse_geskiedenis);
  } catch (fout) {
    console.error("Kon nie statistieke laai nie:", fout);
  }
}

async function paneel_statistiek_herstel_totaal() {
  if (!window.confirm("Herstel die totale besoekerstal na 0? Dit kan nie ongedaan gemaak word nie.")) {
    return;
  }

  const knoppie = document.getElementById("statistiek-herstel-totaal");
  knoppie.disabled = true;

  try {
    const resp = await fetch("/.netlify/functions/herstel-statistiek", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ teller: "totaal" }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    paneel_statistieke_laai();
  } catch (fout) {
    console.error("Kon nie totaal herstel nie:", fout);
    alert("Kon nie herstel nie — probeer weer.");
  } finally {
    knoppie.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("statistiek-herstel-totaal")
    .addEventListener("click", paneel_statistiek_herstel_totaal);
});

// Selfde "wag totdat paneel-inhoud sigbaar raak"-patroon as elders
(function paneel_statistieke_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_statistieke_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_statistieke_laai();
  }
})();
