// Personeel-paneelbord — Netlify Identity-aanmelding, katalogus-lys, en
// die "Voeg produk by"/"Wysig"-vorm. Rolkontrole gebeur ook bediener-kant
// in elke Function (sien _rol-kontrole.js) — hierdie front-end-kontrole is
// net vir 'n gemaklike gebruikerservaring, nie die werklike sekuriteit nie.

const ALLE_PRODUKTE_ENDPOINT = "/.netlify/functions/kry-alle-produkte";
const SKEP_PRODUK_ENDPOINT = "/.netlify/functions/skep-produk";
const WYSIG_PRODUK_ENDPOINT = "/.netlify/functions/wysig-produk";
const KRY_OUTEURS_ENDPOINT = "/.netlify/functions/kry-outeurs";
const SKEP_OUTEUR_ENDPOINT = "/.netlify/functions/skep-outeur";

// In-geheue kas van outeurs — gevul deur laai_outeurs(), gebruik om die
// verdeling-aftrekkieslyste op elke boek-vorm te bou sonder om elke keer
// weer te moet gaan haal.
let outeurs_kas = [];

function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function het_personeel_rol(gebruiker) {
  const rolle = (gebruiker && gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  return rolle.includes("personeel");
}

// --- Aanmeld-status ---

function verberg_alle_auth_afdelings() {
  document.getElementById("paneel-aanmeld-afdeling").style.display = "none";
  document.getElementById("paneel-herstel-afdeling").style.display = "none";
  document.getElementById("paneel-nuwe-wagwoord-afdeling").style.display = "none";
  document.getElementById("paneel-status").style.display = "none";
}

function wys_aangemeld_toestand(gebruiker) {
  verberg_alle_auth_afdelings();
  document.getElementById("paneel-afmeld-knoppie").style.display = "inline-flex";
  document.getElementById("paneel-gebruiker-epos").textContent = gebruiker.email;

  const statusWrap = document.getElementById("paneel-status");
  const inhoudWrap = document.getElementById("paneel-inhoud");

  if (!het_personeel_rol(gebruiker)) {
    statusWrap.style.display = "block";
    statusWrap.textContent = t("paneel_geen_personeel_rol");
    inhoudWrap.style.display = "none";
    return;
  }

  inhoudWrap.style.display = "block";
  laai_produkte();
  laai_outeurs();
}

function wys_afgemeld_toestand() {
  verberg_alle_auth_afdelings();
  document.getElementById("paneel-aanmeld-afdeling").style.display = "block";
  document.getElementById("paneel-afmeld-knoppie").style.display = "none";
  document.getElementById("paneel-gebruiker-epos").textContent = "";
  document.getElementById("paneel-inhoud").style.display = "none";
}

function kry_outorisasie_kop() {
  const sessie = identiteit_kry_sessie();
  return sessie ? { Authorization: `Bearer ${sessie.access_token}` } : {};
}

// --- Produkte-lys ---

async function laai_produkte() {
  const wrap = document.getElementById("paneel-produkte-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_produkte_laai")}</p>`;

  try {
    const resp = await fetch(ALLE_PRODUKTE_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    wys_produkte_lys(data.produkte || []);
  } catch (fout) {
    console.error("Kon nie produkte laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_kon_nie_produkte_laai")}</p>`;
  }
}

function wys_produkte_lys(produkte) {
  const wrap = document.getElementById("paneel-produkte-lys");

  if (!produkte.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_nog_geen_produkte")}</p>`;
    return;
  }

  wrap.innerHTML = produkte
    .map((produk) => {
      const eboek = produk.formate && produk.formate.eboek;
      const hardeKopie = produk.formate && produk.formate.harde_kopie;

      const pryse = [];
      if (eboek && eboek.beskikbaar) pryse.push(`${t("paneel_eboek")} — ${formateer_prys_sent(eboek.prys_sent)}`);
      if (hardeKopie && hardeKopie.beskikbaar) pryse.push(`${t("paneel_hardekopie")} — ${formateer_prys_sent(hardeKopie.prys_sent)}`);

      return `
        <div class="paneel-produk-ry ${produk.aktief ? "" : "paneel-produk-ry-onaktief"}">
          <div class="paneel-produk-inligting">
            <strong>${produk.titel}</strong>
            <span class="paneel-produk-outeur">${produk.outeur}</span>
            <span class="paneel-produk-pryse">${pryse.join(" · ") || t("paneel_geen_formaat")}</span>
            ${!produk.aktief ? `<span class="paneel-onaktief-etiket">${t("paneel_onaktief")}</span>` : ""}
          </div>
          <div class="paneel-produk-aksies">
            <button class="terug-skakel paneel-wysig-knoppie" data-slug="${produk.slug}">${t("paneel_wysig")}</button>
            <button class="terug-skakel paneel-aktief-knoppie" data-slug="${produk.slug}" data-aktief="${produk.aktief}">
              ${produk.aktief ? t("paneel_deaktiveer") : t("paneel_aktiveer")}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  wrap.querySelectorAll(".paneel-wysig-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const produk = produkte.find((p) => p.slug === knoppie.dataset.slug);
      if (produk) open_vorm_vir_wysig(produk);
    });
  });

  wrap.querySelectorAll(".paneel-aktief-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", async () => {
      const nuwe_aktief_status = knoppie.dataset.aktief !== "true";
      knoppie.disabled = true;
      try {
        const resp = await fetch(WYSIG_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ slug: knoppie.dataset.slug, wysigings: { aktief: nuwe_aktief_status } }),
        });
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        laai_produkte();
      } catch (fout) {
        console.error("Kon nie aktief-status wysig nie:", fout);
        alert(t("paneel_kon_nie_status_wysig"));
        knoppie.disabled = false;
      }
    });
  });
}

// --- Outeurs-lys ---

async function laai_outeurs() {
  const wrap = document.getElementById("paneel-outeurs-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_outeurs_laai")}</p>`;

  try {
    const resp = await fetch(KRY_OUTEURS_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    outeurs_kas = data.outeurs || [];
    wys_outeurs_lys(outeurs_kas);
    // Ververs enige reeds-oop verdeling-aftrekkieslyste met die nuutste
    // outeurs-lys (bv. ná 'n nuwe outeur bygevoeg is terwyl 'n boek se
    // vorm reeds oop was).
    ververs_alle_verdeling_aftrekkieslyste();
  } catch (fout) {
    console.error("Kon nie outeurs laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_kon_nie_outeurs_laai")}</p>`;
  }
}

function wys_outeurs_lys(outeurs) {
  const wrap = document.getElementById("paneel-outeurs-lys");

  if (!outeurs.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_nog_geen_outeurs")}</p>`;
    return;
  }

  wrap.innerHTML = outeurs
    .map(
      (outeur) => `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${outeur.naam}</strong>
            <span class="paneel-produk-outeur">${outeur.subrekening_kode}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function open_outeur_vorm() {
  document.getElementById("outeur-vorm-naam").value = "";
  document.getElementById("outeur-vorm-subrekening").value = "";
  document.getElementById("paneel-outeur-vorm-foute").style.display = "none";
  document.getElementById("paneel-outeur-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-outeur-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function sluit_outeur_vorm() {
  document.getElementById("paneel-outeur-vorm-afdeling").style.display = "none";
}

async function hanteer_outeur_vorm_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById("paneel-outeur-vorm-foute");
  foutWrap.style.display = "none";

  const naam = document.getElementById("outeur-vorm-naam").value.trim();
  const subrekening_kode = document.getElementById("outeur-vorm-subrekening").value.trim();

  const knoppie = document.getElementById("paneel-outeur-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = await fetch(SKEP_OUTEUR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ naam, subrekening_kode }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    sluit_outeur_vorm();
    laai_outeurs();
  } catch (fout) {
    console.error("Kon nie outeur stoor nie:", fout);
    foutWrap.textContent = `${t("paneel_kon_nie_stoor")}${fout.message}`;
    foutWrap.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = t("paneel_voeg_outeur_by_knoppie");
  }
}

// --- Verdeling-rye (herhaalbaar, meervoudige outeur-verdelings per formaat) ---

function bou_outeur_opsies_html(gekose_outeur_id) {
  const geen_opsie = `<option value="">${t("paneel_kies_outeur")}</option>`;
  const outeur_opsies = outeurs_kas
    .map(
      (outeur) =>
        `<option value="${outeur.outeur_id}" ${outeur.outeur_id === gekose_outeur_id ? "selected" : ""}>${outeur.naam}</option>`
    )
    .join("");
  return geen_opsie + outeur_opsies;
}

function skep_verdeling_ry_element(voorvoegsel, bestaande) {
  const ry = document.createElement("div");
  ry.className = "paneel-verdeling-ry veld-ry";

  const gekose_tipe = (bestaande && bestaande.tipe) || "persentasie";
  const gekose_waarde = bestaande && Number.isFinite(bestaande.waarde) ? bestaande.waarde : "";
  const gekose_outeur_id = (bestaande && bestaande.outeur_id) || "";

  ry.innerHTML = `
    <select class="veld-invoer paneel-verdeling-outeur">${bou_outeur_opsies_html(gekose_outeur_id)}</select>
    <select class="veld-invoer paneel-verdeling-tipe">
      <option value="persentasie" ${gekose_tipe === "persentasie" ? "selected" : ""}>${t("paneel_persentasie")}</option>
      <option value="vaste_bedrag" ${gekose_tipe === "vaste_bedrag" ? "selected" : ""}>${t("paneel_vaste_bedrag")}</option>
    </select>
    <input type="number" class="veld-invoer paneel-verdeling-waarde" min="0" step="0.01" placeholder="${t("paneel_waarde")}" value="${gekose_waarde}">
    <button type="button" class="terug-skakel paneel-verdeling-verwyder" aria-label="${t("paneel_verwyder_verdeling")}">✕</button>
  `;

  ry.querySelector(".paneel-verdeling-verwyder").addEventListener("click", () => ry.remove());

  return ry;
}

function voeg_verdeling_ry_by(voorvoegsel, bestaande) {
  const lys = document.getElementById(`vorm-${voorvoegsel}-verdelings-lys`);
  lys.appendChild(skep_verdeling_ry_element(voorvoegsel, bestaande || null));
}

function kry_verdelings_uit_vorm(voorvoegsel) {
  const lys = document.getElementById(`vorm-${voorvoegsel}-verdelings-lys`);
  return Array.from(lys.querySelectorAll(".paneel-verdeling-ry")).map((ry) => ({
    outeur_id: ry.querySelector(".paneel-verdeling-outeur").value,
    tipe: ry.querySelector(".paneel-verdeling-tipe").value,
    waarde: parseFloat(ry.querySelector(".paneel-verdeling-waarde").value),
  }));
}

function ververs_alle_verdeling_aftrekkieslyste() {
  document.querySelectorAll(".paneel-verdeling-outeur").forEach((keuselys) => {
    const huidige_waarde = keuselys.value;
    keuselys.innerHTML = bou_outeur_opsies_html(huidige_waarde);
  });
}

// --- Vorm: oopmaak/toemaak ---

function reset_vorm() {
  document.getElementById("paneel-produk-vorm").reset();
  document.getElementById("vorm-oorspronklike-slug").value = "";
  document.getElementById("vorm-slug").disabled = false;
  document.getElementById("vorm-eboek-beskikbaar").checked = true;
  document.getElementById("vorm-omslag").value = "";
  wys_omslag_voorskou("");
  document.getElementById("vorm-omslag-status").textContent = "";
  document.getElementById("vorm-eboek-verdelings-lys").innerHTML = "";
  document.getElementById("vorm-hardekopie-verdelings-lys").innerHTML = "";
  wys_verberg_formaat_velde();
  document.getElementById("paneel-vorm-titel").textContent = t("paneel_voeg_produk_by_titel");
  document.getElementById("paneel-vorm-indien").textContent = t("paneel_skep_produk");
  document.getElementById("paneel-vorm-foute").style.display = "none";
}

function wys_omslag_voorskou(pad) {
  const beeld = document.getElementById("vorm-omslag-voorskou");
  if (pad) {
    beeld.src = pad;
    beeld.style.display = "block";
  } else {
    beeld.removeAttribute("src");
    beeld.style.display = "none";
  }
}

// --- Omslag-oplaai ---

function lees_lêer_as_base64(lêer) {
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onload = () => {
      // readAsDataURL gee "data:image/png;base64,iVBORw0..." — ons het
      // net die gedeelte ná die komma nodig.
      const volledig = leser.result;
      const kommaIndeks = volledig.indexOf(",");
      resolve(volledig.slice(kommaIndeks + 1));
    };
    leser.onerror = () => reject(leser.error);
    leser.readAsDataURL(lêer);
  });
}

async function hanteer_omslag_lêer_gekies(gebeurtenis) {
  const lêer = gebeurtenis.target.files && gebeurtenis.target.files[0];
  const statusWrap = document.getElementById("vorm-omslag-status");
  if (!lêer) return;

  const MAKS_GROOTTE = 4 * 1024 * 1024;
  const TOEGELATE_TIPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!TOEGELATE_TIPES.includes(lêer.type)) {
    statusWrap.textContent = t("paneel_oplaai_verkeerde_tipe");
    gebeurtenis.target.value = "";
    return;
  }
  if (lêer.size > MAKS_GROOTTE) {
    statusWrap.textContent = t("paneel_oplaai_te_groot");
    gebeurtenis.target.value = "";
    return;
  }

  statusWrap.textContent = t("paneel_oplaai_besig");

  try {
    const data_base64 = await lees_lêer_as_base64(lêer);
    const slug = document.getElementById("vorm-slug").value.trim();

    const resp = await fetch("/.netlify/functions/laai-omslag-op", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ slug, inhoud_tipe: lêer.type, data_base64 }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    const data = await resp.json();
    document.getElementById("vorm-omslag").value = data.pad;
    wys_omslag_voorskou(data.pad);
    statusWrap.textContent = t("paneel_oplaai_sukses");
  } catch (fout) {
    console.error("Kon nie omslag oplaai nie:", fout);
    statusWrap.textContent = `${t("paneel_oplaai_fout")}${fout.message}`;
  }
}

function wys_verberg_formaat_velde() {
  document.getElementById("vorm-eboek-velde").style.display =
    document.getElementById("vorm-eboek-beskikbaar").checked ? "block" : "none";
  document.getElementById("vorm-hardekopie-velde").style.display =
    document.getElementById("vorm-hardekopie-beskikbaar").checked ? "block" : "none";
  document.getElementById("vorm-eboek-verdeling-velde").style.display =
    document.getElementById("vorm-eboek-verdeling-aan").checked ? "block" : "none";
  document.getElementById("vorm-hardekopie-verdeling-velde").style.display =
    document.getElementById("vorm-hardekopie-verdeling-aan").checked ? "block" : "none";
}

function open_vorm_vir_toevoeging() {
  reset_vorm();
  document.getElementById("paneel-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function open_vorm_vir_wysig(produk) {
  reset_vorm();
  document.getElementById("paneel-vorm-titel").textContent = `${t("paneel_wysig_titel_voorvoegsel")}${produk.titel}`;
  document.getElementById("paneel-vorm-indien").textContent = t("paneel_stoor_wysigings");
  document.getElementById("vorm-oorspronklike-slug").value = produk.slug;

  document.getElementById("vorm-slug").value = produk.slug;
  document.getElementById("vorm-slug").disabled = true; // slug is die sleutel — nie wysigbaar nie
  document.getElementById("vorm-titel").value = produk.titel || "";
  document.getElementById("vorm-outeur").value = produk.outeur || "";
  document.getElementById("vorm-oorsig").value = produk.oorsig || "";
  document.getElementById("vorm-vol-beskrywing").value = produk.vol_beskrywing || "";
  document.getElementById("vorm-omslag").value = produk.omslag || "";
  wys_omslag_voorskou(produk.omslag || "");

  const eboek = (produk.formate && produk.formate.eboek) || {};
  document.getElementById("vorm-eboek-beskikbaar").checked = !!eboek.beskikbaar;
  document.getElementById("vorm-eboek-prys").value = eboek.prys_sent ? (eboek.prys_sent / 100).toFixed(2) : "";
  document.getElementById("vorm-eboek-vrystelling").value = eboek.vrystelling_datum || "";
  if (eboek.verdelings && eboek.verdelings.length) {
    document.getElementById("vorm-eboek-verdeling-aan").checked = true;
    eboek.verdelings.forEach((v) => voeg_verdeling_ry_by("eboek", v));
  }

  const hardeKopie = (produk.formate && produk.formate.harde_kopie) || {};
  document.getElementById("vorm-hardekopie-beskikbaar").checked = !!hardeKopie.beskikbaar;
  document.getElementById("vorm-hardekopie-prys").value = hardeKopie.prys_sent ? (hardeKopie.prys_sent / 100).toFixed(2) : "";
  document.getElementById("vorm-hardekopie-vrystelling").value = hardeKopie.vrystelling_datum || "";
  document.getElementById("vorm-hardekopie-voorraad").value = hardeKopie.voorraad_status || "beskikbaar";
  if (hardeKopie.verdelings && hardeKopie.verdelings.length) {
    document.getElementById("vorm-hardekopie-verdeling-aan").checked = true;
    hardeKopie.verdelings.forEach((v) => voeg_verdeling_ry_by("hardekopie", v));
  }

  wys_verberg_formaat_velde();
  document.getElementById("paneel-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function sluit_vorm() {
  document.getElementById("paneel-vorm-afdeling").style.display = "none";
  reset_vorm();
}

// --- Vorm: bou versoek-liggaam vanuit die veld-waardes ---

function kry_rand_as_sent(veld_id) {
  const waarde = parseFloat(document.getElementById(veld_id).value);
  return Number.isFinite(waarde) ? Math.round(waarde * 100) : 0;
}

function bou_verdelings_vanuit_vorm(voorvoegsel) {
  const aan = document.getElementById(`vorm-${voorvoegsel}-verdeling-aan`).checked;
  if (!aan) return [];
  return kry_verdelings_uit_vorm(voorvoegsel);
}

function bou_produk_liggaam() {
  const eboekBeskikbaar = document.getElementById("vorm-eboek-beskikbaar").checked;
  const hardeKopieBeskikbaar = document.getElementById("vorm-hardekopie-beskikbaar").checked;

  return {
    slug: document.getElementById("vorm-slug").value.trim(),
    titel: document.getElementById("vorm-titel").value.trim(),
    outeur: document.getElementById("vorm-outeur").value.trim(),
    oorsig: document.getElementById("vorm-oorsig").value.trim(),
    vol_beskrywing: document.getElementById("vorm-vol-beskrywing").value.trim(),
    omslag: document.getElementById("vorm-omslag").value.trim(),
    formate: {
      eboek: {
        beskikbaar: eboekBeskikbaar,
        prys_sent: kry_rand_as_sent("vorm-eboek-prys"),
        vrystelling_datum: document.getElementById("vorm-eboek-vrystelling").value || null,
        verdelings: bou_verdelings_vanuit_vorm("eboek"),
      },
      harde_kopie: {
        beskikbaar: hardeKopieBeskikbaar,
        prys_sent: kry_rand_as_sent("vorm-hardekopie-prys"),
        voorraad_status: document.getElementById("vorm-hardekopie-voorraad").value,
        vrystelling_datum: document.getElementById("vorm-hardekopie-vrystelling").value || null,
        verdelings: bou_verdelings_vanuit_vorm("hardekopie"),
      },
    },
  };
}

function wys_vorm_foute(boodskap) {
  const wrap = document.getElementById("paneel-vorm-foute");
  wrap.textContent = boodskap;
  wrap.style.display = "block";
}

async function hanteer_vorm_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  document.getElementById("paneel-vorm-foute").style.display = "none";

  const oorspronklike_slug = document.getElementById("vorm-oorspronklike-slug").value;
  const is_wysiging = !!oorspronklike_slug;
  const produk = bou_produk_liggaam();

  if (!produk.slug || !produk.titel || !produk.outeur) {
    wys_vorm_foute(t("paneel_verpligte_velde_fout"));
    return;
  }
  if (!produk.formate.eboek.beskikbaar && !produk.formate.harde_kopie.beskikbaar) {
    wys_vorm_foute(t("paneel_formaat_verplig_fout"));
    return;
  }

  const knoppie = document.getElementById("paneel-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = is_wysiging
      ? await fetch(WYSIG_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ slug: oorspronklike_slug, wysigings: produk }),
        })
      : await fetch(SKEP_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify(produk),
        });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    sluit_vorm();
    laai_produkte();
  } catch (fout) {
    console.error("Kon nie produk stoor nie:", fout);
    wys_vorm_foute(`${t("paneel_kon_nie_stoor")}${fout.message}`);
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = is_wysiging ? t("paneel_stoor_wysigings") : t("paneel_skep_produk");
  }
}

// --- Wagwoord-ogies (gewone <input type="password"> nou — geen Shadow
// DOM meer nie, dus 'n eenvoudige direkte wissel) ---

function koppel_wagwoord_ogies() {
  document.querySelectorAll(".paneel-wagwoord-ogie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const veld = document.getElementById(knoppie.dataset.teiken);
      const wys = veld.type === "password";
      veld.type = wys ? "text" : "password";
      knoppie.style.opacity = wys ? "1" : "0.55";
    });
  });
}

// --- Token uit URL-hash (uitnodiging/bevestiging/herstel) ---

function kry_token_uit_hash() {
  const hash = window.location.hash;
  const confirmatie = hash.match(/confirmation_token=([^&]+)/);
  const uitnodiging = hash.match(/invite_token=([^&]+)/);
  const herstel = hash.match(/recovery_token=([^&]+)/);

  if (confirmatie) return { tipe: "signup", token: confirmatie[1] };
  if (uitnodiging) return { tipe: "signup", token: uitnodiging[1] };
  if (herstel) return { tipe: "recovery", token: herstel[1] };
  return null;
}

function wys_stel_nuwe_wagwoord_afdeling(token_inligting) {
  verberg_alle_auth_afdelings();
  document.getElementById("paneel-nuwe-wagwoord-afdeling").style.display = "block";

  document.getElementById("paneel-nuwe-wagwoord-vorm").onsubmit = async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const foutWrap = document.getElementById("paneel-nuwe-wagwoord-foute");
    foutWrap.style.display = "none";

    const wagwoord = document.getElementById("nuwe-wagwoord").value;
    try {
      const sessie = await identiteit_verwerk_token(token_inligting.tipe, token_inligting.token, wagwoord);
      // Maak die token uit die URL skoon sodat 'n verfris nie weer probeer nie
      window.history.replaceState(null, "", window.location.pathname);
      wys_aangemeld_toestand(sessie.gebruiker);
    } catch (fout) {
      foutWrap.textContent = `${t("paneel_kon_nie_wagwoord_stel")}${fout.message}`;
      foutWrap.style.display = "block";
    }
  };
}

// --- Opstelling ---

document.addEventListener("DOMContentLoaded", async () => {
  koppel_wagwoord_ogies();

  const token_inligting = kry_token_uit_hash();
  if (token_inligting) {
    wys_stel_nuwe_wagwoord_afdeling(token_inligting);
  } else {
    const sessie = await identiteit_kry_huidige_sessie();
    if (sessie) wys_aangemeld_toestand(sessie.gebruiker);
    else wys_afgemeld_toestand();
  }

  // Aanmeld
  document.getElementById("paneel-aanmeld-vorm").addEventListener("submit", async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const foutWrap = document.getElementById("paneel-aanmeld-foute");
    foutWrap.style.display = "none";

    const epos = document.getElementById("aanmeld-epos").value.trim();
    const wagwoord = document.getElementById("aanmeld-wagwoord").value;
    try {
      const sessie = await identiteit_meld_aan(epos, wagwoord);
      wys_aangemeld_toestand(sessie.gebruiker);
    } catch (fout) {
      foutWrap.textContent = `${t("paneel_kon_nie_aanmeld")}${fout.message}`;
      foutWrap.style.display = "block";
    }
  });

  // Wagwoord vergeet → wissel na herstel-vorm
  document.getElementById("paneel-wagwoord-vergeet-skakel").addEventListener("click", () => {
    verberg_alle_auth_afdelings();
    document.getElementById("paneel-herstel-afdeling").style.display = "block";
  });
  document.getElementById("paneel-terug-na-aanmeld-skakel").addEventListener("click", () => {
    verberg_alle_auth_afdelings();
    document.getElementById("paneel-aanmeld-afdeling").style.display = "block";
  });

  // Herstel-epos stuur
  document.getElementById("paneel-herstel-vorm").addEventListener("submit", async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const foutWrap = document.getElementById("paneel-herstel-foute");
    const suksesWrap = document.getElementById("paneel-herstel-sukses");
    foutWrap.style.display = "none";
    suksesWrap.style.display = "none";

    const epos = document.getElementById("herstel-epos").value.trim();
    try {
      await identiteit_stuur_herstel(epos);
      suksesWrap.style.display = "block";
    } catch (fout) {
      foutWrap.textContent = `${t("paneel_kon_nie_herstel_stuur")}${fout.message}`;
      foutWrap.style.display = "block";
    }
  });

  // Afmeld
  document.getElementById("paneel-afmeld-knoppie").addEventListener("click", () => {
    identiteit_meld_af();
    wys_afgemeld_toestand();
  });

  // Produk-vorm
  document.getElementById("paneel-voeg-by-knoppie").addEventListener("click", open_vorm_vir_toevoeging);
  document.getElementById("paneel-vorm-kanselleer").addEventListener("click", sluit_vorm);
  document.getElementById("paneel-produk-vorm").addEventListener("submit", hanteer_vorm_indiening);

  document.getElementById("vorm-eboek-beskikbaar").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-hardekopie-beskikbaar").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-eboek-verdeling-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-hardekopie-verdeling-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-omslag-lêer").addEventListener("change", hanteer_omslag_lêer_gekies);

  // Outeurs
  document.getElementById("paneel-voeg-outeur-by-knoppie").addEventListener("click", open_outeur_vorm);
  document.getElementById("paneel-outeur-vorm-kanselleer").addEventListener("click", sluit_outeur_vorm);
  document.getElementById("paneel-outeur-vorm").addEventListener("submit", hanteer_outeur_vorm_indiening);

  // Verdeling-rye (meervoudige outeur-verdelings per formaat)
  document.getElementById("vorm-eboek-voeg-verdeling-by").addEventListener("click", () => voeg_verdeling_ry_by("eboek"));
  document.getElementById("vorm-hardekopie-voeg-verdeling-by").addEventListener("click", () => voeg_verdeling_ry_by("hardekopie"));
});
