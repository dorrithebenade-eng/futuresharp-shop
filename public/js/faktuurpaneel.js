// public/js/faktuurpaneel.js
//
// Boekhouding. Fase 1: die skelet — aanmeld-kontrole, die pil-kieslys, en 'n
// lys wat nog leeg is.
//
// DIE SKERM IS NIE DIE POORT NIE. kry-fakture.js dwing die boekhouding-rol
// af en gee 403 daarsonder, ook vir iemand wat die URL raai. Wat hier gebeur,
// is bloot dat 'n mens nie 'n leë skerm sonder verduideliking sien nie.
//
// Die sessie kom uit die PANEEL-sleutel, dieselfde as paneelbord.html — sien
// identiteit.js se PANEEL_BLADSYE. Een aanmelding vir albei panele.

function fp_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  // t() gee die SLEUTEL terug wanneer hy hom nie ken nie — daar is geen
  // stille terugval nie. Die verstek hier geld net wanneer taal.js glad nie
  // gelaai het nie.
  return uit && uit !== sleutel ? uit : verstek;
}

function fp_wys_afdeling(naam) {
  document.querySelectorAll(".fp-afdeling").forEach((el) => {
    el.classList.toggle("wys", el.getAttribute("data-afdeling") === naam);
  });
  document.querySelectorAll("#fp-kieslys .fp-pil").forEach((pil) => {
    pil.classList.toggle("aktief", pil.getAttribute("data-gaan") === naam);
  });
}

function fp_rand(sent) {
  return "R " + (Number(sent || 0) / 100).toLocaleString("af-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fp_teken_fakture(fakture) {
  const plek = document.getElementById("fp-fakture-lys");
  if (!plek) return;

  if (!fakture.length) {
    // 'n Leë lys moet sê WAT ontbreek, nie net dat daar niks is nie.
    plek.innerHTML = `<p class="stelsel-boodskap">${fp_t(
      "fp_geen_fakture",
      "Daar is nog geen fakture nie."
    )}</p>`;
    return;
  }

  plek.innerHTML = fakture
    .map((f) => {
      const nommer = f.nommer || fp_t("fp_konsep_sonder_nommer", "Konsep");
      const klient = f.klient_naam || "—";
      return `<div class="fp-ry">
        <div class="fp-ry-hoof">
          <span class="fp-nommer">${nommer}</span>
          <span class="fp-klient">${klient}</span>
        </div>
        <div class="fp-ry-syfers">
          <span class="fp-stand fp-stand-${f.stand}">${f.stand}</span>
          <span class="fp-bedrag">${fp_rand(f.totaal_sent)}</span>
        </div>
      </div>`;
    })
    .join("");
}

async function fp_laai_fakture(sessie) {
  const plek = document.getElementById("fp-fakture-lys");
  try {
    const resp = await fetch("/.netlify/functions/kry-fakture", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    // 403 hier beteken die token dra nie die rol nie. Dit gebeur wanneer die
    // rol pas bygesit is en die persoon nog nie weer aangemeld het nie — die
    // rol leef IN die token.
    if (resp.status === 403) {
      fp_geen_toegang(
        fp_t(
          "fp_geen_rol",
          "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan."
        )
      );
      return;
    }

    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const data = await resp.json();
    fp_teken_fakture(data.fakture || []);
  } catch (fout) {
    console.error("Kon nie die fakture laai nie:", fout);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${fp_t(
        "fp_laai_fout",
        "Kon nie die fakture laai nie. Probeer weer."
      )}</p>`;
    }
  }
}

function fp_geen_toegang(teks) {
  const blok = document.getElementById("fp-geen-toegang");
  const paneel = document.getElementById("fp-paneel");
  const teks_el = document.getElementById("fp-geen-toegang-teks");
  if (teks && teks_el) teks_el.textContent = teks;
  if (blok) blok.style.display = "";
  if (paneel) paneel.style.display = "none";
}

document.addEventListener("DOMContentLoaded", async () => {
  const hoof = document.getElementById("fp-hoof");

  // Die bladsy begin onsigbaar sodat 'n mens nie eers die paneel sien en dan
  // die weiering nie. Dieselfde patroon as paneelbord.html.
  const wys = () => {
    if (hoof) hoof.style.visibility = "visible";
  };

  document.querySelectorAll("#fp-kieslys .fp-pil").forEach((pil) => {
    pil.addEventListener("click", () => fp_wys_afdeling(pil.getAttribute("data-gaan")));
  });

  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }

  if (!sessie) {
    fp_geen_toegang(null);
    wys();
    return;
  }

  const epos = document.getElementById("paneel-gebruiker-epos");
  if (epos && sessie.gebruiker) epos.textContent = sessie.gebruiker.email;

  // Die kliëntkant-kontrole is 'n hoflikheid, nie 'n slot. Dra die token nie
  // die rol nie, gee kry-fakture in elk geval 403 en die boodskap hierbo wys.
  if (!identiteit_het_rol(sessie.gebruiker, "boekhouding")) {
    fp_geen_toegang(
      fp_t(
        "fp_geen_rol",
        "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan."
      )
    );
    wys();
    return;
  }

  const paneel = document.getElementById("fp-paneel");
  if (paneel) paneel.style.display = "";
  wys();

  await fp_laai_fakture(sessie);
});
