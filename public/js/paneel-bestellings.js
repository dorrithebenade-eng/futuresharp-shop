// paneel-bestellings.js — die "Bestellings"-oortjie: volledige lys van
// alle bestellings, met soek/filter, en 'n manier om harde-kopie-
// bestellings se drukstatus te merk. kry_outorisasie_kop() kom van
// paneelbord.js.

let ALLE_BESTELLINGS = [];

function formateer_prys_sent_bestelling(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function formateer_datum_vol_bestelling(iso_string) {
  if (!iso_string) return "—";
  const d = new Date(iso_string);
  return (
    d.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("af-ZA", { hour: "2-digit", minute: "2-digit" })
  );
}

function etiket_vir_formaat_bestelling(formaat) {
  return formaat === "harde_kopie" ? "Harde kopie" : "E-boek";
}

function bou_bestelling_kaart(b) {
  const status_klas = b.status === "Nuut" ? "paneel-status-merker--voltooi" : "paneel-status-merker--wag";

  const items_html = (b.items || [])
    .map(
      (i) =>
        `<li>${i.titel} <span class="paneel-bestelling-item-formaat">(${etiket_vir_formaat_bestelling(i.formaat)})</span> — ${formateer_prys_sent_bestelling(i.prys_sent)}</li>`
    )
    .join("");

  const koepon_html = b.koepon_toegepas
    ? `<p class="paneel-bestelling-koepon">🎟️ Koepon toegepas: <strong>${b.koepon_toegepas.kode}</strong></p>`
    : "";

  const gratis_html = b.paystack && b.paystack.gratis_via_koepon
    ? `<p class="paneel-bestelling-koepon">🎁 100%-koepon — geen Paystack-transaksie nie</p>`
    : "";

  const split_fout_html = b.split_fout
    ? `<p class="paneel-bestelling-waarskuwing">⚠️ Split-vangnet geaktiveer: ${b.split_fout}</p>`
    : "";

  let drukker_html = "";
  if (b.bevat_harde_kopie) {
    const geplaas = b.drukker && b.drukker.bestelling_geplaas;
    drukker_html = `
      <div class="paneel-bestelling-drukker">
        <span class="paneel-bestelling-drukker-status">
          📦 Drukwerk: ${geplaas ? `✅ Geplaas — ${formateer_datum_vol_bestelling(b.drukker.geplaas_op)}` : "⏳ Nog nie geplaas nie"}
        </span>
        <button type="button" class="terug-skakel paneel-bestelling-drukker-knoppie" data-bestelnommer="${b.bestelnommer}" data-huidige="${geplaas ? "1" : "0"}">
          ${geplaas ? "Merk as onvoltooid" : "Merk as geplaas"}
        </button>
      </div>
    `;
  }

  return `
    <div class="paneel-bestelling-kaart">
      <div class="paneel-bestelling-kop">
        <strong>${b.bestelnommer}</strong>
        <span class="paneel-status-merker ${status_klas}">${b.status}</span>
      </div>
      <p class="paneel-bestelling-meta">
        ${formateer_datum_vol_bestelling(b.geskep_op)} · ${(b.koper && b.koper.epos) || "—"} · <strong>${formateer_prys_sent_bestelling(b.totaal_sent)}</strong>
      </p>
      <ul class="paneel-bestelling-items">${items_html}</ul>
      ${koepon_html}
      ${gratis_html}
      ${split_fout_html}
      ${drukker_html}
    </div>
  `;
}

function pas_bestellings_filter_toe() {
  const soek_teks = document.getElementById("bestellings-soek").value.trim().toLowerCase();
  const status_filter = document.getElementById("bestellings-status-filter").value;
  const net_onafgehandelde_druk = document.getElementById("bestellings-net-onafgehandelde-druk").checked;

  const gefiltreer = ALLE_BESTELLINGS.filter((b) => {
    if (status_filter && b.status !== status_filter) return false;
    if (net_onafgehandelde_druk && !(b.bevat_harde_kopie && !(b.drukker && b.drukker.bestelling_geplaas))) {
      return false;
    }
    if (soek_teks) {
      const bestelnommer_pas = b.bestelnommer.toLowerCase().includes(soek_teks);
      const epos_pas = (b.koper && b.koper.epos || "").toLowerCase().includes(soek_teks);
      if (!bestelnommer_pas && !epos_pas) return false;
    }
    return true;
  });

  const wrap = document.getElementById("paneel-bestellings-lys");
  if (!gefiltreer.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">Geen bestellings pas by hierdie filter nie.</p>`;
    return;
  }
  wrap.innerHTML = gefiltreer.map(bou_bestelling_kaart).join("");

  wrap.querySelectorAll(".paneel-bestelling-drukker-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => hanteer_drukker_merk(knoppie));
  });
}

async function hanteer_drukker_merk(knoppie) {
  const bestelnommer = knoppie.dataset.bestelnommer;
  const huidige_geplaas = knoppie.dataset.huidige === "1";
  const nuwe_status = !huidige_geplaas;

  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const resp = await fetch("/.netlify/functions/wysig-bestelling-drukker", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ bestelnommer, bestelling_geplaas: nuwe_status }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const bygewerkte_bestelling = await resp.json();
    const idx = ALLE_BESTELLINGS.findIndex((b) => b.bestelnommer === bestelnommer);
    if (idx !== -1) ALLE_BESTELLINGS[idx] = bygewerkte_bestelling;
    pas_bestellings_filter_toe();
  } catch (fout) {
    console.error("Kon nie drukstatus wysig nie:", fout);
    alert("Kon nie drukstatus wysig nie — probeer weer.");
    knoppie.disabled = false;
    knoppie.textContent = huidige_geplaas ? "Merk as onvoltooid" : "Merk as geplaas";
  }
}

async function paneel_bestellings_laai() {
  const wrap = document.getElementById("paneel-bestellings-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">Word gelaai …</p>`;

  try {
    const resp = await fetch("/.netlify/functions/kry-alle-bestellings", {
      headers: kry_outorisasie_kop(),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    ALLE_BESTELLINGS = data.bestellings || [];
    pas_bestellings_filter_toe();
  } catch (fout) {
    console.error("Kon nie bestellings laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie bestellings laai nie.</p>`;
  }
}

// --- Excel-uitvoer ---

const REGISTER_ENDPOINTS_VIR_UITVOER = [
  { endpoint: "/.netlify/functions/kry-outeurs", respons_veld: "outeurs" },
  { endpoint: "/.netlify/functions/kry-vennote", respons_veld: "vennote" },
  { endpoint: "/.netlify/functions/kry-ontwerp-admin", respons_veld: "ontwerp_admin" },
  { endpoint: "/.netlify/functions/kry-printing", respons_veld: "printing" },
  { endpoint: "/.netlify/functions/kry-aflewering", respons_veld: "aflewering" },
];

// Bou 'n opsoektabel: subrekening-kode → leesbare naam — sodat die
// verdeling-blad regte name wys, nie net kriptiese ACCT_-kodes nie.
async function bou_subrekening_naam_opsoek() {
  const opsoek = {};
  const antwoorde = await Promise.all(
    REGISTER_ENDPOINTS_VIR_UITVOER.map((r) =>
      fetch(r.endpoint, { headers: kry_outorisasie_kop() })
        .then((resp) => (resp.ok ? resp.json() : null))
        .then((data) => (data ? { lys: data[r.respons_veld] || [] } : { lys: [] }))
        .catch(() => ({ lys: [] }))
    )
  );
  antwoorde.forEach(({ lys }) => {
    lys.forEach((item) => {
      if (item.subrekening_kode) opsoek[item.subrekening_kode] = item.naam;
    });
  });
  return opsoek;
}

function bestelling_binne_datumreeks(b, van_datum, tot_datum) {
  const b_datum = new Date(b.geskep_op);
  if (van_datum && b_datum < van_datum) return false;
  if (tot_datum && b_datum > tot_datum) return false;
  return true;
}

// Skakel 'n ArrayBuffer na 'n base64-string om — ExcelJS se blaaier-
// weergawe verwerk 'n beeld as base64-data-URI betroubaarder as 'n rou
// ArrayBuffer (wat intern 'n Node.js Buffer verwag, nie altyd korrek
// herken word in 'n blaaier-omgewing nie).
function array_buffer_na_base64(buffer) {
  let binêr = "";
  const grepe = new Uint8Array(buffer);
  const brok_grootte = 0x8000;
  for (let i = 0; i < grepe.length; i += brok_grootte) {
    binêr += String.fromCharCode.apply(null, grepe.subarray(i, i + brok_grootte));
  }
  return btoa(binêr);
}

async function laai_bestellings_as_excel() {
  const knoppie = document.getElementById("bestellings-laai-af-knoppie");
  const oorspronklike_teks = knoppie.textContent;
  knoppie.disabled = true;
  knoppie.textContent = "Word saamgestel …";

  // Future Sharp brand-kleure (ARGB — die "FF"-voorvoegsel is die alfa-kanaal)
  const TEAL = "FF3FB6A4";
  const TEAL_DONKER = "FF0F5257";
  const KORAAL = "FFEC5832";
  const GRYS_LIG = "FFF5F4F1";
  const GRYS_TEKS = "FF5B5B5B";
  const WIT = "FFFFFFFF";

  try {
    const van_waarde = document.getElementById("bestellings-uitvoer-van").value;
    const tot_waarde = document.getElementById("bestellings-uitvoer-tot").value;
    const van_datum = van_waarde ? new Date(van_waarde + "T00:00:00") : null;
    const tot_datum = tot_waarde ? new Date(tot_waarde + "T23:59:59") : null;

    const gekose_bestellings = ALLE_BESTELLINGS.filter((b) =>
      bestelling_binne_datumreeks(b, van_datum, tot_datum)
    );

    if (!gekose_bestellings.length) {
      alert("Geen bestellings in hierdie datumreeks nie.");
      return;
    }

    const naam_opsoek = await bou_subrekening_naam_opsoek();

    const werkboek = new ExcelJS.Workbook();
    werkboek.creator = "Future Shop";
    werkboek.created = new Date();

    // Logo ophaal — nie-krities, as dit om enige rede misluk, gaan ons
    // sonder voort in plaas daarvan om die hele uitvoer te faal, maar ons
    // TEKEN die fout wel in die Console aan sodat dit nagegaan kan word.
    let logo_id = null;
    try {
      const logo_resp = await fetch("/icons/paneel-ikoon-512.png");
      if (!logo_resp.ok) throw new Error(`Status ${logo_resp.status} vir /icons/paneel-ikoon-512.png`);
      const logo_buffer = await logo_resp.arrayBuffer();
      const logo_base64 = array_buffer_na_base64(logo_buffer);
      logo_id = werkboek.addImage({
        base64: `data:image/png;base64,${logo_base64}`,
        extension: "png",
      });
    } catch (logo_fout) {
      console.warn("Kon nie logo vir Excel-uitvoer laai nie (uitvoer gaan sonder logo voort):", logo_fout);
      logo_id = null;
    }

    // Bou 'n gestileerde kop-area (logo + titel) op 'n gegewe blad, en gee
    // die ry-nommer terug waar die werklike data-tabel behoort te begin.
    function bou_kop_area(blad, titel) {
      blad.getColumn(1).width = 4;
      blad.getRow(1).height = 20;
      blad.getRow(2).height = 20;
      blad.getRow(3).height = 20;

      if (logo_id) {
        blad.addImage(logo_id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 56, height: 56 } });
      }

      blad.getCell("C1").value = "FUTURE SHARP — FUTURE SHOP";
      blad.getCell("C1").font = { bold: true, size: 14, color: { argb: TEAL_DONKER } };

      blad.getCell("C2").value = titel;
      blad.getCell("C2").font = { bold: true, size: 12, color: { argb: KORAAL } };

      const reeks_teks =
        van_waarde || tot_waarde
          ? `Periode: ${van_waarde || "begin"} tot ${tot_waarde || "nou"}`
          : "Periode: alle bestellings";
      blad.getCell("C3").value = `${reeks_teks}  ·  Uitgevoer: ${new Date().toLocaleDateString("af-ZA")}`;
      blad.getCell("C3").font = { italic: true, size: 9, color: { argb: GRYS_TEKS } };

      return 5; // eerste leë ry ná die kop-area — kop-kolomme kom hier
    }

    function bou_kop_ry(blad, ry_nommer, etikette, kleur) {
      const ry = blad.getRow(ry_nommer);
      etikette.forEach((etiket, i) => {
        const sel = ry.getCell(i + 1);
        sel.value = etiket;
        sel.font = { bold: true, color: { argb: WIT } };
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kleur } };
        sel.alignment = { vertical: "middle" };
      });
      ry.commit();
    }

    // --- Blad 1: Bestellings-oorsig ---
    const blad1 = werkboek.addWorksheet("Bestellings");
    const kop_ry_1 = bou_kop_area(blad1, "Bestellings-oorsig");
    const etikette_1 = [
      "", "Bestelnommer", "Datum", "Koper e-pos", "Items", "Totaal (R)", "Status",
      "Bevat harde kopie", "Drukwerk geplaas", "Koepon-kode", "100%-koepon", "Split-vangnet",
    ];
    bou_kop_ry(blad1, kop_ry_1, etikette_1, TEAL);

    gekose_bestellings.forEach((b, i) => {
      const ry = blad1.getRow(kop_ry_1 + 1 + i);
      const waardes = [
        "",
        b.bestelnommer,
        formateer_datum_vol_bestelling(b.geskep_op),
        (b.koper && b.koper.epos) || "",
        (b.items || []).map((it) => `${it.titel} (${etiket_vir_formaat_bestelling(it.formaat)})`).join("; "),
        Number((b.totaal_sent / 100).toFixed(2)),
        b.status,
        b.bevat_harde_kopie ? "Ja" : "Nee",
        b.bevat_harde_kopie ? (b.drukker && b.drukker.bestelling_geplaas ? "Ja" : "Nee") : "n.v.t.",
        (b.koepon_toegepas && b.koepon_toegepas.kode) || "",
        b.paystack && b.paystack.gratis_via_koepon ? "Ja" : "Nee",
        b.split_fout ? "Ja" : "Nee",
      ];
      waardes.forEach((w, kol_i) => (ry.getCell(kol_i + 1).value = w));
      if (i % 2 === 1) {
        for (let kol_i = 2; kol_i <= etikette_1.length; kol_i++) {
          ry.getCell(kol_i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRYS_LIG } };
        }
      }
      const status_sel = ry.getCell(7);
      status_sel.font = { bold: true, color: { argb: b.status === "Nuut" ? TEAL_DONKER : "FFB8860B" } };
      ry.commit();
    });

    blad1.columns = [
      { width: 4 }, { width: 18 }, { width: 18 }, { width: 26 }, { width: 42 },
      { width: 12 }, { width: 16 }, { width: 15 }, { width: 15 }, { width: 14 }, { width: 13 }, { width: 13 },
    ];

    // --- Blad 2: Verdeling-opsplitsing ---
    const verdeling_rye = [];
    gekose_bestellings.forEach((b) => {
      if (!b.verdeling) return;
      Object.entries(b.verdeling).forEach(([kode, sent]) => {
        verdeling_rye.push({
          bestelnommer: b.bestelnommer,
          datum: formateer_datum_vol_bestelling(b.geskep_op),
          party: naam_opsoek[kode] || "(onbekend)",
          kode,
          bedrag: Number((sent / 100).toFixed(2)),
        });
      });
    });

    if (verdeling_rye.length) {
      const blad2 = werkboek.addWorksheet("Verdeling");
      const kop_ry_2 = bou_kop_area(blad2, "Verdeling-opsplitsing");
      const etikette_2 = ["", "Bestelnommer", "Datum", "Party", "Subrekening-kode", "Bedrag (R)"];
      bou_kop_ry(blad2, kop_ry_2, etikette_2, KORAAL);

      verdeling_rye.forEach((r, i) => {
        const ry = blad2.getRow(kop_ry_2 + 1 + i);
        [ "", r.bestelnommer, r.datum, r.party, r.kode, r.bedrag ].forEach(
          (w, kol_i) => (ry.getCell(kol_i + 1).value = w)
        );
        if (i % 2 === 1) {
          for (let kol_i = 2; kol_i <= etikette_2.length; kol_i++) {
            ry.getCell(kol_i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRYS_LIG } };
          }
        }
        ry.commit();
      });

      blad2.columns = [{ width: 4 }, { width: 18 }, { width: 18 }, { width: 26 }, { width: 22 }, { width: 14 }];
    }

    const buffer = await werkboek.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const skakel = document.createElement("a");
    const vandag_kort = new Date().toISOString().slice(0, 10);
    skakel.href = url;
    skakel.download = `Future-Shop-Bestellings-${van_waarde || "alles"}-tot-${tot_waarde || vandag_kort}.xlsx`;
    document.body.appendChild(skakel);
    skakel.click();
    skakel.remove();
    URL.revokeObjectURL(url);
  } catch (fout) {
    console.error("Kon nie Excel-lêer saamstel nie:", fout);
    alert("Kon nie die Excel-lêer saamstel nie — probeer weer.");
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = oorspronklike_teks;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("bestellings-soek").addEventListener("input", pas_bestellings_filter_toe);
  document.getElementById("bestellings-status-filter").addEventListener("change", pas_bestellings_filter_toe);
  document.getElementById("bestellings-net-onafgehandelde-druk").addEventListener("change", pas_bestellings_filter_toe);
  document.getElementById("bestellings-laai-af-knoppie").addEventListener("click", laai_bestellings_as_excel);
});

// Selfde "wag totdat paneel-inhoud sigbaar raak"-patroon as elders
(function paneel_bestellings_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_bestellings_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_bestellings_laai();
  }
})();
