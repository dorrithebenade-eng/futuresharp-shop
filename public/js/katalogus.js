const KATALOGUS_ENDPOINT = "/.netlify/functions/kry-katalogus";

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

function bou_kaart(produk, besit_stel) {
  const eboek = produk.formate && produk.formate.eboek;
  const hardeKopie = produk.formate && produk.formate.harde_kopie;
  const besit = besit_stel instanceof Set && besit_stel.has(produk.slug);

  const pryse = [];
  if (eboek && eboek.beskikbaar) {
    const etiket = is_voorbestelling(eboek)
      ? `${t("eboek_etiket")} — ${formateer_prys_sent(eboek.prys_sent)} · ${t("voorbestelling_chip")}`
      : `${t("eboek_etiket")} — ${formateer_prys_sent(eboek.prys_sent)}`;
    pryse.push(`<span class="prys-chip">${etiket}</span>`);
  }
  if (hardeKopie && hardeKopie.beskikbaar) {
    const etiket = is_voorbestelling(hardeKopie)
      ? `${t("hardekopie_etiket")} — ${formateer_prys_sent(hardeKopie.prys_sent)} · ${t("voorbestelling_chip")}`
      : `${t("hardekopie_etiket")} — ${formateer_prys_sent(hardeKopie.prys_sent)}`;
    pryse.push(`<span class="prys-chip">${etiket}</span>`);
  }

  const omslagHtml = produk.omslag
    ? `<img class="kaart-omslag" src="${produk.omslag}" alt="Omslag van ${produk.titel}" loading="lazy">`
    : `<div class="kaart-omslag" role="img" aria-label="Geen omslag beskikbaar vir ${produk.titel}"></div>`;

  const besitMerkerHtml = besit
    ? `<span class="kaart-besit-merker">${t("reeds_gekoop")}</span>`
    : "";

  return `
    <article class="kaart">
      <span class="kaart-hoek" aria-hidden="true"></span>
      <div class="kaart-omslag-wrap">
        ${omslagHtml}
        ${besitMerkerHtml}
      </div>
      <div class="kaart-liggaam">
        <h3 class="kaart-titel">${produk.titel}</h3>
        <p class="kaart-outeur">${produk.outeur}</p>
        <p class="kaart-beskrywing">${produk.oorsig || ""}</p>
        <div class="kaart-onderkant">
          <div class="kaart-pryse">${pryse.join("")}</div>
          <button class="kaart-aksie" data-slug="${produk.slug}">${t("koop_nou")}</button>
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
        <svg class="katalogus-leeg-ster" viewBox="0 0 260 260" aria-hidden="true">
          <polygon points="130.0,0.0 149.5,31.9 179.7,9.9 185.6,46.9 221.9,38.1 213.1,74.4 250.1,80.3 228.1,110.5 260.0,130.0 228.1,149.5 250.1,179.7 213.1,185.6 221.9,221.9 185.6,213.1 179.7,250.1 149.5,228.1 130.0,260.0 110.5,228.1 80.3,250.1 74.4,213.1 38.1,221.9 46.9,185.6 9.9,179.7 31.9,149.5 0.0,130.0 31.9,110.5 9.9,80.3 46.9,74.4 38.1,38.1 74.4,46.9 80.3,9.9 110.5,31.9" />
        </svg>
        <span class="katalogus-leeg-ster-teks">${t("katalogus_leeg_titel")}</span>
      </div>
    `;
    return;
  }

  rooster.innerHTML += produkte.map((produk) => bou_kaart(produk, besit_stel)).join("");

  rooster.querySelectorAll(".kaart-aksie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      // Fase 2 se mandjie-integrasie volg in die volgende stap —
      // vir nou stuur ons na 'n produk-bladsy per slug.
      window.location.href = `produk.html?produk=${knoppie.dataset.slug}`;
    });
  });
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
    return new Set((data.boeke || []).map((boek) => boek.produk_slug));
  } catch (fout) {
    console.warn("Kon nie besit-status laai nie:", fout);
    return new Set();
  }
}

async function laai_katalogus() {
  const rooster = document.getElementById("katalogus-rooster");
  rooster.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_laai")}</p>`;

  try {
    const [resp, besit_stel] = await Promise.all([
      fetch(KATALOGUS_ENDPOINT),
      kry_besit_stel(),
    ]);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    wys_produkte(data.produkte || [], { besit_stel });
  } catch (fout) {
    console.warn("Kon nie lewendige katalogus laai nie, wys demo-data:", fout);
    wys_produkte(DEMO_PRODUKTE, { demo_modus: true });
  }
}

async function laai_winkel_bannier() {
  const plek = document.getElementById("winkel-bannier-plek");
  if (!plek) return;

  try {
    const resp = await fetch("/.netlify/functions/kry-kennisgewing");
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.aktief || !data.teks) return;

    plek.innerHTML = `<div class="winkel-bannier">${data.teks}</div>`;
  } catch (fout) {
    console.warn("Kon nie winkel-bannier laai nie:", fout);
  }
}

document.addEventListener("DOMContentLoaded", laai_katalogus);
document.addEventListener("DOMContentLoaded", laai_winkel_bannier);
