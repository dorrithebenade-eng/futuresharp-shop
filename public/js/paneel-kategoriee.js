// paneel-kategoriee.js — hanteer die "Kategorieë"-oortjie (lys/voeg-by/
// wysig/skrap) EN bou die merkblokkies-lys op die produk-vorm. Apart
// gehou van paneel-registers.js aangesien kategorieë 'n eenvoudiger
// skema het (net 'n naam, geen subrekening-kode nie).
//
// kry_outorisasie_kop() en t() kom van paneelbord.js, wat eerste laai.
// window.kategoriee_kas word deur paneelbord.js se produk-vorm-logika
// gebruik om die merkblokkies te bou/lees.

window.kategoriee_kas = [];

let kategorie_wysig_toestand = null; // null = nuwe kategorie, andersins die kategorie_id wat gewysig word

async function paneel_kategoriee_laai() {
  const wrap = document.getElementById("paneel-kategoriee-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_word_gelaai")}</p>`;

  try {
    const resp = await fetch("/.netlify/functions/kry-kategoriee");
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    window.kategoriee_kas = data.kategoriee || [];

    paneel_kategoriee_wys_lys(window.kategoriee_kas);
    // Ververs enige reeds-oop produk-vorm se kategorie-merkblokkies met
    // die nuutste lys (bv. ná 'n nuwe kategorie bygevoeg is).
    if (typeof ververs_kategorie_merkblokkies === "function") {
      ververs_kategorie_merkblokkies();
    }
  } catch (fout) {
    console.error("Kon nie kategorieë laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("kategorie_kon_nie_laai")}</p>`;
  }
}

function paneel_kategoriee_wys_lys(lys) {
  const wrap = document.getElementById("paneel-kategoriee-lys");

  if (!lys.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("kategorie_leeg")}</p>`;
    return;
  }

  wrap.innerHTML = lys
    .map(
      (kat) => `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${kat.naam_af}</strong> <span class="paneel-kategorie-naam-en">(EN: ${kat.naam_en})</span>
          </div>
          <div class="paneel-produk-aksies">
            <button class="terug-skakel paneel-kategorie-wysig-knoppie" data-id="${kat.kategorie_id}">${t("paneel_wysig")}</button>
            <button class="terug-skakel paneel-skrap-knoppie paneel-kategorie-skrap-knoppie" data-id="${kat.kategorie_id}">${t("paneel_skrap")}</button>
          </div>
        </div>
      `
    )
    .join("");

  wrap.querySelectorAll(".paneel-kategorie-wysig-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const kat = lys.find((k) => k.kategorie_id === knoppie.dataset.id);
      if (kat) paneel_kategorie_open_vorm(kat);
    });
  });

  wrap.querySelectorAll(".paneel-kategorie-skrap-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const kat = lys.find((k) => k.kategorie_id === knoppie.dataset.id);
      if (kat) paneel_kategorie_skrap(kat, knoppie);
    });
  });
}

function paneel_kategorie_open_vorm(kat) {
  kategorie_wysig_toestand = kat ? kat.kategorie_id : null;
  document.getElementById("kategorie-vorm-naam-af").value = kat ? kat.naam_af : "";
  document.getElementById("kategorie-vorm-naam-en").value = kat ? kat.naam_en : "";
  document.getElementById("paneel-kategorie-vorm-foute").style.display = "none";
  document.getElementById("paneel-kategorie-vorm-indien").textContent = kat ? t("paneel_stoor_wysigings") : t("kategorie_voeg_by_knoppie");
  document.getElementById("paneel-kategorie-vorm-afdeling").style.display = "block";
}

function paneel_kategorie_sluit_vorm() {
  kategorie_wysig_toestand = null;
  document.getElementById("paneel-kategorie-vorm-afdeling").style.display = "none";
}

async function paneel_kategorie_hanteer_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById("paneel-kategorie-vorm-foute");
  foutWrap.style.display = "none";

  const naam_af = document.getElementById("kategorie-vorm-naam-af").value.trim();
  const naam_en = document.getElementById("kategorie-vorm-naam-en").value.trim();
  const knoppie = document.getElementById("paneel-kategorie-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const endpoint = kategorie_wysig_toestand
      ? "/.netlify/functions/wysig-kategorie"
      : "/.netlify/functions/skep-kategorie";
    const liggaam = kategorie_wysig_toestand
      ? { kategorie_id: kategorie_wysig_toestand, naam_af, naam_en }
      : { naam_af, naam_en };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify(liggaam),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    paneel_kategorie_sluit_vorm();
    paneel_kategoriee_laai();
  } catch (fout) {
    console.error("Kon nie kategorie stoor nie:", fout);
    foutWrap.textContent = `${t("kategorie_kon_nie_stoor")}: ${fout.message}`;
    foutWrap.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = kategorie_wysig_toestand ? t("paneel_stoor_wysigings") : t("kategorie_voeg_by_knoppie");
  }
}

async function paneel_kategorie_kry_gebruik_in_produkte(kategorie_id) {
  try {
    const resp = await fetch(ALLE_PRODUKTE_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) return [];
    const data = await resp.json();
    const produkte = data.produkte || [];
    return produkte
      .filter((p) => Array.isArray(p.kategorie_ids) && p.kategorie_ids.includes(kategorie_id))
      .map((p) => p.titel);
  } catch {
    return [];
  }
}

async function paneel_kategorie_skrap(kat, knoppie) {
  knoppie.disabled = true;

  const titels = await paneel_kategorie_kry_gebruik_in_produkte(kat.kategorie_id);
  let bevestig_teks = `${t("kategorie_skrap_vraag_voorvoegsel")} "${kat.naam_af}"?`;
  if (titels.length) {
    bevestig_teks =
      `Let op: "${kat.naam_af}" word tans gebruik in: ${titels.join(", ")}.\n\n` +
      `Skrapping sal NIE daardie boeke se kategorie outomaties verwyder nie — gaan dit self na.\n\n` +
      `Wil jy steeds "${kat.naam_af}" skrap?`;
  }

  if (!window.confirm(bevestig_teks)) {
    knoppie.disabled = false;
    return;
  }

  try {
    const resp = await fetch("/.netlify/functions/skrap-kategorie", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ kategorie_id: kat.kategorie_id }),
    });
    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }
    paneel_kategoriee_laai();
  } catch (fout) {
    console.error("Kon nie kategorie skrap nie:", fout);
    alert(`${t("kategorie_kon_nie_skrap")}: ${fout.message}`);
    knoppie.disabled = false;
  }
}

// --- Kategorie-merkblokkies op die produk-vorm ---

function bou_kategorie_merkblokkies_html(gekose_ids) {
  const gekose = new Set(gekose_ids || []);
  if (!window.kategoriee_kas.length) {
    return `<p class="stelsel-boodskap">${t("kategorie_geen_vir_produk")}</p>`;
  }
  return window.kategoriee_kas
    .map(
      (kat) => `
        <label class="paneel-kategorie-merkblokkie">
          <input type="checkbox" value="${kat.kategorie_id}" ${gekose.has(kat.kategorie_id) ? "checked" : ""}>
          ${kat.naam_af}
        </label>
      `
    )
    .join("");
}

function bou_kategorie_merkblokkies(gekose_ids) {
  document.getElementById("vorm-kategoriee-lys").innerHTML = bou_kategorie_merkblokkies_html(gekose_ids);
}

function ververs_kategorie_merkblokkies() {
  const huidige_geselekteerdes = Array.from(
    document.querySelectorAll("#vorm-kategoriee-lys input[type=checkbox]:checked")
  ).map((el) => el.value);
  bou_kategorie_merkblokkies(huidige_geselekteerdes);
}

function kry_kategorie_ids_uit_vorm() {
  return Array.from(document.querySelectorAll("#vorm-kategoriee-lys input[type=checkbox]:checked")).map(
    (el) => el.value
  );
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("paneel-voeg-kategorie-by-knoppie").addEventListener("click", () => paneel_kategorie_open_vorm(null));
  document.getElementById("paneel-kategorie-vorm-kanselleer").addEventListener("click", paneel_kategorie_sluit_vorm);
  document.getElementById("paneel-kategorie-vorm").addEventListener("submit", paneel_kategorie_hanteer_indiening);
});

// Selfde "wag totdat paneel-inhoud sigbaar raak"-patroon as elders —
// laai die kategorie-lys sodra personeel suksesvol aangemeld het, sodat
// die merkblokkies op die produk-vorm reeds gereed is.
(function paneel_kategoriee_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_kategoriee_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_kategoriee_laai();
  }
})();
