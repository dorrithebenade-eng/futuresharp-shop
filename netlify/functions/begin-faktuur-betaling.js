// netlify/functions/begin-faktuur-betaling.js
//
// Gee die KLIENT 'n vars Paystack-skakel, op die oomblik dat hy wil betaal.
// Vir betaal.html.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAN
//
// Paystack se toegangskode leef nie so lank as 'n faktuur se betaaltermyn
// nie. Tot nou het die proforma-pos, die PDF en die QR die
// checkout.paystack.com-adres DIREK gedra. Daardie string gaan dood terwyl hy
// in die kliënt se inboks le, en niks wat ons aan ons kant doen, kan dit
// regmaak nie -- die dooie skakel is by hom, nie by ons nie.
//
// Op 22 September 2026 het FS/01962 en FS/01963 albei so gestaan. Albei
// transaksies was "Abandoned"; geen geld het gekom nie.
//
// Die oplossing is om die kliënt NOOIT Paystack se adres te gee nie, maar ons
// eie: betaal.html?f=<sleutel>&k=<kode>. Daardie adres verwys net na 'n
// faktuur en kan dus nie verval nie. Die Paystack-skakel word eers gemaak
// wanneer iemand werklik klik, en is dan sekondes oud.
// ─────────────────────────────────────────────────────────────────────────
//
// DIT IS 'N PUBLIEKE FUNCTION WAT SKRYF, en dit is 'n ander soort ding as
// kry-betaalstand.js, wat doelbewus net lees. Vier dinge hou dit toe:
//
//   * DIE KODE IS DIE BEWYS. 32 heksadesimale karakters uit
//     crypto.randomBytes(16). Die faktuurnommer is deurlopend en dus tel-baar;
//     die kode is dit nie. Sonder 'n passende kode is die antwoord 404.
//   * DIT SKRYF NET DIE SKAKEL. `paystack.referensie`,
//     `paystack.authorization_url` en `paystack.vorige`. Nie die bedrag nie,
//     nie die stand nie, nie die verdeling nie, niks van die klient nie.
//   * DIE BEDRAG IS GEVRIES. `rekord.totaal_sent` en
//     `rekord.paystack.split_code` word presies soos hulle staan hergebruik.
//     Verander 'n produk se prys intussen, raak dit hierdie faktuur nie.
//   * 'N VARS SKAKEL WORD HERGEBRUIK. Klik iemand tien keer, kom daar nie tien
//     transaksies nie. Sien VARS_MINUTE hieronder.
//
// DIE ANTWOORD DRA GEEN KLIENTDATA. Geen naam, geen e-pos, geen adres, geen
// verdeling. Net wat die bladsy moet wys.

const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
} = require("./_fakture");

// HOE LANK 'N SKAKEL AS VARS TEL.
//
// Die verwysing is `<sleutel>-<Date.now()>`, dus dra sy eie agterstuk die
// millisekonde waarop die skakel gemaak is. Ons het geen nuwe veld nodig om
// sy ouderdom te weet nie.
//
// Is die huidige skakel jonger as dit, gee ons hom net so terug. Dit is
// tegelyk 'n spoedgrens (tien klikke gee nie tien transaksies nie) en die
// regte gedrag: 'n mens wat die bladsy herlaai, hoort by dieselfde
// betaalskerm uit te kom, nie by 'n nuwe een nie.
//
// Vyftien minute is ruim genoeg vir iemand wat sy kaart gaan haal, en kort
// genoeg dat 'n skakel van gister nooit hergebruik word nie.
const VARS_MINUTE = 15;

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

// Die millisekonde uit `FS-01963-1790077807130`. Gee null terug as die vorm
// nie pas nie, en dan behandel ons die skakel as oud.
function skakel_ouderdom_ms(verwysing, nou_ms) {
  const stukke = teks(verwysing).split("-");
  const laaste = stukke[stukke.length - 1];
  if (!/^\d{10,}$/.test(laaste)) return null;
  const toe = Number(laaste);
  if (!Number.isFinite(toe) || toe <= 0) return null;
  return nou_ms - toe;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const vraag = event.queryStringParameters || {};
  const sleutel = teks(vraag.f);
  const kode = teks(vraag.k);

  // EEN BOODSKAP VIR ELKE SOORT MISLUKKING. Se 'n mens "faktuur nie gevind
  // nie" teenoor "verkeerde kode", verklap die verskil watter nommers bestaan.
  const NIE_GEVIND = { statusCode: 404, body: "Nie gevind nie" };

  if (!sleutel || !kode) return NIE_GEVIND;
  if (is_konsep_sleutel(sleutel) || !sleutel_na_nommer(sleutel)) return NIE_GEVIND;

  const store = kry_fakture_store();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return NIE_GEVIND;
  if (!rekord.publieke_kode || rekord.publieke_kode !== kode) return NIE_GEVIND;

  const antwoord = {
    nommer: rekord.nommer || sleutel_na_nommer(sleutel),
    bedrag_sent: rekord.totaal_sent || 0,
    // Die DOKUMENT se taal, nie die blaaier s'n. Die proforma wat die klient
    // ontvang het, was in daardie taal; hierdie bladsy is dieselfde gesprek.
    taal: rekord.taal === "en" ? "en" : "af",
    stand: "oop",
    betaalskakel: null,
  };

  // ── Wanneer daar NIKS te betaal is nie ──────────────────────────────────

  // REEDS BETAAL. 'n Skakel hier sou 'n tweede betaling moontlik maak vir geld
  // wat reeds in is. Die bladsy se dit eerder vir die klient.
  if (rekord.stand === "betaal") {
    antwoord.stand = "betaal";
    return ok(antwoord);
  }

  if (rekord.stand === "gekanselleer") {
    antwoord.stand = "gekanselleer";
    return ok(antwoord);
  }

  if (rekord.stand === "konsep") return NIE_GEVIND;

  const vorige_paystack = rekord.paystack || null;

  // MET DIE HAND BETAAL. Daar was nooit 'n Paystack-transaksie nie, en 'n
  // skakel sou die verdeling omseil wat met die hand gedoen moet word.
  if (!vorige_paystack || !teks(vorige_paystack.referensie)) {
    antwoord.stand = "handmatig";
    return ok(antwoord);
  }

  const totaal_sent = Number(rekord.totaal_sent) || 0;
  if (totaal_sent <= 0) {
    antwoord.stand = "betaal";
    return ok(antwoord);
  }

  // ── Is die huidige skakel nog vars? ─────────────────────────────────────

  const nou_ms = Date.now();
  const ouderdom = skakel_ouderdom_ms(vorige_paystack.referensie, nou_ms);
  if (
    ouderdom !== null &&
    ouderdom >= 0 &&
    ouderdom < VARS_MINUTE * 60 * 1000 &&
    teks(vorige_paystack.authorization_url)
  ) {
    antwoord.betaalskakel = vorige_paystack.authorization_url;
    return ok(antwoord);
  }

  // ── 'n Vars transaksie ──────────────────────────────────────────────────

  const klient_epos = teks(rekord.klient && rekord.klient.epos);
  if (!klient_epos) {
    // Paystack vereis 'n e-posadres. Sonder een kan hierdie bladsy niks doen,
    // en die klient moet Future Sharp kontak.
    antwoord.stand = "geen_epos";
    return ok(antwoord);
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY ontbreek");
    antwoord.stand = "onbekend";
    return ok(antwoord);
  }

  const nommer = antwoord.nommer;
  const referensie = `${sleutel}-${nou_ms}`;
  const werf = process.env.URL || "http://localhost:8888";
  const terug = `${werf}/betaal-klaar.html?f=${sleutel}&k=${rekord.publieke_kode}`;

  let authorization_url;
  try {
    const liggaam = {
      email: klient_epos,
      amount: totaal_sent,
      reference: referensie,
      callback_url: terug,
      metadata: {
        // callback_url geld slegs na 'n VOLTOOIDE poging. By 'n kansellasie
        // gebruik Paystack dit nie, en sonder cancel_action val hy terug op die
        // blaaier se geskiedenis -- wat 'n vars oortjie nie het nie.
        cancel_action: terug,
        faktuur_sleutel: sleutel,
        faktuur_nommer: nommer,
        klient: rekord.klient ? rekord.klient.naam || "" : "",
        // Sodat 'n mens op Paystack se paneel kan sien dat hierdie een deur die
        // betaalbladsy gekom het en nie 'n tweede faktuur is nie.
        bron: "betaalbladsy",
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
      console.error(`Paystack kon nie 'n skakel gee vir ${sleutel} nie:`, data);
      // DIE OU SKAKEL GAAN TERUG, nie niks nie. Hy is waarskynlik dood, maar 'n
      // skerm wat weier, se ten minste vir die klient wat aangaan; 'n leë
      // bladsy se niks.
      antwoord.betaalskakel = vorige_paystack.authorization_url || null;
      antwoord.stand = "onbekend";
      return ok(antwoord);
    }
    authorization_url = data.data.authorization_url;
  } catch (fout) {
    console.error(`Fout by Paystack vir ${sleutel}:`, fout);
    antwoord.betaalskakel = vorige_paystack.authorization_url || null;
    antwoord.stand = "onbekend";
    return ok(antwoord);
  }

  // ── Die rekord ──────────────────────────────────────────────────────────
  //
  // Eers NA Paystack geantwoord het, en dit skryf SLEGS die paystack-blok.
  // Misluk die skryf, gaan die klient steeds na 'n werkende skakel; ons rekord
  // weet net nie van hierdie verwysing nie, en die webhook koppel die betaling
  // terug aan die faktuur uit sy eie metadata.

  const vorige_lys = Array.isArray(vorige_paystack.vorige) ? vorige_paystack.vorige : [];
  vorige_lys.push({
    referensie: vorige_paystack.referensie,
    authorization_url: teks(vorige_paystack.authorization_url) || null,
    vervang_op: new Date(nou_ms).toISOString(),
  });

  try {
    const vars = await store.get(sleutel, { type: "json" });
    // Die faktuur kon intussen betaal of gekanselleer geraak het. Skryf ons
    // dan, oorskryf ons 'n rekord wat ons nie gelees het nie.
    if (vars && vars.stand !== "betaal" && vars.stand !== "gekanselleer") {
      vars.paystack = {
        ...(vars.paystack || {}),
        referensie,
        authorization_url,
        vorige: vorige_lys,
      };
      vars.bygewerk_op = new Date(nou_ms).toISOString();
      await store.setJSON(sleutel, vars);
    }
  } catch (fout) {
    console.error(`Kon nie die nuwe skakel vir ${sleutel} stoor nie:`, fout);
  }

  console.log(`Betaalbladsy: vars skakel vir ${nommer} (${referensie})`);

  antwoord.betaalskakel = authorization_url;
  return ok(antwoord);
};

function ok(liggaam) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Nooit kas nie. Die hele punt is dat elke besoek 'n vars antwoord kry.
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(liggaam),
  };
}
