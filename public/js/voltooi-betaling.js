// Aflewering is altyd 'n woonadres — Future Sharp gebruik 'n print-on-demand-
// verskaffer wat self koerierswerk hanteer. Personeel plaas die drukwerk-
// bestelling self by die verskaffer en verskaf die koper se adres direk
// (sien "drukker"-blok in data/bestelling-skema-voorbeeld.json).
//
// Fase 5: begin-betaling.js vereis nou 'n aangemelde "koper" — hierdie
// bladsy moet dus eers 'n geldige sessie bevestig (identiteit.js) voor die
// bestel-vorm gewys word, en die sessie se access_token saam met die
// betaal-versoek stuur.

const BESTELNOMMER_SLEUTEL = "future_shop_bestelnommer_konsep";

// Koepon-toestand — module-vlak, aangesien dit tussen die "Toepas"-klik en
// die uiteindelike "Gaan na betaling"-indiening moet oorleef.
let TOEGEPASTE_KOEPON_KODE = null;
let VERTOONDE_TOTAAL_SENT = 0;

// Koppel elke taal-onafhanklike foutkode (van verifieer-koepon.js) aan die
// regte taal.js-sleutel — sodat 'n Engelse koper 'n regte Engelse
// boodskap kry, nie die bediener se interne Afrikaanse teks nie.
const KOEPON_FOUT_SLEUTELS = {
  VERPLIGTE_KODE: "koepon_ongeldig",
  ONGELDIG: "koepon_ongeldig",
  ONAKTIEF: "koepon_fout_onaktief",
  VERVAL: "koepon_fout_verval",
  VOLGEBRUIK: "koepon_fout_volgebruik",
  GEEN_TOEPASSING: "koepon_fout_geen_toepassing",
  NIE_JOUNE: "koepon_fout_nie_joune",
};

function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function etiket_vir_formaat(formaat) {
  if (formaat === "harde_kopie") return t("hardekopie_etiket");
  if (formaat === "leen") return t("leen_etiket");
  return t("eboek_etiket");
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

      <div class="vb-koepon-blok">
        <label class="veld-etiket" for="vb-koepon-invoer">${t("koepon_etiket")}</label>
        <div class="vb-koepon-ry">
          <input type="text" id="vb-koepon-invoer" class="veld-invoer" placeholder="${t("koepon_plekhouer")}">
          <button type="button" id="vb-koepon-toepas" class="terug-skakel">${t("koepon_toepas_knoppie")}</button>
        </div>
        <p id="vb-koepon-nota" class="vb-koepon-nota" style="display:none;"></p>
      </div>

      <div class="vb-opsomming-totaal">
        <span>${t("totaal")}</span>
        <span id="vb-totaal-bedrag">${formateer_prys_sent(totaal)}</span>
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
        <label class="veld-etiket" for="adres-ontvanger">${t("ontvanger_naam")}</label>
        <input type="text" id="adres-ontvanger" class="veld-invoer" autocomplete="name">
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

function valideer_en_bou_bestelling(items, totaal, bestelnommer, bevat_harde_kopie, koepon_kode) {
  const foute = [];

  const epos = document.getElementById("kontak-epos").value.trim();
  const selfoon = document.getElementById("kontak-selfoon").value.trim();

  if (!epos) foute.push(t("epos_verplig"));
  if (!selfoon) foute.push(t("selfoon_verplig"));

  let aflewering = null;

  if (bevat_harde_kopie) {
    // Die ontvanger is nie noodwendig die koper nie — 'n boek word as
    // geskenk gekoop. Daarom leef die naam by die adres, nie by koper.
    const ontvanger = document.getElementById("adres-ontvanger").value.trim();
    const straat = document.getElementById("adres-straat").value.trim();
    const stad = document.getElementById("adres-stad").value.trim();
    const provinsie = document.getElementById("adres-provinsie").value.trim();
    const poskode = document.getElementById("adres-poskode").value.trim();

    if (!ontvanger) foute.push(t("ontvanger_verplig"));
    if (!straat || !stad || !provinsie || !poskode) {
      foute.push(t("volledige_adres_verplig"));
    }

    if (ontvanger && straat && stad && provinsie && poskode) {
      aflewering = { ontvanger, straat, stad, provinsie, poskode };
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
    koepon_kode: koepon_kode || null,
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

async function stuur_na_betaling(bestelling, toegangs_token) {
  const knoppie = document.getElementById("gaan-na-betaling");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = await fetch("/.netlify/functions/begin-betaling", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${toegangs_token}`,
      },
      body: JSON.stringify(bestelling),
    });

    if (resp.status === 401) {
      // Sessie het intussen verval — stuur koper terug na aanmeld
      window.location.href = "/aanmeld.html?terug=/voltooi-betaling.html";
      return;
    }

    // 403 IS NIE 401 NIE. Die token is geldig; die rekening het net nie die
    // "koper"-rol nie. Aanmeld gaan niks verander nie — aanmeld.html sien 'n
    // geldige sessie en stuur die gebruiker dadelik hierheen terug, en dan
    // klik hy weer, en weer. Se dus wat fout is en los hom op die bladsy.
    if (resp.status === 403) {
      wys_foute([t("geen_koperprofiel")]);
      knoppie.disabled = false;
      knoppie.textContent = t("gaan_na_betaling");
      return;
    }

    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const data = await resp.json();

    if (data.gratis) {
      // 100%-koepon — geen Paystack-transaksie was nodig nie, die
      // bestelling is reeds as betaal gemerk deur begin-betaling.js.
      window.location.href = `dankie.html?bestelnommer=${encodeURIComponent(data.bestelnommer)}`;
      return;
    }

    if (!data.authorization_url) throw new Error("Geen authorization_url ontvang nie");

    window.location.href = data.authorization_url;
  } catch (fout) {
    console.error("Kon nie na betaling gaan nie:", fout);
    wys_foute([t("betaling_fout")]);
    knoppie.disabled = false;
    knoppie.textContent = t("gaan_na_betaling");
  }
}

function wys_koepon_nota(teks, is_fout) {
  const nota = document.getElementById("vb-koepon-nota");
  nota.textContent = teks;
  nota.style.display = "block";
  nota.classList.toggle("vb-koepon-nota--fout", !!is_fout);
  nota.classList.toggle("vb-koepon-nota--sukses", !is_fout);
}

async function hanteer_koepon_toepas(items, oorspronklike_totaal, toegangs_token) {
  const invoer = document.getElementById("vb-koepon-invoer");
  const knoppie = document.getElementById("vb-koepon-toepas");
  const kode = invoer.value.trim();

  if (!kode) return;

  knoppie.disabled = true;
  const oorspronklike_knoppie_teks = knoppie.textContent;
  knoppie.textContent = t("besig");

  try {
    const resp = await fetch("/.netlify/functions/verifieer-koepon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${toegangs_token}`,
      },
      body: JSON.stringify({
        koepon_kode: kode,
        items: items.map((i) => ({ produk_slug: i.produk_slug, formaat: i.formaat })),
      }),
    });

    if (!resp.ok) {
      let fout_kode = "ONGELDIG";
      try {
        const fout_data = await resp.json();
        if (fout_data && fout_data.fout_kode) fout_kode = fout_data.fout_kode;
      } catch {
        // Onverwagte, nie-JSON-antwoord (bv. 'n 500 sonder liggaam) — val
        // terug op die generiese "ongeldig"-boodskap.
      }
      throw new Error(t(KOEPON_FOUT_SLEUTELS[fout_kode] || "koepon_ongeldig"));
    }

    const data = await resp.json();

    TOEGEPASTE_KOEPON_KODE = kode.toUpperCase();
    VERTOONDE_TOTAAL_SENT = data.nuwe_totaal_sent;
    document.getElementById("vb-totaal-bedrag").textContent = formateer_prys_sent(data.nuwe_totaal_sent);

    if (data.nuwe_totaal_sent === 0) {
      wys_koepon_nota(t("koepon_toegepas_gratis"), false);
    } else {
      wys_koepon_nota(`${t("koepon_toegepas_afslag")} ${formateer_prys_sent(data.afslag_sent)}`, false);
    }

    invoer.disabled = true;
    knoppie.textContent = t("koepon_verwyder_knoppie");
    knoppie.disabled = false;
    knoppie.onclick = () => {
      TOEGEPASTE_KOEPON_KODE = null;
      VERTOONDE_TOTAAL_SENT = oorspronklike_totaal;
      document.getElementById("vb-totaal-bedrag").textContent = formateer_prys_sent(oorspronklike_totaal);
      document.getElementById("vb-koepon-nota").style.display = "none";
      invoer.disabled = false;
      invoer.value = "";
      knoppie.textContent = oorspronklike_knoppie_teks;
      knoppie.onclick = () => hanteer_koepon_toepas(items, oorspronklike_totaal, toegangs_token);
    };
  } catch (fout) {
    console.error("Kon nie koepon toepas nie:", fout);
    wys_koepon_nota(fout.message || t("koepon_ongeldig"), true);
    knoppie.disabled = false;
    knoppie.textContent = oorspronklike_knoppie_teks;
  }
}

function wys_meld_aan_boodskap() {
  const wrap = document.getElementById("vb-inhoud");
  wrap.innerHTML = `
    <p class="stelsel-boodskap">
      ${t("meld_aan_vir_bestelling")}
      <a href="/aanmeld.html?terug=/voltooi-betaling.html">${t("meld_aan_of_registreer")}</a>
    </p>
  `;
}

async function laai_vb() {
  const wrap = document.getElementById("vb-inhoud");

  // --- Vereis 'n aangemelde koper voordat enigiets anders gewys word ---
  // identiteit_kry_huidige_sessie() verfris outomaties 'n verlope
  // access_token via die refresh_token — sien identiteit.js. Hierdie
  // bladsy moet dus identiteit.js LAAI (script-tag) voor voltooi-betaling.js.
  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) {
    wys_meld_aan_boodskap();
    return;
  }

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
  VERTOONDE_TOTAAL_SENT = totaal;
  TOEGEPASTE_KOEPON_KODE = null;
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

  // Voorvul die kontak-epos met die aangemelde koper se e-pos, as gerief
  const epos_invoer = document.getElementById("kontak-epos");
  if (epos_invoer && sessie.gebruiker && sessie.gebruiker.email) {
    epos_invoer.value = sessie.gebruiker.email;
  }

  document.getElementById("vb-koepon-toepas").addEventListener("click", () => {
    hanteer_koepon_toepas(items, totaal, sessie.access_token);
  });

  // 'n Koepon-kode kan as URL-parameter saamkom (bv. ?koepon=ABCD1234) —
  // gebruik vir die leen-na-koop-opgradering-skakel op "My Boeke", sodat
  // die koper nie die kode self hoef in te tik nie.
  const url_koepon_kode = new URLSearchParams(window.location.search).get("koepon");
  if (url_koepon_kode) {
    const koepon_invoer = document.getElementById("vb-koepon-invoer");
    if (koepon_invoer) {
      koepon_invoer.value = url_koepon_kode.trim().toUpperCase();
      hanteer_koepon_toepas(items, totaal, sessie.access_token);
    }
  }

  document.getElementById("gaan-na-betaling").addEventListener("click", async () => {
    // Voordat ons betaling begin, verseker die sessie is nog geldig —
    // 'n verlope access_token sal 'n 401 by begin-betaling.js veroorsaak.
    const vars_sessie = await identiteit_kry_huidige_sessie();
    if (!vars_sessie || !vars_sessie.access_token) {
      window.location.href = "/aanmeld.html?terug=/voltooi-betaling.html";
      return;
    }

    const resultaat = valideer_en_bou_bestelling(
      items,
      VERTOONDE_TOTAAL_SENT,
      bestelnommer,
      bevatHardeKopie,
      TOEGEPASTE_KOEPON_KODE
    );
    if (!resultaat.geldig) {
      wys_foute(resultaat.foute);
      return;
    }
    wys_foute([]);
    stuur_na_betaling(resultaat.bestelling, vars_sessie.access_token);
  });
}

document.addEventListener("DOMContentLoaded", laai_vb);
