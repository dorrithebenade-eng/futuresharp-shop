// netlify/functions/versoek-bankbesonderhede.js
//
// Die outeur se versoek om sy bankbesonderhede te verander, en die pad
// terug daaruit.
//
// DIT SKRYF NOOIT DIE BANKVELDE NIE. Dit skryf 'n VOORSTEL op sy rekord —
// `bank_versoek` — en niks meer nie. Dieselfde patroon as 'n hangende
// wysiging aan 'n boek: die lewendige waarde bly staan tot iemand dit
// hanteer. Hier is dit boonop nie 'n keuse nie: die geld volg die
// bankrekening wat BINNE die betaaldiens aan sy subrekening gekoppel is, en
// geen Function raak daaraan nie. Sou hierdie een die velde op die rekord
// verander, sou die skerm 'n rekening wys waarheen die geld nie gaan nie —
// erger as om niks te wys nie.
//
// EEN LÊER VIR TWEE HANDELINGE. `versoek` en `onttrek` deel die
// eienaarskontrole en die rekord; die onttrekking self is drie reëls.
// Dieselfde keuse as stoor-my-besonderhede.js, wat twee kaarte hanteer.
//
// ROL: "koper" — 'n outeur is in Identity se oë 'n gewone koper. Die
// werklike grens is kry_my_outeur(), wat slegs die inskrywing agter hierdie
// aangemelde rekening teruggee.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const { stuur_bankversoek_kennisgewing } = require("./_kennisgewing-bank");

const MAKS_NAAM = 120;
const MAKS_BANK = 80;
const MAKS_OPMERKING = 200;

function skoon(waarde, maks) {
  return String(waarde === undefined || waarde === null ? "" : waarde)
    .trim()
    .slice(0, maks);
}

// Syfers alleen. 'n Rekeningnommer met spasies of strepies is dieselfde
// nommer, dus haal ons hulle weg eerder as om die versoek te weier.
function net_syfers(waarde) {
  return String(waarde || "").replace(/[\s-]/g, "");
}

function keur_versoek(invoer) {
  const houer = skoon(invoer.houer, MAKS_NAAM);
  const bank_naam = skoon(invoer.bank_naam, MAKS_BANK);
  const bank_tak_kode = net_syfers(invoer.bank_tak_kode);
  const bank_rekeningnommer = net_syfers(invoer.bank_rekeningnommer);
  const opmerking = skoon(invoer.opmerking, MAKS_OPMERKING);

  if (houer.length < 2) return { fout: "Verskaf die rekeninghouer se naam" };
  if (bank_naam.length < 2) return { fout: "Verskaf die bank" };
  if (!/^\d{6}$/.test(bank_tak_kode)) return { fout: "Die takkode is ses syfers" };
  if (!/^\d{6,13}$/.test(bank_rekeningnommer)) {
    return { fout: "Die rekeningnommer is tussen ses en dertien syfers" };
  }

  return {
    versoek: { houer, bank_naam, bank_tak_kode, bank_rekeningnommer, opmerking },
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const myne = await kry_my_outeur(gebruiker);
  if (!myne) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  const aksie = invoer.aksie === "onttrek" ? "onttrek" : "versoek";

  const store = kry_store("outeurs");
  let bestaande;
  try {
    bestaande = await store.get(myne.outeur_id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie outeur ${myne.outeur_id} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die versoek stoor nie" };
  }

  if (!bestaande) {
    return { statusCode: 404, body: "Hierdie inskrywing bestaan nie meer nie" };
  }

  const bygewerk = { ...bestaande };

  if (aksie === "onttrek") {
    if (!bestaande.bank_versoek) {
      return { statusCode: 409, body: "Daar is geen hangende versoek nie" };
    }
    delete bygewerk.bank_versoek;
  } else {
    // Twee versoeke gelyk kan nie. Wil hy iets anders vra, onttrek hy die
    // eerste — anders weet niemand watter een admin gesien het nie.
    if (bestaande.bank_versoek) {
      return { statusCode: 409, body: "Daar is reeds 'n hangende versoek" };
    }

    const uitslag = keur_versoek(invoer);
    if (uitslag.fout) {
      return { statusCode: 400, body: uitslag.fout };
    }

    bygewerk.bank_versoek = {
      ...uitslag.versoek,
      versoek_op: new Date().toISOString(),
      versoek_deur: gebruiker.email || "",
    };
  }

  try {
    await store.setJSON(myne.outeur_id, bygewerk);
  } catch (fout) {
    console.error(`Kon nie outeur ${myne.outeur_id} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die versoek stoor nie" };
  }

  // Die pos kom NÁ die stoor en kan die antwoord nie breek nie.
  if (aksie === "versoek") {
    const pos = await stuur_bankversoek_kennisgewing(
      bestaande.naam,
      Boolean(bygewerk.bank_versoek.opmerking)
    );
    if (!pos.gestuur) {
      console.error(`Bankversoek van ${myne.outeur_id}: geen pos —`, pos.rede);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, bank_versoek: bygewerk.bank_versoek || null }),
  };
};
