// netlify/functions/hernu-betaalskakel.js
//
// Gee 'n uitgereikte, onbetaalde faktuur 'n VARS betaalskakel. Rol: boekhouding.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAN
//
// Die skakel word by uitreiking een keer geskep, en Paystack se toegangskode
// bly nie onbeperk lewendig nie. 'n Faktuur wat 'n week later betaal word --
// wat die normale geval is, want die betaaltermyn is agt dae -- kry dan:
//
//     "We could not start this transaction."
//
// Op 22 September 2026 het FS/01962 en FS/01963 albei so gestaan. Albei
// transaksies was "Abandoned" by Paystack, dus het geen geld gekom nie.
//
// Die alternatief was om te kanselleer en 'n nuwe faktuur uit te reik. Dit
// gee die kliënt 'n tweede nommer vir dieselfde werk, en dit lyk soos 'n
// besigheid wat nie weet wat sy doen nie. Die faktuur moet bly staan en die
// SKAKEL moet nuut word.
// ─────────────────────────────────────────────────────────────────────────
//
// DIT HERBEREKEN NIKS.
//
// Die bedrag en die verdeling is by uitreiking GEVRIES, en dit is die hele
// punt van daardie vriesing: die dokument wat die kliënt het, moet bly geld.
// Hier word `rekord.totaal_sent` en `rekord.paystack.split_code` presies soos
// hulle staan hergebruik. Verander 'n produk se prys of 'n outeur se
// persentasie intussen, raak dit hierdie faktuur nie.
//
// DIE OU VERWYSING BLY STAAN.
//
// Paystack se transaksies is permanent. Die verlate transaksie bly vir altyd
// op die paneel, en 'n mens moet later kan sien watter verwysing die betaling
// was en watter nie. Elke ou verwysing gaan dus in `paystack.vorige`.
//
// 'n NUWE VERWYSING IS NODIG, en die formaat gee dit gratis: die verwysing is
// `<sleutel>-<Date.now()>`, dus is elke hernuwing vanself uniek en Paystack
// weier hom nie met "Duplicate Transaction Reference" nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
  voeg_geskiedenis_by,
} = require("./_fakture");

function teks(waarde) {
  return String(waarde === undefined || waarde === null ? "" : waarde).trim();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = teks(invoer.sleutel);
  if (!sleutel || !sleutel_na_nommer(sleutel)) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }
  // 'n KONSEP HET NIKS OM TE HERNU NIE. Hy is nog nooit uitgereik nie, dus is
  // daar geen skakel, geen gevriesde verdeling en geen nommer.
  if (is_konsep_sleutel(sleutel)) {
    return { statusCode: 400, body: "'n Konsep het nog geen betaalskakel nie." };
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return { statusCode: 500, body: "Paystack is nie opgestel nie." };
  }

  const store = kry_fakture_store();
  const nou = new Date().toISOString();
  const wie = (gebruiker && gebruiker.email) || "";

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  // ── Wanneer dit NIE mag loop nie ────────────────────────────────────────

  // BETAAL. 'n Tweede lewendige skakel vir geld wat reeds in is, is hoe 'n
  // mens dieselfde faktuur twee keer laat betaal.
  if (rekord.stand === "betaal") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is reeds betaal. 'n Nuwe skakel sou 'n tweede betaling moontlik maak.",
    };
  }

  if (rekord.stand === "gekanselleer") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is gekanselleer. Reik 'n nuwe een uit.",
    };
  }

  if (rekord.stand === "konsep") {
    return { statusCode: 409, body: "Hierdie faktuur is nog nie uitgereik nie." };
  }

  // MET DIE HAND BETAAL. Daar was nooit 'n Paystack-transaksie nie, en 'n
  // skakel sou die verdeling omseil wat met die hand gedoen moet word.
  const vorige_paystack = rekord.paystack || null;
  if (!vorige_paystack || !teks(vorige_paystack.referensie)) {
    return {
      statusCode: 409,
      body: "Hierdie faktuur het nooit 'n betaalskakel gehad nie. Sy word met die hand betaal.",
    };
  }

  const totaal_sent = Number(rekord.totaal_sent) || 0;
  if (totaal_sent <= 0) {
    return {
      statusCode: 409,
      body: "Die bedrag is nul. Daar is niks om te betaal nie.",
    };
  }

  const klient_epos = teks(rekord.klient && rekord.klient.epos);
  if (!klient_epos) {
    return {
      statusCode: 409,
      body: "Hierdie kliënt het geen e-posadres nie, en Paystack vereis een.",
    };
  }

  const nommer = teks(rekord.nommer) || sleutel_na_nommer(sleutel);
  const publieke_kode = teks(rekord.publieke_kode);
  if (!publieke_kode) {
    // Sonder die kode kan betaal-klaar.html nie bewys dat die persoon die
    // skakel werklik ontvang het nie. Ons versin nie 'n nuwe een nie: dit sou
    // die ou skakel se terugkeerpad breek.
    return { statusCode: 409, body: "Hierdie faktuur het geen publieke kode nie." };
  }

  // ── Die nuwe transaksie ─────────────────────────────────────────────────

  const referensie = `${sleutel}-${Date.now()}`;
  const werf = process.env.URL || "http://localhost:8888";
  const terug = `${werf}/betaal-klaar.html?f=${sleutel}&k=${publieke_kode}`;

  let authorization_url;
  try {
    const liggaam = {
      email: klient_epos,
      // GEVRIES. Nie herbereken nie. Sien die nota bo-aan.
      amount: totaal_sent,
      reference: referensie,
      callback_url: terug,
      metadata: {
        cancel_action: terug,
        faktuur_sleutel: sleutel,
        faktuur_nommer: nommer,
        klient: rekord.klient ? rekord.klient.naam || "" : "",
        // Sodat 'n mens op Paystack se paneel kan sien dat hierdie een 'n
        // hernuwing is en nie 'n tweede faktuur nie.
        hernu: true,
      },
    };
    // DIESELFDE SPLIT as by uitreiking. 'n Nuwe split sou die verdeling
    // herbereken teen die pryse van vandag.
    if (teks(vorige_paystack.split_code)) {
      liggaam.split_code = vorige_paystack.split_code;
    }

    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(liggaam),
    });

    const data = await resp.json();
    if (!resp.ok || !data.status || !data.data || !data.data.authorization_url) {
      console.error(`Paystack-hernuwing het misluk vir ${sleutel}:`, data);
      return {
        statusCode: 502,
        body: `Paystack kon nie 'n nuwe skakel gee nie: ${
          (data && data.message) || "onbekende fout"
        }.`,
      };
    }
    authorization_url = data.data.authorization_url;
  } catch (fout) {
    console.error(`Fout tydens Paystack-hernuwing vir ${sleutel}:`, fout);
    return { statusCode: 502, body: "Kon nie by Paystack uitkom nie." };
  }

  // ── Die rekord ──────────────────────────────────────────────────────────
  //
  // Eers NA Paystack geantwoord het. Misluk die oproep, bly die ou skakel op
  // die rekord staan; dit is dood, maar 'n dooie skakel is beter as 'n leë
  // veld, want die verwysing daarin is die enigste pad na die ou transaksie.

  const vorige_lys = Array.isArray(vorige_paystack.vorige) ? vorige_paystack.vorige : [];
  vorige_lys.push({
    referensie: vorige_paystack.referensie,
    authorization_url: teks(vorige_paystack.authorization_url) || null,
    vervang_op: nou,
  });

  rekord.paystack = {
    ...vorige_paystack,
    referensie,
    authorization_url,
    vorige: vorige_lys,
  };
  rekord.bygewerk_op = nou;

  voeg_geskiedenis_by(
    rekord,
    "skakel hernu",
    wie,
    `Vorige verwysing: ${vorige_paystack.referensie}`
  );

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    // DIE SKAKEL BESTAAN REEDS BY PAYSTACK. Kan ons hom nie stoor nie, is hy
    // verlore vir ons rekord, en die ou een staan nog op die skerm. Ons se dit
    // eerder as om 'n sukses terug te gee.
    console.error(`Kon nie die hernude skakel vir ${sleutel} stoor nie:`, fout);
    return {
      statusCode: 500,
      body: "Paystack het 'n nuwe skakel gegee, maar ons kon dit nie stoor nie. Probeer weer.",
    };
  }

  console.log(
    `Betaalskakel hernu vir ${nommer} deur ${wie}. Oud: ${vorige_paystack.referensie}, nuut: ${referensie}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer, betaalskakel: authorization_url, referensie }),
  };
};
