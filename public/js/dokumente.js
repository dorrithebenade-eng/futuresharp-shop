// public/js/dokumente.js
//
// Hanteer die paneelbord se "Dokumente"-afdeling: lys, oplaai, skrap, en
// die "Stuur"-knoppies (e-pos/WhatsApp) wat 'n publieke aflaai-skakel na
// die dokument deel. kry_outorisasie_kop(), t(), en lees_lêer_as_base64()
// kom van paneelbord.js, wat eerste laai — apart gehou sodat paneelbord.js
// se bestaande logika nie geraak word nie (dieselfde patroon as
// paneel-registers.js).

const DOKUMENTE_KRY_ENDPOINT = "/.netlify/functions/kry-dokumente";
const DOKUMENTE_OPLAAI_ENDPOINT = "/.netlify/functions/laai-dokument-op";
const DOKUMENTE_SKRAP_ENDPOINT = "/.netlify/functions/skrap-dokument";
const DOKUMENTE_MAKS_GROOTTE = 4 * 1024 * 1024;
const DOKUMENTE_TOEGELATE_TIPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];

let dokumente_kas = [];

function dokument_vormateer_grootte(grepe) {
  if (!Number.isFinite(grepe)) return "";
  if (grepe < 1024) return `${grepe} grepe`;
  if (grepe < 1024 * 1024) return `${(grepe / 1024).toFixed(0)} KB`;
  return `${(grepe / (1024 * 1024)).toFixed(1)} MB`;
}

function dokument_vormateer_datum(iso) {
  if (!iso) return "";
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return datum.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function dokument_aflaai_url(dok) {
  return `/.netlify/functions/kry-dokument?sleutel=${encodeURIComponent(dok.bestand_sleutel)}&naam=${encodeURIComponent(dok.lêernaam || dok.naam)}`;
}

function dokument_volledige_aflaai_url(dok) {
  // Absolute URL nodig vir e-pos/WhatsApp — 'n relatiewe pad werk nie
  // buite die blaaier se konteks nie.
  return `${window.location.origin}${dokument_aflaai_url(dok)}`;
}

async function paneel_dokumente_laai() {
  const wrap = document.getElementById("paneel-dokumente-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_dokumente_laai")}</p>`;

  try {
    const resp = await fetch(DOKUMENTE_KRY_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    dokumente_kas = data.dokumente || [];
    paneel_dokumente_wys_lys(dokumente_kas);
  } catch (fout) {
    console.error("Kon nie dokumente laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie dokumente laai nie.</p>`;
  }
}

function paneel_dokumente_wys_lys(lys) {
  const wrap = document.getElementById("paneel-dokumente-lys");

  if (!lys.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">Nog geen dokumente opgelaai nie.</p>`;
    return;
  }

  wrap.innerHTML = lys
    .map(
      (dok) => `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${dok.naam}</strong>
            <span class="paneel-produk-outeur">
              ${dok.beskrywing ? `${dok.beskrywing} · ` : ""}${dok.lêernaam || ""} · ${dokument_vormateer_grootte(dok.grootte_grepe)} · ${dokument_vormateer_datum(dok.opgelaai_op)}
            </span>
          </div>
          <div class="paneel-produk-aksies">
            <a class="terug-skakel" href="${dokument_aflaai_url(dok)}" download>⬇ Aflaai</a>
            <button class="terug-skakel paneel-dokument-epos-knoppie" data-id="${dok.id}">📧 E-pos</button>
            <button class="terug-skakel paneel-dokument-whatsapp-knoppie" data-id="${dok.id}">💬 WhatsApp</button>
            <button class="terug-skakel paneel-skrap-knoppie paneel-dokument-skrap-knoppie" data-id="${dok.id}">Skrap</button>
          </div>
        </div>
      `
    )
    .join("");

  wrap.querySelectorAll(".paneel-dokument-epos-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const dok = lys.find((d) => d.id === knoppie.dataset.id);
      if (dok) dokument_stuur_epos(dok);
    });
  });

  wrap.querySelectorAll(".paneel-dokument-whatsapp-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const dok = lys.find((d) => d.id === knoppie.dataset.id);
      if (dok) dokument_stuur_whatsapp(dok);
    });
  });

  wrap.querySelectorAll(".paneel-dokument-skrap-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const dok = lys.find((d) => d.id === knoppie.dataset.id);
      if (dok) paneel_dokument_skrap(dok, knoppie);
    });
  });
}

function dokument_stuur_epos(dok) {
  const onderwerp = `Future Shop — ${dok.naam}`;
  const liggaam = [
    `Hallo,`,
    ``,
    `Hier is die dokument "${dok.naam}"${dok.beskrywing ? ` (${dok.beskrywing})` : ""}:`,
    dokument_volledige_aflaai_url(dok),
    ``,
    `Groete,`,
    `Future Shop`,
  ].join("\n");

  window.location.href = `mailto:?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(liggaam)}`;
}

function dokument_stuur_whatsapp(dok) {
  const teks = `Future Shop — ${dok.naam}\n${dokument_volledige_aflaai_url(dok)}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, "_blank");
}

// --- Oplaai-vorm ---

function paneel_dokument_open_vorm() {
  document.getElementById("dokument-vorm-naam").value = "";
  document.getElementById("dokument-vorm-beskrywing").value = "";
  document.getElementById("dokument-vorm-lêer").value = "";
  document.getElementById("paneel-dokument-vorm-foute").style.display = "none";
  document.getElementById("paneel-dokument-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-dokument-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function paneel_dokument_sluit_vorm() {
  document.getElementById("paneel-dokument-vorm-afdeling").style.display = "none";
}

async function paneel_dokument_hanteer_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById("paneel-dokument-vorm-foute");
  foutWrap.style.display = "none";

  const naam = document.getElementById("dokument-vorm-naam").value.trim();
  const beskrywing = document.getElementById("dokument-vorm-beskrywing").value.trim();
  const lêer_invoer = document.getElementById("dokument-vorm-lêer");
  const lêer = lêer_invoer.files && lêer_invoer.files[0];

  if (!lêer) {
    foutWrap.textContent = "Kies eers 'n lêer.";
    foutWrap.style.display = "block";
    return;
  }
  if (!DOKUMENTE_TOEGELATE_TIPES.includes(lêer.type)) {
    foutWrap.textContent = "Slegs Word-, PDF-, Excel- of PowerPoint-lêers word toegelaat.";
    foutWrap.style.display = "block";
    return;
  }
  if (lêer.size > DOKUMENTE_MAKS_GROOTTE) {
    foutWrap.textContent = "Lêer is te groot — maksimum 4MB.";
    foutWrap.style.display = "block";
    return;
  }

  const knoppie = document.getElementById("paneel-dokument-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const data_base64 = await lees_lêer_as_base64(lêer);

    const resp = await fetch(DOKUMENTE_OPLAAI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({
        naam,
        beskrywing,
        lêernaam: lêer.name,
        inhoud_tipe: lêer.type,
        data_base64,
      }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    paneel_dokument_sluit_vorm();
    paneel_dokumente_laai();
  } catch (fout) {
    console.error("Kon nie dokument oplaai nie:", fout);
    foutWrap.textContent = `Kon nie oplaai nie: ${fout.message}`;
    foutWrap.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = "+ Voeg by";
  }
}

async function paneel_dokument_skrap(dok, knoppie) {
  if (!window.confirm(`Skrap "${dok.naam}"?`)) return;
  knoppie.disabled = true;

  try {
    const resp = await fetch(DOKUMENTE_SKRAP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ id: dok.id }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    paneel_dokumente_laai();
  } catch (fout) {
    console.error("Kon nie dokument skrap nie:", fout);
    alert(`Kon nie skrap nie: ${fout.message}`);
    knoppie.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const voeg_by_knoppie = document.getElementById("paneel-voeg-dokument-by-knoppie");
  if (voeg_by_knoppie) voeg_by_knoppie.addEventListener("click", paneel_dokument_open_vorm);

  const kanselleer_knoppie = document.getElementById("paneel-dokument-vorm-kanselleer");
  if (kanselleer_knoppie) kanselleer_knoppie.addEventListener("click", paneel_dokument_sluit_vorm);

  const vorm = document.getElementById("paneel-dokument-vorm");
  if (vorm) vorm.addEventListener("submit", paneel_dokument_hanteer_indiening);
});

// Dieselfde "wag-vir-aanmeld"-waarnemer-patroon as paneel-registers.js —
// laai eers sodra #paneel-inhoud sigbaar raak (suksesvolle personeel-
// aanmelding), nie by kaal bladsy-laai nie (die versoek sou 401 kry).
(function paneel_dokumente_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_dokumente_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_dokumente_laai();
  }
})();
