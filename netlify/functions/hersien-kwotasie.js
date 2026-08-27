// netlify/functions/hersien-kwotasie.js
//
// Hersien 'n uitgereikte kwotasie. Rol: boekhouding.
//
// 'n Kliënt vra 'n aanpassing. Dit gebeur BUITE die stelsel — hy bel of skryf
// 'n e-pos — en die uitkoms is 'n nuwe aanbod onder DIESELFDE nommer en
// DIESELFDE skakel.
//
// WAAROM NIE KANSELLEER EN 'N NUWE NOMMER NIE: drie rondtes met een skool sou
// KW/01964, 01965 en 01966 gee plus twee dooie rekords, en die register lyk
// soos foute waar dit gewone handel was. Die nommer identifiseer die
// ONDERHANDELING, nie elke aanbod daarin nie.
//
// DIE OU AANBOD MOET DOOD WEES, NIE NET OU NIE. Die kliënt hou 'n dokument met
// KW/01964 op R28 400 in sy hand, en sy finansiële afdeling kan die skakel 'n
// week later klik. Die skakel wys ALTYD die huidige hersiening, dus kan die ou
// prys nie aanvaar word nie. Die momentopname is 'n REKORD van wat aangebied
// is, nooit iets wat weer lewendig kan word nie.
//
// HIERDIE FUNCTION DOEN DIE HERSIENING, NIE DIE WYSIGING NIE. Sy neem die
// momentopname, tel die hersieningsnommer op, stel die geldigheid terug en
// stuur die pos. Die REELS word deur stoor-kwotasie.js verander, en dit is
// waarom die volgorde op die skerm is: hersien, dan wysig, dan stuur.
//
// Nee — dit sou beteken die kliënt kan 'n halfgewysigde aanbod aanvaar terwyl
// iemand nog tik. DIE VOLGORDE IS DUS ANDERSOM: die nuwe reëls kom SAAM met
// hierdie oproep, in een handeling, en die kwotasie is nooit halfpad nie.
//
// 'N VERLOPE KWOTASIE MAG HERSIEN WORD. Dit is juis wat 'n mens doen wanneer
// 'n skool eers ná ses weke antwoord, en die hersiening gee hom 'n nuwe
// dertig dae. 'n Aanvaarde of verwerpte een mag nie: sy is toe.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  sleutel_na_nommer,
  verstek_geldig_tot,
  is_verval,
  is_toe,
  neem_momentopname,
  voeg_geskiedenis_by,
} = require("./_kwotasies");
const { datum_dokument } = require("./_fakture");
const { t_rand } = require("../../public/js/taal.js");
const { fs_bereken, fs_invoer_uit_faktuur } = require("../../public/js/faktuur-som.js");
const { stuur_kwotasie_pos } = require("./uitreik-kwotasie");

const REEL_SOORTE = ["verkoop", "koste"];
const RY_TIPES = ["pct", "vas"];

function teks(waarde, maks) {
  const skoon = String(waarde == null ? "" : waarde).trim();
  return maks ? skoon.slice(0, maks) : skoon;
}

function sent(waarde) {
  const getal = Number(waarde);
  if (!Number.isFinite(getal) || getal < 0) return 0;
  return Math.round(getal);
}

function datum(waarde) {
  const skoon = teks(waarde);
  if (!skoon) return null;
  const d = new Date(skoon);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Dieselfde lesers as stoor-kwotasie.js. Hulle staan hier oor eerder as om
// ingevoer te word: 'n hersiening lees presies dieselfde vorm as 'n stoor, en
// 'n verandering aan die een moet 'n bewuste besluit by die ander wees.
function lees_verdeling(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((v) => {
    const item = v || {};
    const tipe = RY_TIPES.includes(item.tipe) ? item.tipe : "pct";
    let waarde;
    if (tipe === "pct") {
      const getal = Number(item.waarde);
      waarde = Number.isFinite(getal) ? Math.min(100, Math.max(0, getal)) : 0;
    } else {
      waarde = sent(item.waarde);
    }
    return { ontvanger: teks(item.ontvanger, 200), tipe, waarde };
  });
}

function lees_reels(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((r) => {
    const item = r || {};
    const hoeveelheid = Number(item.hoeveelheid);
    const veilig = Number.isFinite(hoeveelheid) && hoeveelheid >= 0 ? hoeveelheid : 0;
    const prys_pp_sent = sent(item.prys_pp_sent);
    const hosting = Number(item.hosting_pct);
    return {
      soort: REEL_SOORTE.includes(item.soort) ? item.soort : "verkoop",
      beskrywing: teks(item.beskrywing, 300),
      hoeveelheid: veilig,
      prys_pp_sent,
      bedrag_sent: Math.round(veilig * prys_pp_sent),
      op_faktuur: item.op_faktuur !== false,
      hosting_pct: Number.isFinite(hosting) ? Math.min(100, Math.max(0, hosting)) : 0,
      verdeling: lees_verdeling(item.verdeling),
    };
  });
}

function lees_koste(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((k) => {
    const item = k || {};
    return {
      beskrywing: teks(item.beskrywing, 300),
      ontvanger: teks(item.ontvanger, 200),
      bedrag_sent: sent(item.bedrag_sent),
      inskrywing: teks(item.inskrywing, 500),
    };
  });
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

  // SLEGS 'N GENOMMERDE SLEUTEL. 'n Konsep word gewysig, nie hersien nie —
  // daar is nog geen aanbod om te vervang nie.
  const sleutel = teks(invoer.sleutel);
  if (!sleutel || !sleutel_na_nommer(sleutel)) {
    return { statusCode: 400, body: "Ongeldige kwotasiesleutel" };
  }

  const store = kry_kwotasies_store();
  const wie = (gebruiker && gebruiker.email) || "";
  const nou = new Date().toISOString();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Kwotasie nie gevind nie" };

  if (rekord.stand === "konsep") {
    return { statusCode: 409, body: "Hierdie kwotasie is nog 'n konsep. Wysig haar eerder." };
  }
  if (is_toe(rekord)) {
    return {
      statusCode: 409,
      body:
        rekord.stand === "aanvaar"
          ? "Hierdie kwotasie is aanvaar. Die faktuur wat daaruit gekom het, word gekanselleer en 'n nuwe uitgereik."
          : "Hierdie kwotasie is verwerp en word nie meer hersien nie.",
    };
  }

  // ── Die momentopname, VOORDAT iets verander ─────────────────────────────
  //
  // Wat bewaar word, is wat die kliënt GESIEN het: die reëls, die totaal, die
  // aantekening en die geldigheid. Die verdeling word nie bewaar nie — sy is
  // backoffice, sy het nooit uitgegaan nie, en 'n momentopname daarvan sou
  // lyk of dit iets beteken.
  const vorige_nommer = rekord.hersiening || 1;
  const vorige_totaal = rekord.totaal_sent || 0;
  neem_momentopname(rekord, wie);

  // ── Die nuwe aanbod ─────────────────────────────────────────────────────
  //
  // Die reëls kom SAAM met hierdie oproep, in een handeling. Sou 'n mens eers
  // hersien en dan wysig, kon die kliënt 'n halfgewysigde aanbod aanvaar
  // terwyl iemand nog tik.
  if (invoer.reels !== undefined) rekord.reels = lees_reels(invoer.reels);
  if (invoer.koste !== undefined) rekord.koste = lees_koste(invoer.koste);
  if (invoer.dokument_nota !== undefined) rekord.dokument_nota = teks(invoer.dokument_nota, 3000);
  if (invoer.bestelnommer !== undefined) rekord.bestelnommer = teks(invoer.bestelnommer, 100);
  if (invoer.afslag_sent !== undefined) rekord.afslag_sent = sent(invoer.afslag_sent);
  if (invoer.skenking_sent !== undefined) rekord.skenking_sent = sent(invoer.skenking_sent);

  const reels = Array.isArray(rekord.reels) ? rekord.reels : [];
  if (!reels.length) {
    return { statusCode: 400, body: "Die kwotasie het nog geen reëls nie." };
  }

  const reelsom = reels.reduce((s, r) => s + (r.bedrag_sent || 0), 0);
  const netto = Math.max(0, reelsom - (rekord.afslag_sent || 0));
  rekord.totaal_sent = netto + (rekord.skenking_sent || 0);

  // DIE GELDIGHEID BEGIN OOR. 'n Nuwe aanbod is 'n nuwe dertig dae; die ou
  // datum het by die ou prys gehoor. 'n Uitdruklike datum in die invoer wen,
  // sodat 'n mens 'n korter of langer termyn kan gee.
  rekord.geldig_tot =
    invoer.geldig_tot !== undefined
      ? datum(invoer.geldig_tot) || verstek_geldig_tot(nou)
      : verstek_geldig_tot(nou);

  if (is_verval(rekord, nou)) {
    return {
      statusCode: 400,
      body: "Die geldigheidsdatum lê in die verlede — die kwotasie sou dadelik verval wees.",
    };
  }

  // Dieselfde kontrole as by uitreiking, en om dieselfde rede: 'n prys wat nie
  // sy eie verdeling kan dra nie, word HIER gekeer.
  const u = fs_bereken(fs_invoer_uit_faktuur(rekord, () => false));
  if (u.oorbestee) {
    // DIE BOODSKAP NOEM DIE REELS BY NOMMER EN NAAM. Die som weet klaar watter
    // reëls die meeste vra; "hierdie kwotasie is oorbestee" gooi daardie
    // inligting weg en laat 'n mens self soek.
    //
    // MAAR NIE ELKE REEL WAT OORSKRY, IS 'N PROBLEEM NIE. 'n Vaste bedrag wat
    // sy reël met 'n paar sent oorskry, word deur die ander reëls GEDRA en dit
    // werk — die split loop oor die hele dokument. Sien besluit 5 in
    // Verdeling-Per-Lynitem-Ontwerp.md: 'n stop oor vyf sent is presies hoe 'n
    // mens leer om stops te ignoreer.
    //
    // Wat hier gekeer word, is die faktuur AS GEHEEL. Die name is dus 'n
    // AANWYSING na waar om te kyk — die grootstes eerste, hoogstens drie —
    // nie 'n lys van foute nie.
    const oorskrei = (u.perReel || [])
      .map((p, ix) => ({ ix, kort: p.toegekenSent - p.basisSent }))
      .filter((x) => x.kort > 0)
      .sort((a, b) => b.kort - a.kort)
      .slice(0, 3)
      .map((x) => `${x.ix + 1}. ${teks(reels[x.ix] && reels[x.ix].beskrywing) || "naamloos"}`);

    return {
      statusCode: 409,
      body: oorskrei.length
        ? `Die verdeling vra meer as wat die kwotasie inbring. Kyk na ${oorskrei.join(", ")}.`
        : "Die verdeling vra meer as wat die kwotasie inbring.",
    };
  }

  // ── Skryf ───────────────────────────────────────────────────────────────
  //
  // DIESELFDE SLEUTEL, DIESELFDE NOMMER, DIESELFDE PUBLIEKE KODE. Die skakel
  // wat die kliënt reeds het, wys nou na die nuwe aanbod — en dit is presies
  // wat die ou een dood maak.
  rekord.hersiening = vorige_nommer + 1;
  rekord.uitgereik_op = nou;
  rekord.bygewerk_op = nou;

  voeg_geskiedenis_by(
    rekord,
    "hersien",
    wie,
    `Hersiening ${rekord.hersiening} — ${t_rand(vorige_totaal, "af")} word ` +
      `${t_rand(rekord.totaal_sent, "af")}, geldig tot ${datum_dokument(rekord.geldig_tot)}`
  );

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die hersiening stoor nie" };
  }

  // Die pos gaan laaste en mag die hersiening nie omkeer nie. Sy noem
  // uitdruklik dat dit die vorige weergawe vervang — 'n kliënt met twee
  // dokumente met dieselfde nommer moet weet watter een geld.
  const pos = await stuur_kwotasie_pos(rekord, sleutel, rekord.publieke_kode);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sleutel,
      nommer: rekord.nommer,
      hersiening: rekord.hersiening,
      geldig_tot: rekord.geldig_tot,
      totaal_sent: rekord.totaal_sent,
      vorige_totaal_sent: vorige_totaal,
      pos_ok: Boolean(pos && pos.ok),
      pos_fout: (pos && pos.fout) || null,
    }),
  };
};
