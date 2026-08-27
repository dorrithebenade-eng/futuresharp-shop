// public/js/faktuurpaneel-werk.js
//
// Die register van werk en uitgawes, op Boekhouding se Registers-blad.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. Dieselfde patroon as
// faktuurpaneel-kliente.js en -begunstigdes.js, en soos hulle haal hy sy EIE
// sessie met identiteit_kry_huidige_sessie(). Op 16 Augustus het
// faktuurpaneel-instellings.js na 'n kaal SESSIE verwys — 'n naam wat in
// faktuur-vorm.js leef — en die bladsy het gestort voordat een veld gevul was.
//
// TWEE LYSTE, EEN REGISTER. Werk en uitgawes leef in dieselfde store met 'n
// soort-veld; die skerm wys hulle onder twee koppe. Die onderskeid doen
// werk: 'n uitgawe is ALTYD 'n vaste bedrag, want 'n persentasie sou beteken
// iemand kry 70% van sy eie petrol terug.
//
// DIE ITEM DRA GEEN BEDRAG NIE. Elke geval verskil, en 'n verstek wat
// gewoonlik verkeerd is, word oorgesien.

const WI = {
  items: [],
  sessie: null,
  wysig: null,      // die item_id wat gewysig word, of null vir 'n nuwe een
  soort: "uitgawe",
};

/* DIE TELKAART: hoeveel fakture elke beskrywing dra.

   Sy kom uit tel-werk-items.js, EEN OPROEP vir die hele register — nie een
   per item nie. Twaalf items sou twaalf volle deurlope van die fakture
   beteken, en kry-joernaal.js, wat presies dit doen, staan reeds as 'n
   prestasiekwessie op die lys.

   `null` beteken NOG NIE GEVRA of DIE OPROEP HET OMGEVAL. Dit is nie
   dieselfde as 'n leë kaart nie: 'n leë kaart beteken niks word gebruik, en
   dan skrap iemand 'n item wat op twintig fakture staan. Die knoppie wys dan
   GEEN syfer nie, eerder as 'n verkeerde een. */
let WI_TEL = null;
let WI_TEL_BESIG = false;

function wi_normaliseer(waarde) {
  return String(waarde == null ? "" : waarde).trim().toLowerCase();
}

function wi_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

// Alle teks wat van buite kom, gaan hierdeur voordat dit in innerHTML beland.
function wi_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function wi_vra(naam, opsies) {
  const resp = await fetch("/.netlify/functions/" + naam, {
    ...(opsies || {}),
    headers: {
      ...((opsies && opsies.headers) || {}),
      Authorization: `Bearer ${WI.sessie.access_token}`,
    },
  });
  if (!resp.ok) {
    const teks = await resp.text().catch(() => "");
    throw new Error(teks || String(resp.status));
  }
  return resp.json();
}

// Die soek ignoreer spasies, sodat "reis koste" en "reiskoste" dieselfde ding
// vind — dieselfde gedrag as die kliënteskerm s'n.
function wi_pas(item, soek) {
  if (!soek) return true;
  return [item.naam, item.beskrywing]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "")
    .includes(soek);
}

function wi_teken_lys() {
  const plek = document.getElementById("wi-lys");
  if (!plek) return;

  const soek = (document.getElementById("wi-soek").value || "")
    .trim().toLowerCase().replace(/\s+/g, "");
  const pas = WI.items.filter((i) => wi_pas(i, soek));

  const hulp = document.getElementById("wi-hulp");
  if (hulp) {
    hulp.textContent = soek
      ? pas.length + " " + wi_t("wi_van", "van") + " " + WI.items.length
      : WI.items.length + " " + (WI.items.length === 1
          ? wi_t("wi_item", "item") : wi_t("wi_items", "items"));
  }

  if (!WI.items.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${
      wi_t("wi_leeg", "Die register is nog leeg. Voeg die eerste item by.")}</p>`;
    return;
  }
  if (!pas.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${wi_t("wi_geen_pas", "Geen item pas nie.")}</p>`;
    return;
  }

  const groep = (soort, kop) => {
    const lys = pas.filter((i) => i.soort === soort);
    if (!lys.length) return "";
    return `<p class="fk-subkop">${kop}</p>` + lys.map((i) => `
      <div class="fk-ry fk-ry-twee${i.aktief ? "" : " wi-af"}">
        <button type="button" class="fk-ry-oop" data-item="${wi_ontsnap(i.item_id)}">
          <span class="fk-ry-naam">${wi_ontsnap(i.naam)}${
            i.aktief ? "" : ` <span class="fk-merkie">${wi_t("wi_afgeskakel", "Afgeskakel")}</span>`}</span>
          ${i.beskrywing ? `<span class="fk-ry-onder">${wi_ontsnap(i.beskrywing)}</span>` : ""}
        </button>
        <span class="fk-ry-rand" data-wi-rand="${wi_ontsnap(i.item_id)}">
          <button type="button" class="fp-skrap" data-wi-skrap="${wi_ontsnap(i.item_id)}"
                  >${wi_t("wi_skrap", "Skrap")}</button>
        </span>
      </div>`).join("");
  };

  plek.innerHTML =
    groep("werk", wi_t("wi_kop_werk", "Werk wat betaal word")) +
    groep("uitgawe", wi_t("wi_kop_uitgawe", "Uitgawes wat teruggekry word"));

  // Die ry is 'n <button> sodat Tab en Enter vanself werk. Die skrapknoppie sit
  // BUITE hom: binne-in sou 'n klik op Skrap ook die vorm oopmaak.
  plek.querySelectorAll("[data-item]").forEach((el) =>
    el.addEventListener("click", () => wi_maak_vorm_oop(el.getAttribute("data-item"))));

  plek.querySelectorAll("[data-wi-skrap]").forEach((el) =>
    el.addEventListener("click", () => wi_vra_bevestiging(el.getAttribute("data-wi-skrap"))));
}

/* DIE BEVESTIGING DRA DIE SYFER.

   "Skrap? Staan op 3 fakture · Ja · Nee". Die vraag en die feit staan saam,
   in die ry self — nie 'n confirm() nie: dié blokkeer die bladsy, word
   weggeklik sonder om gelees te word, en sê nie WATTER item nie.

   DIT WEIER NIKS. 'n Werk-item word met TEKS aan 'n faktuur gekoppel, nie met
   'n verwysing nie, dus bly elke bestaande faktuur onaangeraak. Sou dit weier,
   kon 'n tikfout wat een keer op een faktuur beland het, nooit weer uit die
   voorstellys nie — en dit is juis die tikfoute wat 'n mens wil verwyder.

   GEEN SYFER WANNEER DIE TELLING ONBEKEND IS NIE. `WI_TEL === null` beteken
   die oproep het omgeval; dan staan daar net "Skrap?". 'n Nul wat eintlik
   "ek weet nie" beteken, is die gevaarlikste soort fout. */
function wi_vra_bevestiging(item_id) {
  const plek = document.querySelector(`[data-wi-rand="${item_id}"]`);
  const item = WI.items.find((x) => x.item_id === item_id);
  if (!plek || !item) return;

  let feit = "";
  if (WI_TEL) {
    const tel = WI_TEL[wi_normaliseer(item.naam)] || { fakture: 0, konsepte: 0 };
    const dele = [];
    if (tel.fakture) {
      dele.push(
        `${tel.fakture} ${wi_t(tel.fakture === 1 ? "wi_faktuur" : "wi_fakture",
          tel.fakture === 1 ? "faktuur" : "fakture")}`
      );
    }
    if (tel.konsepte) {
      dele.push(
        `${tel.konsepte} ${wi_t(tel.konsepte === 1 ? "wi_konsep" : "wi_konsepte",
          tel.konsepte === 1 ? "konsep" : "konsepte")}`
      );
    }
    const voeg = ` ${wi_t("wi_en", "en")} `;
    feit = dele.length
      ? ` <span class="wi-tel">${wi_t("wi_staan_op", "Staan op")} ${dele.join(voeg)}</span>`
      : ` <span class="wi-tel">${wi_t("wi_ongebruik", "Nog nêrens gebruik nie")}</span>`;
  }

  plek.innerHTML = `<span class="fp-bevestig">${wi_t("wi_skrap_vra", "Skrap?")}${feit}
    <button type="button" class="fp-bevestig-ja">${wi_t("fp_ja", "Ja")}</button>
    <button type="button" class="fp-bevestig-nee">${wi_t("fp_nee", "Nee")}</button></span>`;

  plek.querySelector(".fp-bevestig-nee").addEventListener("click", wi_teken_lys);
  plek.querySelector(".fp-bevestig-ja").addEventListener("click", () => wi_skrap(item_id, plek));
}

async function wi_skrap(item_id, plek) {
  plek.innerHTML = `<span class="fp-bevestig">${wi_t("fp_laai", "Word gelaai …")}</span>`;
  try {
    await wi_vra("skrap-werk-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id }),
    });

    // PLAASLIK uit die lys, nie weer gevra nie. Blobs se list() loop sowat
    // vier sekondes agter en die geskrapte item sou weer verskyn — dan lyk dit
    // of die skrap misluk het terwyl hy geslaag het.
    WI.items = WI.items.filter((x) => x.item_id !== item_id);

    // Die datalist op die faktuurvorm leef in 'n ander bladsy, dus is daar
    // niks om hier by te werk nie. Sy word by die volgende laai reg.
    wi_teken_lys();
  } catch (f) {
    console.error("Kon nie die item skrap nie:", f);
    wi_teken_lys();
    const lys = document.getElementById("wi-lys");
    if (lys) {
      const boodskap = document.createElement("p");
      boodskap.className = "stelsel-boodskap";
      // Die Function se eie boodskap, want sy sê WAAROM — 'n stukkende
      // faktuurtelling is 'n ander rede as 'n item wat nie bestaan nie.
      boodskap.textContent =
        String(f.message || "").trim() ||
        wi_t("wi_skrap_fout", "Kon nie die item skrap nie.");
      lys.prepend(boodskap);
    }
  }
}

/* DIE TELLING WORD EEN KEER GEVRA, en sy hou die lys nie op nie.

   wi_laai() teken die register klaar; hierdie oproep loop DAARNA en herteken
   slegs wanneer sy iets bygevoeg het. Sou die register op die telling wag, sou
   'n mens by elke opening na 'n leë blad kyk terwyl elke faktuur gelees word. */
async function wi_laai_telling() {
  if (WI_TEL_BESIG || WI_TEL) return;
  WI_TEL_BESIG = true;
  try {
    const data = await wi_vra("tel-werk-items");
    WI_TEL = data.kaart || {};
    if (data.volledig === false) {
      // Die syfers is 'n ondergrens: 'n faktuur het omgeval. Aangeteken en nie
      // vir die gebruiker gewys nie — die syfer bly bruikbaar, hy is net dalk
      // te laag, en dit is die veilige rigting.
      console.warn("tel-werk-items: nie elke faktuur kon gelees word nie; die syfers is 'n ondergrens.");
    }
  } catch (f) {
    // WI_TEL BLY null. Die knoppie wys dan geen syfer nie, eerder as 'n nul
    // wat "ongebruik" beteken.
    console.error("Kon nie die faktuurtelling laai nie:", f);
    WI_TEL = null;
  } finally {
    WI_TEL_BESIG = false;
  }
}

// ── Die vorm ────────────────────────────────────────────────────────────

function wi_stel_soort(nuwe) {
  WI.soort = nuwe === "werk" ? "werk" : "uitgawe";
  document.querySelectorAll(".wi-soort-knop").forEach((b) =>
    b.classList.toggle("aan", b.getAttribute("data-wi-soort") === WI.soort));

  // Die hulpreël verander saam, want die onderskeid is die enigste ding wat
  // 'n mens by hierdie vorm moet verstaan.
  const hulp = document.getElementById("wi-soort-hulp");
  if (hulp) {
    hulp.textContent = WI.soort === "werk"
      ? wi_t("wi_hulp_werk", "Arbeid wat betaal word. Die deel is inkomste, en dit mag 'n vaste bedrag of 'n persentasie wees.")
      : wi_t("wi_hulp_uitgawe", "Geld wat iemand uitgehaal het en presies moet terugkry. Altyd 'n vaste bedrag.");
  }
}

function wi_maak_vorm_oop(item_id) {
  const i = WI.items.find((x) => x.item_id === item_id)
    || { soort: "uitgawe", naam: "", beskrywing: "", aktief: true };
  WI.wysig = item_id || null;

  document.getElementById("wi-vorm-titel").textContent = item_id
    ? wi_t("wi_wysig", "Wysig item")
    : wi_t("wi_nuwe", "Nuwe item");

  wi_stel_soort(i.soort || "uitgawe");
  document.getElementById("wi-naam").value = i.naam || "";
  document.getElementById("wi-beskrywing").value = i.beskrywing || "";
  document.getElementById("wi-aktief").checked = i.aktief !== false;

  // Die aktief-blokkie is sinneloos by 'n nuwe item — hy is per definisie aan.
  document.getElementById("wi-aktief-ry").style.display = item_id ? "" : "none";

  document.getElementById("wi-vorm-fout").style.display = "none";
  document.getElementById("wi-vorm").classList.add("oop");
  document.getElementById("wi-naam").focus();
}

function wi_maak_vorm_toe() {
  document.getElementById("wi-vorm").classList.remove("oop");
  WI.wysig = null;
}

async function wi_stoor() {
  const fout = document.getElementById("wi-vorm-fout");
  const naam = document.getElementById("wi-naam").value.trim();

  if (!naam) {
    fout.textContent = wi_t("wi_naam_verplig", "Die naam is verplig.");
    fout.style.display = "";
    document.getElementById("wi-naam").focus();
    return;
  }

  const liggaam = {
    item_id: WI.wysig || "",
    soort: WI.soort,
    naam,
    beskrywing: document.getElementById("wi-beskrywing").value.trim(),
    aktief: document.getElementById("wi-aktief").checked,
  };

  try {
    const uit = await wi_vra("stoor-werk-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(liggaam),
    });

    // DIE LYS WORD PLAASLIK BYGEWERK, nie weer gevra nie. Blobs se list() loop
    // sowat vier sekondes agter, en 'n pas geskepte item sou lyk of hy nie
    // gestoor is nie.
    const rekord = {
      item_id: uit.item_id,
      soort: liggaam.soort,
      naam: liggaam.naam,
      beskrywing: liggaam.beskrywing,
      aktief: liggaam.aktief,
    };

    if (uit.nuut) WI.items.push(rekord);
    else {
      const ix = WI.items.findIndex((x) => x.item_id === uit.item_id);
      if (ix >= 0) WI.items[ix] = rekord;
      else WI.items.push(rekord);
    }
    WI.items.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af-ZA"));

    wi_maak_vorm_toe();
    wi_teken_lys();
  } catch (f) {
    console.error("Kon nie die item stoor nie:", f);
    fout.textContent = String(f.message || "").trim()
      || wi_t("wi_stoor_fout", "Kon nie stoor nie. Probeer weer.");
    fout.style.display = "";
  }
}

// ── Laai ────────────────────────────────────────────────────────────────

async function wi_laai() {
  const plek = document.getElementById("wi-lys");
  try {
    const data = await wi_vra("kry-werk-items");
    WI.items = data.items || [];
    // ALFABETIES BY DIE LAAI, nie net na 'n stoor nie. Die bediener gee die
    // lys in sleutelvolgorde terug, en 'n sleutel is nie 'n naam nie. Sonder
    // hierdie reel lyk die register reg sodra 'n mens iets gestoor het en
    // weer verkeerd sodra 'n mens die bladsy herlaai.
    WI.items.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af-ZA"));
    wi_teken_lys();
    // NA die hertekening, sonder await: die register is klaar bruikbaar en die
    // telling is slegs vir die bevestigingsvraag nodig.
    wi_laai_telling();
  } catch (f) {
    console.error("Kon nie die register laai nie:", f);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${
        wi_t("wi_laai_fout", "Kon nie die register laai nie.")}</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("wi-lys")) return;

  try {
    WI.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    WI.sessie = null;
  }
  if (!WI.sessie || !identiteit_het_rol(WI.sessie.gebruiker, "boekhouding")) return;

  document.getElementById("wi-soek").addEventListener("input", wi_teken_lys);
  document.getElementById("wi-nuut").addEventListener("click", () => wi_maak_vorm_oop(null));
  document.getElementById("wi-stoor").addEventListener("click", wi_stoor);
  document.getElementById("wi-kanselleer").addEventListener("click", wi_maak_vorm_toe);

  document.querySelectorAll(".wi-soort-knop").forEach((b) =>
    b.addEventListener("click", () => wi_stel_soort(b.getAttribute("data-wi-soort"))));

  // 'n Klik op die agtergrond en Escape maak toe — dieselfde as die kliëntvorm.
  const oorlegsel = document.getElementById("wi-vorm");
  oorlegsel.addEventListener("click", (ev) => {
    if (ev.target === oorlegsel) wi_maak_vorm_toe();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && oorlegsel.classList.contains("oop")) wi_maak_vorm_toe();
  });

  await wi_laai();
});
