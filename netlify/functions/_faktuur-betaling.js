// netlify/functions/_faktuur-betaling.js
//
// Wat gebeur wanneer 'n faktuur deur die betaalskakel betaal word.
//
// 'N EIE LÊER, want paystack-webhook.js dra reeds die winkel se bestellings
// en hoef nie te weet hoe 'n faktuur werk nie. Hy kry drie reëls: is daar 'n
// `faktuur_sleutel` in die metadata, gee hy oor aan hierdie lêer.
//
// ─────────────────────────────────────────────────────────────────────────
// DIE VERDELING WORD NIE HERBEREKEN NIE.
//
// Sy is by UITREIKING gevries en sy is die rekord van wat besluit is.
// Herbereken 'n mens hier, kry dieselfde ontvanger 'n ander bedrag na gelang
// van hoe die kliënt toevallig betaal het — en 'n bedrag wat ná uitreiking
// verander, is nie 'n rekord nie.
//
// Wat hier gebeur, is dat elke ry sy STAND kry: 'n ry wat deur Paystack
// betaal is, is klaar oppad na sy bank en verskyn nooit in die werklys nie;
// 'n ry wat na die hoofrekening gaan, wag op 'n handmatige oorbetaling.
// ─────────────────────────────────────────────────────────────────────────
//
// DIE ONTVANGSTE WORD AANGETEKEN SOOS DIT GEBEUR HET, NIE SOOS DIT MOES
// GEWEES HET NIE. Klop die bedrag nie presies nie, word die WERKLIKE bedrag
// gestoor en die verskil gemerk. Dit word nooit stilweg reggemaak nie.

const { kry_store } = require("./_blob-store");
const { kry_fakture_store, voeg_geskiedenis_by } = require("./_fakture");
const { kry_maatskappy } = require("./_instellings");
const { stuur_epos, ontsnap } = require("./_stuur-epos");

function rand(sent) {
  const n = Math.round(Number(sent) || 0);
  const heel = Math.floor(Math.abs(n) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return (n < 0 ? "-" : "") + "R" + heel + "," + String(Math.abs(n) % 100).padStart(2, "0");
}

function datum(iso) {
  const d = new Date(iso);
  const M = "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Des".split(",");
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// Paystack se `channel` sê waarmee betaal is — kaart, EFT, QR. Dit word
// AANGETEKEN vir die rekord maar dryf NIKS nie: die enigste vraag wat die
// stelsel vra, is of Paystack die verdeling gedoen het, en by elke kanaal
// deur die betaalskakel is die antwoord ja.
function kanaal_naam(kanaal) {
  const k = String(kanaal || "").toLowerCase();
  if (k === "card") return "Kaart";
  if (k === "bank" || k === "eft" || k === "bank_transfer") return "Onmiddellike EFT";
  if (k === "qr") return "QR";
  if (k === "mobile_money") return "Selfoonbetaling";
  return kanaal || "";
}

async function hanteer_faktuur_betaling(data, nou) {
  const sleutel = String((data.metadata && data.metadata.faktuur_sleutel) || "").trim();
  const store = kry_fakture_store();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Faktuur-webhook: kon nie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }

  if (!rekord) {
    console.error(`Faktuur-webhook: geen faktuur gevind vir ${sleutel}`);
    return { statusCode: 404, body: "Geen ooreenstemmende faktuur gevind nie" };
  }

  // Paystack stuur dieselfde gebeurtenis soms weer. 'n Tweede verwerking sou
  // die tweede stel eposse stuur en die geskiedenis dubbel aanteken.
  if (rekord.betaling && rekord.betaling.ontvang_op) {
    return { statusCode: 200, body: "Reeds aangeteken" };
  }

  const ontvang_sent = Number(data.amount) || 0;
  const verwag_sent = Number(rekord.totaal_sent) || 0;
  const verskil = ontvang_sent - verwag_sent;

  // 'N BETALING OP 'N GEKANSELLEERDE FAKTUUR WORD NIE WEGGEGOOI NIE.
  //
  // Die geld is werklik ontvang en die verdeling het werklik gebeur — 'n 200
  // wat niks doen nie, sou 'n betaling laat verdwyn. Die stand bly
  // `gekanselleer`, want dit is wat besluit is; die ontvangste word langs dit
  // aangeteken en uitgelig sodat iemand daaroor kan besluit.
  const was_gekanselleer = rekord.stand === "gekanselleer";

  rekord.betaling = {
    metode: "paystack",
    ontvang_sent,
    ontvang_op: nou,
    verwysing: String(data.reference || ""),
    kanaal: String(data.channel || ""),
    aangeteken_deur: "webhook",
    nota: was_gekanselleer
      ? "Betaling ontvang op 'n gekanselleerde faktuur — hanteer met die hand."
      : verskil !== 0
      ? `Bedrag verskil van die faktuur met ${rand(verskil)}.`
      : "",
  };

  if (!was_gekanselleer) rekord.stand = "betaal";
  rekord.bygewerk_op = nou;

  // ── Elke ry kry sy stand ────────────────────────────────────────────────
  //
  // 'n Ry wat deur Paystack betaal is, is by vereffening reeds oppad na sy
  // bank; Future Sharp hou dit nooit vas nie. Sy verskyn dus nooit in die
  // handmatige werklys nie. 'n Ry wat na die hoofrekening gaan — iemand
  // sonder 'n subrekening — wag.
  const gevries = rekord.verdeling_gevries || {};
  rekord.uitbetalings = (gevries.rye || []).map((r) => ({
    ontvanger: r.naam,
    begunstigde_id: r.begunstigde_id || null,
    bedrag_sent: r.bedrag_sent,
    stand: r.pad === "split" ? "direk_uitbetaal" : "uitstaande",
    betaal_op: r.pad === "split" ? nou : null,
    verwysing: r.pad === "split" ? String(data.reference || "") : "",
    deur: r.pad === "split" ? "paystack" : "",
  }));

  voeg_geskiedenis_by(
    rekord,
    was_gekanselleer ? "betaling_op_gekanselleerde" : "betaal",
    "webhook",
    `${rand(ontvang_sent)} — ${kanaal_naam(data.channel)}${
      verskil !== 0 ? ` (verskil ${rand(verskil)})` : ""
    }`
  );

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Faktuur-webhook: kon nie ${sleutel} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur stoor nie" };
  }

  console.log(
    `Faktuur ${rekord.nommer || sleutel} betaal — ${rand(ontvang_sent)} via ${data.channel}` +
      (was_gekanselleer ? " OP 'N GEKANSELLEERDE FAKTUUR" : "")
  );

  // ── Die eposse ──────────────────────────────────────────────────────────
  //
  // ELKEEN IN SY EIE try/catch. Die faktuur is klaar gestoor en 'n pos wat
  // misluk mag dit nie ongedaan maak nie — en die drie is onafhanklik: misluk
  // die staat aan een ontvanger, moet die kwitansie steeds uitgaan.
  //
  // stuur_epos() gooi in elk geval nooit nie; die try/catch vang wat rondom
  // hom kan breek, soos 'n store wat nie lees nie.
  let maatskappy = null;
  try {
    maatskappy = await kry_maatskappy();
  } catch (fout) {
    console.error("Faktuur-webhook: kon nie die instelling lees nie:", fout);
  }

  await stuur_kwitansie(rekord);
  await stuur_state(rekord);
  await stuur_kennisgewing(rekord, maatskappy, was_gekanselleer);

  return { statusCode: 200, body: "Faktuur aangeteken" };
}

/* ═══ 1. Die kwitansie, aan die kliënt ═══

   DIT IS DIE KWITANSIE. Geen aparte dokument, geen aanhegsel — die
   faktuurnommer, die bedrag en die datum is wat 'n mens nodig het om 'n
   betaling te versoen. */
async function stuur_kwitansie(rekord) {
  try {
    const aan = String((rekord.klient && rekord.klient.epos) || "").trim();
    if (!aan) return;

    const nommer = rekord.nommer || "";
    const bedrag = rand(rekord.betaling.ontvang_sent);

    // BY R0 IS DAAR NIKS ONTVANG NIE, en 'n kwitansie wat "Bedrag ontvang:
    // R0,00" sê, lees soos 'n fout. Die faktuur is vereffen deur 'n koepon;
    // dit is wat gebeur het en dit is wat daar moet staan.
    const gratis = rekord.betaling.metode === "gratis";

    await stuur_epos({
      merk: "faktuur",
      aan,
      onderwerp: gratis ? `Faktuur vereffen — ${nommer}` : `Betaling ontvang — ${nommer}`,
      opskrif: gratis ? "Faktuur vereffen" : "Betaling ontvang",
      reels: [
        gratis
          ? `Faktuur <b>${ontsnap(nommer)}</b> is vereffen. Daar is niks betaalbaar nie.`
          : `Dankie. Die betaling is teen faktuur <b>${ontsnap(nommer)}</b> toegewys.`,
        // GEEN DERDE PARAGRAAF NIE. Die opskrif se "Betaling ontvang", die
        // syfers staan hier, en die voetskrif dra reeds
        // admin@futuresharp.co.za. 'n Reel wat se "hierdie is 'n kwitansie"
        // se niks wat die res nie reeds se nie, en die adres twee keer noem
        // maak die pos langer sonder om iets by te voeg.
        `Faktuurnommer: <b>${ontsnap(nommer)}</b><br>` +
          (gratis ? "" : `Bedrag ontvang: <b>${bedrag}</b><br>`) +
          `Datum: ${datum(rekord.betaling.ontvang_op)}`,
      ],
    });
  } catch (fout) {
    console.error("Faktuur-webhook: kwitansie het misluk:", fout);
  }
}

/* ═══ 2. Die staat, aan elke ontvanger ═══

   Wat hy kry en langs watter pad. 'n Ry deur Paystack is reeds oppad na sy
   bank; 'n ry deur die hoofrekening wag op 'n oorbetaling, en om te maak
   asof albei dieselfde is, sou beteken hy wag op geld wat reeds daar is —
   of andersom. */
async function stuur_state(rekord) {
  try {
    const rye = (rekord.uitbetalings || []).filter((r) => r.bedrag_sent > 0);
    if (!rye.length) return;

    let begunstigdes = [];
    try {
      const store = kry_store("begunstigdes");
      const lys = await store.list();
      begunstigdes = (
        await Promise.all((lys.blobs || []).map((b) => store.get(b.key, { type: "json" })))
      ).filter(Boolean);
    } catch (fout) {
      console.error("Faktuur-webhook: kon nie die begunstigdes lees nie:", fout);
      return;
    }

    const per_id = new Map();
    const per_naam = new Map();
    begunstigdes.forEach((b) => {
      if (!b) return;
      if (b.begunstigde_id) per_id.set(b.begunstigde_id, b);
      if (b.naam) per_naam.set(String(b.naam).trim(), b);
    });

    const nommer = rekord.nommer || "";

    // Een pos per ontvanger, elk in sy eie try/catch: misluk die een, moet
    // die volgende steeds uitgaan.
    for (const ry of rye) {
      try {
        const b = per_id.get(ry.begunstigde_id) || per_naam.get(String(ry.ontvanger).trim());
        const aan = String((b && b.kontak_inligting && b.kontak_inligting.epos) || "").trim();
        if (!aan) continue;

        const direk = ry.stand === "direk_uitbetaal";

        await stuur_epos({
          merk: "faktuur",
          aan,
          onderwerp: `Jou deel van ${nommer}`,
          opskrif: "Jou deel van 'n betaalde faktuur",
          reels: [
            `Faktuur <b>${ontsnap(nommer)}</b> is betaal.`,
            `Jou deel: <b>${rand(ry.bedrag_sent)}</b>`,
            direk
              ? "Die bedrag is direk deur die betalingsdiens aan jou uitbetaal en behoort binne twee werksdae in jou rekening te wees."
              : "Die bedrag word met die hand aan jou oorbetaal.",
          ],
        });
      } catch (fout) {
        console.error(`Faktuur-webhook: staat aan ${ry.ontvanger} het misluk:`, fout);
      }
    }
  } catch (fout) {
    console.error("Faktuur-webhook: state het misluk:", fout);
  }
}

/* ═══ 3. Die kennisgewing ═══

   Aan die maatskappy se eie adres — dit is die posbus wat op elke faktuur
   staan en waarheen 'n kliënt in elk geval antwoord. Geen aparte lys van
   direkteure om by te hou nie.

   Die reël wat saak maak, is hoeveel met die HAND oorbetaal moet word. Dit
   is die enigste werk wat 'n betaling agterlaat. */
async function stuur_kennisgewing(rekord, maatskappy, was_gekanselleer) {
  try {
    const aan = String((maatskappy && maatskappy.epos) || "admin@futuresharp.co.za").trim();
    const nommer = rekord.nommer || "";

    const hand = (rekord.uitbetalings || []).filter(
      (r) => r.stand === "uitstaande" && r.bedrag_sent > 0
    );
    const hand_sent = hand.reduce((s, r) => s + r.bedrag_sent, 0);

    // BY R0 LEES "IS BETAAL", "R0,00" EN 'N LEË METODE ALMAL VERKEERD. Daar
    // was niks om te betaal nie; 'n koepon het die bedrag tot niks verminder,
    // en dit is wat 'n mens moet weet.
    const gratis = rekord.betaling.metode === "gratis";
    const kanaal = kanaal_naam(rekord.betaling.kanaal);

    const reels = [
      gratis
        ? `Faktuur <b>${ontsnap(nommer)}</b> is uitgereik teen R0 en is vereffen.`
        : `Faktuur <b>${ontsnap(nommer)}</b> is betaal.`,
      `Kliënt: ${ontsnap((rekord.klient && rekord.klient.naam) || "")}<br>` +
        (gratis
          ? `Bedrag: <b>R0,00</b>` +
            (rekord.koepon_kode ? `<br>Koepon: ${ontsnap(rekord.koepon_kode)}` : "")
          : `Bedrag: <b>${rand(rekord.betaling.ontvang_sent)}</b>` +
            (kanaal ? `<br>Metode: ${ontsnap(kanaal)}` : "")),
      hand.length
        ? `<b>${hand.length === 1 ? "1 ontvanger" : hand.length + " ontvangers"} moet met die hand oorbetaal word — ${rand(
            hand_sent
          )}.</b><br>` + hand.map((r) => ontsnap(r.ontvanger)).join("<br>")
        : // BY R0 IS DAAR GEEN ONTVANGERS NIE, en "al die ontvangers is
          // uitbetaal" sou beteken daar was iets om uit te betaal.
          (rekord.uitbetalings || []).length
          ? "Al die ontvangers is direk deur die betalingsdiens uitbetaal. Daar is niks om met die hand oor te betaal nie."
          : "Daar is niks om te verdeel nie.",
    ];

    if (was_gekanselleer) {
      reels.unshift(
        "<b>Let op:</b> hierdie faktuur was gekanselleer toe die betaling ingekom het. Die geld is ontvang en die verdeling het gebeur."
      );
    }

    const verskil = rekord.betaling.ontvang_sent - (Number(rekord.totaal_sent) || 0);
    if (verskil !== 0) {
      reels.push(
        `<b>Die bedrag verskil van die faktuur met ${rand(
          verskil
        )}.</b> Dit is aangeteken soos dit ontvang is.`
      );
    }

    await stuur_epos({
      merk: "faktuur",
      aan,
      onderwerp: was_gekanselleer
        ? `Betaling op 'n gekanselleerde faktuur — ${nommer}`
        : gratis
        ? `Faktuur teen R0 uitgereik — ${nommer}`
        : `Betaling ontvang — ${nommer}`,
      opskrif: was_gekanselleer
        ? "Betaling op 'n gekanselleerde faktuur"
        : gratis
        ? "Faktuur teen R0 uitgereik"
        : "Betaling ontvang",
      reels,
    });
  } catch (fout) {
    console.error("Faktuur-webhook: kennisgewing het misluk:", fout);
  }
}

// DIE DRIE POSTE WORD UITGEVOER sodat die ander twee paaie hulle kan aanroep.
//
//   stuur-faktuur.js se R0-tak — by R0 word Paystack glad nie geroep nie; geen
//   /split, geen transaksie, geen webhook — en alles wat die webhook sou doen,
//   moet dáár gebeur.
//
//   teken-betaling-aan.js — 'n bankoorbetaling wat met die hand aangeteken
//   word. Ook daar het die webhook nooit gevuur nie.
//
// Twee kopieë van hierdie poste sou beteken 'n mens verander die een en wonder
// hoekom die ander anders lees.
module.exports = {
  hanteer_faktuur_betaling,
  stuur_kwitansie,
  stuur_state,
  stuur_kennisgewing,
};
