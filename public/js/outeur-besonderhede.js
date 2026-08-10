// public/js/outeur-besonderhede.js
//
// Die "My besonderhede"-afdeling van die outeurspaneelbord.
//
// EIE LÊER, soos outeur-titels.js en outeur-indienings.js: outeur.js
// hanteer aanmelding en stuur `outeur-gereed` sodra die outeur bevestig is.
//
// GEEN EIE OPROEP OM TE LAAI. Alles wat hierdie skerm wys, kom saam met
// daardie gebeurtenis — kry-my-outeur.js gee reeds die naam, die kontak, die
// verdoeselde rekeningnommer en die kennisgewings terug. 'n Tweede oproep
// sou dieselfde antwoord vra en die skerm 'n oomblik leeg laat.
//
// DIE SKERM IS GROOTLIKS LEES. Net drie dinge is 'n keuse: die
// verkoopkennisgewing, die selfoon en die adres. Twee kaarte, twee
// stoorknoppies, elk wat net sy eie deel stuur.
//
// DIE KNOPPIE BEGIN DOOF en word eers beskikbaar wanneer iets werklik
// anders is as wat gestoor is. Dit is hoe die outeur weet of daar nog iets
// uitstaande is sonder om te raai.

const MB_FUNKSIE = "/.netlify/functions/stoor-my-besonderhede";
const MB_EPOS = "futureshop@futuresharp.co.za";

// Wat op die bediener staan. Elke geslaagde stoor werk dit by; die knoppies
// meet daarteen.
const mb_gestoor = { by_verkoop: true, selfoon: "", adres: "" };

function mb_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function mb_el(id) {
  return document.getElementById(id);
}

// Wys die eerste ses syfers — geboortedatum, wat hy in elk geval van homself
// weet — en verdoesel die res. Die groepering volg die ID self (6 4 3), dus
// sien hy dat die hele nommer daar is sonder dat dit op die skerm staan.
function mb_verdoesel_id(nommer) {
  const skoon = String(nommer || "").replace(/\s+/g, "");
  if (!skoon) return "";
  if (skoon.length <= 6) return skoon;

  const oor = skoon.length - 6;
  const eerste = "\u2022".repeat(Math.min(4, oor));
  const tweede = oor > 4 ? " " + "\u2022".repeat(oor - 4) : "";
  return skoon.slice(0, 6) + " " + eerste + tweede;
}

// 'n Leë waarde is nie 'n fout nie — dit is net nie verskaf nie, en dit lees
// anders as 'n waarde. Vandaar die eie klas eerder as 'n strepie.
function mb_stel_ry(id, waarde) {
  const el = mb_el(id);
  if (!el) return;

  const teks = String(waarde || "").trim();
  el.classList.toggle("mb-leeg", !teks);
  el.textContent = teks || mb_vertaal("ob_nie_verskaf", "nie verskaf nie");
}

function mb_stel_uitbetaling(gereed) {
  const el = mb_el("mb-w-uitbetaling");
  if (!el) return;

  el.textContent = "";
  el.classList.remove("mb-leeg");

  if (gereed) {
    const pil = document.createElement("span");
    pil.className = "mb-gereed";
    pil.textContent = mb_vertaal("ob_gereed", "Gereed");
    el.appendChild(pil);
    return;
  }

  el.textContent = mb_vertaal("ob_wag", "Word opgestel");
}

// Dieselfde patroon as outeur.js se statusboodskap: die vertaalde sin word
// met DOM-nodes gebou en die adres word klikbaar. data-i18n sou die skakel
// uitwis, want dit vervang die element se textContent.
function mb_skryf_vas_nota() {
  const el = mb_el("mb-vas-nota");
  if (!el) return;

  const teks = mb_vertaal(
    "ob_vas_nota",
    "Hierdie besonderhede raak jou ooreenkoms en jou uitbetalings, en word daarom nie hier verander nie. Stuur 'n e-pos aan futureshop@futuresharp.co.za en dit word vir jou reggemaak."
  );

  el.textContent = "";
  const posisie = teks.indexOf(MB_EPOS);

  if (posisie === -1) {
    el.textContent = teks;
    return;
  }

  el.appendChild(document.createTextNode(teks.slice(0, posisie)));

  const skakel = document.createElement("a");
  skakel.href = `mailto:${MB_EPOS}`;
  skakel.textContent = MB_EPOS;
  el.appendChild(skakel);

  el.appendChild(document.createTextNode(teks.slice(posisie + MB_EPOS.length)));
}

// --- Vul die skerm ---

function mb_vul(data) {
  const kontak = (data && data.kontak_inligting) || {};
  const kennisgewings = (data && data.kennisgewings) || {};

  // Geen inskrywing beteken aan: die pos is die verstek, en 'n outeur wat
  // nog nooit gekies het nie, hoor van sy verkope.
  mb_gestoor.by_verkoop = kennisgewings.by_verkoop !== false;
  mb_gestoor.selfoon = kontak.selfoon || "";
  mb_gestoor.adres = kontak.adres || "";

  const merk = mb_el("mb-verkoop");
  if (merk) merk.checked = mb_gestoor.by_verkoop;

  const selfoon = mb_el("mb-selfoon");
  if (selfoon) selfoon.value = mb_gestoor.selfoon;

  const adres = mb_el("mb-adres");
  if (adres) adres.value = mb_gestoor.adres;

  mb_stel_ry("mb-w-naam", data && data.naam);
  mb_stel_ry("mb-w-epos", kontak.epos);
  mb_stel_ry("mb-w-id", mb_verdoesel_id(kontak.id_nommer));
  mb_stel_ry("mb-w-btw", kontak.btw_nommer);
  mb_stel_ry("mb-w-bank", kontak.bank_naam);
  mb_stel_ry("mb-w-takkode", kontak.bank_tak_kode);
  // Reeds verdoesel deur kry-my-outeur.js — die volle nommer verlaat nooit
  // die bediener nie.
  mb_stel_ry("mb-w-rekening", kontak.bank_rekeningnommer);
  mb_stel_uitbetaling(Boolean(data && data.uitbetaling_gereed));

  mb_skryf_vas_nota();
  mb_kyk_kennis();
  mb_kyk_kontak();
}

// --- Wat verander het ---

function mb_stel_knoppie(knoppie_id, nota_id, anders) {
  const knoppie = mb_el(knoppie_id);
  if (knoppie) knoppie.disabled = !anders;

  // Die bevestiging verdwyn sodra hy weer iets verander — sy sou andersins
  // by 'n nuwe waarde bly staan en sê dit is gestoor.
  const nota = mb_el(nota_id);
  if (anders && nota) {
    nota.textContent = "";
    nota.className = "mb-stoor-nota";
  }
}

function mb_kyk_kennis() {
  const merk = mb_el("mb-verkoop");
  if (!merk) return;
  mb_stel_knoppie("mb-stoor-kennis", "mb-nota-kennis", merk.checked !== mb_gestoor.by_verkoop);
}

function mb_kyk_kontak() {
  const selfoon = mb_el("mb-selfoon");
  const adres = mb_el("mb-adres");
  if (!selfoon || !adres) return;

  const anders =
    selfoon.value.trim() !== mb_gestoor.selfoon || adres.value.trim() !== mb_gestoor.adres;
  mb_stel_knoppie("mb-stoor-kontak", "mb-nota-kontak", anders);
}

// --- Stoor ---

function mb_tyd_nou() {
  const t = new Date();
  return (
    String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0")
  );
}

async function mb_stoor(deel) {
  const is_kennis = deel === "kennis";
  const knoppie_id = is_kennis ? "mb-stoor-kennis" : "mb-stoor-kontak";
  const nota_id = is_kennis ? "mb-nota-kennis" : "mb-nota-kontak";

  const knoppie = mb_el(knoppie_id);
  const nota = mb_el(nota_id);

  const merk = mb_el("mb-verkoop");
  const selfoon = mb_el("mb-selfoon");
  const adres = mb_el("mb-adres");

  const las = is_kennis
    ? { kennisgewings: { by_verkoop: Boolean(merk && merk.checked) } }
    : {
        kontak: {
          selfoon: selfoon ? selfoon.value.trim() : "",
          adres: adres ? adres.value.trim() : "",
        },
      };

  if (knoppie) knoppie.disabled = true;
  if (nota) {
    nota.className = "mb-stoor-nota";
    nota.textContent = mb_vertaal("ob_stoor_besig", "Stoor\u2026");
  }

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) {
    if (typeof wys_sessie_verval === "function") {
      wys_sessie_verval(mb_el("outeur-besonderhede-status"), "/outeur.html");
    }
    if (nota) nota.textContent = "";
    return;
  }

  try {
    const resp = await fetch(MB_FUNKSIE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessie.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(las),
    });

    if (resp.status === 401) {
      if (typeof wys_sessie_verval === "function") {
        wys_sessie_verval(mb_el("outeur-besonderhede-status"), "/outeur.html");
      }
      if (nota) nota.textContent = "";
      return;
    }

    if (!resp.ok) {
      if (nota) {
        nota.className = "mb-stoor-nota mb-fout";
        nota.textContent = mb_vertaal("ob_stoor_fout", "Kon nie stoor nie");
      }
      // Die knoppie moet beskikbaar bly — daar is nog iets ongestoor.
      if (is_kennis) mb_kyk_kennis();
      else mb_kyk_kontak();
      return;
    }

    const antwoord = await resp.json();

    if (antwoord.kennisgewings) {
      mb_gestoor.by_verkoop = antwoord.kennisgewings.by_verkoop !== false;
      if (merk) merk.checked = mb_gestoor.by_verkoop;
    }
    if (antwoord.kontak) {
      mb_gestoor.selfoon = antwoord.kontak.selfoon || "";
      mb_gestoor.adres = antwoord.kontak.adres || "";
      if (selfoon) selfoon.value = mb_gestoor.selfoon;
      if (adres) adres.value = mb_gestoor.adres;
    }

    if (nota) {
      nota.className = "mb-stoor-nota mb-ok";
      nota.textContent = mb_vertaal("ob_gestoor", "Gestoor") + " " + mb_tyd_nou();
    }

    mb_kyk_kennis();
    mb_kyk_kontak();
  } catch (fout) {
    console.error("Kon nie die besonderhede stoor nie:", fout);
    if (nota) {
      nota.className = "mb-stoor-nota mb-fout";
      nota.textContent = mb_vertaal("fout_netwerk", "Kon nie verbind nie. Kontroleer jou verbinding en probeer weer.");
    }
    if (is_kennis) mb_kyk_kennis();
    else mb_kyk_kontak();
  }
}

function mb_koppel() {
  const merk = mb_el("mb-verkoop");
  if (merk) merk.addEventListener("change", mb_kyk_kennis);

  ["mb-selfoon", "mb-adres"].forEach((id) => {
    const el = mb_el(id);
    if (!el) return;
    el.addEventListener("input", mb_kyk_kontak);
    el.addEventListener("change", mb_kyk_kontak);
  });

  const kennis = mb_el("mb-stoor-kennis");
  if (kennis) kennis.addEventListener("click", () => mb_stoor("kennis"));

  const kontak = mb_el("mb-stoor-kontak");
  if (kontak) kontak.addEventListener("click", () => mb_stoor("kontak"));
}

document.addEventListener("outeur-gereed", (gebeurtenis) => {
  mb_koppel();
  mb_vul(gebeurtenis.detail || {});
});
