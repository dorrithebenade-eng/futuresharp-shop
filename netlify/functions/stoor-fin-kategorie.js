// netlify/functions/stoor-fin-kategorie.js
//
// Boekhouding-beskermd — skep of wysig een finansiele kategorie.
//
// EEN FUNCTION VIR ALBEI, want die reels is dieselfde. 'n Aparte skep- en
// wysig-lêer sou beteken die kringloopwag en die rigtingkontrole bestaan twee
// keer, en dan dryf hulle uitmekaar.
//
// DAAR IS GEEN SKRAP NIE, EN DIT IS DIE HELE ONTWERP.
//
// 'n Kategorie word nooit verwyder nie; sy word onder 'n ander een gesit.
// "Reis koste" — 'n spelfout wat 'n maand lank gebruik is — bly bestaan, wys
// onder "Reiskoste", en haar bedrae tel op die regte reel. Skrap 'n mens haar,
// verskuif 'n historiese bedrag, en 'n staat wat verlede maand uitgegaan het,
// is nie meer die staat wat die stelsel vandag wys nie.
//
// DIE ID KOM UIT DIE NAAM EN VERANDER NOOIT.
//
// Dieselfde patroon as die begunstigderegister s'n: 'n werk-item en 'n
// joernaalinskrywing wys na die id, en 'n hernoeming mag hul verwysing nie
// breek nie. Hernoem 'n mens "Reiskoste" na "Reis en verblyf", bly die id
// `reiskoste` en elke bestaande verwysing hou.
//
// DRIE KONTROLES BY DIE STOOR
//
//   1. Die kringloop. Reiskoste onder Petrol terwyl Petrol onder Reiskoste is,
//      laat elke som wat oor die boom optel vir ewig loop.
//
//   2. Die rigting teen die ouer. 'n Uitgawe onder 'n inkomstekategorie laat
//      die staat stilweg verkeerd optel — die bedrag verskyn, maar aan die
//      verkeerde kant.
//
//   3. Die vaste twee. Diensinkomste en Paystack se transaksiefooi word deur
//      die stelsel geskryf; hul naam en rigting mag nie verander nie. Hulle
//      MAG onder 'n ander een gesit word, en hul merkie en nota mag verander —
//      dit is die enigste dinge waaroor 'n mens by hulle 'n keuse het.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fin_kategoriee_store,
  RIGTINGS,
  VAS,
  maak_slug,
  nuwe_kategorie,
  sou_kringloop,
} = require("./_fin-kategoriee");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const naam = String(invoer.naam || "").trim().slice(0, 120);
  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }

  // 'n WYSIGING DRA HAAR EIE ID SAAM. 'n Nuwe een lei hom uit die naam af.
  const id = String(invoer.id || "").trim() || maak_slug(naam);
  if (!id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const onder = String(invoer.onder || "").trim();
  const rigting = RIGTINGS.includes(invoer.rigting) ? invoer.rigting : "uit";
  const gedek = invoer.gedek_deur_hosting === true;
  const nota = String(invoer.nota || "").trim().slice(0, 500);

  const store = kry_fin_kategoriee_store();

  let almal = [];
  try {
    const { blobs } = await store.list();
    almal = (
      await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
    ).filter(Boolean);
  } catch (fout) {
    console.error("Kon nie die kategoriee lees voor die stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die kategoriee laai nie" };
  }

  const bestaande = almal.find((k) => k.id === id) || null;

  // Skep 'n mens 'n nuwe een op 'n naam wat reeds 'n id gee, is dit 'n
  // duplikaat. 'n Wysiging stuur haar id saam en kom nie hier nie.
  if (!invoer.id && bestaande) {
    return { statusCode: 409, body: `'n Kategorie met die naam "${naam}" bestaan reeds` };
  }
  if (invoer.id && !bestaande) {
    return { statusCode: 404, body: "Kategorie nie gevind nie" };
  }

  // ── 1. Die ouer moet bestaan ────────────────────────────────────────────
  if (onder && !almal.some((k) => k.id === onder) && !VAS[onder]) {
    return { statusCode: 400, body: "Die kategorie waaronder dit moet val, bestaan nie" };
  }

  // ── 2. Die kringloop ────────────────────────────────────────────────────
  if (sou_kringloop(id, onder, almal)) {
    return {
      statusCode: 409,
      body: "Dit sou 'n kringloop maak — die kategorie val reeds onder die een wat jy gekies het",
    };
  }

  // ── 3. Die rigting teen die ouer ────────────────────────────────────────
  //
  // 'n Uitgawe onder 'n inkomstekategorie verskyn WEL op die staat, net aan
  // die verkeerde kant, en die totale is dan stil verkeerd.
  const ouer = onder ? almal.find((k) => k.id === onder) : null;
  const ouer_rigting = ouer ? ouer.rigting : VAS[onder] && VAS[onder].rigting;
  if (onder && ouer_rigting && ouer_rigting !== rigting) {
    return {
      statusCode: 409,
      body: `Die rigting stem nie ooreen nie: hierdie kategorie is "${rigting}" en die een waaronder sy val, is "${ouer_rigting}"`,
    };
  }

  // ── 4. Die vaste twee ───────────────────────────────────────────────────
  const is_vas = Boolean(VAS[id] || (bestaande && bestaande.vas));
  if (is_vas) {
    const vaste_naam = (VAS[id] && VAS[id].naam) || (bestaande && bestaande.naam);
    const vaste_rigting = (VAS[id] && VAS[id].rigting) || (bestaande && bestaande.rigting);
    if (naam !== vaste_naam || rigting !== vaste_rigting) {
      return {
        statusCode: 409,
        body: "Hierdie kategorie word deur die stelsel geskryf. Sy mag onder 'n ander een geplaas word, maar haar naam en rigting bly.",
      };
    }
  }

  // ── 5. 'n Kind se rigting mag nie onder haar uit verander nie ───────────
  //
  // Draai 'n mens 'n ouer se rigting om terwyl haar kinders bly staan, is die
  // helfte van die tak aan die verkeerde kant. Die kontrole hoort hier, want
  // die skerm sien nie die kinders wat nie op die skerm is nie.
  if (bestaande && bestaande.rigting !== rigting) {
    const het_kinders = almal.some((k) => k.onder === id);
    if (het_kinders) {
      return {
        statusCode: 409,
        body: "Hierdie kategorie het subkategoriee. Verander eers hulle rigting, of skuif hulle weg.",
      };
    }
  }

  const nou = new Date().toISOString();
  const rekord = {
    ...(bestaande || nuwe_kategorie()),
    id,
    naam,
    onder,
    rigting,
    gedek_deur_hosting: gedek,
    vas: is_vas,
    nota,
    bygewerk_op: nou,
  };
  if (!bestaande) {
    rekord.geskep_op = nou;
    rekord.geskep_deur = gebruiker.email || "";
  }

  try {
    await store.setJSON(id, rekord);
  } catch (fout) {
    console.error(`Kon nie kategorie "${id}" stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kategorie stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kategorie: rekord }),
  };
};
