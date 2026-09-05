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
  bank: { opening: null, sluiting: null },
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
    { headers: await identiteit_kop() }
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
  /* DIE INSKRYWING SE EIE DELE KOM EERSTE.
   *
   * 'n Ontvangs uit 'n faktuur dra sedert 4 September 2026 'n `dele`-lys:
   * die reels se kategoriee, pro rata oor hul bedrae. Sy dra OOK
   * `kategorie_id: "diensinkomste"` -- daardie waarde is die inskrywing se
   * eie kop en die terugval vir 'n ontvangs van voor daardie datum, wat geen
   * dele het nie. Word die dele hier nie eerste gelees nie, val elke ontvangs
   * onder Diensinkomste en die hele oefening was verniet. */
  const eie = Array.isArray(r.dele) ? r.dele.filter((d) => d && d.bedrag_sent) : [];
  if (eie.length) {
    return eie.map((d) => ({
      kategorie_id: d.kategorie_id || "",
      bedrag_sent: Number(d.bedrag_sent) || 0,
    }));
  }

  if (r.kategorie_id) {
    return [{ kategorie_id: r.kategorie_id, bedrag_sent: r.bedrag_sent }];
  }

  const waarvoor = Array.isArray(r.waarvoor) ? r.waarvoor : [];
  if (!waarvoor.length) {
    return [{ kategorie_id: "", bedrag_sent: r.bedrag_sent }];
  }

  const dele = waarvoor.map((w) => {
    /* DIE GEVRIESDE ID EERSTE, DIE NAAMPASSING DAARNA.
     *
     * 'n Uitbetaling wat sedert 4 September 2026 uitgereik is, dra die reel se
     * `kategorie_id` in `waarvoor`. Sy is gevries, dus verander 'n latere
     * wysiging aan die werk-itemregister niks aan 'n ou staat nie.
     *
     * Die naampassing bly vir alles wat voor daardie datum gevries is -- en
     * daardie fakture kan nooit reggemaak word nie, dus mag die pad nooit
     * verdwyn nie. */
    const item = per_naam.get(fs_sleutel(w.reel));
    return {
      kategorie_id: w.kategorie_id || (item && item.kategorie_id) || "",
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

      /* DIE RIGTING MOET PAS.
       *
       * `eie` is EEN versameling per kategorie, sonder rigting. 'n Uitgawe wat
       * na 'n INKOMSTEkategorie wys, is dus tot 4 September 2026 by daardie
       * kategorie se inkomste opgetel -- en die staat het R4 565,01 se
       * uitbetaling as inkomste gewys.
       *
       * Die rigting op die kategorie bestaan juis om dit te keer. Die staat
       * moet hom lees.
       *
       * PAS DIT NIE, VAL DIE BEDRAG ONDER ONGEKATEGORISEER -- sigbaar, en
       * nooit stil. 'n Bedrag wat weggelaat word, laat die staat nie meer tot
       * die bank tel nie, en niemand weet dit nie. */
      const kat = d.kategorie_id ? per_id.get(d.kategorie_id) : null;
      const rigting_pas = kat && (kat.rigting === "in" ? "in" : "uit") === teken;

      if (kat && rigting_pas) {
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

    ${fs_rekonsiliasie(inkomste, uitgawes)}

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

/* ═══ die bankrekonsiliasie ═══ */

/* DIE ENIGSTE REEL WAT SE OF DIE TYDPERK VOLLEDIG IS.

       openingsbalans + inkomste - uitgawes = sluitingsbalans

   Die staat kan se wat sy WEET; sy kan nie se of sy alles weet nie. Die bank
   kan. Klop dit tot die sent, is die tydperk volledig; klop dit nie, ontbreek
   daar 'n inskrywing -- en dan se die stelsel dit nou in plaas van by
   jaareinde.

   DIE DATUM VAN ELKE METING WORD GEWYS, nie net die bedrag nie. Niemand tik 'n
   balans vir elke dag in nie, dus is die "sluiting" die naaste meting op of
   voor die einddatum. Wys 'n mens net "sluitingsbalans", lyk 'n meting van drie
   maande gelede soos vandag s'n.

   'N VERSKIL IS NIE NOODWENDIG 'N FOUT NIE. Paystack vereffen in bondels, dus
   kan 'n bestelling van die 31ste eers op die 2de in die bank wees. Die
   boodskap se dus wat die verskil IS, nie wat dit beteken nie. */
function fs_rekonsiliasie(inkomste, uitgawes) {
  const o = FS.bank.opening;
  const s = FS.bank.sluiting;

  const vorm = `
    <div class="fs-bank-vorm">
      <div>
        <label class="veld-etiket" for="fs-bank-datum">${
          fs_t("fs_bank_datum", "Datum")}</label>
        <input class="veld-invoer" type="date" id="fs-bank-datum">
      </div>
      <div>
        <label class="veld-etiket" for="fs-bank-bedrag">${
          fs_t("fs_bank_bedrag", "Balans")}</label>
        <input class="veld-invoer" id="fs-bank-bedrag" inputmode="decimal" placeholder="0.00">
      </div>
      <button type="button" class="kaart-aksie" id="fs-bank-stoor">${
        fs_t("fs_bank_stoor", "Teken aan")}</button>
    </div>`;

  if (!o || !s || o.datum === s.datum) {
    return `
      <div class="fs-bank">
        <h4 class="fs-blok-kop">${fs_t("fs_bank_kop", "Bankrekonsiliasie")}</h4>
        <p class="fs-hulp">${fs_t("fs_bank_leeg",
          "Teken die balans aan op die dag voor die tydperk en op die laaste dag.")}</p>
        ${vorm}
      </div>`;
  }

  const beweeg = inkomste - uitgawes;
  const verwag = o.balans_sent + beweeg;
  const verskil = s.balans_sent - verwag;

  return `
    <div class="fs-bank">
      <h4 class="fs-blok-kop">${fs_t("fs_bank_kop", "Bankrekonsiliasie")}</h4>
      <table class="fs-tabel">
        <tbody>
          <tr><td class="fs-naam">${fs_t("fs_bank_open", "Balans op")} ${
            fs_ontsnap(o.datum)}</td>
              <td class="fs-tot">${fs_rand(o.balans_sent)}</td></tr>
          <tr><td class="fs-naam">${fs_t("fs_bank_beweeg", "Beweging")}</td>
              <td class="fs-tot">${(beweeg < 0 ? "\u2212 " : "") + fs_rand(beweeg)}</td></tr>
          <tr class="fs-som"><td class="fs-naam">${
            fs_t("fs_bank_verwag", "Berekende balans")}</td>
              <td class="fs-tot">${(verwag < 0 ? "\u2212 " : "") + fs_rand(verwag)}</td></tr>
          <tr><td class="fs-naam">${fs_t("fs_bank_sluit", "Balans op")} ${
            fs_ontsnap(s.datum)}</td>
              <td class="fs-tot">${(s.balans_sent < 0 ? "\u2212 " : "") + fs_rand(s.balans_sent)}</td></tr>
          <tr class="fs-som ${verskil ? "fs-ongekat" : ""}">
              <td class="fs-naam">${fs_t("fs_bank_verskil", "Verskil")}</td>
              <td class="fs-tot">${(verskil < 0 ? "\u2212 " : "") + fs_rand(verskil)}</td></tr>
        </tbody>
      </table>
      <p class="fs-hulp">${
        verskil === 0
          ? fs_t("fs_bank_klop", "Gerekonsilieer.")
          : fs_t("fs_bank_verskil_hulp", "Onverklaard. Vereffenings kan oor die tydperkgrens val.")
      }</p>
      ${vorm}
    </div>`;
}

async function fs_bank_stoor() {
  const datum = document.getElementById("fs-bank-datum").value;
  const rou = document.getElementById("fs-bank-bedrag").value.trim().replace(",", ".");
  if (!datum || rou === "") return;

  const sent = Math.round(Number(rou) * 100);
  if (!Number.isFinite(sent)) return;

  const knop = document.getElementById("fs-bank-stoor");
  knop.disabled = true;
  try {
    const resp = await fetch("/.netlify/functions/stoor-fin-bank", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ datum, balans_sent: sent }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    await fs_laai();
  } catch (fout) {
    console.error("Kon nie die bankbalans stoor nie:", fout);
    knop.disabled = false;
  }
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
      // GEEN VLAK NIE. Ongekategoriseer is nie 'n kategorie nie -- sy is die
      // bedrag wat by geen een pas nie. 'n 1 daar sou haar soos 'n
      // hoofkategorie laat lees en 'n mens sou haar in die boom gaan soek.
      "",
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

  // DIE TOTALE LOOP DEUR DIESELFDE `veilig` AS DIE RES. Die leë velde het as
  // kaal kommas geskryf -- Excel lees dit reg, maar 'n reel wat anders lyk as
  // die res is 'n reel wat 'n mens later verkeerd tel.
  reels.push("");
  const slot = (naam, sent) =>
    reels.push(["", naam, "", "", "", "", rand(sent).toFixed(2)].map(veilig).join(","));

  slot("Totale inkomste", som_van("in"));
  slot("Totale uitgawes", som_van("uit"));
  slot("Oorskot", som_van("in") - som_van("uit"));

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
    const [jn, kat, wi, bank] = await Promise.all([
      fs_vra("kry-joernaal", `van=${FS.van}&tot=${FS.tot}`),
      fs_vra("kry-fin-kategoriee"),
      fs_vra("kry-werk-items"),
      fs_vra("kry-fin-bank", `van=${FS.van}&tot=${FS.tot}`),
    ]);
    FS.inskrywings = Array.isArray(jn.inskrywings) ? jn.inskrywings : [];
    FS.kategoriee = Array.isArray(kat.kategoriee) ? kat.kategoriee : [];
    FS.werk_items = Array.isArray(wi.items) ? wi.items : [];
    FS.bank = { opening: bank.opening || null, sluiting: bank.sluiting || null };
  } catch (fout) {
    console.error("Kon nie die staat laai nie:", fout);
    plek.innerHTML = `<p class="stelsel-boodskap">${
      fs_t("fs_laai_fout", "Kon nie die staat laai nie.")}</p>`;
    return;
  }

  fs_tel_op();
  fs_teken();

  // NA fs_teken(), want die knoppie word saam met die blok herteken en 'n
  // luisteraar op 'n vervangde element bestaan nie meer nie.
  const bknop = document.getElementById("fs-bank-stoor");
  if (bknop) bknop.addEventListener("click", fs_bank_stoor);
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
