// public/js/outeur-indien-leers.js
//
// Deel 7 se lêers, en die Dien in-knoppie.
//
// WAAROM 'N EIE LÊER: outeur-indien.js dra die vorm, die som en die
// outomatiese stoor. Dit werk. Hierdie een haak by dieselfde bladsy in en
// raak niks daarvan aan nie — hy lees die nommer uit die adres, roep
// iv_stoor() aan wanneer hy die konsep eers wil vasmaak, en niks meer nie.
//
// DIE LÊERS LAAI EERS BY DIEN IN OP. 'n PDF wat begin oplaai terwyl iemand
// tik, is nie 'n teksveld nie. Die keuse bly dus in die blaaier se geheue
// tot hy indien.
//
// DIE PRYS DAARVAN is dat 'n herlaai die gekose lêer verloor — die konsep
// onthou net sy NAAM. Ons wys dit dan as "Kies X weer", nie as 'n leë blok
// nie: hy moet sien wat hy gekies het en hoekom dit weer gevra word.
//
// STUKSGEWYS, want 'n Netlify Function se versoek is tot sowat 6MB beperk.
// 3MB per stuk, dieselfde as die paneelbord se e-boek-oplaai. Onderbreek
// dit, begin die oplaai oor met 'n vars opload_id — die bediener voeg
// stukke blindelings aaneen en kan nie halfpad hervat nie. Omdat die
// sleutel die vormnommer is, skryf die tweede poging bo-oor die eerste.

const IL_STUK_GROOTTE = 3 * 1024 * 1024;
const IL_MAKS_MANUSKRIP = 60 * 1024 * 1024;
const IL_MAKS_OMSLAG = 4 * 1024 * 1024;
const IL_BEELD_TIPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const il_toestand = {
  manuskrip: { leer: null, vorige_naam: null, vorige_grootte: 0, opgelaai: false, fout: null, vordering: -1 },
  omslag: { leer: null, vorige_naam: null, vorige_grootte: 0, opgelaai: false, fout: null, vordering: -1 },
};

let il_besig = false;
// 'n Ingediende vorm is toe. Die bediener weier in elk geval (409), maar 'n
// knoppie wat niks doen nie, is erger as geen knoppie nie.
let il_toe = false;

function il_t(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function il_ontsnap(teks) {
  return String(teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function il_grepe(n) {
  if (n < 1024) return n + " grepe";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
}

function il_stukke(n) {
  return Math.ceil(n / IL_STUK_GROOTTE);
}

// Die nommer kom uit die adres — outeur-indien.js sit dit daar met
// replaceState sodra die eerste stoor 'n nommer gekry het. Dit is
// betroubaarder as om oor lêergrense na 'n veranderlike te reik.
function il_nommer() {
  const uit_adres = new URLSearchParams(window.location.search).get("nommer");
  if (uit_adres) return uit_adres;
  const el = document.getElementById("iv-nommer");
  const teks = el ? el.textContent.trim() : "";
  return /^BV-\d{4}-\d{4}$/.test(teks) ? teks : null;
}

// --- Teken ---

function il_teken(soort) {
  const t = il_toestand[soort];
  const blok = document.getElementById("il-blok-" + soort);
  if (!blok) return;

  if (t.vordering >= 0 && t.leer) {
    const stukke = il_stukke(t.leer.size);
    const gedaan = Math.min(t.vordering + 1, stukke);
    blok.innerHTML =
      '<div class="il-gekies il-wag"><span class="il-ikoon">\u2b06</span>' +
      '<div class="il-teks"><div class="il-naam">' + il_ontsnap(t.leer.name) + "</div>" +
      '<div class="il-fyn">' + il_t("il_laai_op", "Laai op") + " \u2014 " +
      il_t("il_deel", "deel") + " " + gedaan + " " + il_t("il_van", "van") + " " + stukke + "</div>" +
      '<div class="il-balk"><i style="width:' + Math.round((gedaan / stukke) * 100) + '%"></i></div>' +
      "</div></div>";
    return;
  }

  if (t.opgelaai) {
    const naam = t.leer ? t.leer.name : t.vorige_naam;
    const grepe = t.leer ? t.leer.size : t.vorige_grootte;
    const grootte = grepe ? il_grepe(grepe) : "";
    blok.innerHTML =
      '<div class="il-gekies il-klaar"><span class="il-ikoon">\u2713</span>' +
      '<div class="il-teks"><div class="il-naam">' + il_ontsnap(naam) + "</div>" +
      '<div class="il-fyn">' + il_t("il_opgelaai", "Opgelaai") +
      (grootte ? " \u00b7 " + grootte : "") + "</div></div>" +
      (il_toe ? "" :
        '<button type="button" class="il-ruil" data-il-ruil="' + soort + '">' +
        il_t("il_kies_ander", "Kies 'n ander") + "</button>") + "</div>";
    return;
  }

  if (t.fout) {
    blok.innerHTML =
      '<div class="il-gekies il-fout"><span class="il-ikoon">!</span>' +
      '<div class="il-teks"><div class="il-naam">' +
      il_ontsnap(t.leer ? t.leer.name : t.vorige_naam || "") + "</div>" +
      '<div class="il-fyn">' + il_ontsnap(t.fout) + "</div></div>" +
      '<button type="button" class="il-ruil" data-il-ruil="' + soort + '">' +
      il_t("il_kies_ander", "Kies 'n ander") + "</button></div>";
    return;
  }

  if (t.leer) {
    let fyn = il_grepe(t.leer.size);
    if (soort === "manuskrip" && il_stukke(t.leer.size) > 1) {
      fyn += " \u00b7 " + il_stukke(t.leer.size) + " " + il_t("il_dele", "dele");
    }
    blok.innerHTML =
      '<div class="il-gekies"><span class="il-ikoon">\u25a4</span>' +
      '<div class="il-teks"><div class="il-naam">' + il_ontsnap(t.leer.name) + "</div>" +
      '<div class="il-fyn">' + fyn + " \u00b7 " +
      il_t("il_word_opgelaai", "word opgelaai wanneer jy indien") + "</div></div>" +
      '<button type="button" class="il-ruil" data-il-ruil="' + soort + '">' +
      il_t("il_kies_ander", "Kies 'n ander") + "</button></div>";
    return;
  }

  if (t.vorige_naam) {
    blok.innerHTML =
      '<div class="il-val" tabindex="0" role="button" data-il-kies="' + soort + '">' +
      '<span class="il-val-knop">' + il_t("il_kies_weer", "Kies weer") + "</span>" +
      "<small>" + il_ontsnap(t.vorige_naam) + " \u2014 " +
      il_t("il_nie_gestoor", "die lêer self is nie gestoor nie, net sy naam") + "</small></div>";
    return;
  }

  if (il_toe) {
    blok.innerHTML =
      '<div class="il-gekies"><span class="il-ikoon">\u2014</span>' +
      '<div class="il-teks"><div class="il-fyn">' +
      il_t("il_geen_leer", "Geen lêer") + "</div></div></div>";
    return;
  }

  blok.innerHTML =
    '<div class="il-val" tabindex="0" role="button" data-il-kies="' + soort + '">' +
    '<span class="il-val-knop">' +
    (soort === "manuskrip"
      ? il_t("il_kies_manuskrip", "Kies die manuskrip")
      : il_t("il_kies_omslag", "Kies die omslag")) +
    "</span><small>" + il_t("il_sleep", "of sleep hom hierheen") + "</small></div>";
}

// --- Die keuse ---

function il_neem(soort, leer) {
  if (!leer) return;
  const t = il_toestand[soort];

  if (soort === "manuskrip") {
    if (leer.type !== "application/pdf") {
      t.leer = leer; t.opgelaai = false;
      t.fout = il_t("il_nie_pdf", "Dit is nie 'n PDF nie.");
      il_teken(soort); return;
    }
    if (leer.size > IL_MAKS_MANUSKRIP) {
      t.leer = leer; t.opgelaai = false;
      t.fout = il_t("il_te_groot_60", "Te groot \u2014 hoogstens 60 MB.");
      il_teken(soort); return;
    }
  } else {
    if (IL_BEELD_TIPES.indexOf(leer.type) === -1) {
      t.leer = leer; t.opgelaai = false;
      t.fout = il_t("il_verkeerde_beeld", "Slegs JPEG, PNG, WEBP of GIF.");
      il_teken(soort); return;
    }
    if (leer.size > IL_MAKS_OMSLAG) {
      t.leer = leer; t.opgelaai = false;
      t.fout = il_t("il_te_groot_4", "Te groot \u2014 hoogstens 4 MB.");
      il_teken(soort); return;
    }
  }

  t.leer = leer;
  t.vorige_naam = leer.name;
  t.fout = null;
  t.opgelaai = false;
  t.vordering = -1;
  il_teken(soort);
  il_wys_kort([]);
}

// --- Die oplaai ---

function il_lees_stuk(stuk) {
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onload = () => {
      const volledig = leser.result;
      resolve(volledig.slice(volledig.indexOf(",") + 1));
    };
    leser.onerror = () => reject(leser.error);
    leser.readAsDataURL(stuk);
  });
}

async function il_laai_op(soort, nommer, token) {
  const t = il_toestand[soort];
  if (!t.leer) return true;      // reeds opgelaai in 'n vorige rondte
  if (t.opgelaai) return true;

  const stukke = il_stukke(t.leer.size);
  const opload_id = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(36).slice(2);

  try {
    for (let i = 0; i < stukke; i++) {
      t.vordering = i;
      t.fout = null;
      il_teken(soort);

      const begin = i * IL_STUK_GROOTTE;
      const data_base64 = await il_lees_stuk(t.leer.slice(begin, begin + IL_STUK_GROOTTE));

      const resp = await fetch("/.netlify/functions/laai-indiening-leer-op", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nommer,
          soort,
          opload_id,
          stuk_indeks: i,
          is_laaste: i === stukke - 1,
          data_base64,
          inhoud_tipe: t.leer.type,
          naam: t.leer.name,
        }),
      });

      if (!resp.ok) {
        const teks = await resp.text();
        throw new Error(teks || "Status " + resp.status);
      }
    }

    t.vordering = -1;
    t.opgelaai = true;
    il_teken(soort);
    return true;
  } catch (fout) {
    console.error("Kon nie die lêer oplaai nie:", fout);
    t.vordering = -1;
    t.fout = il_t("il_onderbreek", "Die oplaai het onderbreek \u2014 kies Dien in weer.");
    il_teken(soort);
    return false;
  }
}

// --- Wat kort nog ---

const IL_KORT_TEKS = {
  titel: ["il_kort_titel", "Die titel in Deel 1 moet ingevul wees."],
  formaat: ["il_kort_formaat", "Ten minste een formaat in Deel 4 moet aangedui wees, met 'n bedrag."],
  manuskrip: ["il_kort_manuskrip", "Die manuskrip moet gekies wees."],
  omslag: ["il_kort_omslag", "Die omslag moet gekies wees."],
  bevestigings: ["il_kort_bevestigings", "Al drie bevestigings in Deel 8 moet gemerk wees."],
};

function il_wys_kort(lys) {
  const blok = document.getElementById("il-kort");
  const ul = document.getElementById("il-kort-lys");
  if (!blok || !ul) return;

  if (!lys.length) { blok.hidden = true; return; }

  ul.innerHTML = lys
    .map((k) => {
      const paar = IL_KORT_TEKS[k];
      return "<li>" + il_ontsnap(paar ? il_t(paar[0], paar[1]) : k) + "</li>";
    })
    .join("");
  blok.hidden = false;
  blok.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Dieselfde toets as dien-in.js, hier sodat hy nie 'n rondte na die
// bediener hoef te loop om te hoor wat hy self kan sien nie. Die bediener
// bly die werklike grens.
function il_kort_plaaslik() {
  const kort = [];
  const titel = document.querySelector('[data-veld="titel"]');
  if (!titel || !titel.value.trim()) kort.push("titel");

  const m = il_toestand.manuskrip;
  const o = il_toestand.omslag;
  if ((!m.leer && !m.opgelaai) || m.fout) kort.push("manuskrip");
  if ((!o.leer && !o.opgelaai) || o.fout) kort.push("omslag");

  const het_formaat = ["eboek", "hardekopie", "leen"].some((s) => {
    const aan = document.getElementById("iv-aan-" + s);
    const veld = document.querySelector('[data-veld="formate.' + s + '.invoer"]');
    return aan && aan.checked && veld && Number(veld.value) > 0;
  });
  if (!het_formaat) kort.push("formaat");

  const bev = ["bevestigings.skepper", "bevestigings.kopiereg", "bevestigings.korrek"];
  const almal = bev.every((pad) => {
    const el = document.querySelector('[data-veld="' + pad + '"]');
    return el && el.checked;
  });
  if (!almal) kort.push("bevestigings");

  return kort;
}

// --- Dien in ---

// 'n Ingediende vorm het EEN handeling: Onttrek. "Dien in" verdwyn — die
// staaf bo sê reeds Ingedien, en 'n dooie groen knoppie trek die oog weg van
// die een wat werk.
function il_wys_toe_knoppies() {
  const dien = document.getElementById("il-dien-in");
  if (dien) dien.style.display = "none";

  const stoor = document.getElementById("iv-stoor");
  if (stoor) stoor.style.display = "none";

  const ont = document.getElementById("il-onttrek");
  if (ont) {
    ont.style.display = "inline-block";
    ont.classList.add("oi-hoof");
  }
}

function il_stel_stand(klas, teks) {
  const el = document.getElementById("iv-stand");
  if (!el) return;
  el.className = "iv-stand " + klas;
  el.textContent = teks;
}

async function il_dien_in() {
  if (il_besig) return;

  const kort = il_kort_plaaslik();
  if (kort.length) { il_wys_kort(kort); return; }
  il_wys_kort([]);

  const knop = document.getElementById("il-dien-in");
  il_besig = true;
  if (knop) { knop.disabled = true; knop.textContent = il_t("il_besig", "Besig om in te dien"); }

  const herstel = (klas, teks) => {
    il_besig = false;
    if (knop) { knop.disabled = false; knop.textContent = il_t("il_dien_in", "Dien in"); }
    il_stel_stand(klas, teks);
  };

  // Eers die konsep vasmaak — sonder 'n nommer is daar niks om aan te heg nie.
  if (typeof iv_stoor === "function") {
    try { await iv_stoor(true); } catch (fout) { console.error(fout); }
  }

  const nommer = il_nommer();
  if (!nommer) {
    herstel("fout", il_t("il_geen_nommer", "Die vorm moet eers stoor voordat dit ingedien kan word."));
    return;
  }

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) {
    herstel("fout", il_t("il_indien_fout", "Kon nie indien nie \u2014 probeer weer."));
    return;
  }

  il_stel_stand("besig", il_t("il_laai_leers", "Laai die lêers op"));

  let ok = await il_laai_op("manuskrip", nommer, sessie.access_token);
  if (ok) ok = await il_laai_op("omslag", nommer, sessie.access_token);

  if (!ok) {
    herstel("fout", il_t("il_indien_nie_deur", "Die indiening het nie deurgegaan nie."));
    return;
  }

  try {
    const resp = await fetch("/.netlify/functions/dien-in", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessie.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nommer }),
    });

    if (resp.status === 422) {
      const uit = await resp.json();
      il_wys_kort(uit.kort || []);
      herstel("", il_t("iv_stoor_outomaties", "Word outomaties gestoor terwyl jy tik"));
      return;
    }

    if (!resp.ok) {
      herstel("fout", il_t("il_indien_fout", "Kon nie indien nie \u2014 probeer weer."));
      return;
    }

    const uit = await resp.json();
    il_besig = false;
    il_toe = true;
    il_stel_stand("klaar", il_t("il_ingedien", "Ingedien"));

    il_wys_toe_knoppies();
    ["manuskrip", "omslag"].forEach(il_teken);

    // Die vorm is toe. Wat hy nou tik, sal die bediener in elk geval weier.
    document.querySelectorAll("#iv-vorm input, #iv-vorm select, #iv-vorm textarea")
      .forEach((el) => { el.disabled = true; });

    console.log("Ingedien:", uit.nommer, uit.stand);
  } catch (fout) {
    console.error("Kon nie indien nie:", fout);
    herstel("fout", il_t("il_indien_fout", "Kon nie indien nie \u2014 probeer weer."));
  }
}

// --- Onttrek ---
//
// Hy trek terug om iets reg te maak, nie om oor te begin nie. Die lêers en
// die hangende voorstel bly staan; net die stand skuif. Daarna herlaai ons
// die bladsy — die vorm kom vars terug as 'n konsep, met alles nog daar.

async function il_onttrek() {
  if (il_besig) return;
  const nommer = il_nommer();
  if (!nommer) return;

  const knop = document.getElementById("il-onttrek");
  il_besig = true;
  if (knop) { knop.disabled = true; knop.textContent = il_t("il_onttrek_besig", "Onttrek \u2026"); }

  try {
    const sessie = await identiteit_kry_huidige_sessie();
    if (!sessie || !sessie.access_token) throw new Error("Geen sessie");

    const resp = await fetch("/.netlify/functions/onttrek", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessie.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nommer }),
    });

    if (!resp.ok) throw new Error(await resp.text());

    window.location.reload();
  } catch (fout) {
    console.error("Kon nie onttrek nie:", fout);
    il_besig = false;
    if (knop) { knop.disabled = false; knop.textContent = il_t("il_onttrek", "Onttrek"); }
    il_stel_stand("fout", il_t("il_onttrek_fout", "Kon nie onttrek nie \u2014 probeer weer."));
  }
}

// --- Wat reeds opgelaai is ---

async function il_laai_bestaande(nommer) {
  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) return;

  try {
    const resp = await fetch(
      "/.netlify/functions/kry-my-indienings?nommer=" + encodeURIComponent(nommer),
      { headers: { Authorization: `Bearer ${sessie.access_token}` } }
    );
    if (!resp.ok) return;

    const rekord = await resp.json();
    const leers = rekord.leers || {};

    if (rekord.stand === "ingedien" || rekord.stand === "wysiging") il_toe = true;

    ["manuskrip", "omslag"].forEach((soort) => {
      if (!leers[soort]) return;
      il_toestand[soort].vorige_naam = leers[soort].naam || "";
      il_toestand[soort].vorige_grootte = Number(leers[soort].grootte) || 0;
      il_toestand[soort].opgelaai = true;
      il_teken(soort);
    });

    if (il_toe) {
      ["manuskrip", "omslag"].forEach(il_teken);
      il_wys_toe_knoppies();
      document.querySelectorAll("#iv-vorm input, #iv-vorm select, #iv-vorm textarea")
        .forEach((el) => { el.disabled = true; });
    }
  } catch (fout) {
    console.error("Kon nie die lêers laai nie:", fout);
  }
}

// --- Koppelings ---

document.addEventListener("outeur-gereed", () => {
  il_teken("manuskrip");
  il_teken("omslag");

  ["manuskrip", "omslag"].forEach((soort) => {
    const invoer = document.getElementById("il-in-" + soort);
    if (!invoer) return;
    invoer.addEventListener("change", (e) => {
      il_neem(soort, e.target.files && e.target.files[0]);
      e.target.value = "";
    });
  });

  const knop = document.getElementById("il-dien-in");
  if (knop) knop.addEventListener("click", il_dien_in);

  const ont = document.getElementById("il-onttrek");
  if (ont) ont.addEventListener("click", il_onttrek);

  const gevra = new URLSearchParams(window.location.search).get("nommer");
  if (gevra) il_laai_bestaande(gevra);
});

document.addEventListener("click", (e) => {
  const kies = e.target.closest("[data-il-kies]");
  if (kies) {
    const invoer = document.getElementById("il-in-" + kies.getAttribute("data-il-kies"));
    if (invoer) invoer.click();
    return;
  }
  const ruil = e.target.closest("[data-il-ruil]");
  if (ruil) {
    const invoer = document.getElementById("il-in-" + ruil.getAttribute("data-il-ruil"));
    if (invoer) invoer.click();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const kies = e.target.closest("[data-il-kies]");
  if (!kies) return;
  e.preventDefault();
  const invoer = document.getElementById("il-in-" + kies.getAttribute("data-il-kies"));
  if (invoer) invoer.click();
});

document.addEventListener("dragover", (e) => {
  const val = e.target.closest("[data-il-kies]");
  if (val) { e.preventDefault(); val.classList.add("il-oor"); }
});

document.addEventListener("dragleave", (e) => {
  const val = e.target.closest("[data-il-kies]");
  if (val) val.classList.remove("il-oor");
});

document.addEventListener("drop", (e) => {
  const val = e.target.closest("[data-il-kies]");
  if (!val) return;
  e.preventDefault();
  val.classList.remove("il-oor");
  il_neem(val.getAttribute("data-il-kies"), e.dataTransfer.files && e.dataTransfer.files[0]);
});
