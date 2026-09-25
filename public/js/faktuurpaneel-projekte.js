// public/js/faktuurpaneel-projekte.js
// Weergawe 2 (25 September 2026).
//
// Die register van projekte, op Boekhouding se Registers-blad.
//
// WAT 'N PROJEK DRA (fase B, 25 September 2026)
//
//   soort      vrye teks, met voorstelle uit die bestaande projekte: julle bou
//              die lys self op deur 'n nuwe soort in te tik
//   vir wie    die skool of instansie waarvoor die projek is, uit die
//              kliënteregister. Nie "begunstigde" nie: die Begunstigdes-register
//              is reeds wie Paystack-uitbetalings kry.
//   toekennings  die befondsing, elk met sy kontrolelys. Hulle word in 'n eie
//              venster bestuur; sien faktuurpaneel-toekennings.js.
//
// Die ou befondsers-veld (kliëntnommers) word nie meer op die vorm gewys nie.
// 'n Projek wat dit reeds dra, hou dit, en die lys noem dit.
//
// Voorvoegsel `PJ` / `pj_`.

const PJ = {
  projekte: [],
  kliente: [],        // { nommer, naam, soort }
  sessie: null,
  wysig: null,
};

function pj_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function pj_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pj_rand(sent) {
  const n = Math.round(Math.abs(Number(sent) || 0));
  const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return "R" + heel + "," + String(n % 100).padStart(2, "0");
}

async function pj_vra(naam, opsies) {
  const resp = await fetch("/.netlify/functions/" + naam, {
    ...(opsies || {}),
    headers: { ...((opsies && opsies.headers) || {}), ...(await identiteit_kop()) },
  });
  if (!resp.ok) {
    const teks = await resp.text().catch(() => "");
    throw new Error(teks || String(resp.status));
  }
  return resp.json();
}

/* ═══ die lys ═══ */

function pj_pas(p, soek) {
  if (!soek) return true;
  return [p.naam, p.nota, p.soort, p.vir_wie_naam]
    .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "").includes(soek);
}

function pj_teken_lys() {
  const plek = document.getElementById("pj-lys");
  if (!plek) return;

  const soekveld = document.getElementById("pj-soek");
  const soek = (soekveld ? soekveld.value || "" : "").trim().toLowerCase().replace(/\s+/g, "");
  const pas = PJ.projekte.filter((p) => pj_pas(p, soek));

  const hulp = document.getElementById("pj-hulp");
  if (hulp) {
    hulp.textContent = soek
      ? pas.length + " " + pj_t("pj_van", "van") + " " + PJ.projekte.length
      : PJ.projekte.length + " " +
        (PJ.projekte.length === 1 ? pj_t("pj_een", "projek") : pj_t("pj_meer", "projekte"));
  }

  if (!PJ.projekte.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${pj_t(
      "pj_leeg", "Die register is nog leeg. Voeg die eerste projek by.")}</p>`;
    return;
  }
  if (!pas.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${pj_t(
      "pj_geen_treffer", "Geen projek pas by die soektog nie.")}</p>`;
    return;
  }

  plek.innerHTML = pas.map((p) => {
    const merkies = [
      p.aktief === false ? `<span class="fk-merkie kt-onaktief">${pj_t("pj_onaktief", "Onaktief")}</span>` : "",
      p.toets ? `<span class="fk-merkie">${pj_t("pj_toets", "Toets")}</span>` : "",
    ].join("");
    const eerste = [
      p.soort ? pj_ontsnap(p.soort) : "",
      p.vir_wie ? `${pj_ontsnap(pj_t("pj_vir", "vir"))} ${pj_ontsnap(p.vir_wie_naam || p.vir_wie)}` : "",
    ].filter(Boolean).join(" \u00b7 ");
    const tk = p.toekennings
      ? pj_t("pj_tk_tel", "{n} toekenning(s), {r} toegesê").replace("{n}", p.toekennings).replace("{r}", pj_rand(p.toegese_sent))
      : pj_t("pj_tk_geen", "Nog geen toekenning nie");
    const oud = (p.befondsers || []).length
      ? `<span class="fk-ry-onder pj-oud">${pj_ontsnap(pj_t("pj_oud_bf", "Ou befondsersveld:"))} ${
          (p.befondsers || []).map((b) => pj_ontsnap(b.naam || b.nommer)).join(", ")}</span>` : "";

    const rand = (p.aktief === false
      ? `<button type="button" class="fp-skrap kt-aktiveer" data-pj-aktiveer="${pj_ontsnap(p.id)}">${pj_t("pj_aktiveer", "Aktiveer")}</button>`
      : `<button type="button" class="pj-tk-knop" data-pj-tk="${pj_ontsnap(p.id)}">${pj_t("pj_tk_knop", "Toekennings")}</button>
         <button type="button" class="fp-skrap" data-pj-skrap="${pj_ontsnap(p.id)}">${pj_t("pj_skrap", "Skrap")}</button>`);

    return `
      <div class="fk-ry fk-ry-twee${p.aktief === false ? " kt-ry-onaktief" : ""}">
        <button type="button" class="fk-ry-oop" data-pj="${pj_ontsnap(p.id)}">
          <span class="fk-ry-naam">${pj_ontsnap(p.naam)}${merkies}</span>
          ${eerste ? `<span class="fk-ry-onder">${eerste}</span>` : ""}
          <span class="fk-ry-onder">${pj_ontsnap(tk)}</span>
          ${oud}
        </button>
        <span class="fk-ry-rand">${rand}</span>
      </div>`;
  }).join("");

  plek.querySelectorAll("[data-pj]").forEach((b) =>
    b.addEventListener("click", () => pj_maak_vorm_oop(b.getAttribute("data-pj"))));
  plek.querySelectorAll("[data-pj-skrap]").forEach((b) =>
    b.addEventListener("click", () => pj_skrap(b.getAttribute("data-pj-skrap"))));
  plek.querySelectorAll("[data-pj-aktiveer]").forEach((b) =>
    b.addEventListener("click", () => pj_aktiveer(b.getAttribute("data-pj-aktiveer"))));
  plek.querySelectorAll("[data-pj-tk]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PJ.projekte.find((x) => x.id === b.getAttribute("data-pj-tk"));
      if (p && typeof window.tk_maak_oop === "function") window.tk_maak_oop(p);
    }));
}

/* ═══ die vorm ═══ */

function pj_vul_keuses(p) {
  // Soorte: wat die bestaande projekte reeds gebruik, alfabeties.
  const soorte = [...new Set(PJ.projekte.map((x) => x.soort).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "af-ZA"));
  document.getElementById("pj-soorte").innerHTML =
    soorte.map((s) => `<option value="${pj_ontsnap(s)}"></option>`).join("");

  // Vir wie: die kliënte; 'n kliënt wat intussen weg is, bly sigbaar gekies.
  const kies = document.getElementById("pj-vir-wie");
  const huidig = p ? p.vir_wie || "" : "";
  const opsies = PJ.kliente.map((k) =>
    `<option value="${pj_ontsnap(k.nommer)}"${k.nommer === huidig ? " selected" : ""}>${
      pj_ontsnap(k.nommer)} \u00b7 ${pj_ontsnap(k.naam)}</option>`);
  if (huidig && !PJ.kliente.some((k) => k.nommer === huidig)) {
    opsies.unshift(`<option value="${pj_ontsnap(huidig)}" selected>${pj_ontsnap(huidig)} (${pj_t("pj_weg", "bestaan nie meer")})</option>`);
  }
  kies.innerHTML = `<option value="">${pj_t("pj_vir_wie_geen", "Nie vir een instansie nie")}</option>` + opsies.join("");
}

function pj_maak_vorm_oop(id) {
  const p = id ? PJ.projekte.find((x) => x.id === id) : null;
  PJ.wysig = p ? p.id : null;

  document.getElementById("pj-vorm-titel").textContent = p
    ? pj_t("pj_wysig_titel", "Wysig projek")
    : pj_t("pj_nuwe_titel", "Nuwe projek");
  document.getElementById("pj-naam").value = p ? p.naam : "";
  document.getElementById("pj-soort").value = p ? p.soort || "" : "";
  document.getElementById("pj-nota").value = p ? p.nota || "" : "";
  pj_vul_keuses(p);

  document.getElementById("pj-vorm-fout").style.display = "none";
  document.getElementById("pj-vorm").classList.add("oop");
  document.getElementById("pj-naam").focus();
}

function pj_maak_vorm_toe() {
  document.getElementById("pj-vorm").classList.remove("oop");
  PJ.wysig = null;
}

function pj_wys_fout(boodskap) {
  const el = document.getElementById("pj-vorm-fout");
  el.textContent = boodskap;
  el.style.display = "";
}

async function pj_stoor() {
  const naam = document.getElementById("pj-naam").value.trim();
  if (!naam) {
    pj_wys_fout(pj_t("pj_naam_kort", "Die naam is verpligtend."));
    return;
  }
  const knop = document.getElementById("pj-stoor");
  knop.disabled = true;
  try {
    await pj_vra("stoor-projek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: PJ.wysig || undefined,
        naam,
        soort: document.getElementById("pj-soort").value.trim(),
        vir_wie: document.getElementById("pj-vir-wie").value,
        nota: document.getElementById("pj-nota").value.trim(),
      }),
    });
    pj_maak_vorm_toe();
    await pj_laai();
  } catch (fout) {
    pj_wys_fout(String(fout.message || fout));
  } finally {
    knop.disabled = false;
  }
}

async function pj_skrap(id) {
  const p = PJ.projekte.find((x) => x.id === id);
  if (!p) return;
  if (!window.confirm(
    pj_t("pj_skrap_vra",
      "Vee hierdie projek uit? Word dit reeds deur inskrywings gebruik, " +
      "word dit gedeaktiveer in plaas van uitgevee.") + "\n\n" + p.naam)) return;
  try {
    const uitslag = await pj_vra("skrap-projek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await pj_laai();
    if (uitslag && uitslag.gedeaktiveer) {
      window.alert(pj_t("pj_gedeaktiveer",
        "Hierdie projek word deur {n} inskrywings gebruik en is gedeaktiveer. " +
        "Bestaande inskrywings bly onveranderd; die projek verskyn nie meer in keuselyste nie.")
        .replace("{n}", Number(uitslag.verwysings) || 0));
    }
  } catch (fout) {
    window.alert(String(fout.message || fout));
  }
}

async function pj_aktiveer(id) {
  try {
    await pj_vra("aktiveer-projek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await pj_laai();
  } catch (fout) {
    window.alert(String(fout.message || fout));
  }
}

/* ═══ laai ═══ */

async function pj_laai_kliente() {
  try {
    const data = await pj_vra("kry-kliente");
    PJ.kliente = (Array.isArray(data.kliente) ? data.kliente : [])
      .map((k) => ({ nommer: k.nommer, naam: k.naam || "", soort: k.soort || "instansie" }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "af-ZA"));
  } catch (fout) {
    console.error("Kon nie die kliënte laai nie:", fout);
    PJ.kliente = [];
  }
}

async function pj_laai() {
  const plek = document.getElementById("pj-lys");
  try {
    const data = await pj_vra("kry-projekte");
    PJ.projekte = Array.isArray(data.projekte) ? data.projekte : [];
    pj_teken_lys();
    document.dispatchEvent(new CustomEvent("pj-gelaai", { detail: PJ.projekte }));
  } catch (fout) {
    console.error("Kon nie die projekte laai nie:", fout);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${pj_t("pj_laai_fout", "Kon nie die projekte laai nie.")}</p>`;
    }
  }
}
window.pj_herlaai = pj_laai;

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("pj-lys")) return;

  try {
    PJ.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    PJ.sessie = null;
  }
  if (!PJ.sessie || !identiteit_het_rol(PJ.sessie.gebruiker, "boekhouding")) return;

  document.getElementById("pj-nuut").addEventListener("click", () => pj_maak_vorm_oop(null));
  const soekveld = document.getElementById("pj-soek");
  if (soekveld) soekveld.addEventListener("input", pj_teken_lys);
  document.getElementById("pj-stoor").addEventListener("click", pj_stoor);
  document.getElementById("pj-kanselleer").addEventListener("click", pj_maak_vorm_toe);

  const oorlegsel = document.getElementById("pj-vorm");
  oorlegsel.addEventListener("click", (ev) => { if (ev.target === oorlegsel) pj_maak_vorm_toe(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && oorlegsel.classList.contains("oop")) pj_maak_vorm_toe();
  });

  await Promise.all([pj_laai_kliente(), pj_laai()]);
});
