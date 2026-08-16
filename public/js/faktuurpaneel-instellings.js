// public/js/faktuurpaneel-instellings.js
//
// Die Instellings-blad: die maatskappy se kop en die bankbesonderhede.
//
// 'N EIE LÊER wat by die bestaande paneel inhaak. faktuurpaneel.js bly
// onaangeraak — dieselfde patroon as faktuurpaneel-kliente.js en
// faktuurpaneel-begunstigdes.js.
//
// DIE VOORSKOU IS DIE PUNT VAN DIE SKERM. 'n Adres wat oor een reël loop teen
// een wat oor drie loop, sien 'n mens net deur hom te sien loop. En 'n leë
// veld wys in KORAAL met die woord "ontbreek": 'n leë plek in 'n grys blok
// lyk soos 'n ontwerpkeuse, terwyl dit op 'n werklike faktuur 'n gat is waar
// 'n rekeningnommer moes staan. Presies wat tot nou toe met die strepies
// gebeur het.
//
// DIE SESSIE WORD HIER SELF GEHAAL, nie by faktuurpaneel.js geleen nie —
// dieselfde patroon as faktuurpaneel-kliente.js. Die eerste weergawe het na 'n
// kaal `SESSIE` verwys; daardie naam leef in faktuur-vorm.js, nie op hierdie
// bladsy nie, en die bladsy het met `SESSIE is not defined` gestort voordat
// een veld gevul is. 'n Naam wat op EEN bladsy bestaan, is nie 'n naam wat
// oral bestaan nie.

// Die veld op die skerm, die veld op die rekord, en die plek in die voorskou.
// Een lys, sodat 'n nuwe veld op EEN plek bygevoeg word en nie op drie nie.
const IN_VELDE = [
  ["in-naam", "naam", "in-p-naam"],
  ["in-reg", "registrasienommer", "in-p-reg"],
  ["in-adres", "adres", "in-p-adres"],
  ["in-epos", "epos", "in-p-epos"],
  ["in-bank", "bank", "in-p-bank"],
  ["in-rnaam", "bank_rekeningnaam", "in-p-rnaam"],
  ["in-rnr", "bank_rekeningnommer", "in-p-rnr"],
  ["in-tak", "bank_takkode", "in-p-tak"],
  ["in-tipe", "bank_rekeningtipe", "in-p-tipe"],
];

const IN = {
  sessie: null,
  besig: false,
};

function in_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function in_teken_voorskou() {
  IN_VELDE.forEach(([veld_id, , plek_id]) => {
    const veld = document.getElementById(veld_id);
    const plek = document.getElementById(plek_id);
    if (!veld || !plek) return;
    const waarde = veld.value.trim();
    if (waarde) {
      plek.textContent = waarde;
      plek.classList.remove("in-vs-leeg");
    } else {
      plek.textContent = in_t("in_ontbreek", "ontbreek");
      plek.classList.add("in-vs-leeg");
    }
  });
}

function in_vul(maatskappy) {
  IN_VELDE.forEach(([veld_id, rekord_veld]) => {
    const veld = document.getElementById(veld_id);
    if (veld) veld.value = maatskappy[rekord_veld] || "";
  });
  in_teken_voorskou();
}

// Die strook op die Fakture-blad. Die toets self leef in _instellings.js —
// die skerm besluit nie self wat "onvolledig" beteken nie.
function in_wys_waarskuwing(onvolledig) {
  const strook = document.getElementById("fp-bank-waarskuwing");
  if (strook) strook.hidden = !onvolledig;
}

function in_stand(teks, is_fout) {
  const el = document.getElementById("in-stand");
  if (!el) return;
  el.textContent = teks || "";
  el.classList.toggle("fout", Boolean(is_fout));
}

async function in_laai() {
  try {
    const resp = await fetch("/.netlify/functions/kry-instellings", {
      headers: { Authorization: `Bearer ${IN.sessie.access_token}` },
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    in_vul(data.maatskappy || {});
    in_wys_waarskuwing(data.bank_onvolledig);
  } catch (fout) {
    console.error("Kon nie die instellings laai nie:", fout);
    in_stand(in_t("in_laai_fout", "Kon nie die instellings laai nie."), true);
  }
}

async function in_stoor() {
  if (IN.besig || !IN.sessie) return;
  IN.besig = true;

  const knop = document.getElementById("in-stoor");
  if (knop) knop.disabled = true;
  in_stand(in_t("fu_besig", "Besig …"), false);

  const liggaam = {};
  IN_VELDE.forEach(([veld_id, rekord_veld]) => {
    const veld = document.getElementById(veld_id);
    if (veld) liggaam[rekord_veld] = veld.value;
  });

  try {
    const resp = await fetch("/.netlify/functions/stoor-instellings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${IN.sessie.access_token}`,
      },
      body: JSON.stringify(liggaam),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    in_vul(data.maatskappy || {});
    in_wys_waarskuwing(data.bank_onvolledig);

    const nou = new Date();
    in_stand(
      `${in_t("fv_gestoor", "Gestoor")} ${String(nou.getHours()).padStart(2, "0")}:${String(
        nou.getMinutes()
      ).padStart(2, "0")}`,
      false
    );
  } catch (fout) {
    console.error("Kon nie die instellings stoor nie:", fout);
    // Eerlik wees hieroor. 'n Stil mislukking laat iemand aangaan met werk wat
    // nêrens beland nie.
    in_stand(
      String(fout.message || "").trim() ||
        in_t("in_stoor_fout", "Kon nie stoor nie — probeer weer"),
      true
    );
  } finally {
    IN.besig = false;
    if (knop) knop.disabled = false;
  }
}

(async function in_begin() {
  try {
    IN.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    IN.sessie = null;
  }
  if (!IN.sessie || !identiteit_het_rol(IN.sessie.gebruiker, "boekhouding")) return;

  IN_VELDE.forEach(([veld_id]) => {
    const veld = document.getElementById(veld_id);
    if (veld) veld.addEventListener("input", in_teken_voorskou);
  });

  const knop = document.getElementById("in-stoor");
  if (knop) knop.addEventListener("click", in_stoor);

  // Die strook se knoppie bring 'n mens by die blad waar dit reggemaak word.
  // 'n Waarskuwing sonder 'n pad daarheen laat 'n mens soek.
  const gaan = document.getElementById("fp-bank-gaan");
  if (gaan) {
    gaan.addEventListener("click", () => {
      fp_wys_afdeling("instellings");
      const eerste = document.getElementById("in-bank");
      if (eerste) eerste.focus();
    });
  }

  await in_laai();
})();
