// paneel-spreker-uit-outeur.js — FutureSharp Talks.
//
// Die knoppie "+ Uit outeurs" in die Sprekers-afdeling: kies 'n bestaande
// outeur en registreer hom in een klik ook as spreker. Die bediener
// (outeur-na-spreker.js) stel die sprekersrekord uit die outeursrekord
// saam; hier word net gekies en gestuur.
//
// Die lys wys net outeurs wat nog nie spreker is nie. Die bediener weier
// in elk geval 'n tweede keer, maar 'n keuse wat net 'n fout kan gee, hoort
// nie in die lys nie.
//
// Hang af van paneelbord.js (kry_outorisasie_kop) en paneel-registers.js
// (PANEEL_REGISTERS, paneel_register_laai, window.paneel_register_kas),
// wat albei vroeër laai.

const SUO_KRY_OUTEURS = "/.netlify/functions/kry-outeurs";
const SUO_REGISTREER = "/.netlify/functions/outeur-na-spreker";

function suo_sprekers_register() {
  return PANEEL_REGISTERS.find((r) => r.sleutel === "sprekers");
}

function suo_boodskap(teks, is_fout) {
  const el = document.getElementById("suo-boodskap");
  el.textContent = teks || "";
  el.classList.toggle("suo-boodskap--fout", Boolean(is_fout));
  el.style.display = teks ? "block" : "none";
}

async function suo_open() {
  const blok = document.getElementById("suo-blok");
  const kieser = document.getElementById("suo-kieser");
  const knoppie = document.getElementById("suo-registreer");

  blok.style.display = "block";
  suo_boodskap("");
  kieser.innerHTML = '<option value="">Outeurs word gelaai …</option>';
  kieser.disabled = true;
  knoppie.disabled = true;

  try {
    const resp = await fetch(SUO_KRY_OUTEURS, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    const outeurs = data.outeurs || [];

    const sprekers = (window.paneel_register_kas && window.paneel_register_kas.sprekers) || [];
    const reeds = new Set();
    sprekers.forEach((s) => {
      if (s.spreker_id) reeds.add(s.spreker_id);
      if (s.bron_outeur_id) reeds.add(s.bron_outeur_id);
    });

    const beskikbaar = outeurs.filter((o) => !reeds.has(o.outeur_id));

    if (!beskikbaar.length) {
      kieser.innerHTML = '<option value="">Geen outeurs oor nie</option>';
      suo_boodskap("Elke outeur is reeds as spreker geregistreer.");
      return;
    }

    kieser.innerHTML =
      `<option value="">Kies 'n outeur …</option>` +
      beskikbaar
        .map((o) => {
          const merk = o.subrekening_kode ? "" : " (wag vir subrekening)";
          return `<option value="${o.outeur_id}">${o.naam}${merk}</option>`;
        })
        .join("");
    kieser.disabled = false;
  } catch (fout) {
    console.error("Kon nie outeurs laai nie:", fout);
    kieser.innerHTML = '<option value="">Kon nie outeurs laai nie</option>';
    suo_boodskap("Kon nie die outeurs laai nie. Probeer weer.", true);
  }
}

function suo_sluit() {
  document.getElementById("suo-blok").style.display = "none";
}

async function suo_registreer() {
  const kieser = document.getElementById("suo-kieser");
  const knoppie = document.getElementById("suo-registreer");
  const outeur_id = kieser.value;
  if (!outeur_id) return;

  const naam = kieser.options[kieser.selectedIndex].textContent;
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";
  suo_boodskap("");

  try {
    const resp = await fetch(SUO_REGISTREER, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ outeur_id }),
    });
    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }
    const spreker = await resp.json();

    // Werk die lys PLAASLIK by: Blobs se list() is eventueel konsekwent,
    // en 'n herlaai net ná die stoor kan die nuwe spreker nog mis.
    const reg = suo_sprekers_register();
    const kas = window.paneel_register_kas.sprekers || [];
    const nuwe_lys = [...kas.filter((s) => s.spreker_id !== spreker.spreker_id), spreker]
      .sort((a, b) => a.naam.localeCompare(b.naam, "af"));
    window.paneel_register_kas.sprekers = nuwe_lys;
    paneel_register_wys_lys(reg, nuwe_lys);

    suo_sluit();
  } catch (fout) {
    console.error("Kon nie as spreker registreer nie:", fout);
    suo_boodskap(`Kon nie ${naam} registreer nie: ${fout.message}`, true);
  } finally {
    knoppie.disabled = !kieser.value;
    knoppie.textContent = "Registreer as spreker";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const open = document.getElementById("paneel-sprekers-uit-outeurs-knoppie");
  if (!open) return;
  open.addEventListener("click", suo_open);
  document.getElementById("suo-kanselleer").addEventListener("click", suo_sluit);
  document.getElementById("suo-registreer").addEventListener("click", suo_registreer);
  document.getElementById("suo-kieser").addEventListener("change", (e) => {
    document.getElementById("suo-registreer").disabled = !e.target.value;
  });
});
