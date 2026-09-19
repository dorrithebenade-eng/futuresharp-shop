// public/js/faktuurpaneel-vereffenings.js
//
// Paystack se uitbetalings, onder Joernaal.
//
// WAAROM DIT HIER SIT EN NIE IN 'N SEWENDE PIL NIE. Die Joernaal wys wat
// gebeur het; hierdie lys wys waar daardie geld beland het. Die twee hoort
// langs mekaar, en 'n mens vra die tweede vraag altyd net ná die eerste.
//
// DIE DATUMS IS DIE JOERNAAL S'N. Twee stelle datumvelde op een blad beteken
// twee tydperke wat stilweg verskil, en dan vergelyk 'n mens Maart met April
// sonder om dit te weet.
//
// WAT HIERDIE LYS NIE DOEN NIE: boek. Dit lees die store en wys hom. Die
// joernaal se syfers kom van elders af en verander nie hierdeur nie.

let VF_SESSIE = null;
let VF_DATA = null;
let VF_OOP = null; // die sleutel van die ry wat oop is, of null

function vf_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function vf_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Presies soos jn_rand() in faktuurpaneel-joernaal.js: 'n harde spasie as
// duisendskeier en 'n komma voor die sente, sodat 'n bedrag oral op die blad
// dieselfde lyk.
function vf_rand(sent) {
  const n = Math.round(Math.abs(Number(sent) || 0));
  const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return "R" + heel + "," + String(n % 100).padStart(2, "0");
}

function vf_datum_af(iso) {
  if (!iso) return "";
  const maande = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const d = String(iso).split("-");
  if (d.length !== 3) return String(iso);
  return `${Number(d[2])} ${maande[Number(d[1]) - 1] || ""} ${d[0]}`;
}

// 'N VERWYSING DRA DIE FAKTUURNOMMER. _faktuur-uitreik.js bou hom as
// FS-01964-1789656222742: die deel voor die tweede koppelteken is die nommer.
//
// 'n Verwysing sonder daardie vorm is 'n winkelbestelling of iets anders. Dan
// word die verwysing self gewys, want 'n faktuurnommer belowe wat nie bestaan
// nie, is erger as geen nommer.
function vf_faktuurnommer(verwysing) {
  const dele = String(verwysing || "").split("-");
  if (dele.length >= 2 && /^[A-Z]{2}$/.test(dele[0]) && /^\d+$/.test(dele[1])) {
    return `${dele[0]}/${dele[1]}`;
  }
  return String(verwysing || "");
}

// DIE VERSKILMERK. 'n Uitbetaling se fooi moet klop met die som van sy
// transaksies se fooie. Klop dit nie, of ontbreek 'n transaksie in ons store,
// staan dit op die ry en nie net binne-in nie: 'n mens maak nie dertig rye oop
// om te sien of een skeef is nie.
function vf_merk(v) {
  if (v.ontbreek) return `<small class="vf-merk">${vf_t("vf_ontbreek_kort", "onvolledig")}</small>`;
  if (v.verskil_sent) return `<small class="vf-merk">${vf_t("vf_verskil_kort", "verskil")}</small>`;
  return "";
}

function vf_status_af(status) {
  const s = String(status || "").toLowerCase();
  if (s === "success") return vf_t("vf_status_klaar", "Uitbetaal");
  if (s === "processing") return vf_t("vf_status_oppad", "Oppad");
  if (s === "pending") return vf_t("vf_status_wag", "Wag");
  return status || "";
}

async function vf_vra(pad) {
  const resp = await fetch(`/.netlify/functions/${pad}`, {
    headers: await identiteit_kop(),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

// DIE GROEP: die uitbetalings wat uit DIESELFDE betalings kom.
//
// Een betaling van R35,00 word in drie stukke: Paystack se fooi, die
// hoofrekening se deel en die begunstigde se deel. Paystack betaal elke deel
// as sy eie uitbetaling uit, en hulle staan as aparte rye in hierdie lys.
//
// SONDER DIE GROEP VRA 'n MENS "waar is die res van die geld heen". Die
// antwoord staan 'n ry laer, met dieselfde datum, maar niks sê dit nie.
//
// Die band tussen hulle is die transaksieverwysing: albei uitbetalings noem
// dieselfde betaling. Dit is 'n vereniging van stelle -- deel twee
// uitbetalings een verwysing, is hulle een groep.
function vf_bou_groepe(alles) {
  const groep_van = new Map(); // sleutel -> groepnommer
  const per_verwysing = new Map();

  alles.forEach((v) => {
    (v.verwysings || []).forEach((r) => {
      if (!per_verwysing.has(r)) per_verwysing.set(r, []);
      per_verwysing.get(r).push(v.sleutel);
    });
  });

  let volgende = 0;
  alles.forEach((v) => {
    if (groep_van.has(v.sleutel)) return;

    // Alles wat aan hierdie een hang, en alles wat aan die hang.
    const nommer = volgende++;
    const stapel = [v.sleutel];
    while (stapel.length) {
      const sleutel = stapel.pop();
      if (groep_van.has(sleutel)) continue;
      groep_van.set(sleutel, nommer);

      const my = alles.find((x) => x.sleutel === sleutel);
      (my ? my.verwysings || [] : []).forEach((r) => {
        (per_verwysing.get(r) || []).forEach((ander) => {
          if (!groep_van.has(ander)) stapel.push(ander);
        });
      });
    }
  });

  return groep_van;
}

function vf_teken() {
  const lys = document.getElementById("vf-lys");
  const leeg = document.getElementById("vf-leeg");
  const som = document.getElementById("vf-som");
  if (!lys) return;

  const alles = (VF_DATA && VF_DATA.vereffenings) || [];

  if (!alles.length) {
    lys.innerHTML = "";
    if (leeg) leeg.hidden = false;
    if (som) som.textContent = "";
    return;
  }
  if (leeg) leeg.hidden = true;

  // DRIE SYFERS, NIE 'N TOTAAL NIE. Die hoofrekening se geld en 'n
  // begunstigde se geld is nie dieselfde geld nie, en 'n som daarvan sou
  // niks beteken nie. Wat nog oppad is, staan apart: dit het nog nie geland
  // nie.
  let hoof = 0;
  let ander = 0;
  let oppad = 0;
  for (const v of alles) {
    if (String(v.status).toLowerCase() !== "success") {
      oppad += Number(v.netto_sent) || 0;
      continue;
    }
    if (v.is_hoofrekening) hoof += Number(v.netto_sent) || 0;
    else ander += Number(v.netto_sent) || 0;
  }

  if (som) {
    const dele = [
      `${vf_t("vf_som_hoof", "Na die hoofrekening")}: ${vf_rand(hoof)}`,
      `${vf_t("vf_som_ander", "Na begunstigdes")}: ${vf_rand(ander)}`,
    ];
    if (oppad) dele.push(`${vf_t("vf_som_oppad", "Nog oppad")}: ${vf_rand(oppad)}`);
    som.textContent = dele.join(" \u00B7 ");
  }

  const groep_van = vf_bou_groepe(alles);

  lys.innerHTML = alles
    .map((v) => {
      const oop = VF_OOP === v.sleutel;
      const verwysings = v.verwysings || [];

      const kop = `
        <button type="button" class="vf-ry${oop ? " oop" : ""}" data-sleutel="${vf_ontsnap(v.sleutel)}"
                aria-expanded="${oop ? "true" : "false"}">
          <!-- DIE PYLTJIE SE DAT DIE RY OOPMAAK. Sonder hom lyk die lys soos 'n
               tabel en bly die transaksies daaronder onontdek; dit het presies
               so gebeur toe die blok die eerste keer gewys is. Hy draai wanneer
               die ry oop is, sodat die toestand ook sigbaar is. -->
          <span class="vf-pyl" aria-hidden="true">›</span>
          <span class="vf-dat">${vf_ontsnap(vf_datum_af(v.datum))}</span>
          <span class="vf-wie">${vf_ontsnap(v.ontvanger_naam)}${
            v.is_hoofrekening ? "" : `<small>${vf_ontsnap(v.ontvanger_kode)}</small>`
          }</span>
          <span class="vf-fooi">${v.fooi_sent ? `\u2212 ${vf_rand(v.fooi_sent)}` : ""}</span>
          <span class="vf-net">${vf_rand(v.netto_sent)}</span>
          <span class="vf-stand${
            String(v.status).toLowerCase() === "success" ? " klaar" : ""
          }">${vf_ontsnap(vf_status_af(v.status))}${vf_merk(v)}</span>
        </button>`;

      if (!oop) return kop;

      const binne = verwysings.length
        ? verwysings
            .map(
              (r) => `
          <div class="vf-tr">
            <span class="vf-tr-nom">${vf_ontsnap(vf_faktuurnommer(r))}</span>
            <small>${vf_ontsnap(r)}</small>
          </div>`
            )
            .join("")
        : `<p class="jn-leeg">${vf_t("vf_geen_transaksies", "Geen transaksies op hierdie uitbetaling nie.")}</p>`;

      // Die fooikontrole, in woorde. Klop dit, staan daar niks: 'n reël wat
      // elke keer "alles reg" sê, word na drie kere nie meer gelees nie.
      let kontrole = "";
      if (v.ontbreek) {
        kontrole = `<p class="vf-waarsku">${vf_t(
          "vf_ontbreek",
          "Van hierdie uitbetaling se transaksies is nog nie afgehaal nie, dus kan die fooie nie vergelyk word nie."
        )} (${v.ontbreek})</p>`;
      } else if (v.verskil_sent) {
        kontrole = `<p class="vf-waarsku">${vf_t(
          "vf_verskil",
          "Die fooi op hierdie uitbetaling klop nie met die transaksies s'n nie"
        )}: ${vf_rand(v.fooi_sent)} ${vf_t("vf_teenoor", "teenoor")} ${vf_rand(
          v.som_fooie_sent
        )}, ${vf_t("vf_verskil_van", "verskil")} ${vf_rand(v.verskil_sent)}.</p>`;
      }

      // DIE VOLLE PRENTJIE: wat die kliënte betaal het, wat Paystack gehou het,
      // en wat elke ontvanger gekry het. Die ry se eie ontvanger word gemerk,
      // sodat 'n mens sien waar in die prentjie hierdie ry sit.
      const groep = alles.filter((x) => groep_van.get(x.sleutel) === groep_van.get(v.sleutel));
      const betaal = Math.max(...groep.map((x) => Number(x.verwerk_sent) || 0), 0);
      const fooie = groep.reduce((a, x) => a + (Number(x.fooi_sent) || 0), 0);

      const prentjie = `
        <table class="vf-prent">
          <tr>
            <td>${vf_t("vf_betaal", "Kliënte het betaal")}</td>
            <td>${vf_rand(betaal)}</td>
          </tr>
          <tr class="vf-prent-fooi">
            <td>${vf_t("vf_paystack_fooi", "Paystack se fooi")}</td>
            <td>− ${vf_rand(fooie)}</td>
          </tr>
          ${groep
            .map(
              (x) => `<tr${x.sleutel === v.sleutel ? ' class="vf-prent-hier"' : ""}>
                <td>${vf_ontsnap(x.ontvanger_naam)}</td>
                <td>${vf_rand(x.netto_sent)}</td>
              </tr>`
            )
            .join("")}
        </table>`;

      return `${kop}
        <div class="vf-binne">
          ${prentjie}
          ${kontrole}
          ${binne}
        </div>`;
    })
    .join("");

  lys.querySelectorAll("[data-sleutel]").forEach((knop) => {
    knop.addEventListener("click", () => {
      const sleutel = knop.getAttribute("data-sleutel");
      VF_OOP = VF_OOP === sleutel ? null : sleutel;
      vf_teken();
    });
  });
}

async function vf_laai() {
  const van = (document.getElementById("jn-van") || {}).value;
  const tot = (document.getElementById("jn-tot") || {}).value;
  if (!van || !tot || van > tot) return;

  try {
    VF_DATA = await vf_vra(
      `kry-vereffenings?van=${encodeURIComponent(van)}&tot=${encodeURIComponent(tot)}`
    );
    vf_teken();
  } catch (fout) {
    console.error("Kon nie die uitbetalings laai nie:", fout);
    const leeg = document.getElementById("vf-leeg");
    if (leeg) {
      leeg.hidden = false;
      leeg.textContent = vf_t("vf_laai_fout", "Kon nie die uitbetalings laai nie.");
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const blok = document.getElementById("vf-blok");
  if (!blok) return;

  // DIESELFDE WAG AS DIE JOERNAAL. Die sessie is nie dadelik daar nie, en 'n
  // oproep sonder token kom as 403 terug met 'n leë lys wat soos 'n antwoord
  // lyk.
  for (let i = 0; i < 60 && !VF_SESSIE; i += 1) {
    try {
      VF_SESSIE = await identiteit_kry_huidige_sessie();
    } catch {
      VF_SESSIE = null;
    }
    if (!VF_SESSIE) await new Promise((r) => setTimeout(r, 100));
  }
  if (!VF_SESSIE) return;

  ["jn-van", "jn-tot"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", vf_laai);
  });

  await vf_laai();
});
