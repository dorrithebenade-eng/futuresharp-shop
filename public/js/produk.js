const KATALOGUS_ENDPOINT = "/.netlify/functions/kry-katalogus";

const DEMO_PRODUKTE = [
  {
    slug: "voorbeeld-produk",
    titel: "Voorbeeld Titel",
    outeur: "Outeur Naam",
    oorsig: "In hierdie meesleurende verhaal volg ons 'n hoofkarakter wat op 'n reis van selfontdekking begin, aangedryf deur gebeure wat haar hele wêreld op sy kop keer. Met ryke beskrywings en onvergeetlike karakters neem die skrywer die leser op 'n reis vol spanning, humor en oomblikke van diepe insig. Elke hoofstuk bou op die vorige, en teen die tyd wat jy by die laaste bladsy kom, sal jy die boek nie kan neersit sonder om dadelik weer van voor af te wil begin lees nie. 'n Aanrader vir enigeen wat van pakkende, karaktergedrewe stories hou.",
    vol_beskrywing:
      "Hierdie is die volledige beskrywing van die boek. Dit kan verskeie paragrawe bevat wat die verhaal, tema, of doel van die boek verduidelik aan potensiële kopers.",
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
    vol_beskrywing: "Volledige beskrywing hier.",
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

function kry_produk_slug_uit_url() {
  const params = new URLSearchParams(window.location.search);
  return params.get("produk");
}

function bou_aksie_ry(produk, formaat, formaat_data, etiket) {
  const knoppie_id = `voeg-by-mandjie-${formaat}`;
  const voorbestelling = is_voorbestelling(formaat_data);

  return `
    <div class="produk-formaat-ry">
      <div class="produk-formaat-info">
        <span class="produk-formaat-etiket">${etiket}</span>
        <span class="produk-formaat-prys">${formateer_prys_sent(formaat_data.prys_sent)}</span>
        ${voorbestelling
          ? `<span class="produk-voorbestel-nota">${t("voorbestelling_beskikbaar_vanaf")} ${formateer_datum_af(formaat_data.vrystelling_datum)}</span>`
          : ""}
      </div>
      <button class="kaart-aksie produk-formaat-knoppie" id="${knoppie_id}"
        data-slug="${produk.slug}" data-formaat="${formaat}"
        data-titel="${produk.titel}" data-prys="${formaat_data.prys_sent}"
        data-voorbestelling="${voorbestelling}">
        ${voorbestelling ? t("voorbestel_nou") : t("voeg_by_mandjie")}
      </button>
    </div>
  `;
}

function wys_produk(produk) {
  document.title = `${produk.titel} — Future Shop`;

  const wrap = document.getElementById("produk-wrap");

  const omslagHtml = produk.omslag
    ? `<img class="produk-omslag" src="${produk.omslag}" alt="Omslag van ${produk.titel}">`
    : `<div class="produk-omslag" role="img" aria-label="Geen omslag beskikbaar vir ${produk.titel}"></div>`;

  const eboek = produk.formate && produk.formate.eboek;
  const hardeKopie = produk.formate && produk.formate.harde_kopie;

  const aksies = [];
  if (eboek && eboek.beskikbaar) {
    aksies.push(bou_aksie_ry(produk, "eboek", eboek, t("eboek_etiket")));
  }
  if (hardeKopie && hardeKopie.beskikbaar) {
    aksies.push(bou_aksie_ry(produk, "harde_kopie", hardeKopie, t("hardekopie_etiket")));
  }

  wrap.innerHTML = `
    <a class="terug-skakel" href="index.html">${t("terug_katalogus")}</a>
    <div class="produk-uitleg">
      ${omslagHtml}
      <div class="produk-inligting">
        <h1 class="produk-titel">${produk.titel}</h1>
        <p class="produk-outeur">${produk.outeur}</p>
        <p class="produk-beskrywing">${produk.vol_beskrywing || produk.oorsig || ""}</p>
        <div class="produk-aksies">${aksies.join("")}</div>
        <p class="produk-nota" id="produk-terugvoer" role="status"></p>
      </div>
    </div>
  `;

  wrap.querySelectorAll(".produk-formaat-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const { slug, formaat, titel, prys, voorbestelling } = knoppie.dataset;
      const resultaat = voeg_by_mandjie({
        produk_slug: slug,
        titel,
        formaat,
        prys_sent: Number(prys),
      });

      const terugvoer = document.getElementById("produk-terugvoer");
      if (resultaat.reeds_in_mandjie) {
        terugvoer.textContent = t("reeds_in_mandjie");
      } else {
        knoppie.textContent = voorbestelling === "true" ? t("voorbestel_teken") : t("in_mandjie_teken");
        knoppie.disabled = true;
        terugvoer.textContent =
          voorbestelling === "true" ? t("voorbestelling_bygevoeg") : t("bygevoeg_mandjie");
      }
    });
  });
}

async function laai_produk() {
  const wrap = document.getElementById("produk-wrap");
  const slug = kry_produk_slug_uit_url();

  let produkte;
  let demo_modus = false;
  try {
    const resp = await fetch(KATALOGUS_ENDPOINT);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    produkte = data.produkte || [];
  } catch (fout) {
    console.warn("Kon nie lewendige katalogus laai nie, wys demo-data:", fout);
    produkte = DEMO_PRODUKTE;
    demo_modus = true;
  }

  if (!slug) {
    if (demo_modus) {
      // Voorskou-gerief: sonder 'n spesifieke slug in die URL, wys net
      // die eerste demo-produk sodat die bladsy steeds bekyk kan word.
      wys_produk(produkte[0]);
      return;
    }
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("geen_produk")} <a href="index.html">${t("terug_katalogus_skakel")}</a></p>`;
    return;
  }

  const produk = produkte.find((p) => p.slug === slug);
  if (!produk) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("produk_nie_gevind")} <a href="index.html">${t("terug_katalogus_skakel")}</a></p>`;
    return;
  }

  wys_produk(produk);
}

document.addEventListener("DOMContentLoaded", laai_produk);
