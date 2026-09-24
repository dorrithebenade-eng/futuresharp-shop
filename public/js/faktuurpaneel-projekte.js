// public/js/faktuurpaneel-projekte.js
//
// Die register van projekte, op Boekhouding se Registers-blad.
//
// 'N NUWE LEER, dieselfde patroon as faktuurpaneel-fin-kategoriee.js: sy eie
// sessie, sy eie rolkontrole, sy eie oorlegsel. Die voorvoegsel is `PJ` en
// `pj_`; faktuurpaneel-kliente.js dra reeds `FK`, en twee lêers met dieselfde
// `const` op een bladsy laat albei nie laai nie.
//
// BEFONDSERS KOM UIT DIE KLIENTEREGISTER. Die vorm kies uit bestaande kliënte,
// en 'n nuwe kliënt kan hier geskep word sonder om die vorm te verlaat. Blobs
// se list() loop sowat vier sekondes agter; die nuwe kliënt word dus uit die
// stoor-antwoord in die lys gesit, nie uit 'n herlaai nie.

const PJ = {
  projekte: [],
  kliente: [],        // { nommer, naam, soort }
  sessie: null,
  wysig: null,        // die id wat gewysig word, of null vir 'n nuwe een
  befondsers: [],     // die vorm se huidige keuse, as kliëntnommers
};

function pj_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function pj_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function pj_vra(naam, opsies) {
  const resp = await fetch("/.netlify/functions/" + naam, {
    ...(opsies || {}),
    headers: {
      ...((opsies && opsies.headers) || {}),
      ...(await identiteit_kop()),
    },
  });
  if (!resp.ok) {
    const teks = await resp.text().catch(() => "");
    throw new Error(teks || String(resp.status));
  }
  return resp.json();
}

function pj_klient(nommer) {
  return PJ.kliente.find((k) => k.nommer === nommer) || null;
}

/* ═══ die lys ═══ */

function pj_pas(p, soek) {
  if (!soek) return true;
  return [p.naam, p.nota]
    .concat((p.befondsers || []).map((b) => b.naam))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "")
    .includes(soek);
}

function pj_teken_lys() {
  const plek = document.getElementById("pj-lys");
  if (!plek) return;

  const soekveld = document.getElementById("pj-soek");
  const soek = (soekveld ? soekveld.value || "" : "")
    .trim().toLowerCase().replace(/\s+/g, "");

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
      p.aktief === false
        ? `<span class="fk-merkie kt-onaktief">${pj_t("pj_onaktief", "Onaktief")}</span>` : "",
      p.toets
        ? `<span class="fk-merkie">${pj_t("pj_toets", "Toets")}</span>` : "",
    ].join("");

    /* DIE TWEEDE REEL DRA DIE BEFONDSERS. 'n Befondser wat nie meer bestaan
       nie, word by sy nommer genoem en gemerk; hy val nie stil weg nie. */
    const bf = (p.befondsers || []).map((b) => b.weg
      ? `${pj_ontsnap(b.nommer)} (${pj_t("pj_weg", "bestaan nie meer")})`
      : `${pj_ontsnap(b.nommer)} · ${pj_ontsnap(b.naam)}`).join(", ");
    const onder = bf || `<span class="pj-geen">${pj_t("pj_geen_befondser", "Geen befondser")}</span>`;

    const rand = p.aktief === false
      ? `<button type="button" class="fp-skrap kt-aktiveer" data-pj-aktiveer="${pj_ontsnap(p.id)}"
                >${pj_t("pj_aktiveer", "Aktiveer")}</button>`
      : `<button type="button" class="fp-skrap" data-pj-skrap="${pj_ontsnap(p.id)}"
                >${pj_t("pj_skrap", "Skrap")}</button>`;

    return `
      <div class="fk-ry fk-ry-twee${p.aktief === false ? " kt-ry-onaktief" : ""}">
        <button type="button" class="fk-ry-oop" data-pj="${pj_ontsnap(p.id)}">
          <span class="fk-ry-naam">${pj_ontsnap(p.naam)}${merkies}</span>
          <span class="fk-ry-onder">${onder}</span>
          ${p.nota ? `<span class="fk-ry-onder">${pj_ontsnap(p.nota)}</span>` : ""}
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
}

/* ═══ die befondsers in die vorm ═══ */

function pj_teken_befondsers() {
  const plek = document.getElementById("pj-befondsers");
  if (!plek) return;

  plek.innerHTML = PJ.befondsers.length
    ? PJ.befondsers.map((n) => {
        const k = pj_klient(n);
        const etiket = k
          ? `${pj_ontsnap(n)} · ${pj_ontsnap(k.naam)}`
          : `${pj_ontsnap(n)} (${pj_t("pj_weg", "bestaan nie meer")})`;
        return `<span class="pj-befondser">${etiket}<button type="button"
                  class="pj-befondser-weg" data-pj-haal="${pj_ontsnap(n)}"
                  aria-label="${pj_t("pj_haal_af", "Haal af")}">&#215;</button></span>`;
      }).join("")
    : `<p class="fk-veldhulp">${pj_t("pj_befondser_leeg", "Geen befondser nie. Dit is geldig vir Future Sharp se eie werk.")}</p>`;

  plek.querySelectorAll("[data-pj-haal]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = b.getAttribute("data-pj-haal");
      PJ.befondsers = PJ.befondsers.filter((x) => x !== n);
      pj_teken_befondsers();
      pj_teken_kies();
    }));
}

// Die keuselys wys net kliënte wat nog NIE befondsers van hierdie projek is
// nie. 'n Kliënt kan nie twee keer gekies word nie.
function pj_teken_kies() {
  const kies = document.getElementById("pj-befondser-kies");
  if (!kies) return;
  const gekies = new Set(PJ.befondsers);
  const oor = PJ.kliente.filter((k) => !gekies.has(k.nommer));
  kies.innerHTML =
    `<option value="">${pj_t("pj_kies_klient", "Kies 'n kliënt")}</option>` +
    oor.map((k) => `<option value="${pj_ontsnap(k.nommer)}">${
      pj_ontsnap(k.nommer)} · ${pj_ontsnap(k.naam)}</option>`).join("");
}

function pj_voeg_befondser_by() {
  const kies = document.getElementById("pj-befondser-kies");
  const n = kies ? kies.value : "";
  if (!n || PJ.befondsers.includes(n)) return;
  PJ.befondsers.push(n);
  pj_teken_befondsers();
  pj_teken_kies();
}

/* ═══ nuwe kliënt binne die vorm ═══ */

function pj_nk_wissel(oop) {
  const blok = document.getElementById("pj-nk");
  if (!blok) return;
  blok.classList.toggle("oop", oop);
  document.getElementById("pj-nk-fout").style.display = "none";
  if (oop) {
    // IN 'N TOETSPROJEK IS DIE NUWE KLIENT OOK 'N TOETS. Die TOETS staan reeds
    // in die veld; 'n mens tik net die res. So gaan hy saam met die projek weg
    // wanneer die toetse opgeruim word.
    const projeknaam = document.getElementById("pj-naam").value;
    document.getElementById("pj-nk-naam").value = /^\s*TOETS\b/.test(projeknaam) ? "TOETS " : "";
    document.getElementById("pj-nk-epos").value = "";
    document.getElementById("pj-nk-soort").value = "instansie";
    document.getElementById("pj-nk-naam").focus();
  }
}

async function pj_nk_skep() {
  const naam = document.getElementById("pj-nk-naam").value.trim();
  const fout = document.getElementById("pj-nk-fout");
  if (!naam) {
    fout.textContent = pj_t("pj_naam_kort", "Die naam is verpligtend.");
    fout.style.display = "";
    return;
  }
  const soort = document.getElementById("pj-nk-soort").value === "privaat" ? "privaat" : "instansie";
  const epos = document.getElementById("pj-nk-epos").value.trim();

  const knop = document.getElementById("pj-nk-skep");
  knop.disabled = true;
  try {
    const uit = await pj_vra("stoor-klient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam, soort, epos }),
    });
    // Uit die antwoord, nie uit 'n herlaai nie: list() loop agter.
    PJ.kliente.push({ nommer: uit.nommer, naam, soort });
    PJ.kliente.sort((a, b) => a.naam.localeCompare(b.naam, "af-ZA"));
    PJ.befondsers.push(uit.nommer);
    pj_teken_befondsers();
    pj_teken_kies();
    pj_nk_wissel(false);
  } catch (f) {
    fout.textContent = String(f.message || f);
    fout.style.display = "";
  } finally {
    knop.disabled = false;
  }
}

/* ═══ die vorm ═══ */

function pj_maak_vorm_oop(id) {
  const p = id ? PJ.projekte.find((x) => x.id === id) : null;
  PJ.wysig = p ? p.id : null;
  PJ.befondsers = p ? (p.befondsers || []).map((b) => b.nommer) : [];

  document.getElementById("pj-vorm-titel").textContent = p
    ? pj_t("pj_wysig_titel", "Wysig projek")
    : pj_t("pj_nuwe_titel", "Nuwe projek");
  document.getElementById("pj-naam").value = p ? p.naam : "";
  document.getElementById("pj-nota").value = p ? p.nota || "" : "";

  pj_teken_befondsers();
  pj_teken_kies();
  pj_nk_wissel(false);

  document.getElementById("pj-vorm-fout").style.display = "none";
  document.getElementById("pj-vorm").classList.add("oop");
  document.getElementById("pj-naam").focus();
}

function pj_maak_vorm_toe() {
  document.getElementById("pj-vorm").classList.remove("oop");
  PJ.wysig = null;
  PJ.befondsers = [];
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
        befondsers: PJ.befondsers,
        nota: document.getElementById("pj-nota").value.trim(),
      }),
    });
    pj_maak_vorm_toe();
    await pj_laai();
  } catch (fout) {
    // Die bediener se woorde, nie 'n eie vertaling nie: hy se watter reel val.
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
      const n = Number(uitslag.verwysings) || 0;
      window.alert(
        pj_t("pj_gedeaktiveer",
          "Hierdie projek word deur {n} inskrywings gebruik en is gedeaktiveer. " +
          "Bestaande inskrywings bly onveranderd; die projek verskyn nie meer in keuselyste nie.")
          .replace("{n}", n));
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
      .map((k) => ({ nommer: k.nommer, naam: k.naam || "", soort: k.soort || "instansie" }));
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
    // faktuurpaneel-toetse.js luister hierna om sy blok te wys of te versteek.
    document.dispatchEvent(new CustomEvent("pj-gelaai", { detail: PJ.projekte }));
  } catch (fout) {
    console.error("Kon nie die projekte laai nie:", fout);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${pj_t(
        "pj_laai_fout", "Kon nie die projekte laai nie.")}</p>`;
    }
  }
}

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
  document.getElementById("pj-befondser-voeg").addEventListener("click", pj_voeg_befondser_by);
  document.getElementById("pj-nk-oop").addEventListener("click", () => pj_nk_wissel(true));
  document.getElementById("pj-nk-kanselleer").addEventListener("click", () => pj_nk_wissel(false));
  document.getElementById("pj-nk-skep").addEventListener("click", pj_nk_skep);

  const oorlegsel = document.getElementById("pj-vorm");
  oorlegsel.addEventListener("click", (ev) => {
    if (ev.target === oorlegsel) pj_maak_vorm_toe();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && oorlegsel.classList.contains("oop")) pj_maak_vorm_toe();
  });

  await Promise.all([pj_laai_kliente(), pj_laai()]);
});
