// public/js/paneel-outeur-kontrole.js
//
// Wys 'n waarskuwing in die produkvorm wanneer die outeurs wat gekrediteer
// is en die outeurs wat betaal word, nie ooreenstem nie. Twee rigtings:
//
//   1. GEKREDITEER MAAR KRY NIKS — 'n outeur staan in die Outeur-veld
//      boaan, maar het in 'n formaat geen verdeling nie. Sy naam verskyn
//      op die boek en hy verdien niks daaruit nie.
//
//   2. KRY GELD MAAR NIE GEKREDITEER NIE — 'n verdeling met rol "Outeur"
//      wys na iemand wat nie boaan gelys is nie. Dit is wat by ToetsBoek
//      gebeur het: 'n Ontwerp/Admin-vergoeding is per ongeluk as "Outeur"
//      gestoor, en die persoon het toe in daardie outeur se paneelbord
//      opgedaag as mede-outeur van 'n boek wat hy nie geskryf het nie.
//
// DIT KEER NIKS. Albei gevalle kan geldig wees — 'n outeur wat sy deel aan
// iemand anders afstaan, 'n vertaler wat as outeur betaal word. Die vorm
// stoor soos gewoonlik; die waarskuwing sê net wat opgemerk is.
//
// EIE LÊER: paneelbord.js werk. Hierdie is 'n laag bo-op die vorm — dit
// lees die bestaande rye en skryf 'n blokkie by. Niks word gewysig nie.

// Die voorvoegsels kom uit paneelbord.html se id-name en is NIE dieselfde
// as die skema se formaatname nie: die HTML se "hardekopie" word in die
// data "harde_kopie". Word 'n id hier verkeerd gespel, vind die kontrole
// niks en swyg stil — daarom kla kontroleer_ids() as een ontbreek.
const KONTROLE_FORMATE = [
  { voorvoegsel: "eboek", etiket: "E-boek" },
  { voorvoegsel: "hardekopie", etiket: "Harde kopie" },
  { voorvoegsel: "leen", etiket: "Leen" },
];

// Loop een keer by opstel. 'n Hernoemde id in paneelbord.html sou hierdie
// lêer andersins stilweg nutteloos maak.
function kontroleer_ids() {
  KONTROLE_FORMATE.forEach(({ voorvoegsel }) => {
    if (!document.getElementById(`vorm-${voorvoegsel}-verdelings-lys`)) {
      console.warn(`paneel-outeur-kontrole: geen element vorm-${voorvoegsel}-verdelings-lys nie`);
    }
  });
}

// Die naam agter 'n outeur-ID, uit die keuselys self — die register is
// reeds daar gelaai, so ons hoef niks te gaan haal nie.
function kontrole_naam_van(outeur_id) {
  const opsie = document.querySelector(
    `.paneel-outeur-ry-kies option[value="${CSS.escape(outeur_id)}"]`
  );
  return opsie ? opsie.textContent.trim() : outeur_id;
}

function kontrole_gekrediteerde_ids() {
  return Array.from(document.querySelectorAll(".paneel-outeur-ry-kies"))
    .map((s) => s.value)
    .filter(Boolean);
}

// Outeur-IDs wat in hierdie formaat se verdelings voorkom. 'n Formaat wat
// afgeskakel is, se lys bestaan nie — dan is daar niks om te kontroleer nie.
function kontrole_betaalde_ids(voorvoegsel) {
  const lys = document.getElementById(`vorm-${voorvoegsel}-verdelings-lys`);
  if (!lys) return null;

  const merk = document.getElementById(`vorm-${voorvoegsel}-verdeling-aan`);
  if (merk && !merk.checked) return null;

  return Array.from(lys.querySelectorAll(".paneel-verdeling-ry"))
    .filter((ry) => {
      const rol = ry.querySelector(".paneel-verdeling-rol-tipe");
      return rol && rol.value === "outeur";
    })
    .map((ry) => {
      const entiteit = ry.querySelector(".paneel-verdeling-entiteit");
      return entiteit ? entiteit.value : "";
    })
    .filter(Boolean);
}

// Die blokkie word hier geskep, nie in paneelbord.html nie — dan bly die
// enigste verandering aan daardie lêer een skriptag. Sy styl kom saam,
// sodat styl.css ook nie hoef te verander nie. Kleure pas by die bestaande
// .demo-kennisgewing.
function kry_of_skep_houer() {
  let houer = document.getElementById("paneel-outeur-kontrole");
  if (houer) return houer;

  const anker = document.getElementById("vorm-voeg-outeur-by");
  if (!anker || !anker.parentNode) return null;

  if (!document.getElementById("paneel-outeur-kontrole-styl")) {
    const styl = document.createElement("style");
    styl.id = "paneel-outeur-kontrole-styl";
    styl.textContent = `
      #paneel-outeur-kontrole {
        background: #FFF7E6;
        border: 1px solid var(--amber);
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 13px;
        color: #6b5610;
        margin: 0 0 16px;
      }
      #paneel-outeur-kontrole ul { margin: 6px 0 0; padding-left: 18px; }
      #paneel-outeur-kontrole li { margin-bottom: 3px; }
      #paneel-outeur-kontrole p { margin: 8px 0 0; opacity: .8; }
    `;
    document.head.appendChild(styl);
  }

  houer = document.createElement("div");
  houer.id = "paneel-outeur-kontrole";
  houer.hidden = true;
  anker.parentNode.insertBefore(houer, anker.nextSibling);
  return houer;
}

function kontroleer_outeurs() {
  const houer = kry_of_skep_houer();
  if (!houer) return;

  const gekrediteer = kontrole_gekrediteerde_ids();
  const waarskuwings = [];

  // Alle outeur-IDs wat êrens betaal word, oor al die formate heen.
  const betaal_orals = new Set();

  KONTROLE_FORMATE.forEach(({ voorvoegsel, etiket }) => {
    const betaal = kontrole_betaalde_ids(voorvoegsel);
    if (betaal === null) return;

    betaal.forEach((id) => betaal_orals.add(id));

    // Rigting 1, per formaat — 'n outeur kan by die e-boek betaal word en
    // by die harde kopie nie, en dit is presies wat 'n mens wil sien.
    const sonder = gekrediteer.filter((id) => !betaal.includes(id));
    sonder.forEach((id) => {
      waarskuwings.push(`${kontrole_naam_van(id)} is gelys as outeur, maar het geen verdeling by ${etiket} nie.`);
    });
  });

  // Rigting 2 — een keer, nie per formaat nie. Dieselfde persoon by drie
  // formate is één probleem, nie drie nie.
  betaal_orals.forEach((id) => {
    if (!gekrediteer.includes(id)) {
      waarskuwings.push(`${kontrole_naam_van(id)} kry 'n outeursdeel, maar is nie as outeur van hierdie boek gelys nie.`);
    }
  });

  if (!waarskuwings.length) {
    houer.hidden = true;
    houer.innerHTML = "";
    return;
  }

  houer.hidden = false;
  houer.innerHTML = "";

  const kop = document.createElement("strong");
  kop.textContent = "Kontroleer die outeurs";
  houer.appendChild(kop);

  const lys = document.createElement("ul");
  waarskuwings.forEach((teks) => {
    const item = document.createElement("li");
    item.textContent = teks;
    lys.appendChild(item);
  });
  houer.appendChild(lys);

  const nota = document.createElement("p");
  nota.textContent = "Dit kan reg wees. Die vorm stoor soos gewoonlik.";
  houer.appendChild(nota);
}

// Die vorm bou sy rye dinamies — nuwe outeur-rye, nuwe verdeling-rye, 'n
// formaat wat aan- of afgeskakel word. 'n Waarnemer vang dit alles sonder
// dat paneelbord.js iets hoef te sê. Dieselfde patroon as
// paneel-registers.js.
function stel_outeur_kontrole_op() {
  const vorm = document.getElementById("paneel-produk-vorm");
  if (!vorm) return;

  let wag;
  const herkontroleer = () => {
    clearTimeout(wag);
    wag = setTimeout(kontroleer_outeurs, 120);
  };

  kontroleer_ids();
  vorm.addEventListener("change", herkontroleer);
  new MutationObserver(herkontroleer).observe(vorm, { childList: true, subtree: true });

  kontroleer_outeurs();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", stel_outeur_kontrole_op);
} else {
  stel_outeur_kontrole_op();
}
