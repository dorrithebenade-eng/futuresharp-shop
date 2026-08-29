// public/js/faktuurpaneel-fin-staat.js
//
// Die inkomste- en uitgawestaat, onderaan die State-oortjie.
//
// GEEN NUWE FUNCTION NIE.
//
// Die staat tel op wat kry-joernaal.js reeds gee. 'n Tweede Function sou die
// hele drie-bron-logika moes dupliseer -- die betaalde fakture, die
// uitbetalings, die winkel se behoue deel en fooi -- en twee kopiee van
// daardie logika dryf uitmekaar. Wat op die joernaal staan, staan hier.
//
// DIE OPTELLING GEBEUR OP DIE SKERM, en die uitvoer bou uit DIESELFDE data.
// Die CSV kan dus nooit van die skerm verskil nie.
//
// DRIE OPROEPE:
//   kry-joernaal        die inskrywings vir die tydperk
//   kry-fin-kategoriee  die boom, reeds gesorteer, met vlak en pad
//   kry-werk-items      om 'n uitbetaling se reels aan 'n kategorie te koppel
//
// HOE 'N UITBETALING SY KATEGORIE KRY
//
// 'n Uitbetaling kom uit die fakture met 'n LEE kategorie -- die begunstigde
// dra nie een nie, die WERK dra een. Elke uitbetaling se `waarvoor` is 'n lys
// van {reel, bedrag_sent}: die reels waaruit daardie betaling opgebou is.
//
// Die staat pas elke reel se beskrywing teen 'n werk-item se NAAM en lees die
// kategorie daar. Pas niks, val daardie DEEL onder Ongekategoriseer -- nie die
// hele uitbetaling nie, want die bedrae staan per reel.
//
// DIE VERGELYKING IS OP DIE NAAM, NIE OP 'N ID NIE.
//
// Die faktuur se reel dra vrye teks met die werk-itemregister as datalist. 'n
// Harde verwysing sou bestaande fakture breek en 'n mens keer om iets te tik
// wat nog nie in die register is nie. Die datalist hou die name konsekwent; die
// Ongekategoriseer-reel vang wat daardeur geglip het.
//
// ONGEKATEGORISEER VERDWYN NOOIT.
//
// 'n Bedrag wat stil weggelaat word, is erger as een wat apart staan: dan tel
// die staat nie meer tot die bank nie, en niemand weet dit nie.

const FS = {
  sessie: null,
  van: "",
  tot: "",
  kategoriee: [],
  werk_items: [],
  inskrywings: [],
  boom: [],          // {kategorie, eie_sent, totaal_sent}
  ongekat: { in: 0, uit: 0, dele: [] },
};

function fs_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function fs_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fs_rand(sent) {
  return "R" + (Math.abs(Number(sent) || 0) / 100).toLocaleString("af-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function fs_vra(naam, vraag) {
  const resp = await fetch(
    "/.netlify/functions/" + naam + (vraag ? "?" + vraag : ""),
    { headers: { Authorization: `Bearer ${FS.sessie.access_token}` } }
  );
  if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
  return resp.json();
}

/* ═══ die optelling ═══ */

// Die naam van 'n reel, skoongemaak vir vergelyking. Hoofletters en spasies
// mag nie 'n eie kategorie maak nie -- "Reiskoste" en "reiskoste " is een ding.
function fs_sleutel(naam) {
  return String(naam || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Watter kategorie hoort by hierdie inskrywing? Gee 'n LYS van dele, want 'n
// uitbetaling kan oor meer as een reel loop en elke reel dra sy eie bedrag.
function fs_dele_van(r, per_naam) {
  if (r.kategorie_id) {
    return [{ kategorie_id: r.kategorie_id, bedrag_sent: r.bedrag_sent }];
  }

  const waarvoor = Array.isArray(r.waarvoor) ? r.waarvoor : [];
  if (!waarvoor.length) {
    return [{ kategorie_id: "", bedrag_sent: r.bedrag_sent }];
  }

  const dele = waarvoor.map((w) => {
    const item = per_naam.get(fs_sleutel(w.reel));
    return {
      kategorie_id: (item && item.kategorie_id) || "",
      bedrag_sent: Number(w.bedrag_sent) || 0,
      reel: w.reel || "",
    };
  });

  // DIE DELE MOET TOT DIE UITBETALING TEL. Loop `waarvoor` om een of ander
  // rede nie op tot die bedrag nie, val die verskil onder Ongekategoriseer in
  // plaas van te verdwyn.
  const som = dele.reduce((a, d) => a + d.bedrag_sent, 0);
  const oor = (Number(r.bedrag_sent) || 0) - som;
  if (oor !== 0) dele.push({ kategorie_id: "", bedrag_sent: oor, reel: "" });

  return dele;
}

function fs_tel_op() {
  const per_naam = new Map(
    FS.werk_items.map((w) => [fs_sleutel(w.naam), w])
  );
  const per_id = new Map(FS.kategoriee.map((k) => [k.id, k]));

  const eie = new Map();       // kategorie_id -> sent
  const ongekat = { in: 0, uit: 0, dele: [] };

  FS.inskrywings.forEach((r) => {
    const teken = r.rigting === "in" ? "in" : "uit";
    fs_dele_van(r, per_naam).forEach((d) => {
      if (!d.bedrag_sent) return;
      if (d.kategorie_id && per_id.has(d.kategorie_id)) {
        eie.set(d.kategorie_id, (eie.get(d.kategorie_id) || 0) + d.bedrag_sent);
        return;
      }
      ongekat[teken] += d.bedrag_sent;
      ongekat.dele.push({
        datum: r.datum,
        beskrywing: d.reel || r.beskrywing,
        bron: r.bron,
        rigting: teken,
        bedrag_sent: d.bedrag_sent,
      });
    });
  });

  // Die totaal van 'n kategorie is haar EIE plus al haar kinders, so diep as
  // wat sy loop. Die boom kom reeds gesorteer terug, dus is 'n kind altyd NA
  // haar ouer -- van agter af optel gee elke ouer haar kinders se totale.
  const totaal = new Map();
  for (let i = FS.kategoriee.length - 1; i >= 0; i -= 1) {
    const k = FS.kategoriee[i];
    const eie_s = eie.get(k.id) || 0;
    const kinders = FS.kategoriee
      .filter((x) => x.onder === k.id)
      .reduce((a, x) => a + (totaal.get(x.id) || 0), 0);
    totaal.set(k.id, eie_s + kinders);
  }

  FS.boom = FS.kategoriee.map((k) => ({
    kategorie: k,
    eie_sent: eie.get(k.id) || 0,
    totaal_sent: totaal.get(k.id) || 0,
  }));
  FS.ongekat = ongekat;
}

/* ═══ die skerm ═══ */

function fs_teken() {
  const plek = document.getElementById("fs-staat");
  if (!plek) return;

  const kant = (v) => Math.min((Number(v) || 1) - 1, 6) * 20;

  const blok = (rigting, titel) => {
    const rye = FS.boom.filter((b) => b.kategorie.rigting === rigting);
    // 'n Kategorie sonder 'n sent bly WEG. 'n Staat vol nulle laat 'n mens die
    // reels soek wat wel iets se.
    const met = rye.filter((b) => b.totaal_sent !== 0);
    if (!met.length && !FS.ongekat[rigting]) return "";

    const som = rye
      .filter((b) => !b.kategorie.onder)
      .reduce((a, b) => a + b.totaal_sent, 0) + FS.ongekat[rigting];

    return `
      <div class="fs-blok">
        <h4 class="fs-blok-kop">${fs_ontsnap(titel)}</h4>
        <table class="fs-tabel">
          <tbody>
            ${met.map((b) => `
              <tr class="${b.kategorie.onder ? "" : "fs-hoof"}">
                <td class="fs-naam" style="padding-left:${kant(b.kategorie.vlak)}px">${
                  fs_ontsnap(b.kategorie.naam)}</td>
                <td class="fs-eie">${b.eie_sent ? fs_rand(b.eie_sent) : ""}</td>
                <td class="fs-tot">${fs_rand(b.totaal_sent)}</td>
              </tr>`).join("")}
            ${FS.ongekat[rigting] ? `
              <tr class="fs-ongekat">
                <td class="fs-naam">${fs_t("fs_ongekat", "Ongekategoriseer")}</td>
                <td class="fs-eie">${fs_rand(FS.ongekat[rigting])}</td>
                <td class="fs-tot">${fs_rand(FS.ongekat[rigting])}</td>
              </tr>` : ""}
            <tr class="fs-som">
              <td class="fs-naam">${fs_ontsnap(titel)}</td>
              <td></td>
              <td class="fs-tot">${fs_rand(som)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  };

  const som_van = (rigting) =>
    FS.boom
      .filter((b) => b.kategorie.rigting === rigting && !b.kategorie.onder)
      .reduce((a, b) => a + b.totaal_sent, 0) + FS.ongekat[rigting];

  const inkomste = som_van("in");
  const uitgawes = som_van("uit");
  const oorskot = inkomste - uitgawes;

  // DIE HOSTINGVERGELYKING. Hosting is 'n heffing op projekwerk wat Future
  // Sharp se oorhoofse koste dra. Die enigste toets of die persentasie reg is,
  // is hierdie verskil -- en niemand kon dit tot nou sien nie.
  const gedek = FS.boom
    .filter((b) => b.kategorie.gedek_deur_hosting && b.kategorie.rigting === "uit")
    .reduce((a, b) => a + b.eie_sent, 0);

  plek.innerHTML = `
    ${blok("in", fs_t("fs_inkomste", "Inkomste"))}
    ${blok("uit", fs_t("fs_uitgawes", "Uitgawes"))}

    <table class="fs-tabel fs-slot">
      <tbody>
        <tr><td class="fs-naam">${fs_t("fs_tot_in", "Totale inkomste")}</td>
            <td class="fs-tot">${fs_rand(inkomste)}</td></tr>
        <tr><td class="fs-naam">${fs_t("fs_tot_uit", "Totale uitgawes")}</td>
            <td class="fs-tot">${fs_rand(uitgawes)}</td></tr>
        <tr class="fs-som"><td class="fs-naam">${
          fs_t("fs_oorskot", "Oorskot vir die tydperk")}</td>
            <td class="fs-tot${oorskot < 0 ? " kort" : ""}">${
              (oorskot < 0 ? "\u2212 " : "") + fs_rand(oorskot)}</td></tr>
      </tbody>
    </table>

    ${gedek ? `
      <div class="fs-hosting">
        <h4 class="fs-blok-kop">${fs_t("fs_hosting_kop", "Word die hosting gedek?")}</h4>
        <p class="fs-hulp">${fs_t("fs_hosting_hulp",
          "Uitgawes wat as \u201cgedek deur hosting\u201d gemerk is, teenoor wat hosting ingebring het. Uitgawes wat iemand uit sy eie sak gedra het sonder om te eis, is nie hierin nie.")}</p>
        <table class="fs-tabel">
          <tbody>
            <tr><td class="fs-naam">${
              fs_t("fs_hosting_uit", "Uitgawes gemerk \u201cgedek deur hosting\u201d")}</td>
                <td class="fs-tot">${fs_rand(gedek)}</td></tr>
          </tbody>
        </table>
      </div>` : ""}

    ${FS.ongekat.dele.length ? `
      <div class="fs-wag">
        <h4 class="fs-blok-kop">${fs_t("fs_wag_kop", "Wag vir 'n kategorie")}</h4>
        <p class="fs-hulp">${fs_t("fs_wag_hulp",
          "Beskrywings wat nie by 'n item in die register pas nie. Die bedrae staan hierbo as Ongekategoriseer \u2014 hulle verdwyn nooit.")}</p>
        <table class="fs-tabel">
          <tbody>
            ${FS.ongekat.dele.slice(0, 40).map((d) => `
              <tr>
                <td class="fs-naam">${fs_ontsnap(d.beskrywing)}</td>
                <td class="fs-eie">${fs_ontsnap(d.datum)}</td>
                <td class="fs-tot">${fs_rand(d.bedrag_sent)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}`;
}

/* ═══ die uitvoer ═══ */

// Dieselfde CSV-hantering as die joernaal s'n: aanhalingstekens om alles, en
// 'n \uFEFF sodat Excel die leer as UTF-8 lees.
//
// DIE VLAK STAAN AS 'N GETAL IN 'N EIE KOLOM. 'n CSV kan nie inkeping of
// vetdruk dra nie, en 'n boekhouer sorteer en filter op 'n getal -- op spasies
// kan hy nie.
function fs_voer_uit() {
  const veilig = (w) => '"' + String(w == null ? "" : w).replace(/"/g, '""') + '"';
  const rand = (s) => (Number(s) || 0) / 100;

  const reels = [
    ["Vlak", "Kategorie", "Val onder", "Rigting", "Gedek deur hosting", "Eie", "Totaal"]
      .map(veilig).join(","),
  ];

  FS.boom.forEach((b) => {
    if (!b.totaal_sent) return;
    const ouer = FS.kategoriee.find((k) => k.id === b.kategorie.onder);
    reels.push([
      b.kategorie.vlak,
      b.kategorie.naam,
      ouer ? ouer.naam : "",
      b.kategorie.rigting === "in" ? "Inkomste" : "Uitgawe",
      b.kategorie.gedek_deur_hosting ? "ja" : "",
      rand(b.eie_sent).toFixed(2),
      rand(b.totaal_sent).toFixed(2),
    ].map(veilig).join(","));
  });

  ["in", "uit"].forEach((rigting) => {
    if (!FS.ongekat[rigting]) return;
    reels.push([
      1,
      "Ongekategoriseer",
      "",
      rigting === "in" ? "Inkomste" : "Uitgawe",
      "",
      rand(FS.ongekat[rigting]).toFixed(2),
      rand(FS.ongekat[rigting]).toFixed(2),
    ].map(veilig).join(","));
  });

  const som_van = (rigting) =>
    FS.boom
      .filter((b) => b.kategorie.rigting === rigting && !b.kategorie.onder)
      .reduce((a, b) => a + b.totaal_sent, 0) + FS.ongekat[rigting];

  reels.push("");
  reels.push([veilig("Totale inkomste"), "", "", "", "", "", veilig(rand(som_van("in")).toFixed(2))].join(","));
  reels.push([veilig("Totale uitgawes"), "", "", "", "", "", veilig(rand(som_van("uit")).toFixed(2))].join(","));
  reels.push([veilig("Oorskot"), "", "", "", "", "", veilig(rand(som_van("in") - som_van("uit")).toFixed(2))].join(","));

  const blob = new Blob(["\uFEFF" + reels.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `staat-${FS.van}-tot-${FS.tot}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* ═══ laai ═══ */

async function fs_laai() {
  const plek = document.getElementById("fs-staat");
  if (!plek) return;

  FS.van = document.getElementById("fs-van").value;
  FS.tot = document.getElementById("fs-tot").value;
  if (!FS.van || !FS.tot) return;

  plek.innerHTML = `<p class="stelsel-boodskap">${fs_t("fp_laai", "Word gelaai \u2026")}</p>`;

  try {
    const [jn, kat, wi] = await Promise.all([
      fs_vra("kry-joernaal", `van=${FS.van}&tot=${FS.tot}`),
      fs_vra("kry-fin-kategoriee"),
      fs_vra("kry-werk-items"),
    ]);
    FS.inskrywings = Array.isArray(jn.inskrywings) ? jn.inskrywings : [];
    FS.kategoriee = Array.isArray(kat.kategoriee) ? kat.kategoriee : [];
    FS.werk_items = Array.isArray(wi.items) ? wi.items : [];
  } catch (fout) {
    console.error("Kon nie die staat laai nie:", fout);
    plek.innerHTML = `<p class="stelsel-boodskap">${
      fs_t("fs_laai_fout", "Kon nie die staat laai nie.")}</p>`;
    return;
  }

  fs_tel_op();
  fs_teken();
}

document.addEventListener("DOMContentLoaded", async () => {
  const afd = document.querySelector('[data-afdeling="state"]');
  if (!afd || !document.getElementById("fs-staat")) return;

  try {
    FS.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    FS.sessie = null;
  }
  if (!FS.sessie || !identiteit_het_rol(FS.sessie.gebruiker, "boekhouding")) return;

  // Die finansiele jaar loop 1 Maart tot 28 Februarie.
  const nou = new Date();
  const jaar = nou.getMonth() + 1 >= 3 ? nou.getFullYear() : nou.getFullYear() - 1;
  document.getElementById("fs-van").value = `${jaar}-03-01`;
  document.getElementById("fs-tot").value = nou.toISOString().slice(0, 10);

  document.getElementById("fs-wys").addEventListener("click", fs_laai);
  document.getElementById("fs-uitvoer").addEventListener("click", fs_voer_uit);

  // Eers laai wanneer iemand werklik na State toe gaan: kry-joernaal.js lees
  // elke faktuur en elke bestelling.
  let gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (afd.classList.contains("wys") && !gelaai) {
      gelaai = true;
      fs_laai();
    }
  });
  waarnemer.observe(afd, { attributes: true, attributeFilter: ["class"] });

  if (afd.classList.contains("wys")) {
    gelaai = true;
    fs_laai();
  }
});
