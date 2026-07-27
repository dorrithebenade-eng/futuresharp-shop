// paneel-registers.js
// Hanteer die 5 nuwe registers: Vennote, Ontwerp/Admin, Printing, Aflewering
// — lys, byvoeg, WYSIG, en SKRAP (met 'n waarskuwing as die inskrywing
// reeds op 'n boek se verdeling gebruik word — sien paneel_register_skrap).
// Presies dieselfde patroon as die Outeurs-register in paneelbord.js.
// kry_outorisasie_kop(), t(), en ALLE_PRODUKTE_ENDPOINT kom van
// paneelbord.js, wat eerste laai. Apart gehou sodat paneelbord.js se
// bestaande logika nie geraak word nie.

const PANEEL_REGISTERS = [
  {
    sleutel: "vennote",
    rol_tipe: "vennoot",
    idveld: "vennoot_id",
    kry_endpoint: "/.netlify/functions/kry-vennote",
    skep_endpoint: "/.netlify/functions/skep-vennoot",
    wysig_endpoint: "/.netlify/functions/wysig-vennoot",
    skrap_endpoint: "/.netlify/functions/skrap-vennoot",
    respons_veld: "vennote",
    laai_teks: "Vennote word gelaai …",
    leeg_teks: "Nog geen vennote bygevoeg nie.",
    fout_teks: "Kon nie vennote laai nie.",
    knoppie_teks: "+ Voeg vennoot by",
  },
  {
    sleutel: "ontwerp-admin",
    rol_tipe: "ontwerp_admin",
    idveld: "ontwerp_admin_id",
    kry_endpoint: "/.netlify/functions/kry-ontwerp-admin",
    skep_endpoint: "/.netlify/functions/skep-ontwerp-admin",
    wysig_endpoint: "/.netlify/functions/wysig-ontwerp-admin",
    skrap_endpoint: "/.netlify/functions/skrap-ontwerp-admin",
    respons_veld: "ontwerp_admin",
    laai_teks: "Word gelaai …",
    leeg_teks: "Nog geen inskrywings bygevoeg nie.",
    fout_teks: "Kon nie laai nie.",
    knoppie_teks: "+ Voeg by",
  },
  {
    sleutel: "printing",
    rol_tipe: "printing",
    idveld: "printing_id",
    kry_endpoint: "/.netlify/functions/kry-printing",
    skep_endpoint: "/.netlify/functions/skep-printing",
    wysig_endpoint: "/.netlify/functions/wysig-printing",
    skrap_endpoint: "/.netlify/functions/skrap-printing",
    respons_veld: "printing",
    laai_teks: "Word gelaai …",
    leeg_teks: "Nog geen inskrywings bygevoeg nie.",
    fout_teks: "Kon nie laai nie.",
    knoppie_teks: "+ Voeg by",
  },
  {
    sleutel: "aflewering",
    rol_tipe: "aflewering",
    idveld: "aflewering_id",
    kry_endpoint: "/.netlify/functions/kry-aflewering",
    skep_endpoint: "/.netlify/functions/skep-aflewering",
    wysig_endpoint: "/.netlify/functions/wysig-aflewering",
    skrap_endpoint: "/.netlify/functions/skrap-aflewering",
    respons_veld: "aflewering",
    laai_teks: "Word gelaai …",
    leeg_teks: "Nog geen inskrywings bygevoeg nie.",
    fout_teks: "Kon nie laai nie.",
    knoppie_teks: "+ Voeg by",
  },
];

// In-geheue kas per register — die boek-verdeling-vorm (Stap 2.3) kan
// hierdie lees via window.paneel_register_kas.
window.paneel_register_kas = {};

// In-geheue "watter inskrywing word tans gewysig" per register (null = nuwe
// inskrywing word bygevoeg, nie 'n bestaande een gewysig nie).
const paneel_register_wysig_toestand = {};

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
    // Ververs enige reeds-oop boek-verdeling-rye met die nuutste
    // register-data (kom van paneelbord.js).
    if (typeof ververs_alle_verdeling_aftrekkieslyste === "function") {
      ververs_alle_verdeling_aftrekkieslyste();
    }
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
            <span class="paneel-produk-outeur">
              ${item.subrekening_kode ? item.subrekening_kode : '<span class="paneel-status-merker paneel-status-merker--wag">Wag vir subrekening</span>'}
            </span>
          </div>
          <div class="paneel-produk-aksies">
            <button class="terug-skakel paneel-register-wysig-knoppie" data-id="${item[reg.idveld]}">Wysig</button>
            <button class="terug-skakel paneel-skrap-knoppie paneel-register-skrap-knoppie" data-id="${item[reg.idveld]}">Skrap</button>
          </div>
        </div>
      `
    )
    .join("");

  wrap.querySelectorAll(".paneel-register-wysig-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const item = lys.find((i) => String(i[reg.idveld]) === knoppie.dataset.id);
      if (item) paneel_register_open_vorm(reg, item);
    });
  });

  wrap.querySelectorAll(".paneel-register-skrap-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const item = lys.find((i) => String(i[reg.idveld]) === knoppie.dataset.id);
      if (item) paneel_register_skrap(reg, item, knoppie);
    });
  });
}

function paneel_register_open_vorm(reg, item) {
  paneel_register_wysig_toestand[reg.sleutel] = item ? item[reg.idveld] : null;

  document.getElementById(`${reg.sleutel}-vorm-naam`).value = item ? item.naam : "";
  document.getElementById(`${reg.sleutel}-vorm-subrekening`).value = item ? item.subrekening_kode : "";
  document.getElementById(`paneel-${reg.sleutel}-vorm-foute`).style.display = "none";

  const indien_knoppie = document.getElementById(`paneel-${reg.sleutel}-vorm-indien`);
  indien_knoppie.textContent = item ? "Stoor wysigings" : reg.knoppie_teks;

  document.getElementById(`paneel-${reg.sleutel}-vorm-afdeling`).style.display = "block";
  document.getElementById(`paneel-${reg.sleutel}-vorm-afdeling`).scrollIntoView({ behavior: "smooth" });
}

function paneel_register_sluit_vorm(reg) {
  paneel_register_wysig_toestand[reg.sleutel] = null;
  document.getElementById(`paneel-${reg.sleutel}-vorm-afdeling`).style.display = "none";
}

async function paneel_register_hanteer_indiening(reg, gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById(`paneel-${reg.sleutel}-vorm-foute`);
  foutWrap.style.display = "none";

  const naam = document.getElementById(`${reg.sleutel}-vorm-naam`).value.trim();
  const subrekening_kode = document.getElementById(`${reg.sleutel}-vorm-subrekening`).value.trim();
  const wysig_id = paneel_register_wysig_toestand[reg.sleutel];

  const knoppie = document.getElementById(`paneel-${reg.sleutel}-vorm-indien`);
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const endpoint = wysig_id ? reg.wysig_endpoint : reg.skep_endpoint;
    const liggaam = wysig_id
      ? { [reg.idveld]: wysig_id, naam, subrekening_kode }
      : { naam, subrekening_kode };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify(liggaam),
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
    knoppie.textContent = wysig_id ? "Stoor wysigings" : reg.knoppie_teks;
  }
}

// Kyk of 'n register-inskrywing reeds op enige boek se e-boek- of
// harde-kopie-verdeling gebruik word (deur reg.idveld op elke
// verdeling-inskrywing te vergelyk — werk vandag reeds vir Outeurs, en
// outomaties ook vir die ander registers sodra Stap 2.3 se verdeling-vorm
// dieselfde idveld-benaming gebruik). Gee 'n lys boektitels terug.
async function paneel_register_kry_gebruik_in_produkte(reg, id) {
  try {
    const resp = await fetch(ALLE_PRODUKTE_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) return [];
    const data = await resp.json();
    const produkte = data.produkte || [];

    const titels = [];
    produkte.forEach((produk) => {
      const alle_verdelings = [
        ...((produk.formate && produk.formate.eboek && produk.formate.eboek.verdelings) || []),
        ...((produk.formate && produk.formate.harde_kopie && produk.formate.harde_kopie.verdelings) || []),
      ];
      const in_gebruik = alle_verdelings.some((v) => v.rol_tipe === reg.rol_tipe && v.entiteit_id === String(id));
      if (in_gebruik) titels.push(produk.titel);
    });

    return titels;
  } catch (fout) {
    console.error("Kon nie produkgebruik nagaan nie:", fout);
    return []; // by twyfel: moenie die skrap-vloei blokkeer nie, net geen waarskuwing nie
  }
}

async function paneel_register_skrap(reg, item, knoppie) {
  knoppie.disabled = true;

  const titels = await paneel_register_kry_gebruik_in_produkte(reg, item[reg.idveld]);

  let bevestig_teks = `Skrap "${item.naam}"?`;
  if (titels.length) {
    bevestig_teks =
      `Let op: "${item.naam}" word tans gebruik in: ${titels.join(", ")}.\n\n` +
      `Skrapping sal NIE daardie boek se verdeling outomaties verwyder nie — gaan dit self na.\n\n` +
      `Wil jy steeds "${item.naam}" skrap?`;
  }

  if (!window.confirm(bevestig_teks)) {
    knoppie.disabled = false;
    return;
  }

  try {
    const resp = await fetch(reg.skrap_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ [reg.idveld]: item[reg.idveld] }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    paneel_register_laai(reg);
  } catch (fout) {
    console.error(`Kon nie ${reg.sleutel}-inskrywing skrap nie:`, fout);
    alert(`Kon nie skrap nie: ${fout.message}`);
    knoppie.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  PANEEL_REGISTERS.forEach((reg) => {
    document
      .getElementById(`paneel-voeg-${reg.sleutel}-by-knoppie`)
      .addEventListener("click", () => paneel_register_open_vorm(reg, null));

    document
      .getElementById(`paneel-${reg.sleutel}-vorm-kanselleer`)
      .addEventListener("click", () => paneel_register_sluit_vorm(reg));

    document
      .getElementById(`paneel-${reg.sleutel}-vorm`)
      .addEventListener("submit", (gebeurtenis) => paneel_register_hanteer_indiening(reg, gebeurtenis));
  });
});

function laai_alle_paneel_registers() {
  PANEEL_REGISTERS.forEach((reg) => paneel_register_laai(reg));
}

// paneelbord.js roep tans net laai_outeurs() direk aan by aanmeld — ons
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

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    laai_alle_paneel_registers();
  }
})();
