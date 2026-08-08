// public/js/outeur-indien.js
//
// Die boekvorm. Dit is die titel se REKORD, nie 'n eenmalige indiening nie:
// dieselfde vorm dra die konsep, die indiening, en later 'n wysiging aan 'n
// boek wat reeds op die rak is.
//
// DIE PRYS. Die vorm se prysveld aanvaar 'n PRYS of 'n VERLANGDE VERDIENSTE.
// Dit is nie 'n detail nie; dit is hoe die vorm werk. Die outeur sien vier
// getalle — wat die koper betaal, sy koste terug, sy verdienste aan die
// boek, en wat Future Sharp ontvang.
//
// NOOIT 'N PERSENTASIE BY 'N HARDE KOPIE NIE. 'n Persentasie van 'n prys wat
// sy eie druk- en poskoste insluit, beteken niks en lok net 'n vraag uit.
//
// Die som kom uit verdeling-som.js — dieselfde funksie wat die paneelbord se
// Verdeling-rekenaar loop. Verskil die twee met 'n sent, weier
// skep-produk.js die boek, en dan sien 'n outeur die fout.

// Die outeur se deel staan VOORAF vas en is nooit 'n veld in sy vorm nie.
// Dit kom later uit sy outeur-inskrywing; tot dan is dit die gewone 70%.
const IV_OUTEUR_PCT = 70;

// Paystack se werklike fooi, soos die rekenaar se aannames. Die outeur sien
// dit nooit; dit beïnvloed net wat "Future Sharp ontvang" wys.
const IV_AANNAMES = { paystackPct: 2.9, paystackVaste: 1, btwPct: 15 };

const IV_FORMATE = [
  { sleutel: "eboek", naam: "E-boek", i18n: "formaat_eboek", koste: false, tydperk: false },
  { sleutel: "hardekopie", naam: "Harde kopie", i18n: "formaat_harde_kopie", koste: true, tydperk: false },
  { sleutel: "leen", naam: "Leen", i18n: "formaat_leen", koste: false, tydperk: true },
];

let iv_nommer = null;
let iv_stand = "konsep";
let iv_wag = null;
let iv_besig = false;

function iv_t(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function iv_rand(bedrag) {
  return "R" + (Number(bedrag) || 0).toLocaleString("af-ZA", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// --- Die formaat-blokke ---

function iv_bou_formate() {
  const houer = document.getElementById("iv-formate");
  if (!houer) return;

  IV_FORMATE.forEach((f) => {
    const blok = document.createElement("div");
    blok.className = "iv-formaat af";
    blok.id = "iv-blok-" + f.sleutel;

    blok.innerHTML = `
      <label class="iv-formaat-kop">
        <input type="checkbox" id="iv-aan-${f.sleutel}" data-veld="formate.${f.sleutel}.aan">
        <span>${iv_t(f.i18n, f.naam)}</span>
      </label>
      <div class="iv-formaat-velde" id="iv-velde-${f.sleutel}" hidden>
        <div class="iv-twee">
          <label class="iv-veld"><span>${iv_t("iv_wat_gee_jy", "Wat gee jy in?")}</span>
            <select id="iv-modus-${f.sleutel}" data-veld="formate.${f.sleutel}.modus">
              <option value="prys">${iv_t("iv_modus_prys", "Die prys van die boek")}</option>
              <option value="wins">${iv_t("iv_modus_wins", "Wat ek wil verdien")}</option>
            </select></label>
          <label class="iv-veld"><span id="iv-etiket-${f.sleutel}">${iv_t("iv_prys", "Prys (R)")}</span>
            <input type="number" min="0" step="1" id="iv-in-${f.sleutel}" data-veld="formate.${f.sleutel}.invoer"></label>
        </div>
        ${f.koste ? `
        <label class="iv-veld"><span>${iv_t("iv_koste", "Jou druk- en afleweringskoste per eksemplaar (R)")}</span>
          <small>${iv_t("iv_koste_fyn", "Kom volledig terug \\u2014 Future Sharp verdien nie daarop nie")}</small>
          <input type="number" min="0" step="1" id="iv-k-${f.sleutel}" data-veld="formate.${f.sleutel}.koste"></label>` : ""}
        ${f.tydperk ? `
        <label class="iv-veld iv-kort"><span>${iv_t("iv_tydperk", "Tydperk (dae)")}</span>
          <input type="number" min="1" step="1" data-veld="formate.${f.sleutel}.dae" value="30"></label>` : ""}
        <div id="iv-som-${f.sleutel}"></div>
      </div>`;

    houer.appendChild(blok);
  });

  IV_FORMATE.forEach((f) => {
    const merk = document.getElementById("iv-aan-" + f.sleutel);
    if (merk) merk.addEventListener("change", () => iv_wissel(f.sleutel));
  });
}

function iv_wissel(sleutel) {
  const aan = (document.getElementById("iv-aan-" + sleutel) || {}).checked;
  const velde = document.getElementById("iv-velde-" + sleutel);
  const blok = document.getElementById("iv-blok-" + sleutel);
  if (velde) velde.hidden = !aan;
  if (blok) blok.classList.toggle("af", !aan);

  // Deel 5 gaan oor gedrukte eksemplare en het geen betekenis sonder een.
  const deel5 = document.getElementById("iv-deel5");
  if (deel5) deel5.hidden = !(document.getElementById("iv-aan-hardekopie") || {}).checked;

  iv_reken();
}

// --- Die som ---

function iv_reken() {
  IV_FORMATE.forEach((f) => {
    const aan = (document.getElementById("iv-aan-" + f.sleutel) || {}).checked;
    const bak = document.getElementById("iv-som-" + f.sleutel);
    if (!bak) return;
    if (!aan) { bak.innerHTML = ""; return; }

    const modus = (document.getElementById("iv-modus-" + f.sleutel) || {}).value || "prys";
    const invoer = Number((document.getElementById("iv-in-" + f.sleutel) || {}).value) || 0;
    const koste_el = document.getElementById("iv-k-" + f.sleutel);
    const koste = koste_el ? Number(koste_el.value) || 0 : 0;

    // Die etiket verander saam met die modus, en by 'n harde kopie sê hy
    // uitdruklik dat die getal nie is wat die koper betaal nie.
    const etiket = document.getElementById("iv-etiket-" + f.sleutel);
    if (etiket) {
      etiket.textContent = modus === "wins"
        ? iv_t("iv_wins_veld", "Wat ek per eksemplaar wil verdien (R)")
        : (f.koste
            ? iv_t("iv_boekprys_veld", "Prys van die boek (R) \u2014 versending kom hierby")
            : iv_t("iv_prys", "Prys (R)"));
    }

    const u = vs_bereken({
      modus, begin: invoer, koste,
      outeurPct: IV_OUTEUR_PCT,
      paystackPct: IV_AANNAMES.paystackPct,
      paystackVaste: IV_AANNAMES.paystackVaste,
      btwPct: IV_AANNAMES.btwPct,
    });

    if (u.leeg) { bak.innerHTML = ""; return; }

    const rye = [];
    rye.push([iv_t("iv_som_koper", "Die koper betaal"), iv_rand(u.P), true]);
    if (u.K > 0) rye.push([iv_t("iv_som_koste", "Jou druk en aflewering, terug"), iv_rand(u.K), false]);
    rye.push([iv_t("iv_som_wins", "Jou verdienste aan die boek"), iv_rand(u.outeurWins), false]);
    rye.push([iv_t("iv_som_jy", "Jy ontvang"), iv_rand(u.outeurRand), true]);
    rye.push([iv_t("iv_som_fs", "Future Sharp ontvang"), iv_rand(u.futureSharpRand), false]);

    const te_laag = u.futureSharpRand <= 0;
    bak.innerHTML =
      `<div class="iv-som${te_laag ? " iv-som-fout" : ""}">` +
      rye.map(([e, w, vet]) =>
        `<div class="iv-som-ry${vet ? " iv-vet" : ""}"><span>${e}</span><span>${w}</span></div>`).join("") +
      (te_laag ? `<div class="iv-som-ry"><span>${iv_t("iv_te_laag", "Hierdie prys is te laag om te werk.")}</span></div>` : "") +
      "</div>";
  });
}

// --- Mede-outeurs ---

function iv_voeg_mede(waardes) {
  const houer = document.getElementById("iv-mede");
  if (!houer) return;
  const w = waardes || {};

  const ry = document.createElement("div");
  ry.className = "iv-mede-ry";
  ry.innerHTML =
    `<input type="text" class="iv-mede-naam" placeholder="${iv_t("iv_mede_naam", "Naam en van")}" value="${w.naam || ""}">` +
    `<input type="text" class="iv-mede-epos" placeholder="${iv_t("iv_mede_epos", "E-posadres")}" value="${w.epos || ""}">` +
    `<button type="button" class="iv-weg" aria-label="${iv_t("iv_verwyder", "Verwyder")}">&times;</button>`;

  ry.querySelector(".iv-weg").addEventListener("click", () => { ry.remove(); iv_tik(); });
  houer.appendChild(ry);
}

function iv_lees_mede() {
  return Array.from(document.querySelectorAll(".iv-mede-ry"))
    .map((ry) => ({
      naam: ry.querySelector(".iv-mede-naam").value.trim(),
      epos: ry.querySelector(".iv-mede-epos").value.trim(),
    }))
    .filter((m) => m.naam || m.epos);
}

// --- Lees en skryf die vorm ---
//
// Elke veld dra sy pad in data-veld, met punte vir neste. Dit hou die HTML
// en die rekord in pas sonder 'n tweede lys wat kan wegdryf.

function iv_stel_diep(voorwerp, pad, waarde) {
  const dele = pad.split(".");
  let hier = voorwerp;
  dele.slice(0, -1).forEach((deel) => {
    if (typeof hier[deel] !== "object" || hier[deel] === null) hier[deel] = {};
    hier = hier[deel];
  });
  hier[dele[dele.length - 1]] = waarde;
}

function iv_kry_diep(voorwerp, pad) {
  return pad.split(".").reduce((hier, deel) =>
    (hier && typeof hier === "object" ? hier[deel] : undefined), voorwerp);
}

function iv_lees_vorm() {
  const data = {};
  document.querySelectorAll("[data-veld]").forEach((el) => {
    const pad = el.getAttribute("data-veld");
    const waarde = el.type === "checkbox" ? el.checked
      : (el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value);
    iv_stel_diep(data, pad, waarde);
  });
  data.mede_outeurs = iv_lees_mede();
  return data;
}

function iv_vul_vorm(data) {
  document.querySelectorAll("[data-veld]").forEach((el) => {
    const waarde = iv_kry_diep(data, el.getAttribute("data-veld"));
    if (waarde === undefined || waarde === null) return;
    if (el.type === "checkbox") el.checked = Boolean(waarde);
    else el.value = waarde;
  });

  const houer = document.getElementById("iv-mede");
  if (houer) {
    houer.innerHTML = "";
    (data.mede_outeurs || []).forEach(iv_voeg_mede);
  }

  IV_FORMATE.forEach((f) => iv_wissel(f.sleutel));
}

// --- Stoor ---
//
// Sowat twee sekondes nadat hy ophou tik, en by blur. Die knoppie bly staan,
// want dit is die enigste manier waarop hy WEET dit is gestoor.

function iv_stel_stand(klas, teks) {
  const el = document.getElementById("iv-stand");
  if (!el) return;
  el.className = "iv-stand " + klas;
  el.textContent = teks;
}

function iv_tik() {
  clearTimeout(iv_wag);
  iv_stel_stand("besig", iv_t("iv_nie_gestoor", "Wysigings nog nie gestoor nie"));
  iv_wag = setTimeout(() => iv_stoor(false), 2000);
  iv_reken();
}

async function iv_stoor(met_die_hand) {
  clearTimeout(iv_wag);
  if (iv_besig) return;
  iv_besig = true;
  iv_stel_stand("besig", iv_t("iv_stoor_tans", "Stoor \u2026"));

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) {
    iv_besig = false;
    iv_stel_stand("fout", iv_t("iv_stoor_fout", "Kon nie stoor nie \u2014 probeer weer, of hou die bladsy oop"));
    return;
  }

  try {
    const resp = await fetch("/.netlify/functions/stoor-indiening", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessie.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nommer: iv_nommer, data: iv_lees_vorm() }),
    });

    if (!resp.ok) {
      iv_stel_stand("fout", iv_t("iv_stoor_fout", "Kon nie stoor nie \u2014 probeer weer, of hou die bladsy oop"));
      iv_besig = false;
      return;
    }

    const uit = await resp.json();
    if (uit.nommer && !iv_nommer) {
      iv_nommer = uit.nommer;
      const n = document.getElementById("iv-nommer");
      if (n) { n.className = "iv-nommer"; n.textContent = uit.nommer; }
      // Die adres kry die nommer, sodat 'n herlaai nie 'n tweede rekord skep nie.
      history.replaceState(null, "", "indien.html?nommer=" + encodeURIComponent(uit.nommer));
    }

    const nou = new Date();
    const tyd = String(nou.getHours()).padStart(2, "0") + ":" + String(nou.getMinutes()).padStart(2, "0");
    iv_stel_stand("klaar",
      (met_die_hand ? iv_t("iv_gestoor", "Gestoor") : iv_t("iv_outo_gestoor", "Outomaties gestoor")) + " " + tyd);
  } catch (fout) {
    console.error("Kon nie die vorm stoor nie:", fout);
    iv_stel_stand("fout", iv_t("iv_stoor_fout", "Kon nie stoor nie \u2014 probeer weer, of hou die bladsy oop"));
  }

  iv_besig = false;
}

// --- Laai ---

async function iv_laai_bestaande(nommer) {
  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) return;

  try {
    const resp = await fetch(
      "/.netlify/functions/kry-my-indienings?nommer=" + encodeURIComponent(nommer),
      { headers: { Authorization: `Bearer ${sessie.access_token}` } }
    );
    if (!resp.ok) {
      iv_stel_stand("fout", iv_t("iv_nie_gevind", "Hierdie vorm kon nie gelaai word nie."));
      return;
    }

    const rekord = await resp.json();
    iv_nommer = rekord.nommer;
    iv_stand = rekord.stand;

    const n = document.getElementById("iv-nommer");
    if (n) { n.className = "iv-nommer"; n.textContent = rekord.nommer; }

    // 'n Boek op die rak wys sy HANGENDE waardes as daar een is — dit is wat
    // hy laas voorgestel het. Die winkel wys steeds die oues.
    iv_vul_vorm(rekord.hangend || rekord.data || {});

    if (rekord.opmerking) {
      const blok = document.getElementById("iv-opmerking");
      if (blok) { blok.hidden = false; blok.textContent = rekord.opmerking; }
    }

    const iv_woord = { ingedien: ["oi_merk_ingedien", "Ingedien"], wysiging: ["oi_merk_wysiging", "Wysiging hangend"], goedgekeur: ["oi_merk_goedgekeur", "Goedgekeur"], op_rak: ["oi_merk_rak", "Op die rak"] }[rekord.stand];
    if (iv_woord) { iv_stel_stand("klaar", iv_t(iv_woord[0], iv_woord[1])); } else { iv_stel_stand("", iv_t("iv_stoor_outomaties", "Word outomaties gestoor terwyl jy tik")); }
  } catch (fout) {
    console.error("Kon nie die vorm laai nie:", fout);
    iv_stel_stand("fout", iv_t("iv_nie_gevind", "Hierdie vorm kon nie gelaai word nie."));
  }
}

// outeur.js stuur hierdie gebeurtenis sodra die outeur bevestig is.
document.addEventListener("outeur-gereed", () => {
  iv_bou_formate();

  const vorm = document.getElementById("iv-vorm");
  if (vorm) {
    vorm.addEventListener("input", iv_tik);
    vorm.addEventListener("change", iv_tik);
    // 'n Veld wat fokus verloor, stoor dadelik — dan wag hy nie twee
    // sekondes nadat hy klaar is nie.
    vorm.addEventListener("blur", () => { if (iv_nommer) iv_stoor(false); }, true);
  }

  const knop = document.getElementById("iv-stoor");
  if (knop) knop.addEventListener("click", () => iv_stoor(true));

  const voeg = document.getElementById("iv-voeg-mede");
  if (voeg) voeg.addEventListener("click", () => iv_voeg_mede());

  const gevra = new URLSearchParams(window.location.search).get("nommer");
  if (gevra) iv_laai_bestaande(gevra);
});
