// PUBLIEK (geen aanmelding nodig nie) — die persoon voltooi hul eie
// inligting via 'n geldige, hangende uitnodigingskakel. Hierdie Function:
//   1. verifieer die token bestaan, nog "hangend" is (nie reeds gebruik
//      nie — voorkom dat 'n skakel twee keer 'n inskrywing skep) en nog
//      nie verval het nie
//   1b. vir 'n OUTEUR: vereis die ooreenkoms-bevestiging, en skryf die
//      datum daarvan op die inskrywing
//   2. skep die register-inskrywing (SONDER subrekening_kode — personeel
//      voeg dit later self by sodra hulle dit by Paystack opgestel het)
//   3. VIR OUTEURS EN VENNOTE (met 'n verskafte wagwoord): skep ook 'n
//      gewone Netlify Identity-rekening via die standaard /signup-
//      eindpunt — dieselfde pad wat 'n koper self sou gebruik. Die
//      bestaande identity-registrasie.js-snellery ken dan outomaties
//      die "koper"-rol toe, presies soos vir enige ander nuwe rekening.
//      Dit gee die outeur/vennoot dadelik toegang tot die winkel/leser
//      met dieselfde e-pos + wagwoord wat hulle hier gekies het.
//   4. merk die uitnodiging as "voltooi", onveranderlik gekoppel aan die
//      nuutgeskepte inskrywing se ID

const { kry_store } = require("./_blob-store");
const { is_verval } = require("./_uitnodiging-geldig");

const ROL_KONFIG = {
  outeur: { store: "outeurs", idveld: "outeur_id" },
  vennoot: { store: "vennote", idveld: "vennoot_id" },
  ontwerp_admin: { store: "ontwerp-admin", idveld: "ontwerp_admin_id" },
  printing: { store: "printing", idveld: "printing_id" },
  aflewering: { store: "aflewering", idveld: "aflewering_id" },
};

// Net hierdie twee rolle kry outomaties 'n koper-tipe Identity-rekening —
// Printing/Aflewering/Ontwerp-Admin het geen rede om by die winkel/leser
// aan te meld nie.
const ROLLE_MET_REKENING = ["outeur", "vennoot"];

// Slegs die outeur teken 'n Outeursooreenkoms. 'n Vennoot is 'n
// direkteur, en Printing/Aflewering/Ontwerp-Admin het elk hul eie
// reëling — 'n merkblokkie wat na 'n dokument verwys wat vir hulle nie
// bestaan nie, is erger as geen merkblokkie.
const ROLLE_MET_OOREENKOMS = ["outeur"];

// Die weergawe van die ooreenkoms wat tans op die werf staan. Die BEDIENER
// besluit dit, nie die klient nie — anders teken iemand 'n weergawe wat hy
// self benoem het. Verander ooreenkoms-en.html, verander hierdie getal ook.
const OOREENKOMS_WEERGAWE = "1.0";
const OOREENKOMS_TAAL = "en";

// Die twee aanhegsels wat klousule 6 vereis.
const VEREISTE_DOKUMENTE = ["bankbrief", "idafskrif"];

const KONTAK_VELDE = [
  "epos", "selfoon", "adres",
  "bank_rekeninghouer", "bank_naam", "bank_rekeningnommer",
  "bank_tak_kode", "bank_tipe",
  "id_nommer", "btw_nommer", "dekkingsarea",
];

function maak_slug(teks) {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function skoon_kontak_inligting(kontak_inligting) {
  if (!kontak_inligting || typeof kontak_inligting !== "object") return {};
  const skoon = {};
  for (const veld of KONTAK_VELDE) {
    if (kontak_inligting[veld]) {
      skoon[veld] = String(kontak_inligting[veld]).trim().slice(0, 200);
    }
  }
  return skoon;
}

// Dieselfde volgorde as _rol-kontrole.js, en om dieselfde rede: 'n
// wildcard-rekord (*.futuresharp.co.za) wys na Afrihost, dus los 'n
// Function wat na process.env.URL terugbel die eie domein verkeerd op en
// die TLS-handdruk misluk met ERR_TLS_CERT_ALTNAME_INVALID. Die
// netlify.app-adres los altyd na Netlify op. process.env.URL bly LAASTE,
// slegs as niks anders beskikbaar is nie.
function kry_identity_basis_url() {
  const werf_url =
    process.env.FUTURE_SHOP_IDENTITY_URL ||
    (process.env.SITE_NAME ? `https://${process.env.SITE_NAME}.netlify.app` : null) ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    process.env.URL;

  return `${werf_url}/.netlify/identity`;
}

// Skep 'n Identity-rekening via die publieke /signup-eindpunt — presies
// dieselfde pad wat 'n gewone koper via identiteit.js sou gebruik. Gee
// { geskep: true } terug by sukses, of { geskep: false, rede } as dit om
// enige rede misluk (bv. e-pos reeds geregistreer) — dit MOET nooit die
// hele uitnodiging-indiening laat val nie, die register-inskrywing is
// reeds gestoor teen hierdie punt.
// 'n Reeds geregistreerde e-posadres is nie 'n fout nie — dit is die
// gewone geval waar 'n bestaande koper 'n outeur word. Die persoon moet
// dan hoor dat hy sy ou wagwoord gebruik, nie dat iets misluk het en hy
// Future Sharp moet kontak. GoTrue antwoord met 400 of 422 en 'n teks
// wat "already registered" bevat; die Afrikaanse vorm word ook getoets
// vir die geval die boodskap ooit verander.
function lyk_soos_bestaande_rekening(status, teks) {
  if (status !== 400 && status !== 422) return false;
  return /already.*regist|reeds.*geregistreer|user.*exists/i.test(teks || "");
}

async function skep_identity_rekening(epos, wagwoord) {
  try {
    const resp = await fetch(`${kry_identity_basis_url()}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: epos, password: wagwoord }),
    });
    if (!resp.ok) {
      const teks = await resp.text();
      return {
        geskep: false,
        bestaan_reeds: lyk_soos_bestaande_rekening(resp.status, teks),
        rede: teks || `Status ${resp.status}`,
      };
    }
    return { geskep: true, bestaan_reeds: false };
  } catch (fout) {
    return { geskep: false, bestaan_reeds: false, rede: fout.message };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const token = (invoer.token || "").trim();
  const naam = (invoer.naam || "").trim();
  const wagwoord = (invoer.wagwoord || "").trim();

  if (!token) {
    return { statusCode: 400, body: "Verpligte veld: token" };
  }
  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }

  const uitnodigings_store = kry_store("uitnodigings");
  const uitnodiging = await uitnodigings_store.get(token, { type: "json" });

  if (!uitnodiging) {
    return { statusCode: 404, body: "Hierdie skakel is nie geldig nie" };
  }
  if (uitnodiging.status !== "hangend") {
    return { statusCode: 409, body: "Hierdie skakel is reeds voltooi en kan nie weer gebruik word nie" };
  }

  // Weer hier, en nie net in kry-uitnodiging.js nie: 'n oortjie wat gister
  // oopgemaak is, sou andersins vandag nog kon indien. Die UI is nie 'n
  // slot nie.
  if (is_verval(uitnodiging)) {
    return { statusCode: 410, body: "Hierdie skakel het verval — vra Future Sharp vir 'n nuwe een" };
  }

  const konfig = ROL_KONFIG[uitnodiging.rol_tipe];
  if (!konfig) {
    return { statusCode: 500, body: "Ongeldige rol op uitnodiging" };
  }

  const kontak_inligting = skoon_kontak_inligting(invoer.kontak_inligting);
  const benodig_rekening = ROLLE_MET_REKENING.includes(uitnodiging.rol_tipe);

  // DIE ONDERTEKENING. Die merkblokkie alleen is nie 'n handtekening nie —
  // wat teken, is die GETIKTE NAAM saam met die bevestiging. Die naam moet
  // ooreenstem met die naam waarop die ooreenkoms staan; 'n handtekening
  // wat van die party se naam verskil, teken niks.
  //
  // Alles hier word op die BEDIENER afgedwing. Die vorm dwing dit ook af,
  // maar 'n vorm is 'n versoek, nie 'n slot nie.
  const vereis_ooreenkoms = ROLLE_MET_OOREENKOMS.includes(uitnodiging.rol_tipe);
  const handtekening = String(invoer.handtekening || "").trim();

  if (vereis_ooreenkoms) {
    if (invoer.ooreenkoms_aanvaar !== true) {
      return { statusCode: 400, body: "Die outeursooreenkoms moet bevestig word voordat die vorm ingedien kan word" };
    }
    if (!handtekening) {
      return { statusCode: 400, body: "Die ooreenkoms moet onderteken word" };
    }
    if (handtekening.toLowerCase() !== naam.toLowerCase()) {
      return { statusCode: 400, body: "Die getekende naam stem nie ooreen met die volle naam nie" };
    }

    // Klousule 6 vereis albei aanhegsels. Hulle is reeds opgelaai teen die
    // token; hier word net nagegaan dat hulle werklik daar is.
    const gelaai = (uitnodiging.leers && typeof uitnodiging.leers === "object") ? uitnodiging.leers : {};
    const kort = VEREISTE_DOKUMENTE.filter((soort) => !gelaai[soort]);
    if (kort.length) {
      return {
        statusCode: 400,
        body: kort.includes("bankbrief")
          ? "Die bankbrief is nog nie opgelaai nie"
          : "Die afskrif van die ID of paspoort is nog nie opgelaai nie",
      };
    }
  }

  if (benodig_rekening) {
    if (!kontak_inligting.epos) {
      return { statusCode: 400, body: "'n E-posadres is nodig om 'n rekening te skep" };
    }
    if (!wagwoord || wagwoord.length < 6) {
      return { statusCode: 400, body: "Wagwoord moet ten minste 6 karakters wees" };
    }
  }

  const entiteit_id = maak_slug(naam);
  if (!entiteit_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const register_store = kry_store(konfig.store);

  const bestaande = await register_store.get(entiteit_id, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: `'n Inskrywing met naam "${naam}" bestaan reeds — kontak Future Sharp direk` };
  }

  const inskrywing = {
    [konfig.idveld]: entiteit_id,
    naam,
    subrekening_kode: "",
    status: "wag_vir_subrekening",
    kontak_inligting,
    geskep_op: new Date().toISOString(),
    geskep_deur: "self-diens (uitnodiging)",
  };

  // Op die INSKRYWING, nie net op die uitnodiging nie: die uitnodiging is
  // 'n token wat mettertyd niks meer beteken nie, terwyl die outeursrekord
  // bly. Dit is die rekord wat later 'n vraag beantwoord — wie het wat
  // geteken, wanneer, en watter weergawe was voor hom.
  if (vereis_ooreenkoms) {
    inskrywing.ooreenkoms = {
      handtekening,
      aanvaar_op: new Date().toISOString(),
      weergawe: OOREENKOMS_WEERGAWE,
      taal: OOREENKOMS_TAAL,
      // Future Sharp se kant. Dit bly leeg totdat die registrasie bevestig
      // word — daardie oomblik IS Future Sharp se ondertekening, ingevolge
      // klousule 14.
      bevestig_op: null,
      bevestig_deur: "",
    };

    // Die lêers bly waar hulle is (`uitnodiging-leers`, sleutel op die
    // token). Die rekord dra die VERWYSING. Kopieer beteken twee plekke
    // met dieselfde ID-afskrif, en dit is die laaste ding wat 'n mens van
    // gevoelige data wil hê.
    inskrywing.dokumente = {};
    for (const soort of VEREISTE_DOKUMENTE) {
      const leer = uitnodiging.leers[soort];
      inskrywing.dokumente[soort] = {
        store: "uitnodiging-leers",
        sleutel: leer.sleutel,
        naam: leer.naam,
        grootte: leer.grootte,
        inhoud_tipe: leer.inhoud_tipe,
        op: leer.op,
      };
    }
  }

  await register_store.setJSON(entiteit_id, inskrywing);

  let rekening_resultaat = { geskep: false, rede: "nie van toepassing vir hierdie rol nie" };
  if (benodig_rekening) {
    rekening_resultaat = await skep_identity_rekening(kontak_inligting.epos, wagwoord);
    if (!rekening_resultaat.geskep) {
      console.error("Kon nie Identity-rekening skep tydens uitnodiging nie:", rekening_resultaat.rede);
    }
  }

  await uitnodigings_store.setJSON(token, {
    ...uitnodiging,
    status: "voltooi",
    voltooi_op: new Date().toISOString(),
    geskepte_entiteit_id: entiteit_id,
    rekening_geskep: rekening_resultaat.geskep,
  });

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sukses: true,
      rekening_geskep: rekening_resultaat.geskep,
      rekening_bestaan_reeds: !!rekening_resultaat.bestaan_reeds,
      rekening_fout: rekening_resultaat.geskep ? null : rekening_resultaat.rede,
    }),
  };
};

