// Word deur voltooi-betaling.js aangeroep wanneer die koper op "Gaan na betaling" klik.
//
// Doen vyf dinge:
// 0. Verifieer die koper se Identity-JWT bediener-kant (_rol-kontrole.js)
//    en koppel hul netlify_identity_id aan die bestelling — dit is wat
//    Fase 5 se "My Boeke" (kry-my-boeke.js) later gebruik om te bepaal
//    watter bestellings aan watter koper behoort.
// 1. Herbou items + totaal SERVER-KANT vanuit die "katalogus"-store — die
//    kliënt se pryse word nooit vertrou nie. Dit voorkom prys-manipulasie
//    (iemand wat die mandjie se prys in die blaaier se dev-tools verander),
//    en is ook nodig om die korrekte verdeling per boek te bepaal.
// 2. Indien enige item(s) 'n verdeling het, skep dinamies 'n Paystack
//    Transaction Split ("op die vlug", soos Paystack self aanbeveel
//    wanneer die samestelling eers by kassa bekend is) en kry 'n
//    split_code terug.
// 3. Stoor 'n konsep-bestelling in Netlify Blobs (status = "Wag vir betaling").
// 4. Roep Paystack se "Initialize Transaction"-eindpunt aan (met split_code
//    indien van toepassing) en gee die authorization_url terug.
//
// PAYSTACK_SECRET_KEY moet as 'n omgewingveranderlike in die Netlify-
// werf-instellings gestel word (nooit in kode nie).
//
// VERDELING-ARGITEKTUUR (uitgebrei): elke verdeling-inskrywing verwys nou
// na 'n rol_tipe (outeur / vennoot / ontwerp_admin / printing /
// aflewering) plus 'n entiteit_id (na die relevante register). Hosting is
// GEEN split-inskrywing nie — dit is 'n suiwer dokumentasie-veld; die
// bedrag bly heeltemal by Future Sharp se hoofrekening (dis presies wat
// gebeur as ons dit eenvoudig NIE by verdeling_per_subrekening voeg nie).
// Ons trek dit wel af by die 3%-veiligheidsnet-berekening hieronder, sodat
// die hoofrekening se ANDER rolle nooit die 3%+Hosting-minimum kan
// oorskry nie.
//
// Oor die verdeling-berekening: 'n Paystack Split Group het EEN tipe
// (persentasie OF vaste bedrag) vir die hele groep, maar 'n boek se
// verdeling in ons katalogus kan per-boek persentasie ÓF vaste bedrag wees.
// Ons versoen dit deur alles om te reken na 'n effektiewe persentasie van
// die item se prys, en dan die subrekening se totale aandeel oor die hele
// bestelling as 'n enkele persentasie van totaal_sent te bereken. Vir
// vaste-bedrag-items is dit wiskundig presies (die bedrag wat Paystack
// uitbetaal, is binne 'n sent van die gestelde vaste bedrag).

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maks_verdeling_sent } = require("./_paystack-koste.js");
const { stuur_outeur_kennisgewings } = require("./_kennisgewing-outeur");

// Rol_tipe → watter Blobs-store die entiteit se subrekening-kode in is.
const ROL_TIPE_STORES = {
  outeur: "outeurs",
  vennoot: "vennote",
  ontwerp_admin: "ontwerp-admin",
  printing: "printing",
  aflewering: "aflewering",
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  // --- Stap 0: verifieer die koper se identiteit bediener-kant ---
  // Sonder 'n geldige "koper"-rol-token kan niemand 'n bestelling begin nie
  // — dit voorkom ook dat 'n bestelling aan die verkeerde koper gekoppel
  // word, aangesien ons NOOIT die kliënt se eie voorstel van wie hulle is
  // vertrou nie.
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan om te koop" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const { bestelnommer, items, aflewering, koper, koepon_kode } = invoer;

  if (!bestelnommer || !items || !items.length || !koper || !koper.epos || !koper.selfoonnommer) {
    return { statusCode: 400, body: "Onvolledige bestelling-data" };
  }

  const katalogusStore = kry_store("katalogus");
  const bestellingsStore = kry_store("bestellings");

  // Onthou reeds-opgesoekte entiteite binne hierdie versoek (oor al 5
  // registers heen) — voorkom herhaalde Blobs-opsoeke as dieselfde
  // entiteit op meer as een item/formaat se verdeling verskyn.
  const entiteit_kas = {};
  async function kry_entiteit(rol_tipe, entiteit_id) {
    const store_naam = ROL_TIPE_STORES[rol_tipe];
    if (!store_naam || !entiteit_id) return null;

    const kas_sleutel = `${rol_tipe}:${entiteit_id}`;
    if (!(kas_sleutel in entiteit_kas)) {
      const store = kry_store(store_naam);
      entiteit_kas[kas_sleutel] = await store.get(entiteit_id, { type: "json" });
    }
    return entiteit_kas[kas_sleutel];
  }

  // Verhoed dat 'n reeds-betaalde bestelnommer oorskryf word
  const bestaande = await bestellingsStore.get(bestelnommer, { type: "json" });
  if (bestaande && bestaande.status !== "Wag vir betaling") {
    return { statusCode: 409, body: "Hierdie bestelnommer is reeds verwerk" };
  }

  // --- Stap 0.5: koepon opsoek + basiese validasie (NOOIT die kliënt se
  // eie voorstel van die afslag-bedrag vertrou nie — ons haal die regte
  // koepon-rekord op en bereken self) ---
  let koepon = null;
  const koepon_kode_skoon = koepon_kode ? String(koepon_kode).trim().toUpperCase() : "";

  if (koepon_kode_skoon) {
    const koeponStore = kry_store("koepons");
    const gevonde_koepon = await koeponStore.get(koepon_kode_skoon, { type: "json" });

    if (!gevonde_koepon) {
      return { statusCode: 400, body: "Koepon-kode is nie geldig nie" };
    }
    if (!gevonde_koepon.aktief) {
      return { statusCode: 400, body: "Hierdie koepon is nie meer aktief nie" };
    }
    if (gevonde_koepon.verval_op && new Date(gevonde_koepon.verval_op) < new Date()) {
      return { statusCode: 400, body: "Hierdie koepon het verval" };
    }
    if (gevonde_koepon.gebruike_tot_dusver >= gevonde_koepon.maks_gebruike) {
      return { statusCode: 400, body: "Hierdie koepon is klaar ten volle gebruik" };
    }
    if (gevonde_koepon.koper_id_beperking && gevonde_koepon.koper_id_beperking !== gebruiker.id) {
      return { statusCode: 400, body: "Hierdie koepon is nie vir jou rekening geldig nie" };
    }
    koepon = gevonde_koepon;
  }

  // Gee terug of 'n koepon op 'n spesifieke item van toepassing is —
  // hou ook "een keer per boek per koper" reg, selfs by 'n
  // veelvuldig-herbruikbare koepon-kode.
  function koepon_geld_vir_item(produk_slug, formaat) {
    if (!koepon) return false;
    if (koepon.koper_id_beperking && koepon.koper_id_beperking !== gebruiker.id) return false;
    if (koepon.produk_slug && koepon.produk_slug !== produk_slug) return false;
    if (koepon.formaat_beperking !== "albei" && koepon.formaat_beperking !== formaat) return false;
    const reeds_gebruik_deur_koper = (koepon.gebruike_geskiedenis || []).some(
      (g) => g.koper_id === gebruiker.id && g.produk_slug === produk_slug
    );
    if (reeds_gebruik_deur_koper) return false;
    return true;
  }

  // --- Voorkom dubbele e-boek-aankope + dubbele/onnodige leen ---
  // Slaan al hierdie koper se reeds-betaalde bestellings na om te sien
  // watter e-boeke hulle reeds BESIT (koop), en watter boeke hulle tans
  // 'n AKTIEWE leen-tydperk voor het. 'n Harde kopie kan doelbewus weer
  // gekoop word (bv. geskenk), so dié beperking geld nie daarvoor nie.
  const reeds_besitte_eboeke = new Set();
  const aktiewe_leen_verval = new Map(); // produk_slug -> jongste verval_op (ISO)
  {
    const { blobs: alle_bestelling_sleutels } = await bestellingsStore.list();
    for (const sleutel_item of alle_bestelling_sleutels) {
      const bestaande_bestelling = await bestellingsStore.get(sleutel_item.key, { type: "json" });
      if (!bestaande_bestelling) continue;
      const behoort_aan_koper =
        bestaande_bestelling.koper &&
        bestaande_bestelling.koper.netlify_identity_id === gebruiker.id;
      if (!behoort_aan_koper || bestaande_bestelling.status !== "Nuut") continue;
      for (const besitte_item of bestaande_bestelling.items || []) {
        if (besitte_item.formaat === "eboek") reeds_besitte_eboeke.add(besitte_item.produk_slug);
        if (besitte_item.formaat === "leen" && besitte_item.verval_op) {
          const huidige = aktiewe_leen_verval.get(besitte_item.produk_slug);
          if (!huidige || new Date(besitte_item.verval_op) > new Date(huidige)) {
            aktiewe_leen_verval.set(besitte_item.produk_slug, besitte_item.verval_op);
          }
        }
      }
    }
  }

  // --- Stap 1: herbou items + totaal server-kant vanuit die katalogus ---
  let totaal_sent = 0;
  let hosting_totaal_sent = 0;
  let bevat_harde_kopie = false;
  const geverifieerde_items = [];
  const verdeling_per_subrekening = {}; // { "ACCT_xxx": sent_bedrag }
  const koepon_gebruikte_items = []; // items waarop die koepon toegepas is

  for (const kliënt_item of items) {
    const produk = await katalogusStore.get(kliënt_item.produk_slug, { type: "json" });
    if (!produk || !produk.aktief) {
      return { statusCode: 400, body: `"${kliënt_item.produk_slug}" is nie meer beskikbaar nie` };
    }

    if (kliënt_item.formaat === "eboek" && reeds_besitte_eboeke.has(produk.slug)) {
      return {
        statusCode: 400,
        body: `Jy besit reeds die e-boek "${produk.titel}" — kyk gerus in "My Boeke". Kontak Future Sharp as jy dink dit is 'n fout.`,
      };
    }

    if (kliënt_item.formaat === "leen") {
      if (reeds_besitte_eboeke.has(produk.slug)) {
        return {
          statusCode: 400,
          body: `Jy besit reeds die e-boek "${produk.titel}" — geen rede om dit ook te leen nie.`,
        };
      }
      const huidige_verval = aktiewe_leen_verval.get(produk.slug);
      if (huidige_verval && new Date(huidige_verval) > new Date()) {
        return {
          statusCode: 400,
          body: `Jy het reeds 'n aktiewe leen vir "${produk.titel}" (verval ${new Date(huidige_verval).toLocaleDateString("af-ZA")}) — wag tot dit verval, of koop dit eerder.`,
        };
      }
    }

    const formaat_data = produk.formate && produk.formate[kliënt_item.formaat];
    if (!formaat_data || !formaat_data.beskikbaar) {
      return { statusCode: 400, body: `"${produk.titel}" (${kliënt_item.formaat}) is nie meer beskikbaar nie` };
    }

    const item_prys_sent = formaat_data.prys_sent; // oorspronklike prys, voor enige koepon
    let verkoop_prys_sent = item_prys_sent;
    let item_koepon_toegepas = false;

    if (koepon_geld_vir_item(produk.slug, kliënt_item.formaat)) {
      item_koepon_toegepas = true;
      if (koepon.tipe === "gratis") {
        verkoop_prys_sent = 0;
      } else if (koepon.afslag_tipe === "vaste_bedrag") {
        verkoop_prys_sent = Math.max(0, item_prys_sent - koepon.afslag_waarde);
      } else {
        verkoop_prys_sent = Math.max(
          0,
          item_prys_sent - Math.round((item_prys_sent * koepon.afslag_waarde) / 100)
        );
      }
      koepon_gebruikte_items.push({ produk_slug: produk.slug, formaat: kliënt_item.formaat });
    }

    totaal_sent += verkoop_prys_sent;
    if (kliënt_item.formaat === "harde_kopie") bevat_harde_kopie = true;

    // Leen-items kry 'n verval-datum — bereken NOU, server-kant, sodat 'n
    // koper dit nooit self kan verleng deur die kliënt te manipuleer nie.
    const leen_ekstra = {};
    if (kliënt_item.formaat === "leen") {
      const tydperk_dae = formaat_data.tydperk_dae > 0 ? formaat_data.tydperk_dae : 30;
      leen_ekstra.verval_op = new Date(Date.now() + tydperk_dae * 24 * 60 * 60 * 1000).toISOString();
      leen_ekstra.tydperk_dae = tydperk_dae;
    }

    geverifieerde_items.push({
      produk_slug: produk.slug,
      titel: produk.titel,
      formaat: kliënt_item.formaat,
      prys_sent: verkoop_prys_sent,
      ...(item_koepon_toegepas ? { oorspronklike_prys_sent: item_prys_sent, koepon_kode: koepon.kode } : {}),
      ...leen_ekstra,
    });

    // Hosting — suiwer dokumentasie, geen subrekening nie. Ons tel dit net
    // op sodat die 3%-veiligheidsnet hieronder ruimte daarvoor hou.
    // LET WEL: gebaseer op die VERKOOP-prys (ná koepon), nie die
    // oorspronklike prys nie — 'n afslag word eweredig deur almal gedra.
    if (formaat_data.hosting) {
      const hosting_sent =
        formaat_data.hosting.tipe === "vaste_bedrag"
          ? Math.min(formaat_data.hosting.waarde, verkoop_prys_sent)
          : Math.round((verkoop_prys_sent * formaat_data.hosting.waarde) / 100);
      hosting_totaal_sent += hosting_sent;
    }

    const verdelings = formaat_data.verdelings || [];
    for (const verdeling of verdelings) {
      if (!verdeling) continue;

      // Ondersteun steeds die OU skema ({ outeur_id }) as 'n vangnet vir
      // enige rekord wat om een of ander rede nie gemigreer is nie.
      const rol_tipe = verdeling.rol_tipe || (verdeling.outeur_id ? "outeur" : null);
      const entiteit_id = verdeling.entiteit_id || verdeling.outeur_id;
      if (!rol_tipe || !entiteit_id) continue;

      const entiteit = await kry_entiteit(rol_tipe, entiteit_id);
      if (!entiteit || !entiteit.subrekening_kode) {
        // Entiteit bestaan nie (meer) nie, of het geen subrekening-kode
        // nie — spring hierdie verdeling oor. Die bedrag bly eenvoudig by
        // Future Sharp se hoofrekening, i.p.v. die hele betaling te laat
        // faal.
        console.warn(`${rol_tipe} "${entiteit_id}" nie gevind nie — verdeling oorgeslaan`);
        continue;
      }

      const item_aandeel_sent =
        verdeling.tipe === "vaste_bedrag"
          ? Math.min(verdeling.waarde, verkoop_prys_sent)
          : Math.round((verkoop_prys_sent * verdeling.waarde) / 100);

      verdeling_per_subrekening[entiteit.subrekening_kode] =
        (verdeling_per_subrekening[entiteit.subrekening_kode] || 0) + item_aandeel_sent;
    }
  }

  if (totaal_sent < 0 || !geverifieerde_items.length) {
    return { statusCode: 400, body: "Bestelling se totaal is ongeldig" };
  }

  // --- 100%-koepon-kortpad: R0, geen Paystack-transaksie moontlik of
  // nodig nie. Merk die bestelling dadelik as betaal (soos die webhook
  // normaalweg sou doen), werk koepon-gebruik + per-produk aankope-tellers
  // op dieselfde plek by (geen webhook gaan ooit hiervoor vuur nie, want
  // daar's nooit 'n regte Paystack-transaksie nie), en stuur die koper
  // reguit na dankie.html i.p.v. Paystack se betaalvenster.
  if (totaal_sent === 0) {
    const nou = new Date().toISOString();
    const gratis_bestelling = {
      bestelnommer,
      geskep_op: bestaande ? bestaande.geskep_op : nou,
      bygewerk_op: nou,
      koper: { ...koper, netlify_identity_id: gebruiker.id },
      items: geverifieerde_items,
      totaal_sent: 0,
      hosting_totaal_sent: 0,
      bevat_harde_kopie,
      aflewering: aflewering || null,
      verdeling: null,
      split_code: null,
      split_fout: null,
      koepon_toegepas: koepon ? { kode: koepon.kode, items: koepon_gebruikte_items } : null,
      drukker: bevat_harde_kopie ? { bestelling_geplaas: false, geplaas_op: null, nota: "" } : null,
      paystack: {
        referensie: bestelnommer,
        geverifieer: true,
        geverifieer_op: nou,
        bedrag_bevestig_sent: 0,
        gratis_via_koepon: true,
      },
      status: "Nuut",
      status_geskiedenis: [{ status: "Nuut", op: nou }],
    };

    await bestellingsStore.setJSON(bestelnommer, gratis_bestelling);

    // Werk koepon-gebruik-rekord dadelik by — geen latere webhook-stap
    // gaan dit doen nie, aangesien daar geen betaling was nie.
    if (koepon && koepon_gebruikte_items.length) {
      const koeponStore = kry_store("koepons");
      const nuwe_geskiedenis = [
        ...(koepon.gebruike_geskiedenis || []),
        ...koepon_gebruikte_items.map((i) => ({
          koper_id: gebruiker.id,
          produk_slug: i.produk_slug,
          formaat: i.formaat,
          op: nou,
        })),
      ];
      await koeponStore.setJSON(koepon.kode, {
        ...koepon,
        gebruike_tot_dusver: koepon.gebruike_tot_dusver + 1,
        gebruike_geskiedenis: nuwe_geskiedenis,
      });
    }

    // Per-produk aankope-tellers — soortgelyk aan paystack-webhook.js,
    // maar hier direk aangeroep aangesien geen webhook gaan vuur nie.
    try {
      const katalogusStore = kry_store("katalogus");
      for (const item of geverifieerde_items) {
        const produk = await katalogusStore.get(item.produk_slug, { type: "json" });
        if (!produk) continue;
        const aankope_veld =
          item.formaat === "harde_kopie" ? "aankope_harde_kopie" :
          item.formaat === "leen" ? "aankope_leen" :
          "aankope_eboek";
        await katalogusStore.setJSON(item.produk_slug, {
          ...produk,
          [aankope_veld]: (produk[aankope_veld] || 0) + 1,
        });
      }
    } catch (fout) {
      console.error(`Kon nie per-produk aankope-tellers bywerk nie vir gratis-bestelling ${bestelnommer}:`, fout);
    }

    // Outeur-kennisgewings. Die webhook doen dit vir 'n betaalde
    // bestelling; hier moet dit self gebeur, anders hoor 'n outeur niks
    // van 'n boek wat deur 'n 100%-koepon weggegee is nie. Dieselfde
    // try/catch as die twee stappe hierbo: die bestelling is klaar
    // gestoor en 'n pos wat misluk mag dit nie ongedaan maak nie.
    try {
      await stuur_outeur_kennisgewings(gratis_bestelling);
    } catch (fout) {
      console.error(`Kon nie outeur-kennisgewings stuur nie vir gratis-bestelling ${bestelnommer}:`, fout);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gratis: true, bestelnommer }),
    };
  }

  // Veiligheidsnet: Future Sharp se hoofrekening moet ALTYD ten minste
  // 3% + Hosting van die bestelling se totaal behou (dek Paystack se
  // transaksiekoste plus die ooreengekome hosting-aandeel, en Paystack
  // self weier 'n verdeling waar die handelaar se aandeel nul of minder
  // is). skep-produk.js/wysig-produk.js keer dit reeds af by stoor-tyd,
  // maar ons verklein hier ook proporsioneel as 'n laaste vangnet — bv.
  // vir data wat van vóór hierdie reël bestaan het — sodat 'n koper se
  // betaling nooit hierom kan misluk nie.
  const totale_verdeling_sent = Object.values(verdeling_per_subrekening).reduce((a, b) => a + b, 0);
  const maks_verdeling_sent = kry_maks_verdeling_sent(totaal_sent) - hosting_totaal_sent;
  if (totale_verdeling_sent > maks_verdeling_sent && totale_verdeling_sent > 0) {
    const skaal_faktor = Math.max(maks_verdeling_sent, 0) / totale_verdeling_sent;
    for (const kode of Object.keys(verdeling_per_subrekening)) {
      verdeling_per_subrekening[kode] = Math.floor(verdeling_per_subrekening[kode] * skaal_faktor);
    }
  }

  // --- Stap 2: dinamiese split-groep skep indien nodig ---
  const subrekening_kodes = Object.keys(verdeling_per_subrekening);
  let split_code = null;
  let split_fout = null; // vangnet-rekord — sien onder

  if (subrekening_kodes.length) {
    const subaccounts = subrekening_kodes.map((kode) => ({
      subaccount: kode,
      share: Math.round((verdeling_per_subrekening[kode] / totaal_sent) * 10000) / 100,
    }));

    try {
      const splitResp = await fetch("https://api.paystack.co/split", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Bestelling ${bestelnommer}`,
          type: "percentage",
          currency: "ZAR",
          subaccounts,
          bearer_type: "account", // Future Sharp dra Paystack se transaksiefooie
        }),
      });

      const splitData = await splitResp.json();
      if (!splitResp.ok || !splitData.status) {
        // VANGNET: 'n foutiewe/ongeldige subrekening-kode (bv. verkeerd
        // ingetik, of nooit werklik by Paystack geskep nie) moes voorheen
        // die HELE aankoop geblokkeer het — een verkeerde kode kon 'n
        // boek se verkope heeltemal stop. Ons laat die betaling nou eerder
        // DEURGAAN sonder verdeling (volle bedrag na die hoofrekening,
        // soos vir enige produk sonder 'n verdeling), en teken die fout
        // aan vir personeel om later reg te stel.
        console.error(`Kon nie split-groep skep nie vir ${bestelnommer} — val terug op hoofrekening:`, splitData);
        split_fout = (splitData && splitData.message) || "Onbekende Paystack-fout";
      } else {
        split_code = splitData.data.split_code;
      }
    } catch (fout) {
      console.error(`Fout tydens split-groep-skepping vir ${bestelnommer} — val terug op hoofrekening:`, fout);
      split_fout = fout.message;
    }
  }

  // --- Stap 3: stoor konsep-bestelling ---
  //
  // DIE PAYSTACK-VERWYSING IS NIE DIE BESTELNOMMER NIE.
  //
  // Paystack weier 'n transaksie met 'n verwysing wat reeds bestaan. Gebruik
  // 'n mens die bestelnommer self, misluk elke TWEEDE poging op dieselfde
  // bestelling met 'n 502 — presies wat gebeur wanneer die koper by Paystack
  // kanselleer en dan weer probeer. (Waargeneem 14 Augustus 2026.)
  //
  // Die bestelnommer bly wat hy is: die sleutel van die rekord en wat die
  // koper sien. Die verwysing kry 'n agtervoegsel per poging. Die webhook
  // vind die bestelling steeds, want metadata.bestelnommer gaan saam.
  //
  // 'n Bestaande rekord sonder `poging` kom uit die tyd voor hierdie
  // regstelling en het sy eerste transaksie op die kaal bestelnommer gehad —
  // daarom begin hy by 2, nie by 1 nie.
  const poging = bestaande ? (Number(bestaande.paystack && bestaande.paystack.poging) || 1) + 1 : 1;
  const paystack_verwysing = poging === 1 ? bestelnommer : `${bestelnommer}-${poging}`;

  const konsep_bestelling = {
    bestelnommer,
    geskep_op: bestaande ? bestaande.geskep_op : new Date().toISOString(),
    bygewerk_op: new Date().toISOString(),
    koper: {
      ...koper,
      // Bediener-kant geverifieer (Stap 0) — NOOIT die kliënt se eie
      // voorstel van hul identiteit vertrou nie. Dit is wat kry-my-boeke.js
      // gebruik om 'n bestelling aan 'n aangemelde koper te koppel.
      netlify_identity_id: gebruiker.id,
    },
    items: geverifieerde_items,
    totaal_sent,
    // Suiwer dokumentasie — geen subrekening nie, bly by die hoofrekening.
    hosting_totaal_sent,
    bevat_harde_kopie,
    aflewering: aflewering || null,
    verdeling: subrekening_kodes.length ? verdeling_per_subrekening : null,
    split_code,
    split_fout,
    koepon_toegepas: koepon ? { kode: koepon.kode, items: koepon_gebruikte_items } : null,
    drukker: bevat_harde_kopie
      ? { bestelling_geplaas: false, geplaas_op: null, nota: "" }
      : null,
    paystack: { referensie: paystack_verwysing, poging, geverifieer: false },
    status: "Wag vir betaling",
    status_geskiedenis: [{ status: "Wag vir betaling", op: new Date().toISOString() }],
  };

  await bestellingsStore.setJSON(bestelnommer, konsep_bestelling);

  // --- Stap 4: inisieer die Paystack-transaksie ---
  const webwerf_url = process.env.URL || "http://localhost:8888";

  try {
    const paystackBody = {
      email: koper.epos,
      amount: totaal_sent, // Paystack verwag ook die kleinste eenheid (sent)
      reference: paystack_verwysing,
      callback_url: `${webwerf_url}/dankie.html?bestelnommer=${bestelnommer}`,
      metadata: {
        bestelnommer,
        selfoonnommer: koper.selfoonnommer,
      },
    };
    if (split_code) paystackBody.split_code = split_code;

    const paystackResp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackBody),
    });

    const paystackData = await paystackResp.json();

    if (!paystackResp.ok || !paystackData.status) {
      console.error("Paystack-inisiëring het misluk:", paystackData);
      return { statusCode: 502, body: "Kon nie betaling by Paystack begin nie" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
      }),
    };
  } catch (fout) {
    console.error("Fout tydens Paystack-inisiëring:", fout);
    return { statusCode: 500, body: "Kon nie betaling begin nie" };
  }
};
