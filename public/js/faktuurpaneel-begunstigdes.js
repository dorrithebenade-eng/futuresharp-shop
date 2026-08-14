// public/js/faktuurpaneel-begunstigdes.js
//
// Die begunstigderegister op Boekhouding se Registers-blad.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. faktuurpaneel.js hanteer die sessie en
// die pille; faktuurpaneel-kliente.js vul die kliëntedeel; hierdie een die
// begunstigdes. Dieselfde patroon, eie prefiks.
//
// DIE NUWE REKORD WORD PLAASLIK BYGEVOEG ná die stoor, nie weer gevra nie.
// Blobs se list() loop sowat vier sekondes agter, en 'n pas geskepte
// begunstigde sou lyk of hy nie gestoor is nie.
//
// 'N BEGUNSTIGDE IS NIE 'N AANBIEDER NIE. Dieselfde mens bied die een keer
// 'n werkswinkel aan en kry die ander keer bloot sy reiskoste terug. Wat
// vasstaan, is dat hy geld ontvang — en dit is wat die register dra.

const BG = {
  lys: [],
  sessie: null,
  wysig: null,   // die begunstigde_id wat gewysig word, of null vir 'n nuwe
};

function bg_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

// Alle teks wat van buite kom, gaan hierdeur voordat dit in innerHTML beland.
function bg_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function bg_vra(pad, opsies) {
  const o = opsies || {};
  const resp = await fetch("/.netlify/functions/" + pad, {
    method: o.metode || "GET",
    headers: {
      Authorization: `Bearer ${BG.sessie.access_token}`,
      ...(o.liggaam ? { "Content-Type": "application/json" } : {}),
    },
    ...(o.liggaam ? { body: JSON.stringify(o.liggaam) } : {}),
  });
  if (!resp.ok) {
    const fout = new Error(`Status ${resp.status}`);
    fout.status = resp.status;
    throw fout;
  }
  return resp.status === 204 ? null : resp.json();
}

// Dieselfde slug as skep-begunstigde.js. Word gebruik om 'n vars geskepte
// rekord plaaslik by die lys te voeg voordat die bediener weer gevra word.
function bg_slug(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- die lys ----------

function bg_pas(b, soek) {
  if (!soek) return true;
  const q = soek.toLowerCase().replace(/\s/g, "");
  const k = b.kontak_inligting || {};
  return [b.naam, k.epos, k.selfoon, b.subrekening_kode]
    .some((v) => (v || "").toLowerCase().replace(/\s/g, "").includes(q));
}

function bg_teken_lys() {
  const plek = document.getElementById("bg-lys");
  if (!plek) return;

  const soek = (document.getElementById("bg-soek") || {}).value || "";
  const lys = BG.lys.filter((b) => bg_pas(b, soek.trim()));

  const hulp = document.getElementById("bg-hulp");
  if (hulp) {
    hulp.textContent = soek.trim()
      ? lys.length + " " + bg_t(lys.length === 1 ? "bg_pas_een" : "bg_pas_meer",
          lys.length === 1 ? "begunstigde pas" : "begunstigdes pas")
      : BG.lys.length + " " + bg_t(BG.lys.length === 1 ? "bg_een" : "bg_meer",
          BG.lys.length === 1 ? "begunstigde" : "begunstigdes");
  }

  if (!lys.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${
      BG.lys.length
        ? bg_t("bg_geen_pas", "Geen begunstigde pas nie.")
        : bg_t("bg_geen", "Daar is nog geen begunstigdes nie.")
    }</p>`;
    return;
  }

  plek.innerHTML = lys.map((b) => {
    const k = b.kontak_inligting || {};
    // Die onderste reël wys die KODE self, nie 'n woord soos "aktief" nie.
    // Dit is wat 'n mens teen Paystack se paneel nagaan, en in monospasie
    // val 'n verkeerde karakter op.
    const kode = b.subrekening_kode
      ? `<span class="fk-kode">${bg_ontsnap(b.subrekening_kode)}</span>`
      : bg_ontsnap(bg_t("bg_geen_kode", "Geen subrekening"));

    const onder = [k.epos, k.selfoon].filter(Boolean)
      .map(bg_ontsnap).concat([kode]).join(" &middot; ");

    return `
    <div class="fk-ry" data-id="${bg_ontsnap(b.begunstigde_id)}">
      <div class="fk-ry-naam">${bg_ontsnap(b.naam)}
        ${!b.subrekening_kode
          ? `<span class="fk-merkie">${bg_t("bg_wag", "Wag vir subrekening")}</span>` : ""}
        ${b.ook_outeur
          ? `<span class="fk-merkie fk-merkie-outeur">${bg_t("bg_ook_outeur", "Ook outeur")}</span>` : ""}
      </div>
      <div class="fk-ry-onder">${onder}</div>
    </div>`;
  }).join("");

  plek.querySelectorAll(".fk-ry").forEach((ry) =>
    ry.addEventListener("click", () => bg_maak_vorm_oop(ry.getAttribute("data-id"))));
}

// ---------- die vorm ----------

function bg_maak_vorm_oop(id) {
  BG.wysig = id || null;
  const b = BG.lys.find((x) => x.begunstigde_id === id) ||
    { naam: "", subrekening_kode: "", kontak_inligting: {} };
  const k = b.kontak_inligting || {};

  document.getElementById("bg-vorm-titel").textContent = id
    ? bg_t("bg_wysig", "Wysig begunstigde")
    : bg_t("bg_nuwe", "Nuwe begunstigde");

  document.getElementById("bg-naam").value = b.naam || "";
  document.getElementById("bg-epos").value = k.epos || "";
  document.getElementById("bg-selfoon").value = k.selfoon || "";
  document.getElementById("bg-adres").value = k.adres || "";
  document.getElementById("bg-kode").value = b.subrekening_kode || "";

  // Is die persoon reeds 'n outeur MET 'n kode, en dra sy begunstigde-rekord
  // nog niks nie, dan is die regte handeling om daardie kode oor te plak —
  // nie 'n tweede subrekening te skep nie. Paystack hou die eerste
  // uitbetaling na 'n nuwe subrekening terug tot iemand dit goedkeur, en die
  // bankbesonderhede hoort op een plek.
  const oorplak = document.getElementById("bg-oorplak");
  const bied_aan = b.ook_outeur && b.outeur_subrekening_kode && !b.subrekening_kode;
  oorplak.style.display = bied_aan ? "" : "none";
  if (bied_aan) {
    document.getElementById("bg-oorplak-kode").textContent = b.outeur_subrekening_kode;
    oorplak.setAttribute("data-kode", b.outeur_subrekening_kode);
  }

  bg_wys_fout("");
  document.getElementById("bg-vorm").classList.add("oop");
  document.getElementById("bg-naam").focus();
}

function bg_maak_vorm_toe() {
  document.getElementById("bg-vorm").classList.remove("oop");
  BG.wysig = null;
}

function bg_wys_fout(teks) {
  const p = document.getElementById("bg-vorm-fout");
  p.textContent = teks || "";
  p.style.display = teks ? "" : "none";
}

async function bg_stoor() {
  const naam = document.getElementById("bg-naam").value.trim();
  const kode = document.getElementById("bg-kode").value.trim();

  if (!naam) {
    bg_wys_fout(bg_t("bg_naam_verplig", "Die naam is verplig."));
    document.getElementById("bg-naam").focus();
    return;
  }
  // Dieselfde toets as die Function. Beter hier as 'n 400 ná die stoor.
  if (kode && kode.indexOf("ACCT_") !== 0) {
    bg_wys_fout(bg_t("bg_kode_fout", "Die subrekening-kode moet met ACCT_ begin."));
    document.getElementById("bg-kode").focus();
    return;
  }

  const liggaam = {
    naam,
    subrekening_kode: kode,
    kontak_inligting: {
      epos: document.getElementById("bg-epos").value.trim(),
      selfoon: document.getElementById("bg-selfoon").value.trim(),
      adres: document.getElementById("bg-adres").value.trim(),
    },
  };
  if (BG.wysig) liggaam.begunstigde_id = BG.wysig;

  const knoppie = document.getElementById("bg-stoor");
  knoppie.disabled = true;

  try {
    const uit = await bg_vra(BG.wysig ? "wysig-begunstigde" : "skep-begunstigde",
      { metode: "POST", liggaam });

    // Plaaslik by die lys voeg — sien die kop van die lêer. Die outeur-vlag
    // kom NIE uit skep/wysig nie; bg_verryk() haal hom net daarna.
    const bestaande = BG.lys.find((x) => x.begunstigde_id === uit.begunstigde_id);
    const rekord = {
      ...uit,
      ook_outeur: bestaande ? bestaande.ook_outeur : false,
      outeur_subrekening_kode: bestaande ? bestaande.outeur_subrekening_kode : "",
    };

    const ix = BG.lys.findIndex((x) => x.begunstigde_id === uit.begunstigde_id);
    if (ix >= 0) BG.lys[ix] = rekord; else BG.lys.push(rekord);
    BG.lys.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af"));

    bg_maak_vorm_toe();
    bg_teken_lys();
    await bg_verryk();
  } catch (f) {
    console.error("Kon nie die begunstigde stoor nie:", f);
    if (f.status === 409) {
      bg_wys_fout(bg_t("bg_bestaan", "Daar is reeds 'n begunstigde met daardie naam."));
    } else {
      bg_wys_fout(bg_t("bg_stoor_fout", "Kon nie stoor nie. Probeer weer."));
    }
  } finally {
    knoppie.disabled = false;
  }
}

// ---------- laai ----------

// Haal SLEGS die outeur-vlae oor na rekords wat ons reeds ken. Dit is nie 'n
// herlaai nie: die plaaslike lys bly die waarheid, want list() loop agter en
// 'n vars rekord sou verdwyn. Is hy nog nie in die antwoord nie, kom sy
// merkie by die volgende laai.
async function bg_verryk() {
  try {
    const uit = await bg_vra("kry-begunstigdes");
    (uit.begunstigdes || []).forEach((vars_rekord) => {
      const plaaslik = BG.lys.find((x) => x.begunstigde_id === vars_rekord.begunstigde_id);
      if (!plaaslik) return;
      plaaslik.ook_outeur = vars_rekord.ook_outeur;
      plaaslik.outeur_subrekening_kode = vars_rekord.outeur_subrekening_kode;
    });
    bg_teken_lys();
  } catch (f) {
    // Die merkie is 'n hulp, nie die rekord nie. Misluk dit, bly die lys staan.
    console.error("Kon nie die outeur-merkies verfris nie:", f);
  }
}

async function bg_laai() {
  const plek = document.getElementById("bg-lys");
  try {
    const uit = await bg_vra("kry-begunstigdes");
    BG.lys = uit.begunstigdes || [];
    bg_teken_lys();
  } catch (f) {
    console.error("Kon nie die begunstigdes laai nie:", f);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${
        bg_t("bg_laai_fout", "Kon nie die begunstigdes laai nie.")}</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("bg-lys")) return;

  try {
    BG.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    BG.sessie = null;
  }
  if (!BG.sessie || !identiteit_het_rol(BG.sessie.gebruiker, "boekhouding")) return;

  document.getElementById("bg-soek").addEventListener("input", bg_teken_lys);
  document.getElementById("bg-nuut").addEventListener("click", () => bg_maak_vorm_oop(null));
  document.getElementById("bg-kanselleer").addEventListener("click", bg_maak_vorm_toe);
  document.getElementById("bg-stoor").addEventListener("click", bg_stoor);

  document.getElementById("bg-oorplak").addEventListener("click", (ev) => {
    const kode = ev.currentTarget.getAttribute("data-kode") || "";
    document.getElementById("bg-kode").value = kode;
    ev.currentTarget.style.display = "none";
  });

  const oorlegsel = document.getElementById("bg-vorm");
  oorlegsel.addEventListener("click", (ev) => {
    if (ev.target === oorlegsel) bg_maak_vorm_toe();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && oorlegsel.classList.contains("oop")) bg_maak_vorm_toe();
  });

  await bg_laai();
});
