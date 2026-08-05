// public/js/paneel-rekenaar-oordrag.js
//
// Dra die Verdeling-rekenaar se uitslag oor na 'n boek se produkvorm.
//
// DIE PROBLEEM: 'n mens reken die verdeling in die rekenaar uit, en tik dit
// dan met die hand oor in die produkvorm. Dis waar 'n syfer verkeerd
// beland, en dis presies die syfer wat 'n outeur se inkomste bepaal.
//
// HOE DIT WERK: 'n knoppie onderaan die rekenaar stoor die uitslag in
// sessionStorage. Maak jy daarna 'n produkvorm oop, verskyn 'n strook wat
// aanbied om dit in te vul. sessionStorage en nie Blobs nie — dit is 'n
// konsep, nie data nie, en dit hoort nie 'n bediener-rondte te kos nie.
//
// PAYSTACK IS DIE DEEL WAT MAKLIK VERKEERD GAAN. Die vennote kry wat
// oorbly nadat die hoofrekening se minimum afgetrek is — en daardie
// minimum is NIE die fooi wat Paystack hef nie:
//
//     werklike fooi   = 3,335% + R1,15
//     afgedwinge min  = 3,5%   + R1,30   (_paystack-koste.js)
//
// Reken ons met die fooi, is die som 'n paar sent te hoog en skep-produk.js
// weier die boek. Ons reken dus met die minimum. En omdat daardie R1,30
// vas is, verskil die vennote se persentasie PER FORMAAT — by 'n R45-leen
// weeg dit swaar, by 'n R280-boek amper nie.
//
// EIE LÊER: paneelbord.js en verdeling-rekenaar.js bly onaangeraak. Die
// rye word deur die vorm se EIE voeg_verdeling_ry_by() geskep, nie met
// ingespuite HTML nie — 'n ry sonder die vorm se hanteerders lyk reg op
// die skerm en stoor niks.

const PRO_SLEUTEL = "future_shop_rekenaar_oordrag";
const PRO_FORMATE = [
  { sleutel: "eboek", vr_sleutel: "eboek", naam: "E-boek" },
  { sleutel: "leen", vr_sleutel: "leen", naam: "Leen" },
  { sleutel: "hardekopie", vr_sleutel: "hardekopie", naam: "Harde kopie" },
];

// --- Paystack, presies soos _paystack-koste.js ---

function pro_minimum_hoofrekening_rand(prys_rand) {
  if (!prys_rand || prys_rand <= 0) return 0;
  return 0.035 * prys_rand + 1.3;
}

function pro_minimum_pct(prys_rand) {
  if (!prys_rand || prys_rand <= 0) return 0;
  return Math.min(100, (pro_minimum_hoofrekening_rand(prys_rand) / prys_rand) * 100);
}

// --- Kant 1: die rekenaar ---

function pro_getal(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value) || 0 : 0;
}

// vr_outeurs leef in verdeling-rekenaar.js as 'n gewone skrip-veranderlike,
// dus is dit hier bereikbaar. Is dit om enige rede weg, val ons terug op
// die enkele anker-persentasie.
function pro_lees_outeurs() {
  if (typeof vr_outeurs !== "undefined" && Array.isArray(vr_outeurs) && vr_outeurs.length) {
    return vr_outeurs.map((o) => ({ naam: String(o.naam || "").trim(), pct: Number(o.pct) || 0 }));
  }
  return [{ naam: "", pct: pro_getal("vr-outeur-pct") }];
}

function pro_bou_uitslag() {
  const outeurs = pro_lees_outeurs();
  const outeur_som = outeurs.reduce((som, o) => som + o.pct, 0);
  const ontwerp_admin = pro_getal("vr-admin-pct") + pro_getal("vr-ontwerp-pct");
  const hosting = pro_getal("vr-hosting-pct");

  const pryse = {};
  const vennoot = {};

  PRO_FORMATE.forEach((f) => {
    const prys = pro_getal(`vr-begin-${f.vr_sleutel}`);
    pryse[f.sleutel] = prys;
    vennoot[f.sleutel] = Number(
      (100 - outeur_som - hosting - ontwerp_admin - pro_minimum_pct(prys)).toFixed(2)
    );
  });

  return { tyd: new Date().toISOString(), outeurs, ontwerp_admin, hosting, vennoot, pryse };
}

function pro_stel_rekenaar_op() {
  const anker = document.getElementById("vr-uitslag");
  if (!anker || document.getElementById("pro-neem-oor")) return;

  const blok = document.createElement("div");
  blok.className = "pro-oordrag-blok";

  const knoppie = document.createElement("button");
  knoppie.type = "button";
  knoppie.id = "pro-neem-oor";
  knoppie.className = "knoppie-primer";
  knoppie.textContent = "Neem oor na 'n boek";

  const boodskap = document.createElement("span");
  boodskap.className = "pro-oordrag-boodskap";

  knoppie.addEventListener("click", () => {
    try {
      sessionStorage.setItem(PRO_SLEUTEL, JSON.stringify(pro_bou_uitslag()));
      boodskap.textContent = "Gestoor. Maak 'n boek se vorm oop om dit in te vul.";
    } catch (fout) {
      console.error("Kon nie die uitslag stoor nie:", fout);
      boodskap.textContent = "Kon nie stoor nie.";
    }
  });

  blok.appendChild(knoppie);
  blok.appendChild(boodskap);
  anker.parentNode.insertBefore(blok, anker.nextSibling);
}

// --- Kant 2: die produkvorm ---

function pro_lees_oordrag() {
  try {
    const rou = sessionStorage.getItem(PRO_SLEUTEL);
    return rou ? JSON.parse(rou) : null;
  } catch {
    return null;
  }
}

function pro_tyd_kort(iso) {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return `${String(datum.getHours()).padStart(2, "0")}:${String(datum.getMinutes()).padStart(2, "0")}`;
}

// Het hierdie vorm reeds verdelings? Dan vra ons voordat ons vervang.
function pro_het_bestaande_verdelings() {
  return PRO_FORMATE.some((f) => {
    const lys = document.getElementById(`vorm-${f.sleutel}-verdelings-lys`);
    return lys && lys.querySelectorAll(".paneel-verdeling-ry").length > 0;
  });
}

function pro_vul_in(oordrag) {
  if (pro_het_bestaande_verdelings()) {
    const gaan_voort = window.confirm(
      "Hierdie boek het reeds verdelings. Vervang hulle met die rekenaar se syfers?"
    );
    if (!gaan_voort) return;
  }

  PRO_FORMATE.forEach((f) => {
    const prys_el = document.getElementById(`vorm-${f.sleutel}-prys`);
    if (prys_el && oordrag.pryse[f.sleutel] > 0) {
      prys_el.value = oordrag.pryse[f.sleutel];
    }

    const lys = document.getElementById(`vorm-${f.sleutel}-verdelings-lys`);
    if (!lys) return;
    lys.innerHTML = "";

    // Die rye word deur die vorm se eie funksie gebou, met sy hanteerders
    // en sy entiteit-keuselyste. entiteit_id bly leeg — die rekenaar weet
    // nie wie die outeur is nie; dit is 'n keuse per boek.
    if (typeof voeg_verdeling_ry_by !== "function") {
      console.error("voeg_verdeling_ry_by ontbreek — die oordrag kan nie rye bou nie");
      return;
    }

    oordrag.outeurs.forEach((outeur) => {
      voeg_verdeling_ry_by(f.sleutel, {
        rol_tipe: "outeur",
        entiteit_id: "",
        tipe: "persentasie",
        waarde: outeur.pct,
      });
    });

    // Ontwerp/Admin en Vennoot word ALTYD geskep, ook by 0 of 'n negatiewe
    // syfer. 'n Ry wat sigbaar is, kan weggeklik word; een wat stilweg
    // ontbreek, word gemis.
    voeg_verdeling_ry_by(f.sleutel, {
      rol_tipe: "ontwerp_admin",
      entiteit_id: "",
      tipe: "persentasie",
      waarde: oordrag.ontwerp_admin,
    });

    voeg_verdeling_ry_by(f.sleutel, {
      rol_tipe: "vennoot",
      entiteit_id: "",
      tipe: "persentasie",
      waarde: oordrag.vennoot[f.sleutel],
    });

    // Hosting is 'n merkblokkie op die vorm, nie 'n verdelingsry nie —
    // die bedrag bly by die hoofrekening vir platformkoste.
    const hosting_aan = document.getElementById(`vorm-${f.sleutel}-hosting-aan`);
    const hosting_tipe = document.getElementById(`vorm-${f.sleutel}-hosting-tipe`);
    const hosting_waarde = document.getElementById(`vorm-${f.sleutel}-hosting-waarde`);

    if (hosting_aan && oordrag.hosting > 0) {
      hosting_aan.checked = true;
      hosting_aan.dispatchEvent(new Event("change", { bubbles: true }));
      if (hosting_tipe) hosting_tipe.value = "persentasie";
      if (hosting_waarde) hosting_waarde.value = oordrag.hosting;
    }
  });

  pro_verberg_strook();
}

function pro_verberg_strook() {
  const strook = document.getElementById("pro-strook");
  if (strook) strook.remove();
}

function pro_wys_strook() {
  const oordrag = pro_lees_oordrag();
  const vorm = document.getElementById("paneel-produk-vorm");
  if (!oordrag || !vorm || document.getElementById("pro-strook")) return;

  const strook = document.createElement("div");
  strook.id = "pro-strook";

  const teks = document.createElement("span");
  const vennote = PRO_FORMATE.map((f) => `${oordrag.vennoot[f.sleutel].toFixed(1)}%`).join(" / ");
  teks.textContent =
    `Daar is 'n uitslag van die Verdeling-rekenaar van ${pro_tyd_kort(oordrag.tyd)} — ` +
    `${oordrag.outeurs.length} outeur(s), ${oordrag.ontwerp_admin}% Ontwerp/Admin, ` +
    `vennote ${vennote} (e-boek / leen / harde kopie).`;
  strook.appendChild(teks);

  const vul = document.createElement("button");
  vul.type = "button";
  vul.className = "knoppie-primer";
  vul.textContent = "Vul in";
  vul.addEventListener("click", () => pro_vul_in(oordrag));
  strook.appendChild(vul);

  const weg = document.createElement("button");
  weg.type = "button";
  weg.className = "pro-strook-teks";
  weg.textContent = "Nee dankie";
  weg.addEventListener("click", () => {
    sessionStorage.removeItem(PRO_SLEUTEL);
    pro_verberg_strook();
  });
  strook.appendChild(weg);

  vorm.insertBefore(strook, vorm.firstChild);
}

// --- Styl ---

function pro_stel_styl_op() {
  if (document.getElementById("pro-oordrag-styl")) return;
  const styl = document.createElement("style");
  styl.id = "pro-oordrag-styl";
  styl.textContent = `
    .pro-oordrag-blok { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 18px; }
    .pro-oordrag-boodskap { font-size: 13px; color: var(--teal); }
    #pro-strook {
      background: #FFF7E6; border: 1px solid var(--amber); border-radius: 8px;
      padding: 13px 16px; margin-bottom: 18px; font-size: 13px; color: #6b5610;
      display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
    }
    #pro-strook > span { flex: 1; min-width: 220px; }
    #pro-strook .knoppie-primer { padding: 7px 15px; font-size: 12px; }
    .pro-strook-teks {
      background: none; border: none; color: #6b5610; text-decoration: underline;
      font-family: var(--font-liggaam); font-size: 12px; cursor: pointer; padding: 0;
    }
  `;
  document.head.appendChild(styl);
}

// --- Opstel ---
//
// Albei kante leef op paneelbord.html. Die rekenaar se knoppie word een
// keer bygevoeg; die strook verskyn elke keer wanneer 'n produkvorm oopgaan,
// wat 'n waarnemer vang sonder dat paneelbord.js iets hoef te sê.

function pro_stel_op() {
  pro_stel_styl_op();
  pro_stel_rekenaar_op();

  const vorm = document.getElementById("paneel-produk-vorm");
  if (!vorm) return;

  let wag;
  const kyk = () => {
    clearTimeout(wag);
    wag = setTimeout(() => {
      pro_stel_rekenaar_op();
      if (vorm.offsetParent !== null) pro_wys_strook();
    }, 150);
  };

  new MutationObserver(kyk).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "hidden"],
  });

  kyk();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pro_stel_op);
} else {
  pro_stel_op();
}
