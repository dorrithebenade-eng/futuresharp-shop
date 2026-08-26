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

let JN_SESSIE = null;
let JN_DATA = null;
let JN_RIGTING = "uit";

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

function jn_jaar_naam(jaar) {
  return `1 Maart ${jaar} \u2013 28 Februarie ${jaar + 1}`;
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

  const lys = JN_DATA.inskrywings || [];

  plek.innerHTML = lys
    .map((r, ix) => {
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
  if (leeg) leeg.hidden = lys.length > 0;

  document.getElementById("jn-s-in").textContent = jn_rand(JN_DATA.in_sent);
  document.getElementById("jn-s-uit").textContent = "\u2212 " + jn_rand(JN_DATA.uit_sent);
  const netto = document.getElementById("jn-s-net");
  netto.textContent = (JN_DATA.netto_sent < 0 ? "\u2212 " : "") + jn_rand(JN_DATA.netto_sent);
  netto.className = "jn-sy" + (JN_DATA.netto_sent < 0 ? " kort" : "");

  const tel = document.getElementById("jn-tel");
  if (tel) {
    tel.textContent = lys.length
      ? lys.length +
        " " +
        (lys.length === 1
          ? jn_t("jn_inskrywing", "inskrywing")
          : jn_t("jn_inskrywings", "inskrywings"))
      : "";
  }

  jn_koppel_lys();
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
      }),
    });

    document.getElementById("jn-besk").value = "";
    document.getElementById("jn-wie").value = "";
    document.getElementById("jn-bedrag").value = "";

    // DIE JAAR SPRING SAAM. Teken 'n mens iets van 'n ander finansiele jaar
    // aan, sou dit andersins verdwyn -- die lys wys net die gekose jaar, en
    // dan lyk dit of die inskrywing nie gestoor is nie.
    const jaar = jn_fin_jaar(datum);
    const keuse = document.getElementById("jn-jaar");
    if (keuse && Number(keuse.value) !== jaar) {
      jn_vul_jare(jaar);
      keuse.value = String(jaar);
    }

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

// 'n CSV, nie 'n Excel-lêer nie. Die boekhouer maak dit in Excel oop en die
// kolomme is skoon; 'n xlsx sou 'n biblioteek verg vir presies dieselfde
// uitkoms. Kommas word deur aanhalingstekens gedra.
function jn_voer_uit() {
  if (!JN_DATA) return;
  const veilig = (w) => '"' + String(w == null ? "" : w).replace(/"/g, '""') + '"';

  const reels = [
    ["Datum", "Beskrywing", "Betaal deur", "Bron", "In", "Uit"].map(veilig).join(","),
  ];

  (JN_DATA.inskrywings || []).forEach((r) => {
    const bedrag = (r.bedrag_sent / 100).toFixed(2);
    reels.push(
      [
        r.datum,
        r.beskrywing,
        r.wie || "",
        r.bron,
        r.rigting === "in" ? bedrag : "",
        r.rigting === "uit" ? bedrag : "",
      ]
        .map(veilig)
        .join(",")
    );
  });

  reels.push("");
  reels.push([veilig("Totaal in"), "", "", "", veilig((JN_DATA.in_sent / 100).toFixed(2)), ""].join(","));
  reels.push([veilig("Totaal uit"), "", "", "", "", veilig((JN_DATA.uit_sent / 100).toFixed(2))].join(","));
  reels.push([veilig("Verskil"), "", "", "", veilig((JN_DATA.netto_sent / 100).toFixed(2)), ""].join(","));

  // \uFEFF sodat Excel die lêer as UTF-8 lees; sonder dit word ë en é onleesbaar.
  const blob = new Blob(["\uFEFF" + reels.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `joernaal-${JN_DATA.jaar}-${JN_DATA.jaar + 1}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ═══ laai ═══ */

function jn_vul_jare(insluit) {
  const keuse = document.getElementById("jn-jaar");
  if (!keuse) return;

  const huidig = jn_fin_jaar(jn_vandag());
  const jare = [];
  for (let j = huidig; j >= huidig - 4; j -= 1) jare.push(j);
  if (Number.isFinite(insluit) && !jare.includes(insluit)) {
    jare.push(insluit);
    jare.sort((a, b) => b - a);
  }

  const gekies = keuse.value;
  keuse.innerHTML = jare
    .map((j) => `<option value="${j}">${jn_jaar_naam(j)}</option>`)
    .join("");
  if (gekies && jare.includes(Number(gekies))) keuse.value = gekies;
}

async function jn_laai() {
  const jaar = Number(document.getElementById("jn-jaar").value) || jn_fin_jaar(jn_vandag());
  try {
    JN_DATA = await jn_vra(`kry-joernaal?jaar=${jaar}`);
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

  jn_vul_jare();
  document.getElementById("jn-datum").value = jn_vandag();
  document.getElementById("jn-datum").max = jn_vandag();
  jn_stel_rigting("uit");

  document.getElementById("jn-r-in").addEventListener("click", () => jn_stel_rigting("in"));
  document.getElementById("jn-r-uit").addEventListener("click", () => jn_stel_rigting("uit"));
  document.getElementById("jn-voeg").addEventListener("click", jn_teken_aan);
  document.getElementById("jn-uitvoer").addEventListener("click", jn_voer_uit);
  document.getElementById("jn-jaar").addEventListener("change", jn_laai);

  ["jn-datum", "jn-besk", "jn-bedrag"].forEach((id) => {
    document.getElementById(id).addEventListener("input", jn_kyk_gereed);
  });

  // Eers laai wanneer iemand werklik na die joernaal toe gaan. Die Function
  // lees ELKE faktuur om die ontvangste en die uitbetalings te vind; dit hoef
  // nie te gebeur terwyl iemand in Fakture werk nie.
  let gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (afd.classList.contains("wys") && !gelaai) {
      gelaai = true;
      jn_laai();
    }
  });
  waarnemer.observe(afd, { attributes: true, attributeFilter: ["class"] });

  if (afd.classList.contains("wys")) {
    gelaai = true;
    jn_laai();
  }
});
