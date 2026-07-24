// public/js/aanmeld.js
//
// Gebruik identiteit.js se globale identiteit_*-funksies (moet voor
// hierdie skrip gelaai word). Geen eie fetch/localStorage-logika hier nie,
// buiten die "terug"-bestemming (sien TERUG_SLEUTEL hieronder).

// Waarom localStorage en nie net die "?terug="-URL-parameter nie: 'n nuwe
// koper wat by kassa registreer, verlaat die bladsy heeltemal om hul
// e-pos te gaan bevestig. Die bevestigings-skakel word deur GoTrue self
// gegenereer (nie deur ons kode nie) en bevat GEEN "?terug="-parameter
// nie — dit sou dus verlore raak teen die tyd bevestig.html laai. Deur
// dit hier in localStorage te stoor, oorleef dit daardie omweg.
const TERUG_SLEUTEL = "future_shop_terug_na";

function kry_terug_pad() {
  const parms = new URLSearchParams(window.location.search);
  const uit_url = parms.get("terug");
  if (uit_url) {
    localStorage.setItem(TERUG_SLEUTEL, uit_url);
    return uit_url;
  }
  return localStorage.getItem(TERUG_SLEUTEL) || "/my-boeke.html";
}

// Stoor dadelik by bladsy-laai — ongeag of die persoon uiteindelik
// aanmeld óf registreer, sodat dit ook oorleef as hulle na registreer
// wissel voor hulle indien.
kry_terug_pad();

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
    const pad = kry_terug_pad();
    localStorage.removeItem(TERUG_SLEUTEL);
    window.location.href = pad;
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
    // kan slaag — bevestig.html verwerk die skakel se token en gebruik
    // die "terug"-pad wat hierbo in localStorage gestoor is.
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
    const pad = kry_terug_pad();
    localStorage.removeItem(TERUG_SLEUTEL);
    window.location.href = pad;
  }
})();
