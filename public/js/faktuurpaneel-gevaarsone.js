// public/js/faktuurpaneel-gevaarsone.js
//
// ─────────────────────────────────────────────────────────────────────────
// TYDELIK. HIERDIE LEER MOET SAAM MET vee-fakture-uit.js VERWYDER WORD
// sodra die skoonmaak gedoen is.
//
// Hy sit die knoppie in Instellings waarmee die HELE faktuurstore uitgevee
// word — elke konsep, elke uitgereikte faktuur, elke betaling. Geen pad
// terug nie.
// ─────────────────────────────────────────────────────────────────────────
//
// DIE BLOK STAAN HEEL ONDERAAN INSTELLINGS, weg van die velde wat 'n mens
// elke week aanraak. Iemand wat die maatskappy se adres kom regmaak, moet
// nie hierby verbyskuif nie.
//
// DIE KNOPPIE BLY DOOD TOTDAT DIE SIN PRESIES REG INGETIK IS. Nie 'n
// bevestiging agterna nie — 'n mens moet die woorde self tik voordat die
// knoppie hoegenaamd lewe. Dieselfde slot sit bedienerkant, en daar boonop
// 'n omgewingsveranderlike wat in Netlify aangeskakel moet word.

const GZ_SIN = "VEE ALLE FAKTURE UIT";

function gz_bou() {
  const wrap = document.querySelector('.fp-afdeling[data-afdeling="instellings"] .in-wrap');
  if (!wrap || document.getElementById("gz-blok")) return;

  const blok = document.createElement("div");
  blok.id = "gz-blok";
  blok.className = "gz-blok";
  blok.innerHTML = `
    <h3 class="gz-kop">Gevaarsone</h3>
    <p class="gz-teks">
      Vee die hele faktuurregister uit — elke konsep, elke uitgereikte faktuur,
      elke betaling en elke uitbetaalrekord. Die nommers begin weer van voor af.
      Dit kan nie teruggedraai word nie en daar is geen afskrif nie.
    </p>
    <p class="gz-teks">
      Dit bestaan om die toetsdata weg te maak voordat die eerste egte faktuur
      uitgereik word. Daarna word hierdie blok uit die stelsel verwyder.
    </p>
    <label class="veld-etiket" for="gz-sin">Tik hierdie sin presies so in: <strong>${GZ_SIN}</strong></label>
    <input class="veld-invoer" id="gz-sin" autocomplete="off" spellcheck="false">
    <p class="gz-uitslag" id="gz-uitslag" hidden></p>
    <button type="button" class="kaart-aksie gz-knop" id="gz-doen" disabled>Vee die faktuurregister uit</button>
  `;
  wrap.appendChild(blok);

  const veld = document.getElementById("gz-sin");
  const knop = document.getElementById("gz-doen");

  veld.addEventListener("input", () => {
    knop.disabled = veld.value.trim() !== GZ_SIN;
  });

  knop.addEventListener("click", gz_doen);
}

async function gz_doen() {
  const knop = document.getElementById("gz-doen");
  const uitslag = document.getElementById("gz-uitslag");

  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }
  if (!sessie) return;

  knop.disabled = true;
  knop.textContent = "Besig \u2026";

  try {
    const resp = await fetch("/.netlify/functions/vee-fakture-uit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessie.access_token}`,
      },
      body: JSON.stringify({ bevestiging: GZ_SIN }),
    });

    const teks = await resp.text();
    uitslag.hidden = false;

    if (!resp.ok) {
      uitslag.className = "gz-uitslag gz-fout";
      uitslag.textContent = teks || "Kon nie uitvee nie.";
      knop.textContent = "Vee die faktuurregister uit";
      knop.disabled = false;
      return;
    }

    let data = {};
    try {
      data = JSON.parse(teks);
    } catch {
      data = {};
    }

    uitslag.className = "gz-uitslag gz-klaar";
    uitslag.textContent =
      `${data.uitgevee || 0} inskrywings uitgevee. Die volgende faktuur is nommer ` +
      `${data.volgende_nommer || ""}. Herlaai die bladsy.`;
    knop.textContent = "Klaar";
  } catch (fout) {
    console.error("Kon nie die faktuurregister uitvee nie:", fout);
    uitslag.hidden = false;
    uitslag.className = "gz-uitslag gz-fout";
    uitslag.textContent = "Kon nie uitvee nie.";
    knop.textContent = "Vee die faktuurregister uit";
    knop.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const afd = document.querySelector('.fp-afdeling[data-afdeling="instellings"]');
  if (!afd) return;

  // Eers bou wanneer iemand werklik na Instellings toe gaan. 'n Blok wat by
  // die laai van die bladsy in die DOM sit, is 'n blok wat 'n mens per
  // ongeluk raakvat.
  const waarnemer = new MutationObserver(() => {
    if (afd.classList.contains("wys")) gz_bou();
  });
  waarnemer.observe(afd, { attributes: true, attributeFilter: ["class"] });

  if (afd.classList.contains("wys")) gz_bou();
});
