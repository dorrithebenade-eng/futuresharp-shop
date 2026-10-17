// public/js/faktuur-projek.js
// Weergawe 1 (17 Oktober 2026).
//
// Die PROJEK van 'n faktuur, in die backoffice-kolom. Nie op die dokument nie.
//
// TWEE PAAIE, NA GELANG VAN DIE STAND.
//   konsep    die keuse gaan saam met die gewone outomatiese stoor
//             (faktuur-vorm.js stuur window.FV_PROJEK_ID in liggaam())
//   anders    die keuse word dadelik deur stel-faktuur-projek.js gestoor, want
//             'n uitgereikte faktuur word nie meer deur die vorm gestoor nie
//
// DIE PROJEK LEEF BUITE V. Ontdoen draai die vorm se velde terug; 'n
// projekkeuse wat reeds deur stel-faktuur-projek.js gestoor is, mag nie stilweg
// op die skerm terugspring terwyl die rekord iets anders sê nie.
//
// Net op 'n faktuur. 'n Kwotasie kry nie die kaart nie.
//
// Voorvoegsel `fpj_`.

const FPJ = { projekte: [], gelaai: false };

function fpj_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function fpj_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fpj_stand(teks, is_fout) {
  const el = document.getElementById("fp-projek-stand");
  if (!el) return;
  el.textContent = teks || "";
  el.classList.toggle("fout", Boolean(is_fout));
}

function fpj_teken() {
  const kies = document.getElementById("fp-projek");
  if (!kies) return;
  const huidig = window.FV_PROJEK_ID || "";
  const lys = FPJ.projekte
    .filter((p) => p.aktief !== false || p.id === huidig)
    .sort((a, b) => String(b.nr || "").localeCompare(String(a.nr || "")) ||
      String(a.naam).localeCompare(String(b.naam), "af-ZA"));
  const opsies = lys.map((p) =>
    `<option value="${fpj_ontsnap(p.id)}"${p.id === huidig ? " selected" : ""}>${
      fpj_ontsnap(p.nr ? p.nr + " · " : "")}${fpj_ontsnap(p.naam)}${
      p.aktief === false ? " (" + fpj_ontsnap(fpj_t("fpj_onaktief", "gedeaktiveer")) + ")" : ""}</option>`);
  if (huidig && !lys.some((p) => p.id === huidig)) {
    opsies.unshift(`<option value="${fpj_ontsnap(huidig)}" selected>${fpj_ontsnap(huidig)} (${
      fpj_ontsnap(fpj_t("fpj_weg", "bestaan nie meer nie"))})</option>`);
  }
  kies.innerHTML = `<option value="">${fpj_ontsnap(fpj_t("fpj_geen", "Geen projek"))}</option>` + opsies.join("");
  kies.value = huidig;
}

async function fpj_kies() {
  const kies = document.getElementById("fp-projek");
  const nuut = kies.value;
  const ou = window.FV_PROJEK_ID || "";
  if (nuut === ou) return;

  // 'n Konsep: saam met die gewone stoor.
  if (typeof V !== "undefined" && V.stand === "konsep") {
    window.FV_PROJEK_ID = nuut;
    if (typeof merk_vuil === "function") merk_vuil();
    fpj_stand("");
    return;
  }

  // Uitgereik of betaal: dadelik.
  if (typeof V === "undefined" || !V.sleutel) return;
  kies.disabled = true;
  fpj_stand(fpj_t("fpj_besig", "Word gestoor …"));
  try {
    const resp = await fetch("/.netlify/functions/stel-faktuur-projek", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sleutel: V.sleutel, projek_id: nuut }),
    });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    window.FV_PROJEK_ID = nuut;
    fpj_stand(fpj_t("fpj_gestoor", "Gestoor"));
  } catch (fout) {
    kies.value = ou;
    fpj_stand(String(fout.message || fout), true);
  } finally {
    kies.disabled = false;
  }
}

async function fpj_laai_projekte() {
  try {
    const resp = await fetch("/.netlify/functions/kry-projekte", { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error(String(resp.status));
    const data = await resp.json();
    FPJ.projekte = Array.isArray(data.projekte) ? data.projekte : [];
  } catch (fout) {
    console.error("Kon nie die projekte laai nie:", fout);
    FPJ.projekte = [];
    fpj_stand(fpj_t("fpj_laai_fout", "Kon nie die projekte laai nie."), true);
  }
  FPJ.gelaai = true;
  fpj_teken();
}

document.addEventListener("fv-projek-gelaai", () => { if (FPJ.gelaai) fpj_teken(); });

document.addEventListener("DOMContentLoaded", async () => {
  const kaart = document.getElementById("fp-projek-kaart");
  if (!kaart) return;
  if (typeof IS_KW !== "undefined" && IS_KW) return;

  let sessie = null;
  try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
  if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

  kaart.hidden = false;
  document.getElementById("fp-projek").addEventListener("change", fpj_kies);
  await fpj_laai_projekte();
});
