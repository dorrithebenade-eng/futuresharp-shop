// public/js/kwotasiepaneel.js
//
// Die kwotasieregister in Boekhouding.
//
// HY LEEF NAAS faktuurpaneel.js, NIE DAARBINNE NIE. Die pil-kieslys en
// fp_wys_afdeling() behoort aan faktuurpaneel.js; hierdie lêer voeg net sy
// eie luisteraar by die Kwotasies-pil. Luisteraars stapel — hulle vervang
// mekaar nie — dus bly die afdeling-wissel presies soos hy was.
//
// DIE SKERM IS NIE DIE POORT NIE. kry-kwotasies.js dwing die boekhouding-rol
// af en gee 403 daarsonder, ook vir iemand wat die URL raai.
//
// DIE LYS LAAI EERS BY DIE EERSTE KLIK, nie by die opening van die paneel
// nie. Die paneel open op Fakture; 'n tweede oproep by elke opening sou werk
// doen wat niemand gevra het nie. Daarna word hy gehou tot die blad herlaai.
//
// DORRITHÉ EN IGNATIUS GEBRUIK ALBEI HIERDIE BLAD. Dit is waarom 'n konsep
// wys WIE hom gemaak het: 'n konsep dra geen nommer, dus is die naam die
// enigste manier om twee konsepte vir dieselfde skool uitmekaar te ken.

let KW_LYS = [];
let KW_SESSIE = null;
let KW_GELAAI = false;

function kw_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  // t() gee die SLEUTEL terug wanneer hy hom nie ken nie — daar is geen stille
  // terugval nie. Die verstek hier geld net wanneer taal.js glad nie gelaai het
  // nie. Sonder dit sou "fp_kw_stand_uitgereik" op die skerm staan.
  return uit && uit !== sleutel ? uit : verstek;
}

function kw_rand(sent) {
  return window.t_rand
    ? t_rand(sent, kry_huidige_taal())
    : "R" + (Number(sent || 0) / 100).toFixed(2);
}

// Slegs die datum, sonder die tyd. 'n Kwotasie se geldigheid loop op DAE — sy
// is die hele laaste dag geldig — en 'n uur langs "geldig tot" sou suggereer
// dat sy om 14:32 doodgaan.
function kw_datum(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const maande = kw_t("fd_maande", "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Des").split(",");
  return `${d.getDate()} ${maande[d.getMonth()]} ${d.getFullYear()}`;
}

/* Die deel voor die @ , met die eerste letter groot en punte as spasies:
   `dorrithe@futuresharp.co.za` word `Dorrithe`, `ignatius.gous@x.co.za` word
   `Ignatius Gous`.

   Geen naamregister nie -- die bediener stoor die e-posadres omdat dit is wat
   die sessie dra, en 'n tweede register net vir vertoonname sou uitmekaar loop
   met Identity s'n. */
function kw_naam_uit_epos(waarde) {
  const voor = String(waarde || "").split("@")[0];
  if (!voor) return "";
  return voor
    .split(/[._-]+/)
    .filter(Boolean)
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join(" ");
}

function kw_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* WAT GESKRAP MAG WORD

   'n Konsep ALTYD; enigiets anders slegs met die toetsstempel. MAAR 'n
   AANVAARDE kwotasie nooit, ook nie met die stempel nie: 'n faktuur verwys na
   haar, en sonder haar dra daardie faktuur 'n `uit_kwotasie` wat na niks wys.

   DIT IS 'N HOFLIKHEID, NIE 'N SLOT NIE. skrap-kwotasie.js toets presies
   dieselfde drie dinge en gee 409 daarsonder. */
function kw_mag_skrap(k) {
  if (k.stand === "aanvaar") return false;
  return k.stand === "konsep" || k.toets === true;
}

// Waarheen 'n ry oopmaak. DIESELFDE VORM as die faktuur — `faktuur.html` dra
// albei dokumente — met `soort=kwotasie` sodat die bladsy weet watter een.
// 'n Konsep het net sy sleutel; ná uitreiking is die NOMMER wat 'n mens in die
// hand het. kry-kwotasie.js aanvaar albei.
function kw_url(k) {
  return k.nommer
    ? `faktuur.html?soort=kwotasie&nommer=${encodeURIComponent(k.nommer)}`
    : `faktuur.html?soort=kwotasie&sleutel=${encodeURIComponent(k.sleutel)}`;
}

// Die tweede reël onder die nommer. Sy dra die EEN feit wat op hierdie oomblik
// saak maak, en dit verskil per stand — 'n verlope kwotasie se geldigheidsdatum
// is nie meer nuus nie, maar wanneer sy verval het, is dit wel.
function kw_onderreel(k) {
  // Dieselfde reel as in faktuurpaneel.js: die afdeling hang met 'n en-streep
  // aan die klient se naam, want sy is deel van wie gekwoteer word en nie 'n
  // aparte feit langs die datum en die stand nie.
  const klient_naam = kw_ontsnap(k.klient_naam) || "—";
  const klient = k.afdeling ? klient_naam + " – " + kw_ontsnap(k.afdeling) : klient_naam;
  const dele = [klient];

  // 'n Hersiening is 'n ONDERHANDELING, nie 'n fout nie. Sy wys van 2 af.
  if (Number(k.hersiening) > 1) {
    dele.push(`${kw_t("fp_kw_hersiening", "hersiening")} ${Number(k.hersiening)}`);
  }

  if (k.vertoon_stand === "aanvaar") {
    // Die faktuurnommer staan HIER, nie in 'n eie kolom nie. Dit is die enigste
    // plek waar die twee registers aan mekaar raak, en 'n mens moet die faktuur
    // kan sien sonder om haar oop te maak.
    dele.push(
      `${kw_t("fp_kw_aanvaar_op", "aanvaar")} ${kw_datum(k.aanvaar_op)}` +
        (k.faktuur_nommer ? ` · ${kw_ontsnap(k.faktuur_nommer)}` : "")
    );
  } else if (k.vertoon_stand === "verwerp") {
    dele.push(`${kw_t("fp_kw_verwerp_op", "verwerp")} ${kw_datum(k.verwerp_op)}`);
  } else if (k.vertoon_stand === "verval") {
    dele.push(`${kw_t("fp_kw_verval_op", "verval")} ${kw_datum(k.geldig_tot)}`);
  } else if (k.vertoon_stand === "uitgereik") {
    dele.push(`${kw_t("fp_kw_geldig_tot", "geldig tot")} ${kw_datum(k.geldig_tot)}`);
  } else if (k.geskep_deur) {
    // 'n KONSEP WYS WIE HOM GEMAAK HET. Albei direkteure stel kwotasies op, en
    // 'n konsep dra geen nommer — twee konsepte vir dieselfde skool is
    // andersins nie uitmekaar te ken nie.
    //
    // DIE NAAM, NIE DIE VOLLE ADRES NIE. `geskep_deur` is 'n e-posadres, want
    // dit is wat die bediener van die sessie af weet. Op 'n skerm wat twee
    // mense deel, is die naam genoeg om te weet wie dit is, en die volle adres
    // vat die reël vol.
    dele.push(kw_ontsnap(kw_naam_uit_epos(k.geskep_deur)));
  }

  return dele.join(" · ");
}

function kw_teken(lys) {
  const plek = document.getElementById("kw-lys");
  if (!plek) return;
  KW_LYS = lys;

  const tel = document.getElementById("kw-tel");
  if (tel) {
    tel.textContent = lys.length
      ? `${lys.length} ${kw_t(
          lys.length === 1 ? "fp_kwotasie_een" : "fp_kwotasie_baie",
          lys.length === 1 ? "kwotasie" : "kwotasies"
        )}`
      : "";
  }

  kw_teken_blootstelling(lys);

  if (!lys.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${kw_t(
      "fp_geen_kwotasies",
      "Daar is nog geen kwotasies nie."
    )}</p>`;
    return;
  }

  plek.innerHTML = lys
    .map((k, ix) => {
      const titel = k.nommer || kw_t("fp_kw_stand_konsep", "Konsep");
      const stempel = k.toets
        ? `<span class="fp-toets">${kw_t("fp_toetsdata", "Toetsdata")}</span>`
        : "";
      // DIE STAND WAT GEWYS WORD, IS `vertoon_stand`, NIE `stand` NIE.
      // "Verval" bestaan nie op die rekord nie — hy word by die lees bereken
      // uit geldig_tot. Sien is_verval() in _kwotasies.js.
      const stand = kw_t(`fp_kw_stand_${k.vertoon_stand}`, k.vertoon_stand);

      // Die ry is 'n <button> sodat Tab en Enter vanself werk. Die
      // skrap-knoppie sit BUITE hom: binne-in sou 'n klik op Skrap ook die
      // kwotasie oopmaak.
      return `<div class="fp-ry fp-ry-knop">
        <button type="button" class="fp-ry-oop" data-oop="${ix}">
          <span class="fp-ry-hoof">
            <span class="fp-nommer">${kw_ontsnap(titel)}</span>
            <span class="fp-klient">${kw_onderreel(k)}</span>
          </span>
          <span class="fp-ry-syfers">
            ${stempel}
            <span class="fp-stand fp-stand-${kw_ontsnap(k.vertoon_stand)}">${kw_ontsnap(stand)}</span>
            <span class="fp-bedrag">${kw_rand(k.totaal_sent)}</span>
          </span>
        </button>
        <span class="fp-ry-rand" data-kw-rand="${ix}">
          <button type="button" class="fp-skrap" data-kw-skrap="${ix}"${
            kw_mag_skrap(k) ? "" : " disabled"
          }>${kw_t("fp_skrap", "Skrap")}</button>
        </span>
      </div>`;
    })
    .join("");

  plek.querySelectorAll("[data-oop]").forEach((knop) => {
    knop.addEventListener("click", () => {
      window.location.href = kw_url(KW_LYS[Number(knop.dataset.oop)]);
    });
  });
  plek.querySelectorAll("[data-kw-skrap]").forEach((knop) => {
    knop.addEventListener("click", () => kw_vra_bevestiging(Number(knop.dataset.kwSkrap)));
  });
}

/* DIE WERKSYFER

   Wat Future Sharp aangebied het en waaraan dit nog gebonde is. Slegs wat
   UITGEREIK EN NOG GELDIG is tel: 'n konsep is nog niks, en 'n verlope,
   aanvaarde of verwerpte aanbod bind niemand meer nie.

   DIT IS NIE VERWAGTE INKOMSTE NIE. Dit staan eers op die staat wanneer 'n
   faktuur uitgereik is, en 'n kliënt wat 'n kwotasie ontvang het, is aan niks
   gebonde nie. Die etiket sê "Uitgereik en nog geldig" en niks anders nie.

   Die syfer kom uit kry-kwotasies.js, nie uit hierdie lêer nie — die bediener
   het reeds elke rekord gelees en weet watter een verval het. */
function kw_teken_blootstelling(lys) {
  const blok = document.getElementById("kw-blootstelling");
  if (!blok) return;
  const oop = lys.filter((k) => k.vertoon_stand === "uitgereik");
  if (!oop.length) {
    blok.hidden = true;
    return;
  }
  const som = oop.reduce((s, k) => s + (Number(k.totaal_sent) || 0), 0);
  const tel = document.getElementById("kw-blootstelling-tel");
  const syfer = document.getElementById("kw-blootstelling-syfer");
  if (tel) {
    tel.textContent = `— ${oop.length} ${kw_t(
      oop.length === 1 ? "fp_kwotasie_een" : "fp_kwotasie_baie",
      oop.length === 1 ? "kwotasie" : "kwotasies"
    )}`;
  }
  if (syfer) syfer.textContent = kw_rand(som);
  blok.hidden = false;
}

/* Die bevestiging VERVANG die knoppie in sy eie ry. Nie 'n confirm() nie: dié
   blokkeer die bladsy, word weggeklik sonder om gelees te word, en sê nie
   WATTER kwotasie nie. Hier staan die ry self langs die vraag. */
function kw_vra_bevestiging(ix) {
  const plek = document.querySelector(`[data-kw-rand="${ix}"]`);
  if (!plek) return;
  plek.innerHTML = `<span class="fp-bevestig">${kw_t("fp_skrap_vra", "Skrap?")}
    <button type="button" class="fp-bevestig-ja">${kw_t("fp_ja", "Ja")}</button>
    <button type="button" class="fp-bevestig-nee">${kw_t("fp_nee", "Nee")}</button></span>`;
  plek.querySelector(".fp-bevestig-nee").addEventListener("click", () => kw_teken(KW_LYS));
  plek.querySelector(".fp-bevestig-ja").addEventListener("click", () => kw_skrap(ix, plek));
}

async function kw_skrap(ix, plek) {
  const k = KW_LYS[ix];
  if (!k || !KW_SESSIE) return;
  plek.innerHTML = `<span class="fp-bevestig">${kw_t("fp_laai", "Word gelaai …")}</span>`;
  try {
    const resp = await fetch("/.netlify/functions/skrap-kwotasie", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sleutel: k.sleutel }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    // PLAASLIK uit die lys, nie weer gevra nie. Blobs se list() loop sowat vier
    // sekondes agter en die geskrapte kwotasie sou weer verskyn — dan lyk dit
    // of die skrap misluk het terwyl hy geslaag het.
    kw_teken(KW_LYS.filter((x) => x.sleutel !== k.sleutel));
  } catch (fout) {
    console.error("Kon nie die kwotasie skrap nie:", fout);
    kw_teken(KW_LYS);
    const lys = document.getElementById("kw-lys");
    if (lys) {
      const boodskap = document.createElement("p");
      boodskap.className = "stelsel-boodskap";
      // Die Function se eie boodskap, want sy sê WAAROM — 'n aanvaarde kwotasie
      // bly staan omdat 'n faktuur na haar verwys, en dit is 'n ander rede as
      // die ontbrekende toetsstempel.
      boodskap.textContent =
        String(fout.message || "").trim() ||
        kw_t("fp_kw_skrap_fout", "Kon nie die kwotasie skrap nie.");
      lys.prepend(boodskap);
    }
  }
}

async function kw_laai() {
  if (KW_GELAAI || !KW_SESSIE) return;
  KW_GELAAI = true; // voor die fetch: 'n tweede klik terwyl die eerste loop,
                    // moet nie 'n tweede oproep afvuur nie
  const plek = document.getElementById("kw-lys");
  try {
    const resp = await fetch("/.netlify/functions/kry-kwotasies", {
      headers: await identiteit_kop(),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    kw_teken(data.kwotasies || []);
  } catch (fout) {
    console.error("Kon nie die kwotasies laai nie:", fout);
    KW_GELAAI = false; // sodat 'n volgende klik weer probeer
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${kw_t(
        "fp_kwotasies_laai_fout",
        "Kon nie die kwotasies laai nie. Probeer weer."
      )}</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Die pil bestaan altyd; die sessie dalk nie. faktuurpaneel.js versteek die
  // hele paneel wanneer daar geen toegang is nie, dus kom hierdie luisteraar
  // in daardie geval nooit aan die beurt nie.
  const pil = document.querySelector('#fp-kieslys .fp-pil[data-gaan="kwotasies"]');
  if (pil) pil.addEventListener("click", () => kw_laai());

  const nuut = document.getElementById("kw-nuwe");
  if (nuut) {
    // Geen sleutel: 'n vars konsep. `soort=kwotasie` sê vir faktuur.html watter
    // dokument hy bou — dieselfde vorm, dieselfde som, twee dokumentsoorte.
    nuut.addEventListener("click", () => {
      window.location.href = "faktuur.html?soort=kwotasie";
    });
  }

  try {
    KW_SESSIE = await identiteit_kry_huidige_sessie();
  } catch {
    KW_SESSIE = null;
  }

  /* DIE AFDELING KAN REEDS OOP WEES TEEN DIE TYD DAT DIE SESSIE GEREED IS.

     faktuurpaneel.js klik die pil wanneer die adres se fragment #kwotasies
     dra -- en hy doen dit sodra SY sessie gereed is, wat vroeer kan wees as
     hierdie een. kw_laai() keer dan by `!KW_SESSIE` om, stilweg, en die lys
     bly op "Word gelaai ..." staan.

     Die wag hierbo is nie 'n oplossing nie: die volgorde tussen twee modules
     wat albei op die sessie wag, staan nie vas. Die module moet dus SELF kyk
     of hy oop is sodra hy kan laai. Dan werk hy ongeag wie eerste klaarmaak
     en ongeag of die pil ooit geklik is.

     kw_laai() se eie KW_GELAAI-wag keer 'n tweede oproep, dus is 'n klik wat
     wel gebeur het, nie 'n probleem nie. */
  if (KW_SESSIE) {
    const afd = document.querySelector('.fp-afdeling[data-afdeling="kwotasies"]');
    if (afd && afd.classList.contains("wys")) kw_laai();
  }

  /* DIE AFDELING KAN REEDS OOP WEES TEEN DIE TYD DAT DIE SESSIE GEREED IS.

     faktuurpaneel.js klik die pil wanneer die adres se fragment #kwotasies
     dra -- en hy doen dit sodra SY sessie gereed is, wat vroeer kan wees as
     hierdie een. kw_laai() keer dan by `!KW_SESSIE` om, stilweg, en die lys
     bly op "Word gelaai ..." staan.

     Die wag hierbo is nie 'n oplossing nie: die volgorde tussen twee modules
     wat albei op die sessie wag, staan nie vas. Die module moet dus SELF kyk
     of hy oop is sodra hy kan laai. Dan werk hy ongeag wie eerste klaarmaak
     en ongeag of die pil ooit geklik is.

     kw_laai() se eie KW_GELAAI-wag keer 'n tweede oproep, dus is 'n klik wat
     wel gebeur het, nie 'n probleem nie. */
  if (KW_SESSIE) {
    const afd = document.querySelector('.fp-afdeling[data-afdeling="kwotasies"]');
    if (afd && afd.classList.contains("wys")) kw_laai();
  }
});
