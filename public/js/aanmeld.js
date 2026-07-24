// public/js/aanmeld.js
//
// Gebruik identiteit.js se globale identiteit_*-funksies (moet voor
// hierdie skrip gelaai word). Geen eie fetch/localStorage-logika hier nie.

function kry_terug_pad() {
  const parms = new URLSearchParams(window.location.search);
  return parms.get("terug") || "/my-boeke.html";
}

function wys_boodskap(teks, is_fout) {
  const el = document.getElementById("aanmeld-boodskap");
  if (!el) return;
  el.textContent = teks;
  el.classList.toggle("boodskap-fout", !!is_fout);
  el.classList.toggle("boodskap-sukses", !is_fout && !!teks);
}

function wys_blok(naam) {
  const blokke = {
    aanmeld: document.getElementById("aanmeld-blok"),
    registreer: document.getElementById("registreer-blok"),
    herstel: document.getElementById("herstel-blok"),
  };
  Object.entries(blokke).forEach(([sleutel, el]) => {
    if (el) el.hidden = sleutel !== naam;
  });
  wys_boodskap("");
}

// --- Vorm-wisseling ---
document.getElementById("wys-registreer-knoppie")?.addEventListener("click", () => wys_blok("registreer"));
document.getElementById("wys-aanmeld-knoppie")?.addEventListener("click", () => wys_blok("aanmeld"));
document.getElementById("wys-herstel-knoppie")?.addEventListener("click", () => wys_blok("herstel"));
document.getElementById("herstel-terug-knoppie")?.addEventListener("click", () => wys_blok("aanmeld"));

// --- Aanmeld ---
document.getElementById("aanmeld-vorm")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const epos = document.getElementById("aanmeld-epos").value.trim();
  const wagwoord = document.getElementById("aanmeld-wagwoord").value;

  wys_boodskap(window.t ? window.t("meld_tans_aan") : "Meld tans aan...");

  try {
    await identiteit_meld_aan(epos, wagwoord);
    window.location.href = kry_terug_pad();
  } catch (fout) {
    wys_boodskap(
      fout.message || (window.t ? window.t("aanmeld_fout") : "Kon nie aanmeld nie — kyk jou besonderhede."),
      true
    );
  }
});

// --- Registreer ---
document.getElementById("registreer-vorm")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const epos = document.getElementById("registreer-epos").value.trim();
  const wagwoord = document.getElementById("registreer-wagwoord").value;

  wys_boodskap(window.t ? window.t("registreer_tans") : "Skep tans rekening...");

  try {
    await identiteit_registreer(epos, wagwoord);
    // GoTrue vereis gewoonlik e-pos-bevestiging voor die eerste aanmeld
    // kan slaag — daar is nog geen "bevestig.html" wat die
    // bevestigings-skakel se token verwerk nie (sien AANPASSINGS-NODIG.md).
    wys_boodskap(
      window.t
        ? window.t("registreer_sukses_bevestig_epos")
        : "Rekening geskep! Kyk jou e-pos vir 'n bevestigingskakel voor jy kan aanmeld.",
      false
    );
  } catch (fout) {
    wys_boodskap(
      fout.message || (window.t ? window.t("registreer_fout") : "Kon nie rekening skep nie."),
      true
    );
  }
});

// --- Wagwoord-herstel ---
document.getElementById("herstel-vorm")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const epos = document.getElementById("herstel-epos").value.trim();

  wys_boodskap(window.t ? window.t("stuur_tans_herstel") : "Stuur tans...");

  try {
    await identiteit_stuur_herstel(epos);
    wys_boodskap(
      window.t ? window.t("herstel_epos_gestuur") : "Herstel-skakel gestuur — kyk jou e-pos.",
      false
    );
  } catch (fout) {
    wys_boodskap(
      fout.message || (window.t ? window.t("herstel_fout") : "Kon nie herstel-epos stuur nie."),
      true
    );
  }
});

// --- As reeds aangemeld, spring dadelik na die "terug"-bestemming ---
(async function kontroleer_reeds_aangemeld() {
  const sessie = await identiteit_kry_huidige_sessie();
  if (sessie) {
    window.location.href = kry_terug_pad();
  }
})();
