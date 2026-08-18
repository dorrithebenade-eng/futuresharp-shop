// public/js/klientvorm.js
//
// Die publieke kliëntvorm. Geen sessie, geen aanmelding, geen rol.
//
// DIE TAALSKAKELAAR HERLAAI NIE DIE BLADSY NIE. taal.js se stel_taal() doen
// 'n window.location.reload(), wat oral elders reg is: elke ander bladsy bou
// sy inhoud vars by laai. Hier tik iemand 'n adres in, en 'n herlaai gooi dit
// weg. Ons skryf dieselfde localStorage-sleutel, roep pas_i18n_toe() self, en
// teken die drie stukke wat nie data-i18n dra nie oor.
//
// Die vorm dra GEEN <form>-element nie: 'n Enter-druk in 'n teksveld sou dan
// die bladsy indien voordat die soort gekies is.

const KV = {
  soort: "instansie",
  besig: false,
  klaar: false,
};

function kv_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function kv_huidige_taal() {
  try {
    return window.kry_huidige_taal ? window.kry_huidige_taal() : "af";
  } catch (fout) {
    return "af";
  }
}

// ── Taal ────────────────────────────────────────────────────────────────

function kv_stel_taal(taal) {
  const sleutel = typeof TAAL_SLEUTEL !== "undefined" ? TAAL_SLEUTEL : "future_shop_taal";
  try {
    localStorage.setItem(sleutel, taal === "en" ? "en" : "af");
  } catch (fout) {
    // 'n Blaaier met stoorplek af. Die taal geld dan net vir hierdie bladsy,
    // wat presies genoeg is — die kliënt kom nie terug nie.
  }
  if (typeof pas_i18n_toe === "function") pas_i18n_toe();
  kv_teken_taal();
  kv_teken_dinamies();
}

function kv_teken_taal() {
  const huidige = kv_huidige_taal();
  document.querySelectorAll(".kv-taal-knop").forEach((b) =>
    b.classList.toggle("aan", b.getAttribute("data-kv-taal") === huidige));
  document.documentElement.lang = huidige === "en" ? "en" : "af";
  document.title = kv_t("kv_bladsy_titel", "Future Sharp");
}

// Die drie stukke wat van die SOORT afhang en dus nie 'n vaste data-i18n kan
// dra nie. Hulle word by elke taalwisseling én by elke soortwisseling oorgeteken.
function kv_teken_dinamies() {
  const privaat = KV.soort === "privaat";

  document.getElementById("kv-naam-etiket").textContent = privaat
    ? kv_t("kv_naam_privaat", "Naam en van")
    : kv_t("kv_naam_instansie", "Naam van die instansie");

  document.getElementById("kv-soort-hulp").textContent = privaat
    ? kv_t("kv_soort_hulp_privaat", "Jy betaal in jou eie naam.")
    : kv_t("kv_soort_hulp_instansie", "'n Skool, departement of maatskappy wat in sy eie naam betaal.");

  document.getElementById("kv-stuur").textContent = KV.besig
    ? kv_t("kv_stuur_besig", "Stuur tans \u2026")
    : kv_t("kv_stuur", "Stuur besonderhede");
}

// ── Soort ───────────────────────────────────────────────────────────────

// DIE KONTAKVELD VERDWYN HEELTEMAL BY 'N PRIVAAT KLIËNT. Hy is sy eie
// kontak, en 'n leë veld laat 'n mens wonder of hy iets mis. Dieselfde
// gedrag as faktuurpaneel-kliente.js, want dit is dieselfde rekord.
function kv_stel_soort(nuwe) {
  KV.soort = nuwe === "privaat" ? "privaat" : "instansie";
  const privaat = KV.soort === "privaat";

  document.querySelectorAll(".kv-soort-knop").forEach((b) =>
    b.classList.toggle("aan", b.getAttribute("data-soort") === KV.soort));

  document.getElementById("kv-kontak-ry").style.display = privaat ? "none" : "";
  document.getElementById("kv-naam").setAttribute("autocomplete", privaat ? "name" : "organization");

  kv_teken_dinamies();
}

// ── Foute ───────────────────────────────────────────────────────────────

function kv_veldfout(veld, wys) {
  document.getElementById("kv-" + veld).classList.toggle("fout", wys);
  document.getElementById("kv-" + veld + "-fout").classList.toggle("wys", wys);
}

function kv_boodskap(teks) {
  const el = document.getElementById("kv-boodskap");
  el.textContent = teks || "";
  el.classList.toggle("wys", !!teks);
}

function kv_geldige_epos(epos) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epos);
}

// ── Stuur ───────────────────────────────────────────────────────────────

async function kv_stuur() {
  if (KV.besig || KV.klaar) return;

  const naam = document.getElementById("kv-naam").value.trim();
  const epos = document.getElementById("kv-epos").value.trim();

  const naam_stukkend = !naam;
  const epos_stukkend = !kv_geldige_epos(epos);

  kv_veldfout("naam", naam_stukkend);
  kv_veldfout("epos", epos_stukkend);
  kv_boodskap("");

  if (naam_stukkend || epos_stukkend) {
    document.getElementById(naam_stukkend ? "kv-naam" : "kv-epos").focus();
    return;
  }

  const liggaam = {
    soort: KV.soort,
    naam,
    kontak: KV.soort === "privaat" ? "" : document.getElementById("kv-kontak").value.trim(),
    epos,
    selfoon: document.getElementById("kv-selfoon").value.trim(),
    adres: document.getElementById("kv-adres").value.trim(),
    // Die heuningpot. Vul 'n bot hom, keer die bediener stil — hy kry 'n
    // gewone 200 sodat daar niks is om teen te toets nie.
    webwerf: document.getElementById("kv-webwerf").value,
  };

  KV.besig = true;
  const knop = document.getElementById("kv-stuur");
  knop.disabled = true;
  kv_teken_dinamies();

  try {
    const antwoord = await fetch("/.netlify/functions/dien-klient-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(liggaam),
    });

    if (antwoord.status === 429) {
      throw new Error("koers");
    }
    if (!antwoord.ok) {
      throw new Error("bediener");
    }

    KV.klaar = true;
    document.getElementById("kv-vorm").style.display = "none";
    document.getElementById("kv-dankie").classList.add("wys");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (fout) {
    console.error("Kon nie die besonderhede stuur nie:", fout);
    kv_boodskap(
      fout && fout.message === "koers"
        ? kv_t("kv_fout_baie", "Te veel indienings uit hierdie netwerk. Probeer later weer.")
        : kv_t("kv_fout_stuur", "Kon nie stuur nie. Probeer weer.")
    );
  } finally {
    KV.besig = false;
    knop.disabled = false;
    kv_teken_dinamies();
  }
}

// ── Begin ───────────────────────────────────────────────────────────────

// taal.js pas sy data-i18n toe op DOMContentLoaded. Hierdie lêer laai NÁ
// taal.js, dus loop ons luisteraar daarna en oorteken is veilig.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".kv-taal-knop").forEach((b) =>
    b.addEventListener("click", () => kv_stel_taal(b.getAttribute("data-kv-taal"))));

  document.querySelectorAll(".kv-soort-knop").forEach((b) =>
    b.addEventListener("click", () => kv_stel_soort(b.getAttribute("data-soort"))));

  document.getElementById("kv-stuur").addEventListener("click", kv_stuur);

  // Die fout verdwyn sodra iemand die veld regmaak, nie eers by die volgende
  // stuur nie.
  document.getElementById("kv-naam").addEventListener("input", () => kv_veldfout("naam", false));
  document.getElementById("kv-epos").addEventListener("input", () => kv_veldfout("epos", false));

  kv_teken_taal();
  kv_stel_soort("instansie");
});
