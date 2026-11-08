// Bondel-oplaai van omslae (Katalogus-afdeling, November 2026).
//
// Dieselfde werkwyse as paneel-bondel-eboek.js: personeel kies verskeie
// beelde gelyk, elke lêer word volgens sy naam aan 'n boek gekoppel (of met
// die keuselys reggestel), en dan een vir een opgelaai.
//
// Per boek:
//   1. Die beeld word in die blaaier kleiner gemaak (hoogstens 1400 pixels
//      hoog, JPEG), sodat dit vinnig laai en onder laai-omslag-op se 4MB bly.
//   2. laai-omslag-op stoor dit en gee die pad terug.
//   3. wysig-produk met net { omslag: pad }. omslag is 'n gewone veld wat
//      wysig-produk saamsmelt, so niks anders aan die boek verander nie.
//
// Gebruik globale hulpfunksies uit paneelbord.js: kry_outorisasie_kop,
// ontsnap_html, laai_produkte, produkte_kas. Moet NA paneelbord.js laai.

// Bekende lêernaam (sonder uitbreiding, kleinletters) → slug.
const OMSLAG_BEKENDE_LEERNAME = {
  "speel-slim_grondslag_voorblad": "speel-slim-grondslag",
  "speel-slim_boek-1_voorblad": "speel-slim-0-1",
  "speel-slim_boek-2_voorblad": "speel-slim",
  "speel-slim_boek-3_voorblad": "Speel-slim-2-3",
  "speel-slim_boek-4_voorblad": "speel-slim-3-4",
  "speel-slim_boek-5_voorblad": "speel-slim-4-5",
  "speel-slim_boek-6_voorblad": "speel-slim-5-6",
  "speel-slim_fokus_boek-1_voorblad": "speel-slim-fokus-0-1",
  "speel-slim_fokus_boek-2_voorblad": "speel-slim-fokus-1-2",
  "speel-slim_fokus_boek-3_voorblad": "speel-slim-fokus-2-3",
  "wanneer_n_nuwe_baba_kom_af_voorblad": "speel-slim-nuwe-baba",
  "play-smart_foundations_voorblad": "play-smart-foundation",
  "play-smart_foundation_voorblad": "play-smart-foundation",
  "play-smart_book-1_voorblad": "play-smart-0-1",
  "play-smart_book-2_voorblad": "play-smart-1-3",
  "play-smart_book-3_voorblad": "play-smart-2-3",
  "play-smart_book-4_voorblad": "play-smart-3-4",
  "play-smart_book-5_voorblad": "play-smart-4-5",
  "play-smart_book-6_voorblad": "play-smart-5-6",
  "play-smart_focus_book-1_voorblad": "play-smart-focus-0-1",
  "play-smart_focus_book-2_voorblad": "play-smart-focus-1-2",
  "play-smart_focus_book-3_voorblad": "play-smart-focus-2-3",
  "when_a_new_baby_arrives_en_voorblad": "play-smart-new-baby",
};

let omslag_rye = []; // { lêer, slug, status, voorskou }
let omslag_besig = false;

function omslag_stam(naam) {
  return String(naam)
    .replace(/\.(jpe?g|png|webp|gif)$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim()
    .toLowerCase();
}

function omslag_produkte() {
  return (produkte_kas || [])
    .slice()
    .sort((a, b) => String(a.titel).localeCompare(String(b.titel), "af"));
}

function omslag_raai_slug(lêernaam) {
  const stam = omslag_stam(lêernaam);
  const produkte = omslag_produkte();
  const bestaan = (slug) => produkte.some((p) => p.slug === slug);
  const bekend = OMSLAG_BEKENDE_LEERNAME[stam];
  if (bekend && bestaan(bekend)) return bekend;
  const volgens_slug = produkte.find((p) => p.slug.toLowerCase() === stam || stam === `${p.slug.toLowerCase()}_voorblad`);
  return volgens_slug ? volgens_slug.slug : "";
}

function omslag_wys_rye() {
  const tabel = document.getElementById("bondel-omslag-tabel");
  const knoppie = document.getElementById("bondel-omslag-laai-op");
  const opsomming = document.getElementById("bondel-omslag-opsomming");
  const produkte = omslag_produkte();

  if (!omslag_rye.length) {
    tabel.innerHTML = "";
    knoppie.disabled = true;
    opsomming.textContent = "";
    return;
  }

  const tellings = {};
  omslag_rye.forEach((r) => { if (r.slug) tellings[r.slug] = (tellings[r.slug] || 0) + 1; });

  tabel.innerHTML = `
    <div class="bondel-ry bondel-kop">
      <span>${t("bondel_kol_leer")}</span>
      <span>${t("bondel_kol_boek")}</span>
      <span>${t("bondel_kol_status")}</span>
    </div>
    ${omslag_rye.map((ry, indeks) => {
      const duplikaat = ry.slug && tellings[ry.slug] > 1;
      const opsies = produkte.map((p) =>
        `<option value="${ontsnap_html(p.slug)}" ${p.slug === ry.slug ? "selected" : ""}>${ontsnap_html(p.titel)} (${ontsnap_html(p.slug)})</option>`
      ).join("");
      let status = ry.status || "";
      if (!status && !ry.slug) status = t("bondel_status_kies");
      if (!status && duplikaat) status = t("bondel_status_duplikaat");
      return `
        <div class="bondel-ry ${duplikaat ? "bondel-ry-fout" : ""}">
          <span class="bondel-leer" style="display:flex;align-items:center;gap:8px;">
            <img src="${ry.voorskou}" alt="" style="width:34px;height:48px;object-fit:cover;border-radius:3px;flex:none;">
            <span>${ontsnap_html(ry.lêer.name)}</span>
          </span>
          <select class="bondel-omslag-keuse" data-indeks="${indeks}" ${omslag_besig ? "disabled" : ""}>
            <option value="">${t("bondel_kies_boek")}</option>
            ${opsies}
          </select>
          <span class="bondel-status" id="bondel-omslag-status-${indeks}">${ontsnap_html(status)}</span>
        </div>`;
    }).join("")}
  `;

  tabel.querySelectorAll(".bondel-omslag-keuse").forEach((keuse) => {
    keuse.addEventListener("change", () => {
      omslag_rye[Number(keuse.dataset.indeks)].slug = keuse.value;
      omslag_rye[Number(keuse.dataset.indeks)].status = "";
      omslag_wys_rye();
    });
  });

  const gereed = omslag_rye.filter((r) => r.slug).length;
  const het_duplikate = Object.values(tellings).some((n) => n > 1);
  knoppie.disabled = omslag_besig || gereed === 0 || het_duplikate;
  if (!omslag_besig) {
    opsomming.textContent = het_duplikate
      ? t("bondel_opsomming_duplikaat")
      : t("bondel_opsomming_gereed").replace("%gereed%", gereed).replace("%totaal%", omslag_rye.length);
  }
}

function omslag_stel_status(indeks, teks) {
  omslag_rye[indeks].status = teks;
  const sel = document.getElementById(`bondel-omslag-status-${indeks}`);
  if (sel) sel.textContent = teks;
}

// Maak die beeld kleiner in die blaaier en gee base64 (sonder voorvoegsel) terug.
function omslag_verklein(lêer) {
  return new Promise((klaar, fout) => {
    const url = URL.createObjectURL(lêer);
    const beeld = new Image();
    beeld.onload = () => {
      const MAKS_HOOGTE = 1400;
      const skaal = Math.min(1, MAKS_HOOGTE / beeld.naturalHeight);
      const doek = document.createElement("canvas");
      doek.width = Math.round(beeld.naturalWidth * skaal);
      doek.height = Math.round(beeld.naturalHeight * skaal);
      const ctx = doek.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, doek.width, doek.height);
      ctx.drawImage(beeld, 0, 0, doek.width, doek.height);
      URL.revokeObjectURL(url);
      klaar(doek.toDataURL("image/jpeg", 0.86).split(",")[1]);
    };
    beeld.onerror = () => {
      URL.revokeObjectURL(url);
      fout(new Error("Kon nie die beeld lees nie"));
    };
    beeld.src = url;
  });
}

async function omslag_laai_een_op(ry, indeks) {
  omslag_stel_status(indeks, t("paneel_oplaai_besig"));
  const data_base64 = await omslag_verklein(ry.lêer);
  const resp = await fetch("/.netlify/functions/laai-omslag-op", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
    body: JSON.stringify({ slug: ry.slug, inhoud_tipe: "image/jpeg", data_base64 }),
  });
  if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
  const { pad } = await resp.json();

  omslag_stel_status(indeks, t("bondel_status_koppel"));
  const wysig = await fetch("/.netlify/functions/wysig-produk", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
    body: JSON.stringify({ slug: ry.slug, wysigings: { omslag: pad } }),
  });
  if (!wysig.ok) throw new Error((await wysig.text()) || `Status ${wysig.status}`);
}

async function omslag_begin_oplaai() {
  const opsomming = document.getElementById("bondel-omslag-opsomming");
  const te_doen = omslag_rye.map((ry, indeks) => ({ ry, indeks })).filter(({ ry }) => ry.slug);
  if (!te_doen.length) return;
  if (!window.confirm(t("bondel_omslag_bevestig").replace("%aantal%", te_doen.length))) return;

  omslag_besig = true;
  omslag_wys_rye();
  document.getElementById("bondel-omslag-leers").disabled = true;

  let geslaag = 0;
  let misluk = 0;
  for (const { ry, indeks } of te_doen) {
    opsomming.textContent = t("bondel_opsomming_besig")
      .replace("%nr%", geslaag + misluk + 1)
      .replace("%totaal%", te_doen.length);
    try {
      await omslag_laai_een_op(ry, indeks);
      omslag_stel_status(indeks, t("bondel_status_klaar"));
      geslaag++;
    } catch (fout) {
      console.error(`Omslag-oplaai het misluk vir ${ry.slug}:`, fout);
      omslag_stel_status(indeks, `${t("bondel_status_fout")}${fout.message}`);
      misluk++;
    }
  }

  omslag_besig = false;
  document.getElementById("bondel-omslag-leers").disabled = false;
  opsomming.textContent = t("bondel_opsomming_klaar").replace("%geslaag%", geslaag).replace("%misluk%", misluk);
  document.getElementById("bondel-omslag-laai-op").disabled = true;
  laai_produkte();
}

function omslag_inisialiseer() {
  const oop_knoppie = document.getElementById("paneel-bondel-omslag-knoppie");
  const afdeling = document.getElementById("paneel-bondel-omslag");
  if (!oop_knoppie || !afdeling) return;

  oop_knoppie.addEventListener("click", () => {
    if (omslag_besig) return;
    afdeling.style.display = afdeling.style.display === "none" ? "block" : "none";
  });
  document.getElementById("bondel-omslag-sluit").addEventListener("click", () => {
    if (omslag_besig) return;
    afdeling.style.display = "none";
  });
  document.getElementById("bondel-omslag-leers").addEventListener("change", (gebeurtenis) => {
    omslag_rye.forEach((r) => URL.revokeObjectURL(r.voorskou));
    const lêers = Array.from(gebeurtenis.target.files || []);
    omslag_rye = lêers
      .filter((l) => /^image\//.test(l.type) || /\.(jpe?g|png|webp|gif)$/i.test(l.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((lêer) => ({ lêer, slug: omslag_raai_slug(lêer.name), status: "", voorskou: URL.createObjectURL(lêer) }));
    omslag_wys_rye();
  });
  document.getElementById("bondel-omslag-laai-op").addEventListener("click", omslag_begin_oplaai);
}

document.addEventListener("DOMContentLoaded", omslag_inisialiseer);
