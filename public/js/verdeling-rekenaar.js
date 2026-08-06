// public/js/verdeling-rekenaar.js
//
// Interne beplanningshulpmiddel (personeel-alleen, leef binne die
// paneelbord se "Verdeling-rekenaar"-afdeling).
//
// WAT DIT DOEN: een som, drie aansigte daarvan.
//
//   Opstel        — wat presies in die katalogusvorm ingetik word.
//   Uiteensetting — elke rolspeler se randbedrag, plus 'n prysstrook.
//   Outeursaansig — 'n volskerm-oorlegsel met drie getalle.
//
// AL DRIE FORMATE GELYK (Augustus 2026): 'n boek is nie een prys nie —
// dit is e-boek, leen en harde kopie. Die rekenaar het voorheen een
// formaat op 'n slag hanteer, wat beteken het jy moes hom drie keer loop
// en die getalle onthou terwyl jy die vorm invul.
//
// TWEE INVOERRIGTINGS: die enigste verskil tussen hulle is een reël in
// vr_bereken(). "Wins" los die prys op uit die outeur se beoogde wins;
// "Prys" vat die prys soos gegee. Die tweede rigting is die praktiese een
// — 'n winkel prys op R150, nie op R142.86 nie — en dis ook die enigste
// rigting wat kan wys dat 'n prys NIE werk nie.
//
// WAAROM DIE OUTEURSAANSIG 'N OORLEGSEL IS EN NIE 'N OORTJIE NIE: 'n
// oortjie verander net die onderste helfte van die skerm. Die aannames,
// die persentasies en die outeur se eie drukkoste bly dan sigbaar bo dit
// — en die aannames is boonop invoervelde wat 'n besoeker kan verander.
// Die oorlegsel bevat geen interne syfer en geen invoerveld nie.
//
// ADMIN EN ONTWERP: die rekenaar hou hulle apart, want dit is twee soorte
// werk met twee koste. Die katalogusvorm het EEN Ontwerp/Admin-rol, want
// dit is tans een persoon. Opstel tel hulle dus saam tot een ry en wys
// die uitsplitsing as fynskrif — dis presies die vertaalwerk waarvoor die
// rekenaar bestaan.
//
// DIE OUTEUR SE PERSENTASIE is wysigbaar, maar leef in die ankerbalk en
// nie tussen die Aannames nie: 70/30 staan vas vir nuwe outeurs, en die
// veld is daar vir bestaande boeke wat op ander voorwaardes opgestel is.
//
// MEER AS EEN OUTEUR: die outeursdeel word oor 'n lys rye versprei, een
// per outeur. Die persentasies is van die VERKOOPPRYS, nie van die 70%
// nie — dis hoe die katalogusvorm dit vra, want elke verdelingsry is 'n
// persentasie van die volle prys. Twee outeurs op 35% elk deel dus 70%.
//
// 'n Onewe deling (70 oor drie) laat 'n oorskiet: dit gaan na die eerste
// ry, sodat die totaal presies klop. Die kontrole onder die rye sê wanneer
// dit nie klop nie — 'n halwe persent wat kortkom, gaan stil na Future
// Sharp toe en kan 'n jaar lank onopgemerk bly.
//
// DIE OUTEURSAANSIG VERANDER NIE by meer as een outeur nie. Mense wat saam
// 'n boek geskryf het, weet reeds dat hulle die 70% deel; hoe hulle dit
// onderling verdeel, is hulle ooreenkoms en nie 'n rekenaarding nie. Net
// die bewoording word meervoud.
//
// PAYSTACK SE FOOI dra BTW: (2,9% + R1) x 1,15. Sonder die BTW-lyn is die
// direkteursfooie omtrent 60c per R100 te optimisties.
//
// Suiwer front-end-berekening, raak geen Blobs-store of Function aan nie.

const VR_STANDAARD_OUTEUR_PCT = 70;

// Leen gebruik dieselfde onderliggende PDF as die e-boek. Hierdie breuk is
// net 'n vertrekpunt vir die "≈"-knoppie, nie 'n reël nie.
const VR_LEEN_BREUK = 0.35;

// Die outeur se druk- en afleweringskoste kom teen kosprys terug. Om die
// koper Paystack se fooi op daardie deel te laat dra, word dit deur 0,965
// gedeel - 1 minus die afgedwinge 3,5%. Die vaste R1,30 sit nie hierin
// nie; dit is eenmalig per transaksie en hoort by die boek self.
const VR_KOSTE_DEELTAL = 0.965;

const VR_FORMATE = [
  { sleutel: "eboek", naam: "E-boek", sub: "", verstek_k: "", k_wysigbaar: false, verstek_begin: "" },
  { sleutel: "leen", naam: "Leen", sub: "30 dae", verstek_k: "", k_wysigbaar: false, verstek_begin: "" },
  { sleutel: "hardekopie", naam: "Harde kopie", sub: "druk + aflewering", verstek_k: "", k_wysigbaar: true, verstek_begin: "" },
];

// Die pryse in die Uiteensetting se strook. Vas gekies om die vorm van die
// kromme te wys — Paystack se vaste fooi weeg by 'n lae prys die swaarste.
const VR_STROOK_PRYSE = [50, 100, 150, 250, 400];

let vr_modus = "wins";   // "wins" | "prys"
let vr_rond = 0;         // 0 | 5 | 10
let vr_aansig = "opstel"; // "opstel" | "uiteen"

function vr_formateer_rand(bedrag) {
  if (!Number.isFinite(bedrag)) return "R0.00";
  return `R${bedrag.toFixed(2)}`;
}

function vr_formateer_rand_rond(bedrag) {
  if (!Number.isFinite(bedrag)) return "R0";
  return `R${Math.round(bedrag).toLocaleString("en-ZA")}`;
}

function vr_getal(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value) || 0 : 0;
}

function vr_outeur_pct() {
  const waarde = vr_getal("vr-outeur-pct");
  return waarde > 0 && waarde < 100 ? waarde : VR_STANDAARD_OUTEUR_PCT;
}

function vr_afrond(prys) {
  return vr_rond > 0 ? Math.ceil(prys / vr_rond) * vr_rond : prys;
}

// ---------- Outeurs ----------

let vr_outeurs = [{ naam: "", pct: VR_STANDAARD_OUTEUR_PCT }];

const vr_outeur_som = () =>
  vr_outeurs.reduce((som, o) => som + (Number(o.pct) || 0), 0);

const vr_outeur_etiket = (outeur, indeks) =>
  String(outeur.naam || "").trim() || `Outeur ${indeks + 1}`;

// Die bewoording van die invoervelde volg die aantal outeurs. Word 'n
// outeur bygevoeg of verwyder, moet die etikette saam skuif — vandaar een
// helper eerder as die teks op drie plekke ingebak.
const vr_wins_etiket = () =>
  vr_outeurs.length > 1 ? "Outeurs se wins" : "Outeur se wins";

const vr_begin_etiket = (f) =>
  vr_modus === "prys"
    ? (f.k_wysigbaar ? "Boekprys — versending kom by" : "Verkoopprys")
    : vr_wins_etiket();

function vr_werk_begin_etikette_by() {
  VR_FORMATE.forEach((f) => {
    const el = document.getElementById(`vr-begin-etiket-${f.sleutel}`);
    if (el) el.textContent = vr_begin_etiket(f);
  });
}

// Versprei die outeursdeel eweredig. Werk in honderdstes sodat 70 oor drie
// nie 23,333… gee nie; die oorskiet gaan na die eerste ry.
function vr_versprei_outeurs() {
  const aantal = vr_outeurs.length;
  const totaal = Math.round(vr_outeur_pct() * 100);
  const elk = Math.floor(totaal / aantal);
  const oorskiet = totaal - elk * aantal;
  vr_outeurs.forEach((o, i) => {
    o.pct = (elk + (i === 0 ? oorskiet : 0)) / 100;
  });
}

function vr_bou_outeur_rye() {
  const wrap = document.getElementById("vr-outeur-rye");
  if (!wrap) return;

  wrap.innerHTML = vr_outeurs
    .map(
      (o, i) => `
    <div class="vr-outeur-ry">
      <label class="vr-veld"><span>Outeur ${i + 1}</span>
        <div class="vr-veld-invoer"><input type="text" data-vr-i="${i}" data-vr-veld="naam" value="${String(o.naam || "").replace(/"/g, "&quot;")}" placeholder="Naam (opsioneel)"></div>
      </label>
      <label class="vr-veld"><span>Sy deel</span>
        <div class="vr-veld-invoer"><input type="number" data-vr-i="${i}" data-vr-veld="pct" value="${o.pct}" step="0.5"><span>%</span></div>
      </label>
      <button type="button" class="vr-outeur-uit" data-vr-uit="${i}" ${vr_outeurs.length === 1 ? "disabled" : ""} aria-label="Verwyder outeur">✕</button>
    </div>`
    )
    .join("");

  wrap.querySelectorAll("input").forEach((el) => {
    el.addEventListener("input", () => {
      const i = Number(el.dataset.vrI);
      const veld = el.dataset.vrVeld;
      vr_outeurs[i][veld] = veld === "pct" ? Number(el.value) || 0 : el.value;
      vr_wys_outeur_som();
      vr_herbereken_alles();
    });
  });

  wrap.querySelectorAll("[data-vr-uit]").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      vr_outeurs.splice(Number(knoppie.dataset.vrUit), 1);
      vr_versprei_outeurs();
      vr_bou_outeur_rye();
      vr_herbereken_alles();
    });
  });

  vr_wys_outeur_som();
  vr_werk_begin_etikette_by();
}

function vr_wys_outeur_som() {
  const blok = document.getElementById("vr-outeur-som");
  if (!blok) return;

  const som = vr_outeur_som();
  const doel = vr_outeur_pct();
  const verskil = Number((doel - som).toFixed(2));
  const klop = Math.abs(verskil) < 0.005;

  blok.innerHTML = `
    <div class="vr-kontrole ${klop ? "vr-kontrole--ja" : "vr-kontrole--nee"}">
      <span>${klop ? "✓" : "⚠"}</span>
      <span>${
        klop
          ? `Die ${vr_outeurs.length} ${vr_outeurs.length === 1 ? "ry" : "rye"} tel saam <b>${som.toFixed(2)}%</b> — presies die outeursdeel.`
          : `Die rye tel <b>${som.toFixed(2)}%</b>, maar die outeursdeel is <b>${doel}%</b>. ${
              verskil > 0
                ? `<b>${verskil.toFixed(2)}%</b> kort`
                : `<b>${Math.abs(verskil).toFixed(2)}%</b> te veel`
            } — dit gaan andersins stil na Future Sharp toe.`
      }</span>
    </div>`;
}

// ---------- Berekening ----------

function vr_bereken(formaat) {
  const outeurPct = vr_outeur_pct();
  const begin = vr_getal(`vr-begin-${formaat.sleutel}`);
  const K = vr_getal(`vr-k-${formaat.sleutel}`);

  // DIE BOEK HET EEN PRYS. Wat 'n harde kopie duurder maak, is nie 'n ander
  // verdeling nie — dit is versending wat bo-op kom. Die 70/30 geld op die
  // BOEKPRYS, en die outeur se druk en aflewering loop skoon daardeur.
  //
  // Die kostedeel word deur 0,965 gedeel (1 minus die afgedwinge 3,5%).
  // Daardie opstoot bly in die hoofrekening en betaal Paystack se fooi op
  // die versending. Die outeur kry sy K presies terug, nie meer nie — gee
  // 'n mens hom die opgestote bedrag, dra Future Sharp die fooi steeds.
  //
  // By 'n e-boek en 'n leen is K nul en die som is wat dit altyd was.
  const boekprys = vr_modus === "wins" ? begin / (outeurPct / 100) : begin;
  const kosteDeel = K > 0 ? K / VR_KOSTE_DEELTAL : 0;

  let P = boekprys + kosteDeel;
  if (P <= 0) {
    return {
      formaat, P: 0, P_rou: 0, afgerond: false, leeg: true,
      B: 0, kosteDeel: 0, outeurVasteRand: 0, outeurPersRand: 0,
      outeurRand: 0, outeurWins: 0, K: 0, paystackRand: 0, hostingRand: 0,
      adminRand: 0, ontwerpRand: 0, futureSharpRand: 0, direkteursRand: 0,
      pct: () => 0,
    };
  }
  const P_rou = P;
  P = vr_afrond(P);

  // Ná afronding is die boekdeel wat werklik oorbly die basis vir elke
  // persentasie. Andersins tel die afronding stil by iemand se deel.
  const B = Math.max(0, P - kosteDeel);

  // Die outeur kry twee dinge: sy koste presies terug as 'n vaste bedrag,
  // en sy persentasie op die boekprys. In die katalogus is dit twee rye wat
  // bymekaar tel.
  const outeurVasteRand = K;
  const outeurPersRand = (outeurPct / 100) * B;
  const outeurRand = outeurVasteRand + outeurPersRand;
  const outeurWins = outeurPersRand;

  // Paystack reken op die VOLLE prys — hy weet niks van boekdele nie.
  const paystackRand = ((vr_getal("vr-paystack-pct") / 100) * P + vr_getal("vr-paystack-vaste")) * (1 + vr_getal("vr-btw-pct") / 100);

  // Die res geld op die boekprys. Andersins verdien Future Sharp op die
  // outeur se posgeld.
  const hostingRand = (vr_getal("vr-hosting-pct") / 100) * B;
  const adminRand = (vr_getal("vr-admin-pct") / 100) * B;
  const ontwerpRand = (vr_getal("vr-ontwerp-pct") / 100) * B;

  const futureSharpRand = P - outeurRand;
  const direkteursRand = futureSharpRand - paystackRand - hostingRand - adminRand - ontwerpRand;

  const pct = (rand) => (P > 0 ? (rand / P) * 100 : 0);

  return {
    formaat, P, P_rou, afgerond: Math.abs(P - P_rou) > 0.005,
    B, kosteDeel, outeurVasteRand, outeurPersRand,
    outeurRand, outeurWins, K, paystackRand, hostingRand, adminRand, ontwerpRand,
    futureSharpRand, direkteursRand, pct,
  };
}

const vr_bereken_alles = () => VR_FORMATE.map(vr_bereken);

// ---------- Aansig 1: Opstel ----------

function vr_aansig_opstel(uitslae) {
  const outeurPct = vr_outeur_pct();
  const hosting = vr_getal("vr-hosting-pct");
  const admin = vr_getal("vr-admin-pct");
  const ontwerp = vr_getal("vr-ontwerp-pct");
  const ontwerpAdmin = admin + ontwerp;
  const somKlop = Math.abs(outeurPct - vr_outeur_som()) < 0.005;
  const enigeK = uitslae.some((u) => u.K > 0);

  const kop = uitslae.map((u) => `<th>${u.formaat.naam}</th>`).join("");
  const prysRy = uitslae
    .map((u) => u.leeg ? "<td>—</td>" : `<td><span class="vr-getal">${u.P.toFixed(2)}</span>${u.afgerond ? `<span class="vr-fynskrif">van ${u.P_rou.toFixed(2)}</span>` : ""}</td>`)
    .join("");

  // Die persentasies verskil nou PER FORMAAT. By 'n harde kopie geld hulle
  // op die boekdeel, en die persentasie van die volle prys is dus laer.
  // Een kolom vir al drie sou 'n verkeerde getal in die vorm laat beland.
  const ry = (etiket, kies, fyn, klas) =>
    `<tr class="${klas || ""}"><td>${etiket}${fyn ? `<span class="vr-fynskrif">${fyn}</span>` : ""}</td>${uitslae
      .map((u) => `<td class="vr-getal">${kies(u)}</td>`)
      .join("")}</tr>`;

  const pctVan = (u, deel) => (u.P > 0 ? ((deel / 100) * u.B / u.P) * 100 : 0);

  return `
    <p class="vr-lei">Tik dit so in by <b>Katalogus &rarr; produk</b>, een kolom per formaat.</p>
    <table class="vr-tabel">
      <thead><tr><th>Veld</th>${kop}</tr></thead>
      <tbody>
        <tr class="vr-r-prys"><td>Prys (R)</td>${prysRy}</tr>
        <tr class="vr-r-groep"><td colspan="4">Verdelings</td></tr>
        ${enigeK ? ry("Outeur — druk en aflewering", (u) => (u.K > 0 ? `R${u.K.toFixed(2)}` : "—"), "vaste bedrag, nie 'n persentasie nie") : ""}
        ${vr_outeurs
          .map((o, i) => ry(`Outeur — ${vr_outeur_etiket(o, i)}`, (u) => `${((o.pct / 100) * u.B / (u.P || 1) * 100).toFixed(1)} %`))
          .join("")}
        ${enigeK ? ry("Outeur — saam", (u) => `${u.pct(u.outeurRand).toFixed(1)} %`, "die twee rye bymekaar", "vr-r-vet") : ""}
        ${ry("Ontwerp/Admin", (u) => `${pctVan(u, ontwerpAdmin).toFixed(1)} %`, `admin ${admin} % + ontwerp ${ontwerp} %`)}
        <tr class="vr-r-groep"><td colspan="4">Hosting</td></tr>
        ${ry("Hosting", (u) => `${pctVan(u, hosting).toFixed(1)} %`)}
      </tbody>
    </table>
    ${enigeK ? `<p class="vr-fynskrif vr-lei">Die harde kopie se persentasies lyk laer omdat sy prys die outeur se druk- en poskoste insluit. Trek dit af, en die verdeling is presies dieselfde ${outeurPct}/${100 - outeurPct} as die e-boek s'n.</p>` : ""}
    ${!somKlop ? `<div class="vr-kontrole vr-kontrole--nee"><span>⚠</span><span>Die outeursrye tel nie op tot ${outeurPct}% nie — maak dit eers reg voordat jy die vorm invul.</span></div>` : ""}
    ${vr_opstel_kontrole(uitslae)}`;
}

// Die kontrole reken per formaat, want die persentasies verskil nou per
// formaat. 'n Enkele som oor al drie sou by een van hulle lieg.
function vr_opstel_kontrole(uitslae) {
  const slegte = uitslae.filter((u) => !u.leeg && u.direkteursRand < 0).map((u) => u.formaat.naam);
  if (slegte.length) {
    return `<div class="vr-kontrole vr-kontrole--nee"><span>⚠</span><span><b>${slegte.join(" en ")}</b> los te min oor vir die hoofrekening — die direkteursfooie is negatief. Verhoog die prys of verlaag 'n koste-lyn.</span></div>`;
  }
  const gevul = uitslae.filter((u) => !u.leeg);
  if (!gevul.length) return "";
  const reels = gevul
    .map((u) => `${u.formaat.naam} ${(100 - u.pct(u.outeurRand) - u.pct(u.hostingRand) - u.pct(u.adminRand) - u.pct(u.ontwerpRand)).toFixed(1)}%`)
    .join(" · ");
  return `<div class="vr-kontrole vr-kontrole--ja"><span>✓</span><span>Wat die hoofrekening terughou: ${reels}. Genoeg vir Paystack se fooi by al drie pryse.</span></div>`;
}

// ---------- Aansig 2: Uiteensetting ----------

function vr_aansig_uiteen(uitslae) {
  const outeurPct = vr_outeur_pct();
  const kop = uitslae.map((u) => `<th>${u.formaat.naam}</th>`).join("");

  const ry = (etiket, kies, vet, kleurNegatief) =>
    `<tr class="${vet ? "vr-r-vet" : ""}"><td>${etiket}</td>${uitslae
      .map((u) => {
        const waarde = kies(u);
        return `<td class="vr-getal ${kleurNegatief && waarde < 0 ? "vr-negatief" : ""}">${vr_formateer_rand(waarde)}<span class="vr-fynskrif">${u.pct(waarde).toFixed(1)}%</span></td>`;
      })
      .join("")}</tr>`;

  const enigeK = uitslae.some((u) => u.K > 0);
  const negatief = uitslae.filter((u) => !u.leeg && u.direkteursRand < 0).map((u) => u.formaat.naam);

  return `
    <table class="vr-tabel">
      <thead><tr><th></th>${kop}</tr></thead>
      <tbody>
        <tr class="vr-r-prys"><td>Verkoopprys</td>${uitslae.map((u) => `<td><span class="vr-getal">${vr_formateer_rand(u.P)}</span></td>`).join("")}</tr>
        <tr class="vr-r-groep"><td colspan="4">Gaan uit</td></tr>
        ${ry(vr_outeurs.length > 1 ? "Outeurs saam" : "Outeur ontvang", (u) => u.outeurRand, true, false)}
        ${vr_outeurs.length > 1 ? vr_outeurs.map((o, i) => ry(`— ${vr_outeur_etiket(o, i)} (${o.pct}%)`, (u) => (o.pct / 100) * u.P, false, false)).join("") : ""}
        ${enigeK ? ry("Eie druk-/afleweringskoste", (u) => -u.K, false, false) : ""}
        ${enigeK ? ry(vr_outeurs.length > 1 ? "Outeurs se wins" : "Outeur se wins", (u) => u.outeurWins, false, true) : ""}
        <tr class="vr-r-groep"><td colspan="4">Bly by Future Sharp</td></tr>
        ${ry("Paystack (met BTW)", (u) => u.paystackRand, false, false)}
        ${ry("Hosting", (u) => u.hostingRand, false, false)}
        ${ry("Admin", (u) => u.adminRand, false, false)}
        ${ry("Ontwerp", (u) => u.ontwerpRand, false, false)}
        ${ry("Direkteursfooie", (u) => u.direkteursRand, true, true)}
      </tbody>
    </table>
    ${negatief.length ? `<div class="vr-kontrole vr-kontrole--nee"><span>⚠</span><span>Direkteursfooie is negatief by <b>${negatief.join(" en ")}</b> — Paystack, Hosting, Admin en Ontwerp saam is meer as die ${(100 - outeurPct).toFixed(1)}% wat by Future Sharp bly.</span></div>` : ""}
    ${vr_strook()}`;
}

// Wys wat prys aan die direkteursfooie doen. Die verdeling bly identies by
// elke prys — die kromme kom heeltemal van Paystack se vaste fooi.
function vr_strook() {
  const outeurPct = vr_outeur_pct();
  const paystackPct = vr_getal("vr-paystack-pct");
  const paystackVaste = vr_getal("vr-paystack-vaste");
  const btw = vr_getal("vr-btw-pct");
  const koste = vr_getal("vr-hosting-pct") + vr_getal("vr-admin-pct") + vr_getal("vr-ontwerp-pct");

  const waardes = VR_STROOK_PRYSE.map((P) => {
    const paystack = ((paystackPct / 100) * P + paystackVaste) * (1 + btw / 100);
    return P - (outeurPct / 100) * P - paystack - (koste / 100) * P;
  });
  const maks = Math.max(...waardes.map(Math.abs), 1);

  return `
    <div class="vr-strook">
      <div class="vr-strook-kop">Wat prys aan die direkteursfooie doen</div>
      <p class="vr-strook-lei">Dieselfde verdeling by elke prys. Die verskil kom van Paystack se vaste fooi, wat by 'n lae prys proporsioneel alles opvreet.</p>
      <div class="vr-strook-grid">
        ${VR_STROOK_PRYSE.map((P, i) => {
          const waarde = waardes[i];
          const hoogte = Math.max(3, (Math.abs(waarde) / maks) * 88);
          return `<div class="vr-staaf-kol">
            <span class="vr-staaf-bedrag ${waarde < 0 ? "vr-negatief" : ""}">${vr_formateer_rand(waarde)}</span>
            <div class="vr-staaf ${waarde < 0 ? "vr-staaf--neg" : ""}" style="height:${hoogte}px"></div>
            <span class="vr-staaf-prys">R${P}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

// ---------- Aansig 3: Outeur (oorlegsel) ----------

function vr_aansig_outeur(uitslae) {
  const eboek = uitslae[0];
  return `
    <div class="vr-oa-blokke">
      ${uitslae
        .map(
          (u) => `<div class="vr-oa-blok ${u.formaat.sleutel === "eboek" ? "vr-oa-blok--uitgelig" : ""}">
        <div class="vr-oa-formaat">${u.formaat.naam}</div>
        <div class="vr-oa-prys">Verkoopprys ${vr_formateer_rand(u.P)}</div>
        <div class="vr-oa-kry">${vr_formateer_rand(u.outeurRand)}</div>
        <div class="vr-oa-kry-etiket">gaan aan die ${vr_outeurs.length > 1 ? "outeurs" : "outeur"}</div>
      </div>`
        )
        .join("")}
    </div>
    <div class="vr-oa-leer">
      <div class="vr-oa-leer-kop">Wat dit beteken — e-boek teen ${vr_formateer_rand(eboek.P)}</div>
      <div class="vr-oa-leer-rye">
        ${[10, 50, 100]
          .map((n) => `<div class="vr-oa-leer-blok"><div class="vr-oa-leer-n">${n} boeke verkoop</div><div class="vr-oa-leer-bedrag">${vr_formateer_rand_rond(eboek.outeurRand * n)}</div></div>`)
          .join("")}
      </div>
    </div>
    <p class="vr-oa-nota">${uitslae.some((u) => u.K > 0) ? "Druk- en afleweringskoste kom volledig terug — Future Sharp verdien nie daarop nie. " : ""}Die ${vr_outeurs.length > 1 ? "outeurs behou saam" : "outeur behou"} ${vr_outeur_pct()}% van elke verkoop se boekwaarde. Die res dek Paystack se transaksiefooi, die platform, en Future Sharp se deel.</p>`;
}

// ---------- Teken ----------

function vr_herbereken_alles() {
  const uitslag = document.getElementById("vr-uitslag");
  if (!uitslag) return;

  const uitslae = vr_bereken_alles();
  uitslag.innerHTML = vr_aansig === "opstel" ? vr_aansig_opstel(uitslae) : vr_aansig_uiteen(uitslae);

  const afwyking = document.getElementById("vr-anker-afwyking");
  if (afwyking) afwyking.style.display = vr_outeur_pct() === VR_STANDAARD_OUTEUR_PCT ? "none" : "inline";

  const oorlegsel = document.getElementById("vr-oorlegsel");
  if (oorlegsel && oorlegsel.classList.contains("vr-oorlegsel-oop")) {
    document.getElementById("vr-oorlegsel-inhoud").innerHTML = vr_aansig_outeur(uitslae);
    document.getElementById("vr-oorlegsel-pct").textContent = `${vr_outeur_pct()}%`;
  }
}

// ---------- Opbou en koppeling ----------

function vr_bou_formaat_rye() {
  const wrap = document.getElementById("vr-formaat-rye");
  if (!wrap) return;

  wrap.innerHTML = VR_FORMATE.map(
    (f) => `
    <div class="vr-formaat-ry">
      <div class="vr-formaat-naam">${f.naam}${f.sub ? `<small>${f.sub}</small>` : ""}</div>
      <label class="vr-veld"><span id="vr-begin-etiket-${f.sleutel}">${vr_begin_etiket(f)}</span>
        <div class="vr-veld-invoer"><span>R</span><input type="number" id="vr-begin-${f.sleutel}" value="${f.verstek_begin}" step="10"></div>
      </label>
      ${f.k_wysigbaar ? `<label class="vr-veld"><span>Eie druk-/afleweringskoste</span><div class="vr-veld-invoer"><span>R</span><input type="number" id="vr-k-${f.sleutel}" value="${f.verstek_k}" step="10" placeholder="0"></div><span class="vr-fynskrif">Kom teen kosprys terug. Die verdeling geld op die res.</span></label>` : `<span class="vr-veld-leeg"></span>`}
      ${f.sleutel === "leen" ? `<button type="button" class="vr-wenk" id="vr-wenk-leen">≈ 35% van e-boek</button>` : `<span class="vr-wenk-leeg"></span>`}
    </div>`
  ).join("");

  VR_FORMATE.forEach((f) => {
    [`vr-begin-${f.sleutel}`, `vr-k-${f.sleutel}`].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", vr_herbereken_alles);
      el.addEventListener("change", vr_herbereken_alles);
    });
  });

  const wenk = document.getElementById("vr-wenk-leen");
  if (wenk) {
    wenk.addEventListener("click", () => {
      const eboek = vr_bereken(VR_FORMATE[0]);
      const voorstel = vr_modus === "prys"
        ? eboek.P * VR_LEEN_BREUK
        : eboek.P * VR_LEEN_BREUK * (vr_outeur_pct() / 100);
      document.getElementById("vr-begin-leen").value = Math.round(voorstel * 100) / 100;
      vr_herbereken_alles();
    });
  }
}

function vr_stel_modus(nuwe_modus) {
  // Dra die huidige som oor sodat die getalle nie spring wanneer jy wissel nie.
  const vorige = vr_bereken_alles();
  vr_modus = nuwe_modus;

  document.querySelectorAll("#vr-seg-modus button").forEach((k) => k.classList.toggle("vr-seg-aktief", k.dataset.modus === nuwe_modus));

  vorige.forEach((u) => {
    const veld = document.getElementById(`vr-begin-${u.formaat.sleutel}`);
    const etiket = document.getElementById(`vr-begin-etiket-${u.formaat.sleutel}`);
    if (veld) veld.value = Math.round((nuwe_modus === "prys" ? u.B : u.outeurWins) * 100) / 100;
    if (etiket) etiket.textContent = vr_begin_etiket(u.formaat);
  });

  vr_herbereken_alles();
}

function vr_maak_oorlegsel_oop() {
  const oorlegsel = document.getElementById("vr-oorlegsel");
  if (!oorlegsel) return;
  document.getElementById("vr-oorlegsel-inhoud").innerHTML = vr_aansig_outeur(vr_bereken_alles());
  document.getElementById("vr-oorlegsel-pct").textContent = `${vr_outeur_pct()}%`;
  const ankerTeks = document.getElementById("vr-oorlegsel-anker-teks");
  if (ankerTeks) ankerTeks.textContent = `van elke verkoop gaan aan die ${vr_outeurs.length > 1 ? "outeurs" : "outeur"}.`;
  oorlegsel.classList.add("vr-oorlegsel-oop");
  document.body.classList.add("vr-oorlegsel-aktief");
}

function vr_maak_oorlegsel_toe() {
  const oorlegsel = document.getElementById("vr-oorlegsel");
  if (!oorlegsel) return;
  oorlegsel.classList.remove("vr-oorlegsel-oop");
  document.body.classList.remove("vr-oorlegsel-aktief");
}

function vr_koppel_gebeurtenisse() {
  const wrap = document.getElementById("vr-formaat-rye");
  if (!wrap) return; // afdeling nie op hierdie bladsy nie

  vr_bou_formaat_rye();
  vr_bou_outeur_rye();

  const voegOuteur = document.getElementById("vr-voeg-outeur");
  if (voegOuteur) {
    voegOuteur.addEventListener("click", () => {
      vr_outeurs.push({ naam: "", pct: 0 });
      vr_versprei_outeurs();
      vr_bou_outeur_rye();
      vr_herbereken_alles();
    });
  }

  // Verander die outeursdeel in die ankerbalk, moet die rye saam skuif —
  // anders klop die som dadelik nie meer nie.
  const ankerVeld = document.getElementById("vr-outeur-pct");
  if (ankerVeld) {
    ankerVeld.addEventListener("input", () => {
      vr_versprei_outeurs();
      vr_bou_outeur_rye();
    });
  }

  const segModus = document.getElementById("vr-seg-modus");
  if (segModus) {
    segModus.addEventListener("click", (ev) => {
      const knoppie = ev.target.closest("button");
      if (knoppie) vr_stel_modus(knoppie.dataset.modus);
    });
  }

  const segRond = document.getElementById("vr-seg-rond");
  if (segRond) {
    segRond.addEventListener("click", (ev) => {
      const knoppie = ev.target.closest("button");
      if (!knoppie) return;
      vr_rond = Number(knoppie.dataset.rond);
      segRond.querySelectorAll("button").forEach((k) => k.classList.toggle("vr-seg-aktief", k === knoppie));
      vr_herbereken_alles();
    });
  }

  const oortjies = document.getElementById("vr-oortjies");
  if (oortjies) {
    oortjies.addEventListener("click", (ev) => {
      const knoppie = ev.target.closest("button");
      if (!knoppie) return;
      vr_aansig = knoppie.dataset.aansig;
      oortjies.querySelectorAll("button").forEach((k) => k.classList.toggle("vr-oortjie-aktief", k === knoppie));
      vr_herbereken_alles();
    });
  }

  const wysKnoppie = document.getElementById("vr-wys-outeur");
  if (wysKnoppie) wysKnoppie.addEventListener("click", vr_maak_oorlegsel_oop);

  const sluitKnoppie = document.getElementById("vr-oorlegsel-sluit");
  if (sluitKnoppie) sluitKnoppie.addEventListener("click", vr_maak_oorlegsel_toe);

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") vr_maak_oorlegsel_toe();
  });

  [
    "vr-outeur-pct", "vr-paystack-pct", "vr-paystack-vaste", "vr-btw-pct",
    "vr-hosting-pct", "vr-admin-pct", "vr-ontwerp-pct",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return; // veiligheidsnet — moenie die hele koppeling laat omval as een veld ontbreek nie
    el.addEventListener("input", vr_herbereken_alles);
    el.addEventListener("change", vr_herbereken_alles); // rugsteun vir blaaiers waar 'input' nie konsekwent op number-velde afvuur nie
  });

  vr_herbereken_alles();
}

// As hierdie skrip om een of ander rede eers ná DOMContentLoaded laai,
// sou 'n gewone addEventListener nooit afvuur nie — kyk eers self.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", vr_koppel_gebeurtenisse);
} else {
  vr_koppel_gebeurtenisse();
}
