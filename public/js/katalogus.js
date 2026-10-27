const KATALOGUS_ENDPOINT = "/.netlify/functions/kry-katalogus";
const KATEGORIEE_ENDPOINT = "/.netlify/functions/kry-kategoriee";

// Demo-terugvalprodukte — word slegs gebruik wanneer die lewendige Function
// nie bereikbaar is nie (bv. tydens plaaslike voorskou sonder Netlify Dev).
// Weerspieël presies die skema uit data/katalogus/*.json.
const DEMO_PRODUKTE = [
  {
    slug: "voorbeeld-produk",
    titel: "Voorbeeld Titel",
    outeur: "Outeur Naam",
    oorsig: "In hierdie meesleurende verhaal volg ons 'n hoofkarakter wat op 'n reis van selfontdekking begin, aangedryf deur gebeure wat haar hele wêreld op sy kop keer. Met ryke beskrywings en onvergeetlike karakters neem die skrywer die leser op 'n reis vol spanning, humor en oomblikke van diepe insig. Elke hoofstuk bou op die vorige, en teen die tyd wat jy by die laaste bladsy kom, sal jy die boek nie kan neersit sonder om dadelik weer van voor af te wil begin lees nie. 'n Aanrader vir enigeen wat van pakkende, karaktergedrewe stories hou.",
    omslag: "",
    formate: {
      eboek: { beskikbaar: true, prys_sent: 15000 },
      harde_kopie: { beskikbaar: true, prys_sent: 28000, vrystelling_datum: "2026-11-01" },
    },
  },
  {
    slug: "voorbeeld-produk-slegs-eboek",
    titel: "Nog 'n Voorbeeld Titel",
    outeur: "Outeur Naam",
    oorsig: "'n Intieme en eerlike vertelling wat lesers laat nadink oor die keuses wat ons daaglikse lewens vorm. Met 'n unieke stem en skerp waarneming van menslike verhoudinge, bou die skrywer 'n wêreld wat beide bekend en verrassend voel. Hierdie e-boek is ideaal vir wie 'n vinnige maar betekenisvolle leeservaring soek — kort genoeg om in 'n naweek te geniet, maar ryk genoeg om lank ná die laaste bladsy by jou te bly.",
    omslag: "",
    formate: {
      eboek: { beskikbaar: true, prys_sent: 12000 },
      harde_kopie: { beskikbaar: false },
    },
  },
];

function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

// Gedeelde kleur-palet (dieselfde 4 opsies as die personeel-paneelbord se
// kleur-swatches) — gebruik deur die winkel-bannier-ster ÉN die
// boek-etiket-ster, sodat albei presies dieselfde tinte gebruik.
const ETIKET_KLEUR_GRADIENTE = {
  amber: ["#F5D484", "#F1BD43", "#BB9334"],
  koraal: ["#F29279", "#EC5832", "#B84427"],
  teal: ["#87C0B7", "#479F91", "#377C71"],
  swart: ["#686868", "#171717", "#111111"],
};

const STER_POLIGOON_PUNTE =
  "130.0,0.0 149.5,31.9 179.7,9.9 185.6,46.9 221.9,38.1 213.1,74.4 250.1,80.3 228.1,110.5 260.0,130.0 228.1,149.5 250.1,179.7 213.1,185.6 221.9,221.9 185.6,213.1 179.7,250.1 149.5,228.1 130.0,260.0 110.5,228.1 80.3,250.1 74.4,213.1 38.1,221.9 46.9,185.6 9.9,179.7 31.9,149.5 0.0,130.0 31.9,110.5 9.9,80.3 46.9,74.4 38.1,38.1 74.4,46.9 80.3,9.9 110.5,31.9";

// Bou 'n gradiënt-gevulde ster-SVG (skaduwee + voorlaag) as HTML-string.
// `gradient_id` moet uniek wees per instansie op die bladsy (verskeie
// boek-kaarte kan gelyktydig 'n ster wys).
function bou_gradient_ster_svg_html(kleur_klas, gradient_id) {
  const kleur = ETIKET_KLEUR_GRADIENTE[kleur_klas] ? kleur_klas : "amber";
  const [stop1, stop2, stop3] = ETIKET_KLEUR_GRADIENTE[kleur];
  return `
    <svg class="ster-skaduwee-laag" viewBox="0 0 260 260" aria-hidden="true">
      <polygon points="${STER_POLIGOON_PUNTE}" />
    </svg>
    <svg class="winkel-bannier-ster" viewBox="0 0 260 260" aria-hidden="true">
      <defs>
        <linearGradient id="${gradient_id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${stop1}" />
          <stop offset="55%" stop-color="${stop2}" />
          <stop offset="100%" stop-color="${stop3}" />
        </linearGradient>
      </defs>
      <polygon fill="url(#${gradient_id})" points="${STER_POLIGOON_PUNTE}" />
    </svg>
  `;
}

function bou_beskikbaar_merkers(eboek, hardeKopie, leen) {
  const merkers = [];
  if (eboek && eboek.beskikbaar) {
    merkers.push(`<button type="button" class="beskikbaar-merker beskikbaar-merker--eboek" data-formaat="eboek">📖 ${t("eboek_etiket")}</button>`);
  }
  if (hardeKopie && hardeKopie.beskikbaar) {
    merkers.push(`<button type="button" class="beskikbaar-merker beskikbaar-merker--hardekopie" data-formaat="harde_kopie">📦 ${t("hardekopie_etiket")}</button>`);
  }
  if (leen && leen.beskikbaar) {
    merkers.push(`<button type="button" class="beskikbaar-merker beskikbaar-merker--leen" data-formaat="leen" data-tydperk="${leen.tydperk_dae || 30}">⏳ ${t("leen_etiket")}</button>`);
  }
  if (!merkers.length) return "";
  return `
    <p class="beskikbaar-as-etiket">${t("beskikbaar_as_etiket")}</p>
    <div class="beskikbaar-merkers">${merkers.join("")}</div>
  `;
}

// --- Titel-vertoning vir reeksboeke ---
// 'n Boek in 'n reeks (met 'n eweknie of 'n reeks) se titel kan as
// "Reeks: Boektitel" gestoor word, bv. "Speel-Slim Fokus: Eerste Blik".
// Op die kaart en die produkbladsy word dit dan gestapel gewys:
//   SPEEL-SLIM        (eerste woord van die reeks, hoofletters)
//   Fokus             (res van die reeksnaam, skuinsdruk, as daar is)
//   Eerste Blik       (die boek se eie titel)
// Die gestoorde titel self bly gewone teks, sodat fakture, e-posse, die
// mandjie en die leeskamer dit steeds as een reël wys.
function titel_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function bou_titel_html(produk) {
  const titel = String(produk.titel || "");
  const is_reeks = !!(produk.eweknie_slug || (produk.reeks && produk.reeks.reeks_slug));
  const pas = titel.match(/^([^:]{2,40}):\s+(.+)$/);
  if (!is_reeks || !pas) return titel_ontsnap(titel);
  const reeks_woorde = pas[1].trim().split(/\s+/);
  const hoof = reeks_woorde.shift();
  const sub = reeks_woorde.join(" ");
  return `<span class="titel-reeks">${titel_ontsnap(hoof)}</span>`
    + (sub ? `<span class="titel-reeks-sub">${titel_ontsnap(sub)}</span>` : "")
    + `<span class="titel-boek">${titel_ontsnap(pas[2])}</span>`;
}

function bou_kaart(produk, besit_stel) {
  const eboek = produk.formate && produk.formate.eboek;
  const hardeKopie = produk.formate && produk.formate.harde_kopie;
  const leen = produk.formate && produk.formate.leen;
  const besit = besit_stel instanceof Set && besit_stel.has(produk.slug);

  const omslagHtml = produk.omslag
    ? `<img class="kaart-omslag" src="${produk.omslag}" alt="Omslag van ${produk.titel}" loading="lazy">`
    : `<div class="kaart-omslag" role="img" aria-label="Geen omslag beskikbaar vir ${produk.titel}"></div>`;

  const besitMerkerHtml = besit
    ? `<span class="kaart-besit-merker">${t("reeds_gekoop")}</span>`
    : "";

  const etiketHtml = produk.etiket
    ? (() => {
        // Die etiket volg die boek se eie taal (Engelse boek = Engelse
        // etiket), en val net terug op die werf se taal as die boek nie 'n
        // taal het nie.
        const etiket_taal = produk.taal === "af" || produk.taal === "en" ? produk.taal : kry_huidige_taal();
        const etiket_teks = etiket_taal === "en"
          ? (produk.etiket.teks_en || produk.etiket.teks_af || produk.etiket.teks || "")
          : (produk.etiket.teks_af || produk.etiket.teks_en || produk.etiket.teks || "");
        const teks_lengte = etiket_teks.length;
        const grootte_klas = teks_lengte <= 5 ? "kort" : teks_lengte <= 10 ? "medium" : "lank";
        const kleur_klas_teks = produk.etiket.kleur === "swart" ? " kaart-etiket-ster-teks--swart" : "";
        return `
          <div class="kaart-etiket-ster-wrap" aria-hidden="true">
            ${bou_gradient_ster_svg_html(produk.etiket.kleur, `gradient-etiket-${produk.slug}`)}
            <span class="kaart-etiket-ster-teks kaart-etiket-ster-teks--${grootte_klas}${kleur_klas_teks}">${etiket_teks}</span>
          </div>
        `;
      })()
    : "";

  return `
    <article class="kaart">
      <span class="kaart-hoek" aria-hidden="true"></span>
      <div class="kaart-omslag-wrap">
        <div class="kaart-omslag-knip">
          ${omslagHtml}
          ${besitMerkerHtml}
        </div>
        ${etiketHtml}
      </div>
      <div class="kaart-liggaam">
        <h3 class="kaart-titel">${bou_titel_html(produk)}</h3>
        <p class="kaart-outeur">${produk.outeur}</p>
        <p class="kaart-teaser">${produk.oorsig || ""}</p>
        <a class="lees-meer-skakel" href="produk.html?produk=${produk.slug}" data-slug="${produk.slug}">
          ${t("lees_meer")} →
        </a>
        <div class="kaart-onderkant">
          ${bou_beskikbaar_merkers(eboek, hardeKopie, leen)}
        </div>
      </div>
    </article>
  `;
}

function wys_produkte(produkte, { demo_modus, besit_stel = new Set() } = {}) {
  const rooster = document.getElementById("katalogus-rooster");
  rooster.innerHTML = "";

  if (demo_modus) {
    const kennisgewing = document.createElement("div");
    kennisgewing.className = "demo-kennisgewing";
    kennisgewing.textContent = t("katalogus_demo");
    rooster.appendChild(kennisgewing);
  }

  if (!produkte.length) {
    rooster.innerHTML += `
      <div class="katalogus-leeg-plekhouer">
        <svg class="ster-skaduwee-laag" viewBox="0 0 260 260" aria-hidden="true">
          <polygon points="130.0,0.0 149.5,31.9 179.7,9.9 185.6,46.9 221.9,38.1 213.1,74.4 250.1,80.3 228.1,110.5 260.0,130.0 228.1,149.5 250.1,179.7 213.1,185.6 221.9,221.9 185.6,213.1 179.7,250.1 149.5,228.1 130.0,260.0 110.5,228.1 80.3,250.1 74.4,213.1 38.1,221.9 46.9,185.6 9.9,179.7 31.9,149.5 0.0,130.0 31.9,110.5 9.9,80.3 46.9,74.4 38.1,38.1 74.4,46.9 80.3,9.9 110.5,31.9" />
        </svg>
        <svg class="katalogus-leeg-ster" viewBox="0 0 260 260" aria-hidden="true">
          <defs>
            <linearGradient id="gradient-koraal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#F29279" />
              <stop offset="55%" stop-color="#EC5832" />
              <stop offset="100%" stop-color="#B84427" />
            </linearGradient>
          </defs>
          <polygon fill="url(#gradient-koraal)" points="130.0,0.0 149.5,31.9 179.7,9.9 185.6,46.9 221.9,38.1 213.1,74.4 250.1,80.3 228.1,110.5 260.0,130.0 228.1,149.5 250.1,179.7 213.1,185.6 221.9,221.9 185.6,213.1 179.7,250.1 149.5,228.1 130.0,260.0 110.5,228.1 80.3,250.1 74.4,213.1 38.1,221.9 46.9,185.6 9.9,179.7 31.9,149.5 0.0,130.0 31.9,110.5 9.9,80.3 46.9,74.4 38.1,38.1 74.4,46.9 80.3,9.9 110.5,31.9" />
        </svg>
        <span class="katalogus-leeg-ster-teks">${t("katalogus_leeg_titel")}</span>
      </div>
    `;
    return;
  }

  rooster.innerHTML += groepeer_eweknieë(produkte)
    .map((groep) =>
      groep.length === 2
        ? `<div class="eweknie-paar">
             <p class="eweknie-paar-etiket">${eweknie_paar_etiket(groep)}</p>
             <div class="eweknie-paar-kaarte">${groep.map((produk) => bou_kaart(produk, besit_stel)).join("")}</div>
           </div>`
        : bou_kaart(groep[0], besit_stel)
    )
    .join("");
}

// Die etiket hang af van die twee boeke se taal. Net wanneer albei 'n taal
// het en dit verskil, is dit taaluitgawes van een werk. Anders is dit twee
// boeke wat bymekaar hoort (bv. 'n Ma se Reis en 'n Pa se Reis).
// Die sleutels staan in taal.js. Die terugval keer dat die rou sleutel op
// die skerm verskyn as taal.js ooit met 'n ouer weergawe vervang word.
const EWEKNIE_ETIKET_TERUGVAL = {
  eweknie_paar_etiket: { af: "Beskikbaar in Afrikaans en Engels", en: "Available in English and Afrikaans" },
  eweknie_paar_etiket_saam: { af: "Twee boeke wat bymekaar hoort", en: "Two books that belong together" },
};

function eweknie_paar_etiket(paar) {
  const [a, b] = paar || [];
  const tale_verskil = a && b && a.taal && b.taal && a.taal !== b.taal;
  const sleutel = tale_verskil ? "eweknie_paar_etiket" : "eweknie_paar_etiket_saam";
  const teks = t(sleutel);
  if (teks !== sleutel) return teks;
  return EWEKNIE_ETIKET_TERUGVAL[sleutel][kry_huidige_taal() === "en" ? "en" : "af"];
}

// Taaluitgawes van dieselfde werk (eweknie_slug) word een paar. Die paar
// neem die plek in van die eerste van die twee in die gesorteerde lys, so
// die gekose sortering bly geld. Binne die paar staan die uitgawe in die
// winkeltaal eerste. 'n Eweknie wat nie in die huidige lys is nie (bv.
// uitgefiltreer of onaktief) laat die boek alleen staan.
function groepeer_eweknieë(produkte) {
  const per_slug = new Map(produkte.map((p) => [p.slug, p]));
  const reeds = new Set();
  const winkeltaal = kry_huidige_taal();
  const groepe = [];

  for (const produk of produkte) {
    if (reeds.has(produk.slug)) continue;
    reeds.add(produk.slug);

    const eweknie = produk.eweknie_slug && per_slug.get(produk.eweknie_slug);
    if (!eweknie || reeds.has(eweknie.slug)) {
      groepe.push([produk]);
      continue;
    }
    reeds.add(eweknie.slug);

    const paar = eweknie.taal === winkeltaal && produk.taal !== winkeltaal
      ? [eweknie, produk]
      : [produk, eweknie];
    groepe.push(paar);
  }
  return groepe;
}

// Lees die aangemelde koper se reeds-gekoopte e-boeke — gebruik dieselfde
// endpoint as "My Boeke". Gee 'n leë Set terug (nooit 'n fout nie) as
// niemand aangemeld is nie, of as die versoek om enige rede misluk — die
// katalogus moet steeds normaal werk vir 'n besoeker sonder rekening.
async function kry_besit_stel() {
  try {
    if (typeof identiteit_kry_huidige_sessie !== "function") return new Set();
    const sessie = await identiteit_kry_huidige_sessie();
    if (!sessie || !sessie.access_token) return new Set();

    const resp = await fetch("/.netlify/functions/kry-my-boeke", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return new Set();

    const data = await resp.json();
    // Sluit geleende items uit — 'n huur is nie dieselfde as "Alreeds
    // joune" (permanente besit) nie. Net werklike e-boek-KOPE tel hier.
    return new Set((data.boeke || []).filter((boek) => !boek.is_leen).map((boek) => boek.produk_slug));
  } catch (fout) {
    console.warn("Kon nie besit-status laai nie:", fout);
    return new Set();
  }
}

// --- Kategorie-filter ---

let ALLE_PRODUKTE = [];
let HUIDIGE_BESIT_STEL = new Set();
const AKTIEWE_KATEGORIEE = new Set();

function bou_filter_chips(kategoriee) {
  const wrap = document.getElementById("katalogus-filter");
  if (!kategoriee || !kategoriee.length) {
    wrap.innerHTML = "";
    return;
  }

  const alle_chip = `<button type="button" class="filter-chip${AKTIEWE_KATEGORIEE.size === 0 ? " filter-chip--aktief" : ""}" data-kategorie="">${t("filter_alle")}</button>`;
  const chips = kategoriee
    .map(
      (k) =>
        `<button type="button" class="filter-chip${AKTIEWE_KATEGORIEE.has(k.kategorie_id) ? " filter-chip--aktief" : ""}" data-kategorie="${k.kategorie_id}">${kry_huidige_taal() === "en" ? (k.naam_en || k.naam_af) : (k.naam_af || k.naam_en)}</button>`
    )
    .join("");

  wrap.innerHTML = alle_chip + chips;

  wrap.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const kat_id = chip.dataset.kategorie;
      if (!kat_id) {
        AKTIEWE_KATEGORIEE.clear();
      } else if (AKTIEWE_KATEGORIEE.has(kat_id)) {
        AKTIEWE_KATEGORIEE.delete(kat_id);
      } else {
        AKTIEWE_KATEGORIEE.add(kat_id);
      }
      bou_filter_chips(kategoriee);
      pas_filter_toe();
    });
  });
}

function pas_filter_toe() {
  const gefiltreer =
    AKTIEWE_KATEGORIEE.size === 0
      ? ALLE_PRODUKTE
      : ALLE_PRODUKTE.filter(
          (p) => Array.isArray(p.kategorie_ids) && p.kategorie_ids.some((id) => AKTIEWE_KATEGORIEE.has(id))
        );
  wys_produkte(gefiltreer, { besit_stel: HUIDIGE_BESIT_STEL });
}

async function laai_katalogus() {
  const rooster = document.getElementById("katalogus-rooster");
  rooster.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_laai")}</p>`;

  try {
    const [resp, kat_resp, besit_stel] = await Promise.all([
      fetch(KATALOGUS_ENDPOINT),
      fetch(KATEGORIEE_ENDPOINT).catch(() => null),
      kry_besit_stel(),
    ]);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();

    ALLE_PRODUKTE = data.produkte || [];
    HUIDIGE_BESIT_STEL = besit_stel;

    let kategoriee = [];
    if (kat_resp && kat_resp.ok) {
      const kat_data = await kat_resp.json();
      kategoriee = kat_data.kategoriee || [];
    }

    bou_filter_chips(kategoriee);
    pas_filter_toe();
  } catch (fout) {
    console.warn("Kon nie lewendige katalogus laai nie, wys demo-data:", fout);
    ALLE_PRODUKTE = DEMO_PRODUKTE;
    HUIDIGE_BESIT_STEL = new Set();
    document.getElementById("katalogus-filter").innerHTML = "";
    wys_produkte(DEMO_PRODUKTE, { demo_modus: true });
  }
}

document.addEventListener("DOMContentLoaded", laai_katalogus);
