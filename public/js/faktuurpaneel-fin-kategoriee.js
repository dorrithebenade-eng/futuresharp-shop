// public/js/faktuurpaneel-fin-kategoriee.js
//
// Die register van finansiele kategoriee, op Boekhouding se Registers-blad.
//
// 'N NUWE LEER, dieselfde patroon as faktuurpaneel-werk.js: sy eie sessie uit
// identiteit_kry_huidige_sessie(), sy eie rolkontrole, sy eie oorlegsel.
//
// DIE BOOM WORD NIE HIER GEBOU NIE. kry-fin-kategoriee.js gee die lys reeds
// gesorteer, met `vlak` en `pad` op elke kategorie. Sou hierdie skerm hom self
// bou, is daar twee plekke waar 'n weeskind anders hanteer kan word.
//
// DIE INKEPING KOM UIT `vlak`, en dit is 'n CSS-marge, nie spasies nie.
// Spasies in innerHTML val weg, en 'n mens kan later nie op hulle sorteer nie.
//
// DIE VOORVOEGSEL IS `KT`, NIE `FK`, EN DIT IS NIE 'N SMAAKKEUSE NIE.
//
// faktuurpaneel-kliente.js dra reeds `const FK` en die hele `fk_`-familie.
// Twee lers op dieselfde bladsy met dieselfde `const` gee 'n SyntaxError, en
// dan laai NIE EEN van hulle nie -- die eerste weergawe hiervan het die hele
// Registers-blad op "Word gelaai ..." laat staan.
//
// `kt_` pas boonop by die taal.js-sleutels en die CSS-klasse, wat albei reeds
// so heet.

// SKRAP VERSKYN SELDE, EN DIT IS REG SO. Die knoppie is daar vir 'n tikfout
// van 'n minuut gelede en vir toetsdata. Die bediener weier alles anders — 'n
// kategorie wat gebruik word, word onder 'n ander een gesit, nie uitgevee nie.

const KT = {
  kategoriee: [],
  sessie: null,
  wysig: null,      // die id wat gewysig word, of null vir 'n nuwe een
};

function kt_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function kt_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function kt_vra(naam, opsies) {
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

/* ═══ die lys ═══ */

// Die soek ignoreer spasies, sodat "reis koste" en "reiskoste" dieselfde ding
// vind -- dieselfde gedrag as die werk-itemskerm s'n.
function kt_pas(k, soek) {
  if (!soek) return true;
  return [k.naam, k.nota]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "")
    .includes(soek);
}

/* EEN BLOK SE RYE.

   DIE VLAK WORD HIER HERBEREKEN, nie uit `vlak` geneem nie.

   kry-fin-kategoriee.js se `vlak` tel oor die HELE lys. Word die lys in twee
   blokke gesny -- en word 'n soek boonop rye uitgehaal -- kan 'n ry se ouer
   buite die blok wees. Die ou inkeping sou haar dan onder 'n leegte indruk en
   die hierargie lieg.

   Die reel: is jou ouer nie in HIERDIE lys nie, staan jy op vlak 1. Sigbaar
   los is beter as stil verkeerd.

   Dieselfde reel vang 'n weeskind -- 'n kategorie waarvan die ouer weg is. */
function kt_teken_blok(lys, plek_id) {
  const plek = document.getElementById(plek_id);
  if (!plek) return;

  const in_lys = new Set(lys.map((k) => k.id));

  const vlak_van_ry = (k) => {
    let diep = 1;
    let ouer = k.onder;
    while (ouer && in_lys.has(ouer) && diep < 8) {
      diep += 1;
      const volgende = lys.find((x) => x.id === ouer);
      ouer = volgende ? volgende.onder : "";
    }
    return diep;
  };

  plek.innerHTML = lys.map((k) => {
    /* DIE DIEPTE GAAN AS 'N CSS-VERANDERLIKE, nie as punte nie.

       Skryf die JavaScript `padding-left: 52px`, kan geen breekpunt daaraan
       raak nie -- 'n inline-styl klop elke reel. Met `--kt-diep` bly die MAAT
       in die CSS, waar 'n foon hom kan halveer. */
    const diep = Math.min(vlak_van_ry(k) - 1, 5);

    const merkies = [
      k.vas
        ? `<span class="fk-merkie">${kt_t("kt_vas", "Stelsel")}</span>` : "",
      k.gedek_deur_hosting
        ? `<span class="fk-merkie kt-hosting">${kt_t("kt_hosting_kort", "Hosting")}</span>` : "",
      k.toets
        ? `<span class="fk-merkie">${kt_t("kt_toets", "Toets")}</span>` : "",
    ].join("");

    /* DIE RIGTING STAAN NIE MEER OP DIE RY NIE.

       'n Kind se rigting KAN nie van sy ouer s'n verskil nie --
       stoor-fin-kategorie.js weier dit. Die woord het dus ses-en-dertig keer
       op die skerm gestaan sonder om iets te se wat die blok nie reeds se nie.

       Wat oorbly op die tweede reel is die nota, en sy verskyn slegs wanneer
       daar een is. */
    const lyn = diep > 0 ? `<span class="kt-lyn"></span>` : "";

    return `
      <div class="fk-ry fk-ry-twee kt-ry${diep === 0 ? " kt-ry-hoof" : ""}"
           style="--kt-diep:${diep}">
        ${lyn}
        <button type="button" class="fk-ry-oop" data-kt="${kt_ontsnap(k.id)}">
          <span class="fk-ry-naam">${kt_ontsnap(k.naam)}${merkies}</span>
          ${k.nota ? `<span class="fk-ry-onder">${kt_ontsnap(k.nota)}</span>` : ""}
        </button>
        <span class="fk-ry-rand">${
          k.vas ? "" :
          `<button type="button" class="fp-skrap" data-kt-skrap="${kt_ontsnap(k.id)}"
                  >${kt_t("kt_skrap", "Skrap")}</button>`}</span>
      </div>`;
  }).join("");
}

/* DIE REGISTER LEES SOOS DIE STAAT WAT HY VOED: twee kante.

   Voor 4 September 2026 was dit een alfabetiese lys, en inkomste en uitgawes
   het deurmekaar gestaan -- Aanbiedings, Akkommodasie, Diensinkomste,
   Learnworlds, Paystack, Reiskoste. Die leser moes eers self sorteer. */
function kt_teken_lys() {
  const plek = document.getElementById("kt-lys");
  if (!plek) return;

  const soekveld = document.getElementById("kt-soek");
  const soek = (soekveld ? soekveld.value || "" : "")
    .trim().toLowerCase().replace(/\s+/g, "");

  const pas = KT.kategoriee.filter((k) => kt_pas(k, soek));
  const inkomste = pas.filter((k) => k.rigting === "in");
  const uitgawes = pas.filter((k) => k.rigting !== "in");

  const hulp = document.getElementById("kt-hulp");
  if (hulp) {
    hulp.textContent = soek
      ? pas.length + " " + kt_t("kt_van", "van") + " " + KT.kategoriee.length
      : KT.kategoriee.length + " " +
        (KT.kategoriee.length === 1 ? kt_t("kt_een", "kategorie") : kt_t("kt_meer", "kategoriee"));
  }

  if (!KT.kategoriee.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${kt_t(
      "kt_leeg", "Die register is nog leeg. Voeg die eerste kategorie by.")}</p>`;
    return;
  }

  if (!pas.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${kt_t(
      "kt_geen_treffer", "Geen kategorie pas by die soektog nie.")}</p>`;
    return;
  }

  /* DIE + OP DIE BLOKOPSKRIF open die venster met die rigting REEDS gekies.
     Die eerste keuse in daardie venster is dan nie meer 'n keuse nie. */
  const blok = (sleutel, verstek, lys, rigting, lys_id) => `
    <div class="kt-blok">
      <div class="kt-blok-kop">
        <span>${kt_t(sleutel, verstek)}</span>
        <span class="kt-blok-tel">${lys.length}</span>
        <button type="button" class="kt-blok-voeg" data-kt-nuut="${rigting}"
                title="${kt_t("kt_nuwe_knop", "+ Nuwe kategorie")}">+</button>
      </div>
      <div id="${lys_id}"></div>
    </div>`;

  plek.innerHTML =
    // DIE BLOKOPSKRIF DRA SY EIE SLEUTELS. `kt_in` en `kt_uit` is die VORM se
    // twee knoppies, waar enkelvoud reg is -- 'n mens kies een rigting. 'n
    // Opskrif oor twaalf items lees "Uitgawes".
    blok("kt_kop_in", "Inkomste", inkomste, "in", "kt-lys-in") +
    blok("kt_kop_uit", "Uitgawes", uitgawes, "uit", "kt-lys-uit");

  kt_teken_blok(inkomste, "kt-lys-in");
  kt_teken_blok(uitgawes, "kt-lys-uit");

  plek.querySelectorAll("[data-kt-nuut]").forEach((b) =>
    b.addEventListener("click", () => kt_maak_vorm_oop(null, b.getAttribute("data-kt-nuut"))));

  plek.querySelectorAll("[data-kt]").forEach((b) =>
    b.addEventListener("click", () => kt_maak_vorm_oop(b.getAttribute("data-kt"))));
  plek.querySelectorAll("[data-kt-skrap]").forEach((b) =>
    b.addEventListener("click", () => kt_skrap(b.getAttribute("data-kt-skrap"))));
}

/* ═══ die vorm ═══ */

// Die keuselys vir `onder`. Twee dinge word uitgelaat, en albei om dieselfde
// rede: hulle sou 'n kringloop maak wat die bediener in elk geval weier.
//
//   die kategorie self
//   enigiets wat reeds ONDER haar val
//
// Die bediener bly die poort — hierdie lys maak die fout net onmoontlik om te
// kies, in plaas van moontlik om te kies en dan geweier te word.
function kt_onder_opsies(huidige_id, gekies) {
  const verbode = new Set();
  if (huidige_id) {
    verbode.add(huidige_id);
    let verander = true;
    while (verander) {
      verander = false;
      KT.kategoriee.forEach((k) => {
        if (!verbode.has(k.id) && verbode.has(k.onder)) {
          verbode.add(k.id);
          verander = true;
        }
      });
    }
  }

  const kop = `<option value="">${kt_t("kt_geen_ouer", "\u2014 hoofkategorie \u2014")}</option>`;
  return kop + KT.kategoriee
    .filter((k) => !verbode.has(k.id))
    .map((k) => `<option value="${kt_ontsnap(k.id)}"${
      k.id === gekies ? " selected" : ""}>${kt_ontsnap(k.pad || k.naam)}</option>`)
    .join("");
}

// `verstek_rigting` kom van die + op 'n blokopskrif: klik 'n mens die een op
// Uitgawes, is die rigting reeds gekies wanneer die venster oopgaan. Hy geld
// slegs vir 'n NUWE kategorie -- 'n bestaande een dra haar eie.
function kt_maak_vorm_oop(id, verstek_rigting) {
  const k = id ? KT.kategoriee.find((x) => x.id === id) : null;
  KT.wysig = k ? k.id : null;

  document.getElementById("kt-vorm-titel").textContent = k
    ? kt_t("kt_wysig_titel", "Wysig kategorie")
    : kt_t("kt_nuwe_titel", "Nuwe kategorie");

  document.getElementById("kt-naam").value = k ? k.naam : "";
  document.getElementById("kt-onder").innerHTML =
    kt_onder_opsies(k ? k.id : null, k ? k.onder : "");
  document.getElementById("kt-nota").value = k ? k.nota || "" : "";
  document.getElementById("kt-hosting").checked = Boolean(k && k.gedek_deur_hosting);

  kt_stel_rigting(k ? k.rigting : (verstek_rigting === "in" ? "in" : "uit"));

  // 'n VASTE KATEGORIE SE NAAM EN RIGTING IS TOE. Sy mag onder 'n ander een
  // gesit word, en haar merkie en nota mag verander — dit is die enigste
  // dinge waaroor 'n mens by haar 'n keuse het.
  const vas = Boolean(k && k.vas);
  document.getElementById("kt-naam").disabled = vas;
  document.querySelectorAll(".kt-rigting-knop").forEach((b) => (b.disabled = vas));
  const vashulp = document.getElementById("kt-vas-hulp");
  if (vashulp) vashulp.style.display = vas ? "" : "none";

  document.getElementById("kt-vorm-fout").style.display = "none";
  document.getElementById("kt-vorm").classList.add("oop");
  if (!vas) document.getElementById("kt-naam").focus();
}

function kt_maak_vorm_toe() {
  document.getElementById("kt-vorm").classList.remove("oop");
  KT.wysig = null;
}

function kt_stel_rigting(rigting) {
  document.querySelectorAll(".kt-rigting-knop").forEach((b) =>
    b.classList.toggle("aan", b.getAttribute("data-kt-rigting") === rigting));
}

function kt_huidige_rigting() {
  const aan = document.querySelector(".kt-rigting-knop.aan");
  return aan ? aan.getAttribute("data-kt-rigting") : "uit";
}

function kt_wys_fout(boodskap) {
  const el = document.getElementById("kt-vorm-fout");
  el.textContent = boodskap;
  el.style.display = "";
}

async function kt_stoor() {
  const naam = document.getElementById("kt-naam").value.trim();
  if (!naam) {
    kt_wys_fout(kt_t("kt_naam_kort", "Die naam is verpligtend."));
    return;
  }

  const knop = document.getElementById("kt-stoor");
  knop.disabled = true;
  try {
    await kt_vra("stoor-fin-kategorie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: KT.wysig || undefined,
        naam,
        onder: document.getElementById("kt-onder").value,
        rigting: kt_huidige_rigting(),
        gedek_deur_hosting: document.getElementById("kt-hosting").checked,
        nota: document.getElementById("kt-nota").value.trim(),
      }),
    });
    kt_maak_vorm_toe();
    await kt_laai();
  } catch (fout) {
    // Die bediener se woorde word gewys, nie 'n eie vertaling nie. Hy sê
    // presies WATTER reel geval het — die kringloop, die rigting, die
    // subkategoriee — en 'n algemene "kon nie stoor nie" sou dit wegvat.
    kt_wys_fout(String(fout.message || fout));
  } finally {
    knop.disabled = false;
  }
}

async function kt_skrap(id) {
  const k = KT.kategoriee.find((x) => x.id === id);
  if (!k) return;
  if (!window.confirm(
    kt_t("kt_skrap_vra", "Vee hierdie kategorie uit?") + "\n\n" + k.naam)) return;

  try {
    await kt_vra("skrap-fin-kategorie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await kt_laai();
  } catch (fout) {
    window.alert(String(fout.message || fout));
  }
}

/* ═══ laai ═══ */

async function kt_laai() {
  const plek = document.getElementById("kt-lys");
  try {
    const data = await kt_vra("kry-fin-kategoriee");
    KT.kategoriee = Array.isArray(data.kategoriee) ? data.kategoriee : [];
    kt_teken_lys();
  } catch (fout) {
    console.error("Kon nie die kategoriee laai nie:", fout);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${kt_t(
        "kt_laai_fout", "Kon nie die kategoriee laai nie.")}</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("kt-lys")) return;

  try {
    KT.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    KT.sessie = null;
  }
  if (!KT.sessie || !identiteit_het_rol(KT.sessie.gebruiker, "boekhouding")) return;

  document.getElementById("kt-nuut")
    .addEventListener("click", () => kt_maak_vorm_oop(null));

  // Die soek teken die lys oor terwyl 'n mens tik. Sy loop op wat reeds
  // gelaai is -- geen oproep per tikslag.
  const soekveld = document.getElementById("kt-soek");
  if (soekveld) soekveld.addEventListener("input", kt_teken_lys);
  document.getElementById("kt-stoor").addEventListener("click", kt_stoor);
  document.getElementById("kt-kanselleer").addEventListener("click", kt_maak_vorm_toe);

  document.querySelectorAll(".kt-rigting-knop").forEach((b) =>
    b.addEventListener("click", () => kt_stel_rigting(b.getAttribute("data-kt-rigting"))));

  const oorlegsel = document.getElementById("kt-vorm");
  oorlegsel.addEventListener("click", (ev) => {
    if (ev.target === oorlegsel) kt_maak_vorm_toe();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && oorlegsel.classList.contains("oop")) kt_maak_vorm_toe();
  });

  await kt_laai();
});
