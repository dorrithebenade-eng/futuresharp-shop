// Aflewering is altyd 'n woonadres — Future Sharp gebruik 'n print-on-demand-
// verskaffer wat self koerierswerk hanteer. Personeel plaas die drukwerk-
// bestelling self by die verskaffer en verskaf die koper se adres direk
// (sien "drukker"-blok in data/bestelling-skema-voorbeeld.json).

const BESTELNOMMER_SLEUTEL = "future_shop_bestelnommer_konsep";

function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function etiket_vir_formaat(formaat) {
  return formaat === "harde_kopie" ? t("hardekopie_etiket") : t("eboek_etiket");
}

function kry_of_skep_bestelnommer() {
  let bestaande = sessionStorage.getItem(BESTELNOMMER_SLEUTEL);
  if (bestaande) return bestaande;

  const jaar = new Date().getFullYear();
  const volgnommer = String(Math.floor(100000 + Math.random() * 900000));
  const nommer = `FS-${jaar}-${volgnommer}`;
  sessionStorage.setItem(BESTELNOMMER_SLEUTEL, nommer);
  return nommer;
}

function bou_opsomming(items, totaal) {
  return `
    <section class="vb-afdeling">
      <h2 class="vb-afdeling-titel">${t("bestelling_opsomming")}</h2>
      <div class="vb-opsomming-lys">
        ${items
          .map(
            (i) => `
          <div class="vb-opsomming-ry">
            <span>${i.titel} <span class="vb-opsomming-formaat">(${etiket_vir_formaat(i.formaat)})</span></span>
            <span>${formateer_prys_sent(i.prys_sent)}</span>
          </div>`
          )
          .join("")}
      </div>
      <div class="vb-opsomming-totaal">
        <span>${t("totaal")}</span>
        <span>${formateer_prys_sent(totaal)}</span>
      </div>
    </section>
  `;
}

function bou_aflewer_afdeling() {
  return `
    <section class="vb-afdeling">
      <h2 class="vb-afdeling-titel">${t("aflewering_titel")}</h2>
      <p class="vb-afdeling-nota">${t("aflewering_nota")}</p>

      <div id="aflewer-adres-blok" class="aflewer-blok">
        <label class="veld-etiket" for="adres-straat">${t("straatadres")}</label>
        <input type="text" id="adres-straat" class="veld-invoer">
        <label class="veld-etiket" for="adres-stad">${t("stad")}</label>
        <input type="text" id="adres-stad" class="veld-invoer">
        <div class="veld-ry">
          <div>
            <label class="veld-etiket" for="adres-provinsie">${t("provinsie")}</label>
            <input type="text" id="adres-provinsie" class="veld-invoer">
          </div>
          <div>
            <label class="veld-etiket" for="adres-poskode">${t("poskode")}</label>
            <input type="text" id="adres-poskode" class="veld-invoer">
          </div>
        </div>
      </div>
    </section>
  `;
}

function bou_kontak_afdeling() {
  return `
    <section class="vb-afdeling">
      <h2 class="vb-afdeling-titel">${t("kontakbesonderhede")}</h2>
      <label class="veld-etiket" for="kontak-epos">${t("epos")}</label>
      <input type="email" id="kontak-epos" class="veld-invoer" required>
      <label class="veld-etiket" for="kontak-selfoon">${t("selfoonnommer")} <span class="veld-verplig">${t("verplig")}</span></label>
      <input type="tel" id="kontak-selfoon" class="veld-invoer" placeholder="08x xxx xxxx" required>
    </section>
  `;
}

function valideer_en_bou_bestelling(items, totaal, bestelnommer, bevat_harde_kopie) {
  const foute = [];

  const epos = document.getElementById("kontak-epos").value.trim();
  const selfoon = document.getElementById("kontak-selfoon").value.trim();

  if (!epos) foute.push(t("epos_verplig"));
  if (!selfoon) foute.push(t("selfoon_verplig"));

  let aflewering = null;

  if (bevat_harde_kopie) {
    const straat = document.getElementById("adres-straat").value.trim();
    const stad = document.getElementById("adres-stad").value.trim();
    const provinsie = document.getElementById("adres-provinsie").value.trim();
    const poskode = document.getElementById("adres-poskode").value.trim();

    if (!straat || !stad || !provinsie || !poskode) {
      foute.push(t("volledige_adres_verplig"));
    } else {
      aflewering = { straat, stad, provinsie, poskode };
    }
  }

  if (foute.length) {
    return { geldig: false, foute };
  }

  const bestelling = {
    bestelnommer,
    geskep_op: new Date().toISOString(),
    koper: { epos, selfoonnommer: selfoon },
    items,
    totaal_sent: totaal,
    bevat_harde_kopie,
    aflewering,
    status: "Konsep — wag vir betaling",
  };

  return { geldig: true, bestelling };
}

function wys_foute(foute) {
  const foutWrap = document.getElementById("vb-foute");
  if (!foute.length) {
    foutWrap.style.display = "none";
    foutWrap.innerHTML = "";
    return;
  }
  foutWrap.style.display = "block";
  foutWrap.innerHTML = foute.map((f) => `<p>${f}</p>`).join("");
}

async function stuur_na_betaling(bestelling) {
  const knoppie = document.getElementById("gaan-na-betaling");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = await fetch("/.netlify/functions/begin-betaling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bestelling),
    });

    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const data = await resp.json();
    if (!data.authorization_url) throw new Error("Geen authorization_url ontvang nie");

    window.location.href = data.authorization_url;
  } catch (fout) {
    console.error("Kon nie na betaling gaan nie:", fout);
    wys_foute([t("betaling_fout")]);
    knoppie.disabled = false;
    knoppie.textContent = t("gaan_na_betaling");
  }
}

function laai_vb() {
  const wrap = document.getElementById("vb-inhoud");
  const items = kry_mandjie();

  if (!items.length) {
    wrap.innerHTML = `
      <p class="stelsel-boodskap">
        ${t("mandjie_leeg")} <a href="index.html">${t("blaai_katalogus")}</a>.
      </p>
    `;
    return;
  }

  const totaal = kry_mandjie_totaal_sent();
  const bevatHardeKopie = mandjie_bevat_harde_kopie();
  const bestelnommer = kry_of_skep_bestelnommer();

  wrap.innerHTML = `
    <p class="vb-bestelnommer">${t("bestelnommer_etiket")}: <strong>${bestelnommer}</strong></p>
    ${bou_opsomming(items, totaal)}
    ${bevatHardeKopie ? bou_aflewer_afdeling() : ""}
    ${bou_kontak_afdeling()}
    <div id="vb-foute" class="vb-foute" style="display:none;"></div>
    <button class="kaart-aksie vb-betaal-knoppie" id="gaan-na-betaling">${t("gaan_na_betaling")}</button>
  `;

  document.getElementById("gaan-na-betaling").addEventListener("click", () => {
    const resultaat = valideer_en_bou_bestelling(items, totaal, bestelnommer, bevatHardeKopie);
    if (!resultaat.geldig) {
      wys_foute(resultaat.foute);
      return;
    }
    wys_foute([]);
    stuur_na_betaling(resultaat.bestelling);
  });
}

document.addEventListener("DOMContentLoaded", laai_vb);
