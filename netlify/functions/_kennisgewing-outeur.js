// netlify/functions/_kennisgewing-outeur.js
//
// Stuur vir elke outeur 'n pos oor SY EIE boeke in 'n bestelling.
//
// Een bestelling kan boeke van verskeie outeurs bevat, en 'n boek kan
// meer as een outeur hê. Daarom word eers per outeur gegroepeer en dan
// een pos gestuur — twee poste vir dieselfde bestelling lees soos 'n fout.
//
// HARDE KOPIEË kry ook 'n pos, met die afleweradres daarby. Die outeur
// druk en pos self, dus is daardie adres die punt van die hele boodskap.
// Die adres kom uit die koper se eie getikte teks en word ontsnap —
// alles anders in 'n pos kom uit die katalogus of die outeursrekord.
// Bestellings van vóór 3 Aug 2026 het geen aflewering.ontvanger nie; dan
// sê die pos dit eerder as om 'n naamlose adres te gee.
//
// Hierdie module gooi nooit 'n fout op sodat 'n betaling breek nie: die
// aanroeper hou dit in 'n try/catch, en stuur_epos() gee self { ok, fout }
// terug in plaas van te gooi.

const { kry_store } = require("./_blob-store");
const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie — 'n wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener
// land. Vir 'n skakel wat 'n mens klik, is die eie domein in elk geval
// die regte een.
const WERF_URL = "https://futureshop.futuresharp.co.za";

const FORMATE_WAT_POS_KRY = ["eboek", "leen", "harde_kopie"];

function rand(sent) {
  return "R" + (Number(sent || 0) / 100).toFixed(2).replace(".", ",");
}

// Tel op wat hierdie een outeur uit hierdie een item kry. Dieselfde
// berekening as begin-betaling.js, insluitend die vangnet vir die ou
// skema ({ outeur_id } i.p.v. { rol_tipe, entiteit_id }).
function outeur_aandeel_sent(verdelings, outeur_id, prys_sent) {
  let som = 0;
  for (const v of verdelings || []) {
    if (!v) continue;
    const rol_tipe = v.rol_tipe || (v.outeur_id ? "outeur" : null);
    const entiteit_id = v.entiteit_id || v.outeur_id;
    if (rol_tipe !== "outeur" || entiteit_id !== outeur_id) continue;

    som +=
      v.tipe === "vaste_bedrag"
        ? Math.min(v.waarde, prys_sent)
        : Math.round((prys_sent * v.waarde) / 100);
  }
  return som;
}

// Wie moet van hierdie item hoor? Dieselfde twee bronne as kry-verslag.js:
// die outeurs wat op die produk gekrediteer is, en enigeen wat met
// rol_tipe "outeur" in hierdie formaat se verdeling voorkom. 'n Outeur
// kan gekrediteer wees sonder 'n verdeling, en andersom.
function outeur_ids_vir_item(produk, formaat_data) {
  const ids = new Set();

  for (const id of produk.outeur_ids || []) {
    if (id) ids.add(id);
  }
  for (const v of (formaat_data && formaat_data.verdelings) || []) {
    if (!v) continue;
    const rol_tipe = v.rol_tipe || (v.outeur_id ? "outeur" : null);
    const entiteit_id = v.entiteit_id || v.outeur_id;
    if (rol_tipe === "outeur" && entiteit_id) ids.add(entiteit_id);
  }
  return [...ids];
}

// Die outeur se eie leesalleen-staat, as daar reeds een geskep is. Ons
// skep nooit hier een nie — 'n skakel wat vanself in 'n pos verskyn
// sonder dat iemand dit uitgereik het, is 'n verrassing. Bestaan daar
// nie een nie, val die knoppie eenvoudig weg.
async function kry_verslag_url(outeur_id) {
  try {
    const indeks = kry_store("verslag-skakels-indeks");
    const inskrywing = await indeks.get(`outeur:${outeur_id}`, { type: "json" });
    if (inskrywing && inskrywing.token) {
      return `${WERF_URL}/verslag.html?token=${encodeURIComponent(inskrywing.token)}`;
    }
  } catch (fout) {
    console.warn(`Kon nie verslagskakel vir outeur "${outeur_id}" opsoek nie:`, fout);
  }
  return null;
}

// Voorkeure bestaan nog nie op die outeursrekord nie. Afwesig beteken
// "ja" — sodra die veld bykom, hoef niks hier te verander nie.
//
// 'N HARDE KOPIE KEN GEEN VOORKEUR NIE. Die keuse geld verkope waar die pos
// bloot inligting dra: 'n e-boek en 'n leen gebeur klaar sonder hom. 'n Harde
// kopie verg dat hy druk en pos, en 'n koper wat betaal het, wag daarop. Sou
// die voorkeur daardie pos onderdruk, is die geld geneem en niemand weet van
// die bestelling nie.
//
// Die toets kyk dus na die REËLS in hierdie pos, nie net na die voorkeur nie.
// Dieselfde `enige_harde_kopie` wat bou_pos() gebruik om die afleweringsblok
// by te sit.
function wil_hoor_van_verkope(outeur, reël_items) {
  const bevat_harde_kopie = (reël_items || []).some(
    (i) => i && i.formaat === "harde_kopie"
  );
  if (bevat_harde_kopie) return true;

  const voorkeure = outeur && outeur.kennisgewings;
  return !(voorkeure && voorkeure.by_verkoop === false);
}

function beskryf_item(reël_item) {
  const { titel, formaat, tydperk_dae } = reël_item;
  if (formaat === "leen") {
    const dae = tydperk_dae > 0 ? tydperk_dae : 30;
    return `<b>${titel}</b> is vir ${dae} dae uitgeleen.`;
  }
  if (formaat === "harde_kopie") {
    return `<b>${titel}</b> is as harde kopie verkoop.`;
  }
  return `<b>${titel}</b> is as e-boek verkoop.`;
}

// Die adres, as één paragraaf met reëlbreuke. Alles hierin kom uit die
// koper se eie invoer, dus word elke stuk ontsnap.
function aflewering_blok(bestelling) {
  const aflewering = bestelling.aflewering;
  if (!aflewering) {
    return "Geen afleweradres is by hierdie bestelling gestoor nie. Kontak Future Shop voordat jy die boek pos.";
  }

  const reels = [];
  if (aflewering.ontvanger) reels.push(`<b>${ontsnap(aflewering.ontvanger)}</b>`);
  if (aflewering.straat) reels.push(ontsnap(aflewering.straat));
  if (aflewering.stad) reels.push(ontsnap(aflewering.stad));

  const onderste = [aflewering.provinsie, aflewering.poskode]
    .filter(Boolean)
    .map(ontsnap)
    .join(", ");
  if (onderste) reels.push(onderste);

  const selfoon = bestelling.koper && bestelling.koper.selfoonnommer;
  if (selfoon) reels.push(`Selfoon ${ontsnap(selfoon)}`);

  // Ou bestellings het geen ontvanger nie. 'n Naamlose adres laat die
  // outeur raai; dit is beter om te sê waar die gaping is.
  if (!aflewering.ontvanger) {
    reels.push("Geen ontvangernaam is by hierdie bestelling gestoor nie — kontak Future Shop.");
  }

  return `Stuur na<br>${reels.join("<br>")}`;
}

function bedrae_blok(reël_item) {
  const prys_etiket = reël_item.formaat === "leen" ? "Leenprys" : "Verkoopprys";

  // 'n 100%-koepon gee 'n item van R0. "Verkoopprys R0,00" lees soos 'n
  // fout; sê eerder wat gebeur het.
  if (!reël_item.prys_sent) {
    return "Gratis — geen inkomste vir hierdie een.";
  }

  // Geen verdeling vir hierdie outeur op hierdie formaat nie: wys net die
  // prys. "Jou deel R0,00" is verkeerd sowel as onrusbarend — dit beteken
  // die verdeling is nog nie opgestel nie, en dit is 'n admin-saak.
  if (!reël_item.aandeel_sent) {
    return `${prys_etiket} ${rand(reël_item.prys_sent)}`;
  }

  const future_sharp_sent = reël_item.prys_sent - reël_item.aandeel_sent;
  return [
    `${prys_etiket} ${rand(reël_item.prys_sent)}`,
    `Jou deel ${rand(reël_item.aandeel_sent)}`,
    `Future Sharp se deel ${rand(future_sharp_sent)}`,
  ].join("<br>");
}

function bou_pos(outeur, reël_items, bestelling) {
  const enkel = reël_items.length === 1;
  const enige_aandeel = reël_items.some((i) => i.aandeel_sent > 0);
  const enige_harde_kopie = reël_items.some((i) => i.formaat === "harde_kopie");

  let onderwerp;
  let opskrif;

  if (enkel) {
    const formaat = reël_items[0].formaat;
    const titel = reël_items[0].titel;
    if (formaat === "leen") {
      onderwerp = `Uitgeleen op Future Shop — ${titel}`;
      opskrif = "Jou boek is uitgeleen";
    } else if (formaat === "harde_kopie") {
      // Die onderwerp sê "harde kopie" sodat die outeur in sy inkassie
      // kan sien watter poste werk verg en watter net inligting is.
      onderwerp = `Harde kopie verkoop op Future Shop — ${titel}`;
      opskrif = "Jou boek is verkoop";
    } else {
      onderwerp = `Verkoop op Future Shop — ${titel}`;
      opskrif = "Jou boek is verkoop";
    }
  } else {
    onderwerp = enige_harde_kopie
      ? "Verkope op Future Shop — een is 'n harde kopie"
      : "Verkope op Future Shop";
    opskrif = "Jou boeke op Future Shop";
  }

  const reels = [`Goeie dag ${outeur.naam}`];

  for (const reël_item of reël_items) {
    reels.push(beskryf_item(reël_item));
    reels.push(bedrae_blok(reël_item));
  }

  if (enige_harde_kopie) {
    reels.push(aflewering_blok(bestelling));
    if (bestelling.bestelnommer) {
      reels.push(`Bestelnommer <b>${ontsnap(bestelling.bestelnommer)}</b>`);
    }
  }

  if (enige_aandeel) {
    reels.push("Uitbetaling geskied gewoonlik binne twee werksdae.");
  }

  return { onderwerp, opskrif, reels };
}

// Opsies (albei net vir die toetsroete — die webhook gee niks deur nie):
//   droog          — bereken alles, stuur niks, gee die beplande poste terug
//   oorheers_aan   — stuur alles na hierdie adres i.p.v. die outeur s'n
//
// Gee 'n lys terug van wat beplan of gestuur is, sodat 'n toets kan sien
// wat sou gebeur sonder om die logs te lees.
async function stuur_outeur_kennisgewings(bestelling, opsies = {}) {
  const { droog = false, oorheers_aan = null } = opsies;

  const items = (bestelling.items || []).filter((i) =>
    FORMATE_WAT_POS_KRY.includes(i.formaat)
  );
  if (!items.length) return [];

  const katalogus = kry_store("katalogus");
  const outeurs_store = kry_store("outeurs");

  // outeur_id -> lys van sy eie reëls in hierdie bestelling
  const per_outeur = new Map();

  for (const item of items) {
    const produk = await katalogus.get(item.produk_slug, { type: "json" });
    if (!produk) continue;

    const formaat_data = (produk.formate && produk.formate[item.formaat]) || null;

    for (const outeur_id of outeur_ids_vir_item(produk, formaat_data)) {
      const reël_item = {
        titel: item.titel || produk.titel || item.produk_slug,
        formaat: item.formaat,
        prys_sent: item.prys_sent || 0,
        tydperk_dae: item.tydperk_dae,
        aandeel_sent: outeur_aandeel_sent(
          formaat_data && formaat_data.verdelings,
          outeur_id,
          item.prys_sent || 0
        ),
      };

      if (!per_outeur.has(outeur_id)) per_outeur.set(outeur_id, []);
      per_outeur.get(outeur_id).push(reël_item);
    }
  }

  const opsomming = [];

  for (const [outeur_id, reël_items] of per_outeur) {
    const outeur = await outeurs_store.get(outeur_id, { type: "json" });
    if (!outeur) {
      console.warn(`Kennisgewing oorgeslaan — outeur "${outeur_id}" nie gevind nie`);
      opsomming.push({ outeur_id, oorgeslaan: "outeur nie gevind nie" });
      continue;
    }

    const outeur_epos = outeur.kontak_inligting && outeur.kontak_inligting.epos;
    if (!outeur_epos) {
      console.warn(`Kennisgewing oorgeslaan — geen e-posadres vir outeur "${outeur_id}"`);
      opsomming.push({ outeur_id, oorgeslaan: "geen e-posadres nie" });
      continue;
    }

    if (!wil_hoor_van_verkope(outeur, reël_items)) {
      opsomming.push({ outeur_id, oorgeslaan: "voorkeur is af" });
      continue;
    }

    const { onderwerp, opskrif, reels } = bou_pos(outeur, reël_items, bestelling);
    const verslag_url = await kry_verslag_url(outeur_id);
    const aan = oorheers_aan || outeur_epos;

    const rekord = {
      outeur_id,
      naam: outeur.naam,
      aan,
      outeur_epos,
      onderwerp,
      opskrif,
      reels,
      verslag_skakel: Boolean(verslag_url),
      items: reël_items.length,
    };

    if (droog) {
      opsomming.push({ ...rekord, gestuur: false, droog: true });
      continue;
    }

    const uitslag = await stuur_epos({
      aan,
      onderwerp,
      opskrif,
      reels,
      knoppie: verslag_url ? { teks: "Sien jou volledige staat", url: verslag_url } : null,
    });

    if (!uitslag.ok) {
      console.error(`Kennisgewing aan outeur "${outeur_id}" het misluk:`, uitslag.fout);
    }
    opsomming.push({ ...rekord, gestuur: uitslag.ok, fout: uitslag.fout || null });
  }

  return opsomming;
}

module.exports = { stuur_outeur_kennisgewings };
