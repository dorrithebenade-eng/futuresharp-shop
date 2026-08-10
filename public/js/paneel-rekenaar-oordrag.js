// public/js/paneel-rekenaar-oordrag.js
//
// Dra die Verdeling-rekenaar se uitslag oor na 'n boek se produkvorm, en
// wys 'n lopende tel van elke formaat se verdeling.
//
// PER FORMAAT, NIE ALMAL GELYK NIE. Die aanbod sit binne elke formaat se
// eie afdeling, tussen die prysveld en die verdelings. 'n Strook boaan die
// vorm het beteken 'n mens rol op en af tussen die knoppie en die rye wat
// dit verander.
//
// DRIE SOORTE RYE WORD GESKRYF: Outeur (een per outeur), Ontwerp/Admin, en
// Hosting as merkblokkie. Die direkteursfooie is NIE 'n verdelingsry nie —
// dit is wat in die hoofrekening oorbly nadat die outeur, Ontwerp/Admin,
// Hosting en Paystack afgetrek is.
//
// PRINTING EN AFLEWERING BLY STAAN. Die rekenaar het geen veld daarvoor
// nie, en wat hy nie ken nie, mag hy nie uitvee nie. Hulle bestaan vir die
// geval waar Future Sharp die druk vir 'n bepaalde boek hanteer.
//
// DAAROM DIE TEL. Behou 'n mens 'n Printing-ry van 12% en die rekenaar het
// 70/5/3 bereken sonder om daarvan te weet, klop die som nie meer nie. Die
// vorm wys nêrens 'n totaal nie, so dit sou eers by stoortyd blyk wanneer
// die boek geweier word. Die tel loop saam met elke verandering, ook met
// die hand ingetik.
//
// Die tel reken met Paystack se AFGEDWINGE MINIMUM (3,5% + R1,30), nie sy
// werklike fooi (3,335% + R1,15) nie. Die minimum is wat skep-produk.js
// gaan vereis; reken 'n mens met die fooi, lyk 'n boek reg wat geweier
// gaan word.
//
// ONTDOEN sit terug wat daar was — prys, rye, merkblokkies — nie 'n leë
// afdeling nie. Die afskrif leef in die geheue en verdwyn saam met die
// bladsy. 'n Ou weergawe van 'n boek se verdeling word nêrens gestoor nie;
// dit is presies die soort ding wat later 'n verkeerde uitbetaling maak.
//
// EIE LÊER: paneelbord.js en verdeling-rekenaar.js bly onaangeraak. Die
// rye word deur die vorm se EIE voeg_verdeling_ry_by() geskep — 'n ry met
// ingespuite HTML lyk reg en stoor niks.

const PRO_SLEUTEL = "future_shop_rekenaar_oordrag";
const PRO_FORMATE = [
  { sleutel: "eboek", naam: "E-boek" },
  { sleutel: "leen", naam: "Leen" },
  { sleutel: "hardekopie", naam: "Harde kopie" },
];

// Rolle wat die rekenaar ken en dus mag vervang. Wat hier nie staan nie —
// printing en aflewering — bly staan.
const PRO_EIE_ROLLE = ["outeur", "vennoot", "ontwerp_admin"];

const pro_afskrifte = {};

// --- Paystack, presies soos _paystack-koste.js se afgedwinge minimum ---

function pro_minimum_pct(prys_rand) {
  if (!prys_rand || prys_rand <= 0) return 0;
  return Math.min(100, ((0.035 * prys_rand + 1.3) / prys_rand) * 100);
}

// --- Kant 1: die rekenaar ---

function pro_getal(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value) || 0 : 0;
}

// vr_outeurs leef in verdeling-rekenaar.js as 'n gewone skrip-veranderlike
// en is dus hier bereikbaar. Is dit weg, val ons terug op die enkele
// anker-persentasie.
function pro_lees_outeurs() {
  if (typeof vr_outeurs !== "undefined" && Array.isArray(vr_outeurs) && vr_outeurs.length) {
    return vr_outeurs.map((o) => ({ naam: String(o.naam || "").trim(), pct: Number(o.pct) || 0 }));
  }
  return [{ naam: "", pct: pro_getal("vr-outeur-pct") }];
}

// Die uitslag word HIER na persentasies van die prys omgereken, sodat die
// produkvorm niks hoef te weet van boekdele nie.
//
// vr_bereken_alles() is die enigste bron. Die invoerveld vr-begin-<formaat>
// is in wins-modus die outeur se VERLANGDE WINS, nie 'n prys nie — dit lees
// en as 'n prys deurgee, sit 'n te lae prys in die vorm.
function pro_bou_uitslag() {
  if (typeof vr_bereken_alles !== "function") return null;

  const outeurs = pro_lees_outeurs();
  const ontwerp_admin = pro_getal("vr-admin-pct") + pro_getal("vr-ontwerp-pct");
  const hosting = pro_getal("vr-hosting-pct");
  const formate = {};

  vr_bereken_alles().forEach((u) => {
    const P = u.P;
    // 'n Persentasie wat op die boekdeel geld, word 'n kleiner persentasie
    // van die volle prys. Die katalogus ken net die volle prys.
    const van_boekdeel = (pct) => (P > 0 ? (pct / 100) * u.B / P * 100 : 0);
    formate[u.formaat.sleutel] = {
      prys: Number(P.toFixed(2)),
      vaste: Number(u.K) || 0,
      outeurs: outeurs.map((o) => ({ naam: o.naam, pct: Number(van_boekdeel(o.pct).toFixed(2)) })),
      ontwerp_admin: Number(van_boekdeel(ontwerp_admin).toFixed(2)),
      hosting: Number(van_boekdeel(hosting).toFixed(2)),
    };
  });

  return { tyd: new Date().toISOString(), formate };
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
      const uitslag = pro_bou_uitslag();
      if (!uitslag) { boodskap.textContent = "Die rekenaar is nie gereed nie."; return; }
      sessionStorage.setItem(PRO_SLEUTEL, JSON.stringify(uitslag));
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
    if (!rou) return null;
    const oordrag = JSON.parse(rou);
    return oordrag && oordrag.formate ? oordrag : null;
  } catch {
    return null;
  }
}

function pro_tyd_kort(iso) {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return `${String(datum.getHours()).padStart(2, "0")}:${String(datum.getMinutes()).padStart(2, "0")}`;
}

// Lees die rye uit die vorm, in die eenheid wat DIE RYBOUER verwag.
//
// skep_verdeling_ry_element() aanvaar net 'n GETAL — Number.isFinite() op 'n
// string is vals, en dan teken hy die veld leeg. Die veld se `.value` is 'n
// string, dus moet dit hier deur Number().
//
// En hy verwag 'n vaste bedrag in SENT, want hy deel deur 100 om te wys.
// Die veld wys rand. Sonder die × 100 word 'n bewaarde R25,00-ry as R0,25
// teruggeskryf.
//
// Dit is dieselfde omskakeling as kry_verdelings_uit_vorm() s'n. Die rede om
// dit nie net te roep nie, is dat daardie een die rol- en entiteitvelde
// anders lees; die eenheid is nou wel dieselfde.
function pro_lees_rye(s) {
  const lys = document.getElementById(`vorm-${s}-verdelings-lys`);
  if (!lys) return [];
  return Array.from(lys.querySelectorAll(".paneel-verdeling-ry")).map((ry) => {
    const tipe = ry.querySelector(".paneel-verdeling-tipe").value;
    const rou = parseFloat(ry.querySelector(".paneel-verdeling-waarde").value);
    // 'n Leë veld bly leeg — nie 0 nie. 'n Nul wat verskyn waar niks was,
    // lyk soos 'n besluit.
    const waarde = Number.isFinite(rou)
      ? (tipe === "vaste_bedrag" ? Math.round(rou * 100) : rou)
      : null;
    return {
      rol_tipe: ry.querySelector(".paneel-verdeling-rol-tipe").value,
      entiteit_id: ry.querySelector(".paneel-verdeling-entiteit").value,
      tipe,
      waarde,
    };
  });
}

function pro_neem_afskrif(s) {
  const el = (id) => document.getElementById(`vorm-${s}-${id}`);
  return {
    prys: el("prys") ? el("prys").value : "",
    verdeling_aan: el("verdeling-aan") ? el("verdeling-aan").checked : false,
    rye: pro_lees_rye(s),
    hosting_aan: el("hosting-aan") ? el("hosting-aan").checked : false,
    hosting_tipe: el("hosting-tipe") ? el("hosting-tipe").value : "persentasie",
    hosting_waarde: el("hosting-waarde") ? el("hosting-waarde").value : "",
  };
}

function pro_merk(el, aan) {
  if (!el || el.checked === aan) return;
  el.checked = aan;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function pro_skryf_stand(s, stand) {
  const el = (id) => document.getElementById(`vorm-${s}-${id}`);

  if (el("prys")) el("prys").value = stand.prys;

  pro_merk(el("verdeling-aan"), stand.verdeling_aan);

  const lys = document.getElementById(`vorm-${s}-verdelings-lys`);
  if (lys) {
    lys.innerHTML = "";
    stand.rye.forEach((ry) => voeg_verdeling_ry_by(s, ry));
  }

  pro_merk(el("hosting-aan"), stand.hosting_aan);
  if (el("hosting-tipe")) el("hosting-tipe").value = stand.hosting_tipe;
  if (el("hosting-waarde")) el("hosting-waarde").value = stand.hosting_waarde;
}

function pro_vul_in(s, oordrag) {
  if (typeof voeg_verdeling_ry_by !== "function") {
    console.error("voeg_verdeling_ry_by ontbreek — die oordrag kan nie rye bou nie");
    return;
  }

  const u = oordrag.formate[s];
  if (!u) return;

  pro_afskrifte[s] = pro_neem_afskrif(s);

  // Wat die rekenaar nie ken nie, bly staan.
  const behou = pro_afskrifte[s].rye.filter((ry) => !PRO_EIE_ROLLE.includes(ry.rol_tipe));

  const nuwe = [];

  // Die outeur se druk- en afleweringskoste kom teen kosprys terug — 'n
  // vaste bedrag in rand, nie 'n persentasie nie. Dit is die eerste van sy
  // twee rye; die twee tel in begin-betaling.js bymekaar.
  if (u.vaste > 0) {
    // Die rekenaar werk in rand; die rybouer verwag sent.
    nuwe.push({
      rol_tipe: "outeur",
      entiteit_id: "",
      tipe: "vaste_bedrag",
      waarde: Math.round(u.vaste * 100),
    });
  }

  u.outeurs.forEach((outeur) => {
    nuwe.push({ rol_tipe: "outeur", entiteit_id: "", tipe: "persentasie", waarde: outeur.pct });
  });

  // Ontwerp/Admin word altyd geskep, ook by 0. 'n Ry wat sigbaar is, kan
  // weggeklik word; een wat stilweg ontbreek, word gemis.
  nuwe.push({ rol_tipe: "ontwerp_admin", entiteit_id: "", tipe: "persentasie", waarde: u.ontwerp_admin });

  pro_skryf_stand(s, {
    prys: u.prys > 0 ? u.prys : pro_afskrifte[s].prys,
    verdeling_aan: true,
    rye: nuwe.concat(behou),
    hosting_aan: u.hosting > 0 ? true : pro_afskrifte[s].hosting_aan,
    hosting_tipe: u.hosting > 0 ? "persentasie" : pro_afskrifte[s].hosting_tipe,
    hosting_waarde: u.hosting > 0 ? u.hosting : pro_afskrifte[s].hosting_waarde,
  });

  pro_teken(s);
}

function pro_ontdoen(s) {
  const afskrif = pro_afskrifte[s];
  if (!afskrif) return;
  pro_skryf_stand(s, afskrif);
  delete pro_afskrifte[s];
  pro_teken(s);
}

// --- Die tel ---
//
// Alles word na 'n persentasie van die prys omgereken. Die prys staan in
// RAND, maar pro_lees_rye() gee 'n vaste bedrag in SENT (dit is wat die
// rybouer verwag), dus word dit hier eers teruggedeel voordat dit teen die
// prys gemeet word.

function pro_tel(s) {
  const prys = Number((document.getElementById(`vorm-${s}-prys`) || {}).value) || 0;
  if (prys <= 0) return { prys: 0 };

  const na_pct = (tipe, waarde, in_sent) => {
    const getal = Number(waarde) || 0;
    const rand = tipe === "vaste_bedrag" && in_sent ? getal / 100 : getal;
    return tipe === "vaste_bedrag" ? (rand / prys) * 100 : rand;
  };

  const verdeling_aan = (document.getElementById(`vorm-${s}-verdeling-aan`) || {}).checked;
  let uit = 0;
  const dele = [];

  if (verdeling_aan) {
    pro_lees_rye(s).forEach((ry) => {
      const pct = na_pct(ry.tipe, ry.waarde, true);
      uit += pct;
      dele.push(`${pct.toFixed(1)}%`);
    });
  }

  const hosting_aan = (document.getElementById(`vorm-${s}-hosting-aan`) || {}).checked;
  let hosting = 0;
  if (hosting_aan) {
    // Hosting kom REGSTREEKS uit sy veld, dus in rand — nie deur
    // pro_lees_rye() nie.
    hosting = na_pct(
      (document.getElementById(`vorm-${s}-hosting-tipe`) || {}).value,
      (document.getElementById(`vorm-${s}-hosting-waarde`) || {}).value,
      false
    );
  }

  const paystack = pro_minimum_pct(prys);
  return { prys, uit, hosting, paystack, oor: 100 - uit - hosting - paystack, aantal: dele.length };
}

// --- Teken ---

function pro_anker(s) {
  const merk = document.getElementById(`vorm-${s}-verdeling-aan`);
  return merk ? merk.closest("label") : null;
}

function pro_teken(s) {
  const anker = pro_anker(s);
  if (!anker) return;

  let balk = document.getElementById(`pro-balk-${s}`);
  if (!balk) {
    balk = document.createElement("div");
    balk.id = `pro-balk-${s}`;
    balk.className = "pro-balk";
    anker.parentNode.insertBefore(balk, anker);
  }

  const oordrag = pro_lees_oordrag();
  const tel = pro_tel(s);
  balk.innerHTML = "";

  const teks = document.createElement("span");
  teks.className = "pro-balk-teks";
  if (!tel.prys) {
    teks.textContent = "Vul 'n prys in om die verdeling te kan tel.";
  } else {
    teks.textContent =
      `${tel.aantal} verdeling(s) ${tel.uit.toFixed(1)}%` +
      (tel.hosting > 0 ? ` · Hosting ${tel.hosting.toFixed(1)}%` : "") +
      ` · Paystack ${tel.paystack.toFixed(1)}% · vir Future Sharp bly ${tel.oor.toFixed(1)}% oor`;
    if (tel.oor < 0) balk.classList.add("pro-balk-fout");
  }
  balk.appendChild(teks);

  if (oordrag) {
    const aanbod = document.createElement("span");
    aanbod.className = "pro-balk-aanbod";
    const u = oordrag.formate[s] || {};
    aanbod.textContent =
      `Rekenaar ${pro_tyd_kort(oordrag.tyd)}` +
      (u.prys > 0 ? ` · R${u.prys.toFixed(2)}` : "") +
      (u.vaste > 0 ? ` · druk/aflewering R${u.vaste.toFixed(2)} vas` : "") +
      ` · ${(u.outeurs || []).length} outeur(s) ${(u.outeurs || []).map((o) => o.pct).join("/")}%` +
      ` · Ontwerp/Admin ${u.ontwerp_admin}%` +
      (u.hosting > 0 ? ` · Hosting ${u.hosting}%` : "");
    balk.appendChild(aanbod);

    const knoppie = document.createElement("button");
    knoppie.type = "button";
    knoppie.className = "knoppie-primer pro-balk-knoppie";
    if (pro_afskrifte[s]) {
      knoppie.textContent = "Ontdoen";
      knoppie.addEventListener("click", () => pro_ontdoen(s));
    } else {
      knoppie.textContent = "Vul in";
      knoppie.addEventListener("click", () => pro_vul_in(s, oordrag));
    }
    balk.appendChild(knoppie);
  }
}

function pro_teken_almal() {
  PRO_FORMATE.forEach((f) => pro_teken(f.sleutel));
}

// --- Styl ---

function pro_stel_styl_op() {
  if (document.getElementById("pro-oordrag-styl")) return;
  const styl = document.createElement("style");
  styl.id = "pro-oordrag-styl";
  styl.textContent = `
    .pro-oordrag-blok { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 18px; }
    .pro-oordrag-boodskap { font-size: 13px; color: var(--teal); }
    .pro-balk {
      background: #FFF7E6; border: 1px solid var(--amber); border-radius: 8px;
      padding: 9px 13px; margin: 12px 0; font-size: 12px; color: #6b5610;
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    }
    .pro-balk-fout { background: #FDECEC; border-color: #d98a8a; color: #8a2b2b; }
    .pro-balk-teks { flex-basis: 100%; font-weight: 600; }
    .pro-balk-aanbod { flex: 1; min-width: 200px; }
    .pro-balk-knoppie { padding: 5px 13px; font-size: 12px; }
  `;
  document.head.appendChild(styl);
}

// --- Opstel ---

function pro_stel_op() {
  pro_stel_styl_op();
  pro_stel_rekenaar_op();

  const vorm = document.getElementById("paneel-produk-vorm");
  if (!vorm) return;

  // Elke verandering binne die vorm tel weer. Ook 'n ry wat bygevoeg of
  // verwyder word, want dit gebeur sonder 'n input-gebeurtenis.
  vorm.addEventListener("input", pro_teken_almal);
  vorm.addEventListener("change", pro_teken_almal);

  let wag;
  const kyk = () => {
    clearTimeout(wag);
    wag = setTimeout(() => {
      pro_stel_rekenaar_op();
      if (vorm.offsetParent !== null) pro_teken_almal();
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
