// paneel-registers.js
// Hanteer die 4 nuwe registers: Vennote, Ontwerp/Admin, Printing, Aflewering.
// Presies dieselfde patroon as die Outeurs-register in paneelbord.js
// (kry_outorisasie_kop() en t() kom van daardie lêer, wat eerste laai).
// Apart gehou sodat paneelbord.js se bestaande logika nie geraak word nie.

const PANEEL_REGISTERS = [
  {
    sleutel: "vennote",
    enkelvoud: "vennoot",
    kry_endpoint: "/.netlify/functions/kry-vennote",
    skep_endpoint: "/.netlify/functions/skep-vennoot",
    veld_naam: "naam",
    respons_veld: "vennote",
    laai_teks: "Vennote word gelaai …",
    leeg_teks: "Nog geen vennote bygevoeg nie.",
    fout_teks: "Kon nie vennote laai nie.",
    knoppie_teks: "+ Voeg vennoot by",
  },
  {
    sleutel: "ontwerp-admin",
    enkelvoud: "ontwerp-admin",
    kry_endpoint: "/.netlify/functions/kry-ontwerp-admin",
    skep_endpoint: "/.netlify/functions/skep-ontwerp-admin",
    respons_veld: "ontwerp_admin",
    laai_teks: "Word gelaai …",
    leeg_teks: "Nog geen inskrywings bygevoeg nie.",
    fout_teks: "Kon nie laai nie.",
    knoppie_teks: "+ Voeg by",
  },
  {
    sleutel: "printing",
    enkelvoud: "printing",
    kry_endpoint: "/.netlify/functions/kry-printing",
    skep_endpoint: "/.netlify/functions/skep-printing",
    respons_veld: "printing",
    laai_teks: "Word gelaai …",
    leeg_teks: "Nog geen inskrywings bygevoeg nie.",
    fout_teks: "Kon nie laai nie.",
    knoppie_teks: "+ Voeg by",
  },
  {
    sleutel: "aflewering",
    enkelvoud: "aflewering",
    kry_endpoint: "/.netlify/functions/kry-aflewering",
    skep_endpoint: "/.netlify/functions/skep-aflewering",
    respons_veld: "aflewering",
    laai_teks: "Word gelaai …",
    leeg_teks: "Nog geen inskrywings bygevoeg nie.",
    fout_teks: "Kon nie laai nie.",
    knoppie_teks: "+ Voeg by",
  },
];

// In-geheue kas per register — ander skrips (bv. die boek-verdeling-vorm
// in 'n volgende stap) kan hierdie lees via window.paneel_register_kas.
window.paneel_register_kas = {};

async function paneel_register_laai(reg) {
  const wrap = document.getElementById(`paneel-${reg.sleutel}-lys`);
  wrap.innerHTML = `<p class="stelsel-boodskap">${reg.laai_teks}</p>`;

  try {
    const resp = await fetch(reg.kry_endpoint, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    const lys = data[reg.respons_veld] || [];
    window.paneel_register_kas[reg.sleutel] = lys;
    paneel_register_wys_lys(reg, lys);
  } catch (fout) {
    console.error(`Kon nie ${reg.sleutel} laai nie:`, fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${reg.fout_teks}</p>`;
  }
}

function paneel_register_wys_lys(reg, lys) {
  const wrap = document.getElementById(`paneel-${reg.sleutel}-lys`);

  if (!lys.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${reg.leeg_teks}</p>`;
    return;
  }

  wrap.innerHTML = lys
    .map(
      (item) => `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${item.naam}</strong>
            <span class="paneel-produk-outeur">${item.subrekening_kode}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function paneel_register_open_vorm(reg) {
  document.getElementById(`${reg.sleutel}-vorm-naam`).value = "";
  document.getElementById(`${reg.sleutel}-vorm-subrekening`).value = "";
  document.getElementById(`paneel-${reg.sleutel}-vorm-foute`).style.display = "none";
  document.getElementById(`paneel-${reg.sleutel}-vorm-afdeling`).style.display = "block";
  document.getElementById(`paneel-${reg.sleutel}-vorm-afdeling`).scrollIntoView({ behavior: "smooth" });
}

function paneel_register_sluit_vorm(reg) {
  document.getElementById(`paneel-${reg.sleutel}-vorm-afdeling`).style.display = "none";
}

async function paneel_register_hanteer_indiening(reg, gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById(`paneel-${reg.sleutel}-vorm-foute`);
  foutWrap.style.display = "none";

  const naam = document.getElementById(`${reg.sleutel}-vorm-naam`).value.trim();
  const subrekening_kode = document.getElementById(`${reg.sleutel}-vorm-subrekening`).value.trim();

  const knoppie = document.getElementById(`paneel-${reg.sleutel}-vorm-indien`);
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const resp = await fetch(reg.skep_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ naam, subrekening_kode }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    paneel_register_sluit_vorm(reg);
    paneel_register_laai(reg);
  } catch (fout) {
    console.error(`Kon nie ${reg.sleutel}-inskrywing stoor nie:`, fout);
    foutWrap.textContent = `Kon nie stoor nie: ${fout.message}`;
    foutWrap.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = reg.knoppie_teks;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  PANEEL_REGISTERS.forEach((reg) => {
    document
      .getElementById(`paneel-voeg-${reg.sleutel}-by-knoppie`)
      .addEventListener("click", () => paneel_register_open_vorm(reg));

    document
      .getElementById(`paneel-${reg.sleutel}-vorm-kanselleer`)
      .addEventListener("click", () => paneel_register_sluit_vorm(reg));

    document
      .getElementById(`paneel-${reg.sleutel}-vorm`)
      .addEventListener("submit", (gebeurtenis) => paneel_register_hanteer_indiening(reg, gebeurtenis));
  });
});

// Word deur paneelbord.js se hoof-auth-vloei aangeroep sodra 'n personeellid
// suksesvol aangemeld is (soortgelyk aan laai_outeurs()). Sien opmerking
// onderaan hierdie lêer vir hoe dit ingehaak word.
function laai_alle_paneel_registers() {
  PANEEL_REGISTERS.forEach((reg) => paneel_register_laai(reg));
}

// paneelbord.js roep tans net laai_outeurs() direkt aan by aanmeld — ons
// haak hier in sonder om daardie lêer te wysig: 'n klein "waarnemer" wat
// wag totdat #paneel-inhoud sigbaar raak (d.w.s. suksesvolle aanmeld), en
// dan EEN KEER die nuwe registers laai.
(function paneel_registers_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      laai_alle_paneel_registers();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  // Ook dadelik nagaan (bv. as die skerm reeds oop is teen die tyd hierdie
  // skrip loop, soos ná 'n bladsy-verversing terwyl aangemeld).
  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    laai_alle_paneel_registers();
  }
})();
