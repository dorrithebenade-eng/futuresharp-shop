// public/js/faktuurpaneel-joernaal.js
//
// Die joernaal: inkomste en uitgawes wat NIE deur die faktuurmodule loop nie.
//
// DIE MAATSTAF IS TIKWERK. Ignatius doen sy bankstate een keer per jaar. Vat
// 'n inskrywing lank, gebeur dit nie, en dan sit hy in Februarie en probeer
// onthou wat 'n betaling van R340 in Junie was. Daarom vyf velde, 'n datum
// wat op vandag begin, "Uit" wat voorgekies is, en 'n herhaal-knoppie.
//
// DIE FAKTURE EN DIE UITBETALINGS WORD NIE HIER INGETIK NIE. kry-joernaal.js
// lees hulle uit die fakture en gee hulle saam terug; hulle dra 'n merkie en
// kan nie geskrap word nie.

// Hoeveel inskrywings altyd sigbaar is. Die vraag wat 'n mens onmiddellik na
// 'n inskrywing het, is of dit werklik daar is -- 'n lys agter 'n knoppie
// beantwoord dit nie. Oor 'n jaar staan daar honderde reels, en dan is 'n
// mens se blad vol van 'n lys wat hy selde lees.
const JN_WYS = 5;

let JN_SESSIE = null;
let JN_DATA = null;

/* DIE KATEGORIEE WORD EEN KEER GELAAI, nie by elke inskrywing nie.

   Die lys verander selde en die joernaal is 'n plek waar 'n mens vinnig agter
   mekaar tik. 'n Oproep per inskrywing sou die tweede een laat wag op iets wat
   nie verander het nie.

   MISLUK DIE LEES, BLY DIE JOERNAAL WERK. Die keuselys dra dan net die leë
   keuse, en die inskrywing gaan deur sonder 'n kategorie -- sy verskyn as
   "Ongekategoriseer" op die staat, sigbaar en met haar eie totaal. Die
   alternatief is 'n joernaal wat nie werk omdat 'n ander register stukkend is
   nie, en dit is die slegter ruil. */
let JN_KATEGORIEE = [];
let JN_RIGTING = "uit";
let JN_ALMAL = false;

function jn_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function jn_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jn_rand(sent) {
  const n = Math.round(Math.abs(Number(sent) || 0));
  const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return "R" + heel + "," + String(n % 100).padStart(2, "0");
}

// Wat 'n mens intik, is nie noodwendig wat 'n rekenaar 'n getal noem. "1 234,50"
// kom uit die bankstaat gekopieer, met 'n harde spasie en 'n komma.
function jn_sent(teks) {
  const skoon = String(teks || "").replace(/[\s\u00A0]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(skoon)) return NaN;
  return Math.round(parseFloat(skoon) * 100);
}

function jn_datum_af(d) {
  const m = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const p = String(d || "").split("-");
  return p.length === 3 ? Number(p[2]) + " " + m[Number(p[1]) - 1] + " " + p[0] : d || "";
}

// Vandag in die blaaier se eie tyd. toISOString() sou in SAST voor 02:00
// gisteraand se datum gee.
function jn_vandag() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Die finansiele jaar loop 1 Maart tot 28/29 Februarie, en word deur sy
// BEGINJAAR benoem: 2026 beteken 1 Maart 2026 tot 28 Februarie 2027.
function jn_fin_jaar(datum) {
  const p = String(datum || "").split("-");
  const j = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(j) || !Number.isFinite(m)) return null;
  return m >= 3 ? j : j - 1;
}

// Die eerste boekjaar waarvoor daar data KAN wees. Future Sharp is in 2024
// geregistreer, maar die stelsel se eerste faktuur is Augustus 2026. 'n
// Keuselys wat 2022 aanbied, bied jare aan wat nie kan bestaan nie.
//
// Dit is 'n VERSTEK, nie 'n grens nie: 'n mens kan 'n vroeere datum intik as
// daar ooit 'n rede is. 'n Grens wat keer, keer ook wanneer iemand 'n rede
// het wat die kode nie ken nie.
const JN_EERSTE_JAAR = 2026;

// 1 Maart van die boekjaar waarin 'n datum val.
function jn_jaar_begin(datum) {
  const j = jn_fin_jaar(datum);
  return j === null ? "" : `${j}-03-01`;
}

async function jn_vra(pad, opsies) {
  const resp = await fetch(`/.netlify/functions/${pad}`, {
    ...(opsies || {}),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JN_SESSIE.access_token}`,
      ...((opsies || {}).headers || {}),
    },
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

/* ═══ teken ═══ */

function jn_teken() {
  const plek = document.getElementById("jn-lys");
  if (!plek || !JN_DATA) return;

  const alles = JN_DATA.inskrywings || [];
  const lys = JN_ALMAL ? alles : alles.slice(0, JN_WYS);

  // Die INDEKS IN DIE VOLLE LYS, nie in die afgesnyde nie. Sonder dit
  // kopieer "herhaal" die verkeerde inskrywing sodra 'n mens verby die vyfde
  // kom -- en dit sou stilweg gebeur, met 'n bedrag wat amper reg lyk.
  plek.innerHTML = lys
    .map((r) => {
      const ix = alles.indexOf(r);
      const uit = r.rigting === "uit";
      const merk =
        r.bron === "hand"
          ? ""
          : `<span class="jn-bron">${jn_ontsnap(
              r.bron === "faktuur"
                ? jn_t("jn_bron_faktuur", "faktuur")
                : jn_t("jn_bron_uitbetaling", "uitbetaling")
            )}</span>`;

      // Net 'n handinskrywing kan herhaal of geskrap word. 'n Faktuur se
      // ontvangs en 'n uitbetaling kom uit die fakture; hulle bestaan nie in
      // die joernaal se store nie en het geen sleutel nie.
      const aksies =
        r.bron === "hand"
          ? `<button type="button" class="jn-herhaal" data-herhaal="${ix}">${jn_t(
              "jn_herhaal",
              "herhaal"
            )}</button>` +
            `<button type="button" class="jn-vee" data-skrap="${jn_ontsnap(
              r.sleutel
            )}" title="${jn_t("jn_verwyder", "Verwyder")}">&times;</button>`
          : "";

      return `
      <tr>
        <td>${jn_ontsnap(jn_datum_af(r.datum))}</td>
        <td>${jn_ontsnap(r.beskrywing)}${merk}${
          r.wie ? `<span class="jn-wie">${jn_ontsnap(r.wie)}</span>` : ""
        }</td>
        <td class="n${uit ? " jn-uit" : ""}">${uit ? "\u2212 " : ""}${jn_rand(
        r.bedrag_sent
      )}</td>
        <td class="n jn-aks">${aksies}</td>
      </tr>`;
    })
    .join("");

  const leeg = document.getElementById("jn-leeg");
  if (leeg) leeg.hidden = alles.length > 0;

  const wys_al = document.getElementById("jn-wys-al");
  if (wys_al) {
    wys_al.hidden = alles.length <= JN_WYS;
    wys_al.textContent = JN_ALMAL
      ? jn_t("jn_wys_minder", "Wys minder")
      : jn_t("jn_wys_al", "Wys al") + " " + alles.length;
  }

  document.getElementById("jn-s-in").textContent = jn_rand(JN_DATA.in_sent);
  document.getElementById("jn-s-uit").textContent = "\u2212 " + jn_rand(JN_DATA.uit_sent);
  const netto = document.getElementById("jn-s-net");
  netto.textContent = (JN_DATA.netto_sent < 0 ? "\u2212 " : "") + jn_rand(JN_DATA.netto_sent);
  netto.className = JN_DATA.netto_sent < 0 ? "kort" : "";

  document.getElementById("jn-s-deb").textContent = jn_rand(JN_DATA.debiteure_sent);
  document.getElementById("jn-s-kred").textContent = jn_rand(JN_DATA.krediteure_sent);
  jn_teken_wag();

  const tydperk = document.getElementById("jn-tydperk");
  if (tydperk) {
    const aantal =
      alles.length +
      " " +
      (alles.length === 1
        ? jn_t("jn_inskrywing", "inskrywing")
        : jn_t("jn_inskrywings", "inskrywings"));
    tydperk.textContent =
      jn_datum_af(JN_DATA.van) + " \u2013 " + jn_datum_af(JN_DATA.tot) + " \u00B7 " + aantal;
  }

  jn_koppel_lys();
}

// DIE OOP BLOK, of niks. Debiteure en krediteure is aparte lyste; die een
// vervang die ander sodat daar nooit twee lang lyste onder mekaar staan nie.
let JN_WAG_OOP = null;

function jn_teken_wag() {
  const plek = document.getElementById("jn-wag-lys");
  if (!plek || !JN_DATA) return;

  const deb = document.getElementById("jn-w-deb");
  const kred = document.getElementById("jn-w-kred");
  if (deb) deb.setAttribute("aria-expanded", String(JN_WAG_OOP === "deb"));
  if (kred) kred.setAttribute("aria-expanded", String(JN_WAG_OOP === "kred"));
  if (deb) deb.classList.toggle("oop", JN_WAG_OOP === "deb");
  if (kred) kred.classList.toggle("oop", JN_WAG_OOP === "kred");

  if (!JN_WAG_OOP) {
    plek.hidden = true;
    plek.innerHTML = "";
    return;
  }

  const lys =
    JN_WAG_OOP === "deb" ? JN_DATA.debiteure || [] : JN_DATA.krediteure || [];

  if (!lys.length) {
    plek.hidden = false;
    plek.innerHTML = `<p class="jn-leeg">${jn_t(
      "jn_wag_leeg",
      "Niks staan uit nie."
    )}</p>`;
    return;
  }

  plek.hidden = false;
  plek.innerHTML = lys
    .map(
      (r) => `
      <div class="jn-wag-ry">
        <span class="jn-wag-dat">${jn_ontsnap(jn_datum_af(r.datum))}</span>
        <span class="jn-wag-wat">${jn_ontsnap(r.nommer)}<small>${jn_ontsnap(
        JN_WAG_OOP === "deb" ? r.klient || "" : r.ontvanger || ""
      )}</small></span>
        <span class="jn-wag-bed">${jn_rand(r.bedrag_sent)}</span>
      </div>`
    )
    .join("");
}

function jn_koppel_lys() {
  // HERHAAL. Afrihost kom elke maand, LearnWorlds een keer per jaar,
  // bankkoste elke maand. Dieselfde beskrywing, dieselfde bedrag, 'n ander
  // datum. Sonder hierdie knoppie tik 'n mens Afrihost twaalf keer per jaar
  // oor -- en dit is presies waar 'n mens ophou aanteken.
  //
  // Niks skryf homself in nie. Dit vul die vorm; die datum bly oop.
  document.querySelectorAll("[data-herhaal]").forEach((b) => {
    b.addEventListener("click", () => {
      const r = JN_DATA.inskrywings[Number(b.getAttribute("data-herhaal"))];
      if (!r) return;
      document.getElementById("jn-besk").value = r.beskrywing;
      document.getElementById("jn-wie").value = r.wie || "";
      const kies = document.getElementById("jn-kategorie");
      // NA jn_stel_rigting(), want die lys word daar herteken -- 'n waarde wat
      // voor die herteken gestel word, val weg.
      if (kies) setTimeout(() => { kies.value = r.kategorie_id || ""; }, 0);
      document.getElementById("jn-bedrag").value = (r.bedrag_sent / 100)
        .toFixed(2)
        .replace(".", ",");
      jn_stel_rigting(r.rigting);
      jn_kyk_gereed();
      const datum = document.getElementById("jn-datum");
      datum.focus();
      datum.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-skrap]").forEach((b) => {
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await jn_vra("skrap-joernaal", {
          method: "POST",
          body: JSON.stringify({ sleutel: b.getAttribute("data-skrap") }),
        });
        await jn_laai();
      } catch (fout) {
        console.error("Kon nie die inskrywing skrap nie:", fout);
        b.disabled = false;
      }
    });
  });
}

/* ═══ die vorm ═══ */

function jn_stel_rigting(rigting) {
  JN_RIGTING = rigting === "in" ? "in" : "uit";
  // Die keuselys wys slegs kategoriee van hierdie rigting; sien
  // jn_teken_kategoriee().
  jn_teken_kategoriee();
  const i = document.getElementById("jn-r-in");
  const u = document.getElementById("jn-r-uit");
  if (i) i.className = JN_RIGTING === "in" ? "aan-in" : "";
  if (u) u.className = JN_RIGTING === "uit" ? "aan-uit" : "";
}

function jn_kyk_gereed() {
  const d = document.getElementById("jn-datum").value;
  const b = document.getElementById("jn-besk").value.trim();
  const s = jn_sent(document.getElementById("jn-bedrag").value);
  const knop = document.getElementById("jn-voeg");
  if (knop) knop.disabled = !(d && b && Number.isFinite(s) && s > 0);
}

function jn_wys_fout(teks) {
  const p = document.getElementById("jn-fout");
  if (!p) return;
  p.textContent = teks || "";
  p.hidden = !teks;
}

async function jn_laai_kategoriee() {
  const kies = document.getElementById("jn-kategorie");
  if (!kies) return;

  try {
    const data = await jn_vra("kry-fin-kategoriee", { method: "GET" });
    JN_KATEGORIEE = Array.isArray(data.kategoriee) ? data.kategoriee : [];
  } catch (fout) {
    console.error("Kon nie die kategoriee laai nie:", fout);
    JN_KATEGORIEE = [];
  }

  jn_teken_kategoriee();
}

/* DIE KEUSELYS WYS SLEGS DIE RIGTING WAT GEKIES IS.

   'n Uitgawe onder "Diensinkomste" verskyn WEL op die staat, net aan die
   verkeerde kant, en dan is die totale stil verkeerd. Die skerm hoef dit nie
   moontlik te maak nie.

   Vandaar dat hierdie funksie ook loop wanneer 'n mens die rigting wissel. */
function jn_teken_kategoriee() {
  const kies = document.getElementById("jn-kategorie");
  if (!kies) return;

  const gekies = kies.value;
  const leeg = `<option value="">${jn_t("jn_kat_geen", "\u2014 geen kategorie \u2014")}</option>`;

  kies.innerHTML = leeg + JN_KATEGORIEE
    .filter((k) => k.rigting === JN_RIGTING)
    .map((k) => `<option value="${jn_ontsnap(k.id)}">${jn_ontsnap(k.pad || k.naam)}</option>`)
    .join("");

  // Hou die keuse as sy nog in die nuwe lys is; andersins val sy terug na leeg.
  kies.value = Array.from(kies.options).some((o) => o.value === gekies) ? gekies : "";
}

async function jn_teken_aan() {
  const knop = document.getElementById("jn-voeg");
  const datum = document.getElementById("jn-datum").value;

  jn_wys_fout("");
  knop.disabled = true;
  knop.textContent = jn_t("jn_besig", "Besig \u2026");

  try {
    await jn_vra("stoor-joernaal", {
      method: "POST",
      body: JSON.stringify({
        datum,
        beskrywing: document.getElementById("jn-besk").value.trim(),
        wie: document.getElementById("jn-wie").value.trim(),
        bedrag_sent: jn_sent(document.getElementById("jn-bedrag").value),
        rigting: JN_RIGTING,
        kategorie_id: (document.getElementById("jn-kategorie") || {}).value || "",
      }),
    });

    document.getElementById("jn-besk").value = "";
    document.getElementById("jn-wie").value = "";
    document.getElementById("jn-bedrag").value = "";

    // DIE TYDPERK REK OM DIE NUWE INSKRYWING IN TE SLUIT. Teken 'n mens iets
    // van buite die gekose tydperk aan, sou dit andersins verdwyn -- en dan
    // lyk dit of dit nie gestoor is nie.
    const van = document.getElementById("jn-van");
    const tot = document.getElementById("jn-tot");
    if (datum < van.value) van.value = jn_jaar_begin(datum);
    if (datum > tot.value) tot.value = datum;

    await jn_laai();
    document.getElementById("jn-besk").focus();
  } catch (fout) {
    console.error("Kon nie die inskrywing stoor nie:", fout);
    jn_wys_fout(
      String(fout.message || "").trim() ||
        jn_t("jn_fout", "Kon nie die inskrywing stoor nie.")
    );
  } finally {
    knop.textContent = jn_t("jn_teken_aan", "Teken aan");
    jn_kyk_gereed();
  }
}

/* ═══ uitvoer ═══ */

// Die UITVOER dra die NAAM, nie die id nie. Die boekhouer lees "Bedryfskoste /
// Netlify", nie `netlify`. Die volle pad, want 'n plat CSV wys nie 'n boom nie.
//
// Ken die stelsel die id nie -- 'n ou inskrywing na 'n kategorie wat weg is --
// staan die id self daar. Dit is lelik en dit is die bedoeling: 'n mens moet
// dit sien en kan gaan soek.
function jn_kategorie_naam(id) {
  if (!id) return "";
  const k = JN_KATEGORIEE.find((x) => x.id === id);
  return k ? k.pad || k.naam : id;
}


// 'n CSV, nie 'n Excel-lêer nie. Die boekhouer maak dit in Excel oop en die
// kolomme is skoon; 'n xlsx sou 'n biblioteek verg vir presies dieselfde
// uitkoms. Kommas word deur aanhalingstekens gedra.
function jn_voer_uit() {
  if (!JN_DATA) return;
  const veilig = (w) => '"' + String(w == null ? "" : w).replace(/"/g, '""') + '"';

  const reels = [
    ["Datum", "Beskrywing", "Betaal deur", "Kategorie", "Bron", "In", "Uit"].map(veilig).join(","),
  ];

  (JN_DATA.inskrywings || []).forEach((r) => {
    const bedrag = (r.bedrag_sent / 100).toFixed(2);
    reels.push(
      [
        r.datum,
        r.beskrywing,
        r.wie || "",
        jn_kategorie_naam(r.kategorie_id),
        r.bron,
        r.rigting === "in" ? bedrag : "",
        r.rigting === "uit" ? bedrag : "",
      ]
        .map(veilig)
        .join(",")
    );
  });

  reels.push("");
  // DIE LEE KOLOMME TEL. Kom daar 'n kolom by, moet hierdie drie reels saam
  // skuif, anders staan die totale onder die verkeerde kop.
  reels.push([veilig("Totaal in"), "", "", "", "", veilig((JN_DATA.in_sent / 100).toFixed(2)), ""].join(","));
  reels.push([veilig("Totaal uit"), "", "", "", "", "", veilig((JN_DATA.uit_sent / 100).toFixed(2))].join(","));
  reels.push([veilig("Verskil"), "", "", "", "", veilig((JN_DATA.netto_sent / 100).toFixed(2)), ""].join(","));

  // \uFEFF sodat Excel die lêer as UTF-8 lees; sonder dit word ë en é onleesbaar.
  const blob = new Blob(["\uFEFF" + reels.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  // Die lêernaam dra die tydperk, want die uitvoer volg die filter: wat op
  // die skerm is, is wat in die lêer beland.
  a.download = `joernaal-${JN_DATA.van}-tot-${JN_DATA.tot}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ═══ laai ═══ */

function jn_stel_tydperk(van, tot) {
  document.getElementById("jn-van").value = van;
  document.getElementById("jn-tot").value = tot;
}

// HERSTEL sit die tydperk terug op die HUIDIGE boekjaar en laai dadelik.
// 'n Herstel wat 'n tweede klik verg, is nie 'n herstel nie.
function jn_herstel() {
  const vandag = jn_vandag();
  const begin = jn_jaar_begin(vandag);
  jn_stel_tydperk(begin < `${JN_EERSTE_JAAR}-03-01` ? `${JN_EERSTE_JAAR}-03-01` : begin, vandag);
  document.getElementById("jn-soek").value = "";
  jn_laai();
}

async function jn_laai() {
  const van = document.getElementById("jn-van").value;
  const tot = document.getElementById("jn-tot").value;
  const soek = document.getElementById("jn-soek").value.trim();

  if (!van || !tot || van > tot) {
    jn_wys_fout(jn_t("jn_tydperk_fout", "Die \u2018van\u2019-datum moet voor die \u2018tot\u2019-datum wees."));
    return;
  }
  jn_wys_fout("");

  try {
    JN_DATA = await jn_vra(
      `kry-joernaal?van=${van}&tot=${tot}&soek=${encodeURIComponent(soek)}`
    );
    JN_ALMAL = false;
    jn_teken();
  } catch (fout) {
    console.error("Kon nie die joernaal laai nie:", fout);
    jn_wys_fout(jn_t("jn_laai_fout", "Kon nie die joernaal laai nie."));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const afd = document.querySelector('.fp-afdeling[data-afdeling="joernaal"]');
  if (!afd) return;

  for (let i = 0; i < 60 && !JN_SESSIE; i += 1) {
    try {
      JN_SESSIE = await identiteit_kry_huidige_sessie();
    } catch {
      JN_SESSIE = null;
    }
    if (!JN_SESSIE) await new Promise((r) => setTimeout(r, 100));
  }
  if (!JN_SESSIE) return;

  document.getElementById("jn-datum").value = jn_vandag();
  document.getElementById("jn-datum").max = jn_vandag();
  jn_stel_rigting("uit");

  document.getElementById("jn-r-in").addEventListener("click", () => jn_stel_rigting("in"));
  document.getElementById("jn-r-uit").addEventListener("click", () => jn_stel_rigting("uit"));
  document.getElementById("jn-voeg").addEventListener("click", jn_teken_aan);
  document.getElementById("jn-uitvoer").addEventListener("click", jn_voer_uit);
  document.getElementById("jn-herstel").addEventListener("click", jn_herstel);
  ["jn-van", "jn-tot"].forEach((id) => {
    document.getElementById(id).addEventListener("change", jn_laai);
  });

  // Die soekwoord loop deur die bediener, dus wag ons tot iemand ophou tik.
  // 'n Oproep per toetsaanslag sou vyf keer soek vir "Afrihost".
  let tik = null;
  document.getElementById("jn-soek").addEventListener("input", () => {
    clearTimeout(tik);
    tik = setTimeout(jn_laai, 350);
  });

  document.getElementById("jn-wys-al").addEventListener("click", () => {
    JN_ALMAL = !JN_ALMAL;
    jn_teken();
  });

  document.getElementById("jn-w-deb").addEventListener("click", () => {
    JN_WAG_OOP = JN_WAG_OOP === "deb" ? null : "deb";
    jn_teken_wag();
  });
  document.getElementById("jn-w-kred").addEventListener("click", () => {
    JN_WAG_OOP = JN_WAG_OOP === "kred" ? null : "kred";
    jn_teken_wag();
  });

  ["jn-datum", "jn-besk", "jn-bedrag"].forEach((id) => {
    document.getElementById(id).addEventListener("input", jn_kyk_gereed);
  });

  jn_stel_tydperk(
    (() => {
      const b = jn_jaar_begin(jn_vandag());
      return b < `${JN_EERSTE_JAAR}-03-01` ? `${JN_EERSTE_JAAR}-03-01` : b;
    })(),
    jn_vandag()
  );

  // Eers laai wanneer iemand werklik na die joernaal toe gaan. Die Function
  // lees ELKE faktuur om die ontvangste en die uitbetalings te vind; dit hoef
  // nie te gebeur terwyl iemand in Fakture werk nie.
  let gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (afd.classList.contains("wys") && !gelaai) {
      gelaai = true;
      jn_laai();
      jn_laai_kategoriee();
    }
  });
  waarnemer.observe(afd, { attributes: true, attributeFilter: ["class"] });

  if (afd.classList.contains("wys")) {
    gelaai = true;
    jn_laai();
    jn_laai_kategoriee();
  }
});
