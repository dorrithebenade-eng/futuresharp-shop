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
// Tot twee kodes: een veldtogkode (bv. BLACKFRIDAY) en een lojaliteitskode
// (bv. VOLGENDE50). Die bediener kontroleer die reëls; hier hou ons net lys.
let TOEGEPASTE_KOEPON_KODES = [];
let VERTOONDE_TOTAAL_SENT = 0;
// HARDE KOPIEË (November 2026): die boeke se totaal (ná koepons) en die
// afleweringskoste word apart gehou en saam gewys. Die bediener bereken
// albei weer self (sien netlify/functions/_aflewering.js).
let BOEKE_TOTAAL_SENT = 0;
let AFLEWERING_SENT = 0;
let KOERIER_SENT = 0;

// Dieselfde trappe as _aflewering.js: R90 vir 1 tot 10 boeke, R160 vir 11 tot 30.
function koerier_sent_vir(getal) {
  let oor = getal, som = 0;
  while (oor > 0) {
    const n = Math.min(oor, 30);
    som += n <= 10 ? 9000 : 16000;
    oor -= n;
  }
  return som;
}

function gekose_metode() {
  const k = document.querySelector('input[name="aflewer-metode"]:checked');
  return k && k.value === "afhaal" ? "afhaal" : "koerier";
}

function werk_totaal_by() {
  const ry = document.getElementById("vb-aflewering-ry");
  if (ry) {
    AFLEWERING_SENT = gekose_metode() === "afhaal" ? 0 : KOERIER_SENT;
    ry.style.display = "";
    document.getElementById("vb-aflewering-bedrag").textContent =
      AFLEWERING_SENT ? formateer_prys_sent(AFLEWERING_SENT) : t("aflewering_gratis");
  }
  VERTOONDE_TOTAAL_SENT = BOEKE_TOTAAL_SENT + AFLEWERING_SENT;
  const veld = document.getElementById("vb-totaal-bedrag");
  if (veld) veld.textContent = formateer_prys_sent(VERTOONDE_TOTAAL_SENT);
}

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
  TE_VEEL: "koepon_fout_te_veel",
  TWEE_VAN_SOORT: "koepon_fout_twee_van_soort",
  BESIT_NODIG: "koepon_fout_besit_nodig",
  IN_PAKKET: "koepon_fout_in_pakket",
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

function bou_opsomming(items, totaal, pakkette) {
  return `
    <section class="vb-afdeling">
      <h2 class="vb-afdeling-titel">${t("bestelling_opsomming")}</h2>
      <div class="vb-opsomming-lys">
        ${items
          .map(
            (i) => `
          <div class="vb-opsomming-ry">
            <span>${i.titel} <span class="vb-opsomming-formaat">(${i.opsie_naam || etiket_vir_formaat(i.formaat)}${i.geskenk ? `, 🎁 ${t("geskenk_merk")}` : ""})</span></span>
            <span>${formateer_prys_sent(i.prys_sent)}</span>
          </div>`
          )
          .join("")}
      </div>

      ${typeof reekspakket_lyne_html === "function" ? reekspakket_lyne_html(pakkette, "vb-opsomming-ry") : ""}

      <div class="vb-koepon-blok">
        <label class="veld-etiket" for="vb-koepon-invoer">${t("koepon_etiket")}</label>
        <p id="vb-koepon-etiket-meer" class="vb-koepon-meer" style="display:none;">${t("koepon_nog_een")}</p>
        <div class="vb-koepon-ry">
          <input type="text" id="vb-koepon-invoer" class="veld-invoer" placeholder="${t("koepon_plekhouer")}">
          <button type="button" id="vb-koepon-toepas" class="terug-skakel">${t("koepon_toepas_knoppie")}</button>
        </div>
        <div id="vb-koepon-toegepas" class="vb-koepon-toegepas"></div>
        <p id="vb-koepon-nota" class="vb-koepon-nota" style="display:none;"></p>
      </div>

      <div class="vb-opsomming-ry" id="vb-aflewering-ry" style="display:none;">
        <span>${t("afleweringskoste_ry")}</span>
        <span id="vb-aflewering-bedrag"></span>
      </div>

      <div class="vb-opsomming-totaal">
        <span>${t("totaal")}</span>
        <span id="vb-totaal-bedrag">${formateer_prys_sent(totaal)}</span>
      </div>
    </section>
  `;
}

// HARDE KOPIE AS GESKENK (November 2026): die boek gaan per koerier reguit
// na die ontvanger. Geen afhaal nie, en die ontvanger se selfoonnommer is
// verplig sodat die koerier die ontvanger kan bel. Die item gaan sonder die
// geskenk-vlag na die bediener (dit is nie 'n e-boek-geskenkkode nie); die
// bestelling dra aflewering.geskenk.
function is_hk_geskenk(i) { return i.geskenk === true && i.formaat === "harde_kopie"; }

function bou_aflewer_afdeling(met_kaartjie, as_geskenk) {
  return `
    <section class="vb-afdeling">
      <h2 class="vb-afdeling-titel">${as_geskenk ? "🎁 " : ""}${t("aflewering_titel")}</h2>
      <p class="vb-afdeling-nota">${t(as_geskenk ? "aflewering_geskenk_nota" : "aflewering_nota")}</p>

      <div class="aflewer-metodes" style="display:flex;flex-direction:column;gap:8px;margin:8px 0 16px;">
        <label style="display:flex;gap:10px;align-items:center;cursor:pointer;">
          <input type="radio" name="aflewer-metode" value="koerier" checked>
          <span>${t("aflewering_metode_koerier")} <span id="vb-koerier-bedrag" style="color:#666"></span></span>
        </label>
        ${as_geskenk ? "" : `<label style="display:flex;gap:10px;align-items:center;cursor:pointer;">
          <input type="radio" name="aflewer-metode" value="afhaal">
          <span>${t("aflewering_metode_afhaal")} <span style="color:#666">(${t("aflewering_gratis")})</span></span>
        </label>`}
        <p id="vb-afhaal-nota" class="vb-afdeling-nota" style="display:none;margin:4px 0 0;">${t("aflewering_afhaal_nota")}</p>
      </div>

      <div id="aflewer-adres-blok" class="aflewer-blok">
        <label class="veld-etiket" for="adres-ontvanger">${t("ontvanger_naam")}</label>
        <input type="text" id="adres-ontvanger" class="veld-invoer" autocomplete="name">
        ${as_geskenk ? `
        <label class="veld-etiket" for="adres-selfoon">${t("ontvanger_selfoon")} <span class="veld-verplig">${t("verplig")}</span></label>
        <input type="tel" id="adres-selfoon" class="veld-invoer" placeholder="08x xxx xxxx">` : ""}
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
        ${met_kaartjie ? `
        <label class="veld-etiket" for="adres-kaartjie">${t("kaartjie_boodskap_etiket")} <span class="veld-opsioneel">${t("opsioneel")}</span></label>
        <textarea id="adres-kaartjie" class="veld-invoer" rows="3" maxlength="300"></textarea>` : ""}
      </div>
    </section>
  `;
}

// GESKENKE (November 2026): vir wie, van wie en 'n boodskap. Dit kom op die
// geskenkbewys wat die koper ná betaling kry (sien netlify/functions/_geskenke.js).
function bou_geskenk_afdeling() {
  return `
    <section class="vb-afdeling">
      <h2 class="vb-afdeling-titel">🎁 ${t("geskenk_afdeling_titel")}</h2>
      <p class="vb-afdeling-nota">${t("geskenk_afdeling_nota")}</p>
      <label class="veld-etiket" for="geskenk-aan">${t("geskenk_aan")}</label>
      <input type="text" id="geskenk-aan" class="veld-invoer" maxlength="80">
      <label class="veld-etiket" for="geskenk-van">${t("geskenk_van")} <span class="veld-verplig">${t("verplig")}</span></label>
      <input type="text" id="geskenk-van" class="veld-invoer" maxlength="80">
      <label class="veld-etiket" for="geskenk-boodskap">${t("geskenk_boodskap")}</label>
      <textarea id="geskenk-boodskap" class="veld-invoer" rows="3" maxlength="400"></textarea>
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

function valideer_en_bou_bestelling(items, totaal, bestelnommer, bevat_harde_kopie, koepon_kodes) {
  const foute = [];

  const epos = document.getElementById("kontak-epos").value.trim();
  const selfoon = document.getElementById("kontak-selfoon").value.trim();

  if (!epos) foute.push(t("epos_verplig"));
  if (!selfoon) foute.push(t("selfoon_verplig"));

  let aflewering = null;
  const hk_geskenk = items.some(is_hk_geskenk);
  if (hk_geskenk && items.some((i) => i.formaat === "harde_kopie" && !i.geskenk)) {
    foute.push(t("geskenk_hk_gemeng"));
  }

  if (bevat_harde_kopie && !hk_geskenk && gekose_metode() === "afhaal") {
    aflewering = { metode: "afhaal" };
  } else if (bevat_harde_kopie) {
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
      aflewering = { metode: "koerier", ontvanger, straat, stad, provinsie, poskode };
      // Kaartjieboodskap (November 2026): opsioneel, net by produkte met
      // kaartjie_boodskap aan (sien koop.js).
      const kaartjie_veld = document.getElementById("adres-kaartjie");
      const kaartjie = kaartjie_veld ? kaartjie_veld.value.trim().slice(0, 300) : "";
      if (kaartjie) aflewering.kaartjie = kaartjie;
    }
    if (hk_geskenk) {
      const ontvanger_selfoon = document.getElementById("adres-selfoon").value.trim();
      if (!ontvanger_selfoon) foute.push(t("ontvanger_selfoon_verplig"));
      if (aflewering) {
        aflewering.geskenk = true;
        aflewering.selfoon = ontvanger_selfoon;
      }
    }
  }

  let geskenk = null;
  if (items.some((i) => i.geskenk && !is_hk_geskenk(i))) {
    const van = document.getElementById("geskenk-van").value.trim();
    if (!van) foute.push(t("geskenk_van_verplig"));
    geskenk = {
      aan: document.getElementById("geskenk-aan").value.trim(),
      van,
      boodskap: document.getElementById("geskenk-boodskap").value.trim(),
    };
  }

  if (foute.length) {
    return { geldig: false, foute };
  }

  const bestelling = {
    bestelnommer,
    geskep_op: new Date().toISOString(),
    koper: { epos, selfoonnommer: selfoon },
    items: items.map((i) => (is_hk_geskenk(i) ? { ...i, geskenk: false } : i)),
    totaal_sent: totaal,
    bevat_harde_kopie,
    aflewering,
    geskenk,
    koepon_kodes: koepon_kodes || [],
    koepon_kode: (koepon_kodes && koepon_kodes[0]) || null,
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

// Vra die bediener om 'n voorskou vir 'n lys kodes. Gooi 'n Error met die
// regte taalboodskap as een van die kodes nie werk nie.
async function verifieer_kodes(kodes, items, toegangs_token) {
  const resp = await fetch("/.netlify/functions/verifieer-koepon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${toegangs_token}`,
    },
    body: JSON.stringify({
      koepon_kodes: kodes,
      items: items.map((i) => ({ produk_slug: i.produk_slug, formaat: i.formaat, ...(i.opsie ? { opsie: i.opsie } : {}), ...(i.geskenk && i.formaat !== "harde_kopie" ? { geskenk: true } : {}) })),
    }),
  });

  if (!resp.ok) {
    let fout_kode = "ONGELDIG";
    let kode = null;
    try {
      const fout_data = await resp.json();
      if (fout_data && fout_data.fout_kode) fout_kode = fout_data.fout_kode;
      if (fout_data && fout_data.kode) kode = fout_data.kode;
    } catch {
      // Onverwagte, nie-JSON-antwoord (bv. 'n 500 sonder liggaam) — val
      // terug op die generiese "ongeldig"-boodskap.
    }
    const boodskap = t(KOEPON_FOUT_SLEUTELS[fout_kode] || "koepon_ongeldig");
    throw new Error(kode && kodes.length > 1 ? `${kode}: ${boodskap}` : boodskap);
  }
  return resp.json();
}

// Wys die toegepaste kodes, elk met 'n Verwyder-knoppie, en die totaal.
function wys_toegepaste_koepons(data, items, oorspronklike_totaal, toegangs_token) {
  const lys = document.getElementById("vb-koepon-toegepas");
  const ry = document.querySelector(".vb-koepon-ry");
  const invoer = document.getElementById("vb-koepon-invoer");

  lys.innerHTML = TOEGEPASTE_KOEPON_KODES.map((kode) => `
    <span class="vb-koepon-kaartjie">🎟️ <strong>${kode}</strong>
      <button type="button" class="terug-skakel vb-koepon-verwyder" data-kode="${kode}">${t("koepon_verwyder_knoppie")}</button>
    </span>`).join("");

  lys.querySelectorAll(".vb-koepon-verwyder").forEach((knoppie) => {
    knoppie.addEventListener("click", () => verwyder_koepon(knoppie.dataset.kode, items, oorspronklike_totaal, toegangs_token));
  });

  const totaal = data ? data.nuwe_totaal_sent : oorspronklike_totaal;
  BOEKE_TOTAAL_SENT = totaal;
  werk_totaal_by();

  if (!data) {
    document.getElementById("vb-koepon-nota").style.display = "none";
  } else if (data.nuwe_totaal_sent === 0) {
    wys_koepon_nota(t("koepon_toegepas_gratis"), false);
  } else {
    // Die besparing van die koepon self; 'n reekspakket se afslag staan reeds apart.
    wys_koepon_nota(`${t("koepon_toegepas_afslag")} ${formateer_prys_sent(oorspronklike_totaal - data.nuwe_totaal_sent)}`, false);
  }

  // Twee kodes is die maksimum; daarna verdwyn die invoerry.
  ry.style.display = TOEGEPASTE_KOEPON_KODES.length >= 2 ? "none" : "";
  invoer.value = "";
  document.getElementById("vb-koepon-etiket-meer").style.display = TOEGEPASTE_KOEPON_KODES.length === 1 ? "" : "none";
}

async function verwyder_koepon(kode, items, oorspronklike_totaal, toegangs_token) {
  const oorblywend = TOEGEPASTE_KOEPON_KODES.filter((k) => k !== kode);
  if (!oorblywend.length) {
    TOEGEPASTE_KOEPON_KODES = [];
    wys_toegepaste_koepons(null, items, oorspronklike_totaal, toegangs_token);
    return;
  }
  try {
    const data = await verifieer_kodes(oorblywend, items, toegangs_token);
    TOEGEPASTE_KOEPON_KODES = data.kodes || oorblywend;
    wys_toegepaste_koepons(data, items, oorspronklike_totaal, toegangs_token);
  } catch (fout) {
    TOEGEPASTE_KOEPON_KODES = [];
    wys_toegepaste_koepons(null, items, oorspronklike_totaal, toegangs_token);
    wys_koepon_nota(fout.message || t("koepon_ongeldig"), true);
  }
}

async function hanteer_koepon_toepas(items, oorspronklike_totaal, toegangs_token) {
  const invoer = document.getElementById("vb-koepon-invoer");
  const knoppie = document.getElementById("vb-koepon-toepas");
  const kode = invoer.value.trim().toUpperCase();

  if (!kode) return;
  if (TOEGEPASTE_KOEPON_KODES.includes(kode)) {
    invoer.value = "";
    return;
  }

  knoppie.disabled = true;
  const oorspronklike_knoppie_teks = knoppie.textContent;
  knoppie.textContent = t("besig");

  try {
    const data = await verifieer_kodes([...TOEGEPASTE_KOEPON_KODES, kode], items, toegangs_token);
    TOEGEPASTE_KOEPON_KODES = data.kodes || [...TOEGEPASTE_KOEPON_KODES, kode];
    wys_toegepaste_koepons(data, items, oorspronklike_totaal, toegangs_token);
  } catch (fout) {
    console.error("Kon nie koepon toepas nie:", fout);
    wys_koepon_nota(fout.message || t("koepon_ongeldig"), true);
  } finally {
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

  // Die totaal soos die kassa dit sal bereken, met reekspakkette (sien
  // reekspakket.js); val terug op die mandjie se som as dit nie beskikbaar is nie.
  let totaal = kry_mandjie_totaal_sent();
  let pakkette = [];
  try {
    const prys = typeof reekspakket_kry_mandjie_prys === "function" ? await reekspakket_kry_mandjie_prys(items) : null;
    if (prys) {
      totaal = prys.totaal_sent;
      pakkette = prys.pakkette || [];
    }
  } catch (_) {
    /* die mandjie se som bly staan */
  }
  BOEKE_TOTAAL_SENT = totaal;
  VERTOONDE_TOTAAL_SENT = totaal;
  TOEGEPASTE_KOEPON_KODES = [];
  const bevatHardeKopie = mandjie_bevat_harde_kopie();
  const bestelnommer = kry_of_skep_bestelnommer();

  wrap.innerHTML = `
    <p class="vb-bestelnommer">${t("bestelnommer_etiket")}: <strong>${bestelnommer}</strong></p>
    ${bou_opsomming(items, totaal, pakkette)}
    ${bevatHardeKopie ? bou_aflewer_afdeling(items.some((i) => i.kaartjie === true), items.some(is_hk_geskenk)) : ""}
    ${items.some((i) => i.geskenk && !is_hk_geskenk(i)) ? bou_geskenk_afdeling() : ""}
    ${bou_kontak_afdeling()}
    <div id="vb-foute" class="vb-foute" style="display:none;"></div>
    <button class="kaart-aksie vb-betaal-knoppie" id="gaan-na-betaling">${t("gaan_na_betaling")}</button>
  `;

  // Aflewering vir harde kopieë: koerierkoste volgens die getal boeke.
  if (bevatHardeKopie) {
    KOERIER_SENT = koerier_sent_vir(items.filter((i) => i.formaat === "harde_kopie").length);
    document.getElementById("vb-koerier-bedrag").textContent = `(${formateer_prys_sent(KOERIER_SENT)})`;
    document.querySelectorAll('input[name="aflewer-metode"]').forEach((r) =>
      r.addEventListener("change", () => {
        const afhaal = gekose_metode() === "afhaal";
        document.getElementById("aflewer-adres-blok").style.display = afhaal ? "none" : "";
        document.getElementById("vb-afhaal-nota").style.display = afhaal ? "" : "none";
        werk_totaal_by();
      })
    );
    werk_totaal_by();
  }

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
  // Ook uit localStorage: koop.js bewaar 'n kode van 'n boek se webblad, sodat
  // dit ná aanmelding steeds hier is (hoogstens twee dae oud).
  let url_koepon_kode = new URLSearchParams(window.location.search).get("koepon");
  try {
    const bewaar = JSON.parse(localStorage.getItem("future_shop_koepon") || "null");
    if (!url_koepon_kode && bewaar && bewaar.kode && Date.now() - (bewaar.op || 0) < 2 * 86400000) url_koepon_kode = bewaar.kode;
    localStorage.removeItem("future_shop_koepon");
  } catch (_) {
    /* geen bewaarde kode nie */
  }
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
      TOEGEPASTE_KOEPON_KODES
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
