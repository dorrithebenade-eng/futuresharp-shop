// Bondel-oplaai van e-boek-PDF's (Katalogus-afdeling).
//
// Personeel kies verskeie PDF's gelyk; elke lêer word volgens sy naam aan
// 'n boek gekoppel (of met die aftrekkieslys reggestel), en dan een vir een
// opgelaai. Per boek:
//   1. stuksgewyse oplaai na laai-eboek-op (dieselfde as die enkel-vorm);
//   2. wysig-produk met die VOLLE bestaande eboek-voorwerp plus die nuwe
//      eboek_sleutel. wysig-produk vervang die eboek-voorwerp in sy geheel,
//      so as ons net { eboek_sleutel } stuur, verdwyn prys, verdelings,
//      hosting en vrystelling_datum (die bekende veldverlies-patroon).
//      Ons lees daarom die produk vars van die bediener af net voor die
//      wysiging.
//
// Gebruik globale hulpfunksies uit paneelbord.js: kry_outorisasie_kop,
// lees_stuk_as_base64, ontsnap_html, laai_produkte, produkte_kas, en die
// *_ENDPOINT-konstantes. Moet dus NA paneelbord.js gelaai word.

// Bekende lêernaam (sonder .pdf, kleinletters) → slug. Lêers wat nie hier
// staan nie, word met die titel/slug probeer pas, en andersins kies
// personeel self die boek.
const BONDEL_BEKENDE_LEERNAME = {
  "speel-slim_boek-1_e-boek": "speel-slim-0-1",
  "speel-slim_boek-2_e-boek": "speel-slim",
  "speel-slim_boek-3_e-boek": "Speel-slim-2-3",
  "speel-slim_boek-4_e-boek": "speel-slim-3-4",
  "speel-slim_boek-5_e-boek": "speel-slim-4-5",
  "speel-slim_boek-6_e-boek": "speel-slim-5-6",
  "speel-slim_fokus_boek-1_e-boek": "speel-slim-fokus-0-1",
  "speel-slim_fokus_boek-2_e-boek": "speel-slim-fokus-1-2",
  "speel-slim_fokus_boek-3_e-boek": "speel-slim-fokus-2-3",
  "wanneer_n_nuwe_baba_kom_e-boek": "speel-slim-nuwe-baba",
  "play-smart_book-1_e-book": "play-smart-0-1",
  "play-smart_book-2_e-book": "play-smart-1-3",
  "play-smart_book-3_e-book": "play-smart-2-3",
  "play-smart_book-4_e-book": "play-smart-3-4",
  "play-smart_book-5_e-book": "play-smart-4-5",
  "play-smart_book-6_e-book": "play-smart-5-6",
  "play-smart_focus_book-1_e-book": "play-smart-focus-0-1",
  "play-smart_focus_book-2_e-book": "play-smart-focus-1-2",
  "play-smart_focus_book-3_e-book": "play-smart-focus-2-3",
  "when_a_new_baby_arrives_e-book": "play-smart-new-baby",
};

let bondel_rye = []; // { lêer, slug, status }
let bondel_besig = false;

function bondel_lêernaam_stam(naam) {
  // Blaaiers voeg soms " (1)" by duplikaat-aflaaie; haal dit ook weg.
  return String(naam)
    .replace(/\.pdf$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim()
    .toLowerCase();
}

function bondel_eboek_produkte() {
  return (produkte_kas || [])
    .filter((p) => p.formate && p.formate.eboek)
    .slice()
    .sort((a, b) => String(a.titel).localeCompare(String(b.titel), "af"));
}

function bondel_raai_slug(lêernaam) {
  const stam = bondel_lêernaam_stam(lêernaam);
  const produkte = bondel_eboek_produkte();
  const bestaan = (slug) => produkte.some((p) => p.slug === slug);

  const bekend = BONDEL_BEKENDE_LEERNAME[stam];
  if (bekend && bestaan(bekend)) return bekend;

  // Lêer heet presies soos die slug.
  const volgens_slug = produkte.find((p) => p.slug.toLowerCase() === stam);
  if (volgens_slug) return volgens_slug.slug;

  return "";
}

function bondel_wys_rye() {
  const tabel = document.getElementById("bondel-eboek-tabel");
  const knoppie = document.getElementById("bondel-eboek-laai-op");
  const opsomming = document.getElementById("bondel-eboek-opsomming");
  const produkte = bondel_eboek_produkte();

  if (!bondel_rye.length) {
    tabel.innerHTML = "";
    knoppie.disabled = true;
    opsomming.textContent = "";
    return;
  }

  // Tel hoe dikwels elke slug gekies is, om duplikate uit te lig.
  const tellings = {};
  bondel_rye.forEach((r) => { if (r.slug) tellings[r.slug] = (tellings[r.slug] || 0) + 1; });

  tabel.innerHTML = `
    <div class="bondel-ry bondel-kop">
      <span>${t("bondel_kol_leer")}</span>
      <span>${t("bondel_kol_boek")}</span>
      <span>${t("bondel_kol_status")}</span>
    </div>
    ${bondel_rye.map((ry, indeks) => {
      const duplikaat = ry.slug && tellings[ry.slug] > 1;
      const opsies = produkte.map((p) =>
        `<option value="${ontsnap_html(p.slug)}" ${p.slug === ry.slug ? "selected" : ""}>${ontsnap_html(p.titel)} (${ontsnap_html(p.slug)})</option>`
      ).join("");
      const groot_mb = (ry.lêer.size / (1024 * 1024)).toFixed(1).replace(".", ",");
      let status = ry.status || "";
      if (!status && !ry.slug) status = t("bondel_status_kies");
      if (!status && duplikaat) status = t("bondel_status_duplikaat");
      return `
        <div class="bondel-ry ${duplikaat ? "bondel-ry-fout" : ""}">
          <span class="bondel-leer">${ontsnap_html(ry.lêer.name)} <small>${groot_mb} MB</small></span>
          <select class="bondel-boek-keuse" data-indeks="${indeks}" ${bondel_besig ? "disabled" : ""}>
            <option value="">${t("bondel_kies_boek")}</option>
            ${opsies}
          </select>
          <span class="bondel-status" id="bondel-status-${indeks}">${ontsnap_html(status)}</span>
        </div>`;
    }).join("")}
  `;

  tabel.querySelectorAll(".bondel-boek-keuse").forEach((keuse) => {
    keuse.addEventListener("change", () => {
      bondel_rye[Number(keuse.dataset.indeks)].slug = keuse.value;
      bondel_rye[Number(keuse.dataset.indeks)].status = "";
      bondel_wys_rye();
    });
  });

  const gereed = bondel_rye.filter((r) => r.slug).length;
  const het_duplikate = Object.values(tellings).some((n) => n > 1);
  knoppie.disabled = bondel_besig || gereed === 0 || het_duplikate;
  if (!bondel_besig) {
    opsomming.textContent = het_duplikate
      ? t("bondel_opsomming_duplikaat")
      : t("bondel_opsomming_gereed").replace("%gereed%", gereed).replace("%totaal%", bondel_rye.length);
  }
}

function bondel_stel_status(indeks, teks) {
  bondel_rye[indeks].status = teks;
  const sel = document.getElementById(`bondel-status-${indeks}`);
  if (sel) sel.textContent = teks;
}

async function bondel_laai_een_op(ry, indeks) {
  const lêer = ry.lêer;
  const STUK_GROOTTE = 3 * 1024 * 1024; // dieselfde as die enkel-vorm
  const opload_id = crypto.randomUUID();
  const totale_stukke = Math.ceil(lêer.size / STUK_GROOTTE);
  let eboek_sleutel = null;

  for (let stuk_indeks = 0; stuk_indeks < totale_stukke; stuk_indeks++) {
    const begin = stuk_indeks * STUK_GROOTTE;
    const data_base64 = await lees_stuk_as_base64(lêer.slice(begin, begin + STUK_GROOTTE));
    const is_laaste = stuk_indeks === totale_stukke - 1;
    bondel_stel_status(indeks, `${t("paneel_eboek_oplaai_besig")} (${stuk_indeks + 1}/${totale_stukke})`);

    const resp = await fetch(LAAI_EBOEK_OP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ slug: ry.slug, opload_id, stuk_indeks, is_laaste, data_base64 }),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    if (is_laaste) eboek_sleutel = (await resp.json()).eboek_sleutel;
  }
  if (!eboek_sleutel) throw new Error("Geen eboek_sleutel ontvang nie");

  // Vars produk van die bediener, sodat ons die volle eboek-voorwerp stuur.
  bondel_stel_status(indeks, t("bondel_status_koppel"));
  const lys_resp = await fetch(ALLE_PRODUKTE_ENDPOINT, { headers: kry_outorisasie_kop() });
  if (!lys_resp.ok) throw new Error(`Status ${lys_resp.status}`);
  const produk = ((await lys_resp.json()).produkte || []).find((p) => p.slug === ry.slug);
  if (!produk || !produk.formate || !produk.formate.eboek) {
    throw new Error(`Geen e-boekformaat vir ${ry.slug} nie`);
  }

  const wysig_resp = await fetch(WYSIG_PRODUK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
    body: JSON.stringify({
      slug: ry.slug,
      wysigings: { formate: { eboek: { ...produk.formate.eboek, eboek_sleutel } } },
    }),
  });
  if (!wysig_resp.ok) throw new Error((await wysig_resp.text()) || `Status ${wysig_resp.status}`);
}

async function bondel_begin_oplaai() {
  const opsomming = document.getElementById("bondel-eboek-opsomming");
  const te_doen = bondel_rye.map((ry, indeks) => ({ ry, indeks })).filter(({ ry }) => ry.slug);
  if (!te_doen.length) return;
  if (!window.confirm(t("bondel_bevestig").replace("%aantal%", te_doen.length))) return;

  bondel_besig = true;
  bondel_wys_rye();
  document.getElementById("bondel-eboek-leers").disabled = true;

  let geslaag = 0;
  let misluk = 0;
  for (const { ry, indeks } of te_doen) {
    opsomming.textContent = t("bondel_opsomming_besig")
      .replace("%nr%", geslaag + misluk + 1)
      .replace("%totaal%", te_doen.length);
    try {
      await bondel_laai_een_op(ry, indeks);
      bondel_stel_status(indeks, t("bondel_status_klaar"));
      geslaag++;
    } catch (fout) {
      console.error(`Bondel-oplaai het misluk vir ${ry.slug}:`, fout);
      bondel_stel_status(indeks, `${t("bondel_status_fout")}${fout.message}`);
      misluk++;
    }
  }

  bondel_besig = false;
  document.getElementById("bondel-eboek-leers").disabled = false;
  opsomming.textContent = t("bondel_opsomming_klaar")
    .replace("%geslaag%", geslaag)
    .replace("%misluk%", misluk);
  document.getElementById("bondel-eboek-laai-op").disabled = true;
  laai_produkte();
}

function bondel_inisialiseer() {
  const oop_knoppie = document.getElementById("paneel-bondel-eboek-knoppie");
  const afdeling = document.getElementById("paneel-bondel-eboek");
  if (!oop_knoppie || !afdeling) return;

  oop_knoppie.addEventListener("click", () => {
    if (bondel_besig) return;
    afdeling.style.display = afdeling.style.display === "none" ? "block" : "none";
  });

  document.getElementById("bondel-eboek-sluit").addEventListener("click", () => {
    if (bondel_besig) return;
    afdeling.style.display = "none";
  });

  document.getElementById("bondel-eboek-leers").addEventListener("change", (gebeurtenis) => {
    const lêers = Array.from(gebeurtenis.target.files || []);
    bondel_rye = lêers
      .filter((l) => l.type === "application/pdf" || /\.pdf$/i.test(l.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((lêer) => ({ lêer, slug: bondel_raai_slug(lêer.name), status: "" }));
    bondel_wys_rye();
  });

  document.getElementById("bondel-eboek-laai-op").addEventListener("click", bondel_begin_oplaai);
}

document.addEventListener("DOMContentLoaded", bondel_inisialiseer);
