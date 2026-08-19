// netlify/functions/dra-begunstigde-oor.js
//
// Boekhouding-beskermd — maak van 'n wagkamer-indiening 'n werklike
// begunstigde, en skrap die indiening.
//
// TWEE HANDELINGE IN EEN, EN DIE VOLGORDE IS NIE WILLEKEURIG NIE. Eers word
// die rekord geskep, dan word die indiening geskrap. Andersom, en 'n
// mislukking laat die bankbesonderhede weg terwyl daar geen rekord is nie -
// en dan moet 'n mens die persoon weer vra.
//
// Misluk die SKRAP nadat die rekord geskep is, bly die indiening staan. Dit
// lyk soos werk wat nie gedoen is nie, maar dit is die veilige kant: 'n mens
// druk weer, kry 'n 409, en skrap hom dan met die Vee weg-knoppie.
//
// DIE NAAM KAN BY DIE OORDRAG VERANDER. Dit is die hele rede waarom die
// wagkamer bestaan. Die `begunstigde_id` is 'n slak van die naam en verander
// NOOIT weer - 'n faktuur se gevriesde verdeling verwys daarna. Tik iemand
// "eugene marais" op die vorm, is dit hier waar dit "Eugene Marais" word.
//
// DIE SUBREKENING-KODE KAN SAAMKOM. Is die persoon reeds 'n outeur met 'n
// ACCT_-kode, plak die skerm dit hier in. Dan word daar nie 'n tweede
// subrekening gemaak nie, en - let op - wysig-begunstigde.js se reel geld
// ook hier: is daar 'n kode, word die bankbesonderhede NIE gestoor nie.
// Hulle bestaan net om die subrekening mee te maak.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const ROLLE = ["boekhouding"];
const WAGKAMER = "begunstigde-indienings";

const KONTAK_VELDE = ["epos", "selfoon", "adres"];
const BANK_VELDE = ["rekeninghouer", "bank_naam", "rekeningnommer", "takkode", "tipe"];

function maak_slug(teks) {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function kies(bron, velde, kleinletter_epos) {
  const uit = {};
  if (!bron || typeof bron !== "object") return uit;
  for (const veld of velde) {
    if (bron[veld]) {
      let waarde = String(bron[veld]).trim().slice(0, 200);
      if (kleinletter_epos && veld === "epos") waarde = waarde.toLowerCase();
      if (veld === "rekeningnommer" || veld === "takkode") waarde = waarde.replace(/\s+/g, "");
      uit[veld] = waarde;
    }
  }
  return uit;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie - boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = String(invoer.sleutel || "").trim();
  if (!sleutel || sleutel.indexOf("IN-") !== 0) {
    return { statusCode: 400, body: "Verpligte veld: sleutel" };
  }

  const wag = kry_store(WAGKAMER);

  let indiening;
  try {
    indiening = await wag.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening lees nie" };
  }
  if (!indiening) {
    return { statusCode: 404, body: "Die indiening bestaan nie meer nie" };
  }

  // Die skerm stuur die MOONTLIK GEREGSTELDE waardes saam. Kom hulle nie deur
  // nie, val ons terug op die indiening self.
  const naam = String(invoer.naam || indiening.naam || "").trim();
  if (!naam) {
    return { statusCode: 400, body: "Die naam is verplig" };
  }

  const subrekening_kode = String(invoer.subrekening_kode || "").trim();
  if (subrekening_kode && !subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const begunstigde_id = maak_slug(naam);
  if (!begunstigde_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const store = kry_store("begunstigdes");

  const bestaande = await store.get(begunstigde_id, { type: "json" });
  if (bestaande) {
    // GEEN OORSKRYWING NIE. Die bestaande rekord kan reeds 'n subrekening en
    // 'n faktuurgeskiedenis he. Wat hier hoort, is dat 'n mens die indiening
    // met die hand teen die bestaande rekord vergelyk - en dit is 'n besluit,
    // nie 'n handeling nie.
    return {
      statusCode: 409,
      body: `Daar is reeds 'n begunstigde met die naam "${naam}"`,
    };
  }

  const bank = kies(invoer.bank || indiening.bank, BANK_VELDE, false);

  const inskrywing = {
    begunstigde_id,
    naam,
    subrekening_kode,
    status: subrekening_kode ? "aktief" : "wag_vir_subrekening",
    kontak_inligting: kies(
      invoer.kontak_inligting || indiening.kontak_inligting,
      KONTAK_VELDE,
      true
    ),
    // Dieselfde reel as wysig-begunstigde.js: is die kode daar, is die
    // bankbesonderhede se werk gedoen en word hulle nie gestoor nie.
    bank: subrekening_kode ? {} : bank,
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
    // Waar hy vandaan kom. Dit is die enigste plek waar dit ooit opgeteken
    // word, en dit beantwoord later die vraag of die vorm gebruik word.
    bron: "vorm",
    ingedien_op: indiening.ingedien_op || "",
  };

  try {
    await store.setJSON(begunstigde_id, inskrywing);
  } catch (fout) {
    console.error("Kon nie die begunstigde skep nie:", fout);
    return { statusCode: 500, body: "Kon nie die begunstigde skep nie" };
  }

  // EERS NOU. Sien die kop van hierdie leer vir waarom die volgorde tel.
  let geskrap = true;
  try {
    await wag.delete(sleutel);
  } catch (fout) {
    console.error("Die rekord is geskep maar die indiening is nie geskrap nie:", fout);
    geskrap = false;
  }

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ begunstigde: inskrywing, indiening_geskrap: geskrap }),
  };
};
