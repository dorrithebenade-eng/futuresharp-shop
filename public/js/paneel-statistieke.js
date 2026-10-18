// paneel-statistieke.js — laai die 4 besoek-tellers en wys dit bo-aan
// die paneelbord. kry_outorisasie_kop() kom van paneelbord.js.

function formateer_maand_etiket(maand_sleutel) {
  const [jaar, maand_nommer] = maand_sleutel.split("-");
  const maande_af = [
    "Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
    "Julie", "Augustus", "September", "Oktober", "November", "Desember",
  ];
  const maande_en = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const maand_lys = (typeof kry_huidige_taal === "function" && kry_huidige_taal() === "en") ? maande_en : maande_af;
  return `${maand_lys[Number(maand_nommer) - 1]} ${jaar}`;
}

// Die winkel se elemente het geen voorvoegsel nie; FutureSharp Talks s'n
// begin met "fst-".
const STATISTIEK_AFDELINGS = { winkel: "", fst: "fst-" };

function wys_maandelikse_geskiedenis(geskiedenis, voorvoegsel = "") {
  const plek = document.getElementById(voorvoegsel ? `${voorvoegsel}statistieke-geskiedenis-plek` : "paneel-statistieke-geskiedenis-plek");
  if (!plek) return;

  if (!geskiedenis || !geskiedenis.length) {
    plek.innerHTML = "";
    return;
  }

  plek.innerHTML = `
    <details class="paneel-statistieke-geskiedenis">
      <summary>${t("statistiek_maandelikse_geskiedenis")} (${geskiedenis.length})</summary>
      <ul class="paneel-statistieke-geskiedenis-lys">
        ${geskiedenis
          .map((m) => `<li><span>${formateer_maand_etiket(m.maand)}</span><strong>${m.telling}</strong></li>`)
          .join("")}
      </ul>
    </details>
  `;
}

function vul_tellers(data, voorvoegsel) {
  const stel = (id, waarde) => {
    const el = document.getElementById(`${voorvoegsel}${id}`);
    if (el) el.textContent = waarde == null ? 0 : waarde;
  };
  stel("statistiek-totaal", data.totaal);
  stel("statistiek-vandag", data.vandag);
  stel("statistiek-week", data.hierdie_week);
  stel("statistiek-maand", data.hierdie_maand);
  const info = document.getElementById(`${voorvoegsel}statistiek-week-info`);
  if (info) info.title = t("statistiek_week_nota");
  wys_maandelikse_geskiedenis(data.maandelikse_geskiedenis, voorvoegsel);
}

async function paneel_statistieke_laai() {
  try {
    const resp = await fetch("/.netlify/functions/kry-statistieke", {
      headers: kry_outorisasie_kop(),
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();

    vul_tellers(data, STATISTIEK_AFDELINGS.winkel);
    vul_tellers(data.fst || {}, STATISTIEK_AFDELINGS.fst);
  } catch (fout) {
    console.error("Kon nie statistieke laai nie:", fout);
  }
}

async function paneel_statistiek_herstel_totaal(afdeling = "winkel") {
  if (!window.confirm(t("statistiek_herstel_bevestig"))) {
    return;
  }

  const knoppie = document.getElementById(`${STATISTIEK_AFDELINGS[afdeling]}statistiek-herstel-totaal`);
  knoppie.disabled = true;

  try {
    const resp = await fetch("/.netlify/functions/herstel-statistiek", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ teller: "totaal", afdeling }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    paneel_statistieke_laai();
  } catch (fout) {
    console.error("Kon nie totaal herstel nie:", fout);
    alert(t("statistiek_kon_nie_herstel"));
  } finally {
    knoppie.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  Object.entries(STATISTIEK_AFDELINGS).forEach(([afdeling, voorvoegsel]) => {
    const knoppie = document.getElementById(`${voorvoegsel}statistiek-herstel-totaal`);
    if (knoppie) knoppie.addEventListener("click", () => paneel_statistiek_herstel_totaal(afdeling));
  });
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
