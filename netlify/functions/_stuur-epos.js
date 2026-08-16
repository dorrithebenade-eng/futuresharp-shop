// netlify/functions/_stuur-epos.js
//
// Gedeelde helper: stuur 'n e-pos vanaf Future Shop se eie posbus.
//
// WAAROM DIE BESTAANDE POSBUS EN NIE 'N TRANSAKSIONELE DIENS NIE:
// futureshop@futuresharp.co.za bestaan reeds by Afrihost. Deur dáárdeur te
// stuur, kom die pos van dieselfde bediener wat die domein se bestaande
// SPF-rekord reeds dek — geen DNS-verandering nie, en geen risiko om 'n
// tweede SPF-rekord by te voeg wat albei sou breek. Wil ons later na 'n
// diens soos Postmark of Resend skuif vir aflewerinsverslae, verander net
// hierdie lêer plus 'n include in die SPF-reël.
//
// OMGEWINGSVERANDERLIKES (in Netlify, nooit in kode nie):
//   EPOS_GASHEER    bv. mail.futuresharp.co.za
//   EPOS_POORT      465 (SSL) of 587 (STARTTLS)
//   EPOS_GEBRUIKER  futureshop@futuresharp.co.za
//   EPOS_WAGWOORD   die posbus se wagwoord
//   EPOS_VAN        opsioneel — die "van"-naam, verstek "Future Shop"
//
// TWEE MERKE, TWEE POSBUSSE.
//
// Die winkel stuur uit futureshop@; die faktuurmodule uit admin@. Dit is nie
// kosmeties nie: 'n proforma wat uit die winkel se posbus kom met Future Shop
// se woordmerk daarop, kom van die verkeerde maatskappy. Die kliënt antwoord
// boonop op die adres wat op sy faktuur staan.
//
//   EPOS_ADMIN_GEBRUIKER  admin@futuresharp.co.za
//   EPOS_ADMIN_WAGWOORD   daardie posbus se wagwoord
//   EPOS_ADMIN_GASHEER    opsioneel — verstek dieselfde as EPOS_GASHEER
//   EPOS_ADMIN_POORT      opsioneel — verstek dieselfde as EPOS_POORT
//   EPOS_VAN_ADMIN        opsioneel — die "van"-naam, verstek "Future Sharp"
//
// ONTBREEK DIE ADMIN-POSBUS, VAL DIT TERUG op die winkel s'n met
// Reply-To: admin@. 'n Faktuur wat glad nie uitgaan nie, is erger as een wat
// uit die verkeerde posbus kom — en die terugval word aangeteken.
//
// STUUR FAAL NOOIT DIE AANROEPER NIE. 'n E-pos wat nie deurkom nie mag
// nooit 'n betaling, 'n bestelling of 'n stoor-aksie laat misluk nie.
// stuur_epos() gooi dus geen fout nie — dit gee { ok, fout } terug en die
// aanroeper besluit self of dit saak maak. Dit is doelbewus: die webhook
// wat 'n outeur inlig, moet die bestelling bevestig al is die pos weg.

const nodemailer = require("nodemailer");

// Een vervoerder per posbus, gekas op sy naam. Twee posbusse beteken twee
// verbindings, en 'n gedeelde kas sou die tweede aanroep die eerste se
// verbinding gee.
const vervoerders = {};

function kry_vervoerder(merk_naam) {
  const naam = MERKE[merk_naam] ? merk_naam : "winkel";
  if (vervoerders[naam]) return vervoerders[naam];

  const m = MERKE[naam];
  const gasheer = m.gasheer();
  const gebruiker = m.gebruiker();
  const wagwoord = m.wagwoord();
  if (!gasheer || !gebruiker || !wagwoord) return null;

  const poort = m.poort();

  vervoerders[naam] = nodemailer.createTransport({
    host: gasheer,
    port: poort,
    // 465 is implisiete SSL; 587 begin skoon en gaan met STARTTLS oor.
    secure: poort === 465,
    auth: { user: gebruiker, pass: wagwoord },
  });

  return vervoerders[naam];
}

// DIE UITLEG IS 'N TABEL, NIE 'N DIV NIE. Outlook ignoreer max-width en
// border-radius op 'n gewone blok — 'n boodskap wat mooi lyk in Gmail strek
// dan oor die hele venster en verloor sy rand. 'n Tabel met 'n vaste breedte
// van 600px is die enigste ding wat oral hou.
//
// EEN BEELD, EN DIT MAG WEGVAL. Die kop dra die wordmark oor die volle
// breedte, maar die teal band daaronder bly staan en sê dieselfde in
// teks. Poskliënte blokkeer beelde by verstek — Outlook doen dit vir
// elke nuwe stuurder — en dan lyk die boodskap presies soos die ou
// ontwerp sonder dat iets breek. Die alt-teks is doelbewus leeg: dit sou
// net die band se woorde herhaal, en by volle breedte teen die linkerrand
// vasgesit het. Alle style is inlyn, want <style>-blokke word deur baie
// kliënte gestroop.
//
// Die logo word van die werf af gelaai, nie aangeheg nie. 'n Aanhegsel
// of 'n base64-beeld word deur meer kliënte geweier as 'n gewone URL.

const TEAL = "#479F91";
const KORAAL = "#EC5832";
const FONT = "Segoe UI,Helvetica,Arial,sans-serif";

// Volle absolute URL — 'n relatiewe pad beteken niks in 'n poskliënt.
// 598px is die 600px-boks minus sy 1px-rand aan elke kant. Die bronbeeld
// is 986px breed, dus bly dit skerp op 'n retina-skerm.
const LOGO_URL = "https://futureshop.futuresharp.co.za/images/future-shop-woordmerk.png";
const LOGO_BREEDTE = 598;

/* ═══════════════════════════════════════════════════════════════════════
   DIE TWEE MERKE

   `winkel` is presies wat vantevore gebou is — die woordmerk-beeld, die teal
   band met FUTURE SHARP / Future Shop, en die winkel se voetskrif. Niks in
   die winkel verander nie.

   `faktuur` dra GEEN BEELD nie. Die Future Sharp-logo is staande (354x545) en
   'n faktuurkop is breed en laag; hy sou die pos se boonste helfte vul. Die
   teal band sê in teks presies wat die beeld sou gesê het, en dit is in elk
   geval wat 'n mens sien wanneer 'n poskliënt beelde blokkeer — soos Outlook
   by verstek doen vir elke nuwe stuurder.
   ═══════════════════════════════════════════════════════════════════════ */
const MERKE = {
  winkel: {
    logo: LOGO_URL,
    boonste: "FUTURE SHARP",
    onderste: "Future Shop",
    voet: "Future Shop &middot; futureshop.futuresharp.co.za",
    voet_teks: "Future Shop · futureshop.futuresharp.co.za",
    knoppie_verstek: "Gaan na Future Shop",
    van_verstek: "Future Shop",
    gebruiker: () => process.env.EPOS_GEBRUIKER,
    gasheer: () => process.env.EPOS_GASHEER,
    poort: () => Number(process.env.EPOS_POORT) || 465,
    wagwoord: () => process.env.EPOS_WAGWOORD,
  },
  faktuur: {
    logo: null,
    boonste: "FUTURE SHARP NPC",
    onderste: "Boekhouding",
    voet: "Future Sharp NPC &middot; admin@futuresharp.co.za",
    voet_teks: "Future Sharp NPC · admin@futuresharp.co.za",
    knoppie_verstek: "Maak oop",
    van_verstek: "Future Sharp",
    // Die adres wat op die faktuur staan. Hy staan HIER en nie in 'n
    // omgewingsveranderlike nie, want by die terugval is presies daardie
    // veranderlike die ding wat ontbreek — en dan sou die Reply-To leeg wees.
    antwoord_verstek: "admin@futuresharp.co.za",
    gebruiker: () => process.env.EPOS_ADMIN_GEBRUIKER,
    gasheer: () => process.env.EPOS_ADMIN_GASHEER || process.env.EPOS_GASHEER,
    poort: () =>
      Number(process.env.EPOS_ADMIN_POORT) || Number(process.env.EPOS_POORT) || 465,
    wagwoord: () => process.env.EPOS_ADMIN_WAGWOORD,
  },
};

function kry_merk(naam) {
  return MERKE[naam] || MERKE.winkel;
}

// Ontsnap teks wat in HTML beland. Reels mag eenvoudige HTML bevat en word
// NIE ontsnap nie — maar 'n knoppie se teks en 'n URL kom dikwels uit data.
function ontsnap(teks) {
  return String(teks || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bou_html(opskrif, reels, knoppie, m) {
  const paragrawe = reels
    .map((r) => `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;line-height:1.65;color:#333333;">${r}</p>`)
    .join("");

  const knoppie_ry = knoppie && knoppie.url
    ? `<tr><td style="padding:10px 32px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${KORAAL};padding:12px 24px;">
            <a href="${ontsnap(knoppie.url)}" style="font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">${ontsnap(knoppie.teks || m.knoppie_verstek)}</a>
          </td>
        </tr></table>
      </td></tr>`
    : "";

  // Geen beeld by die faktuurmerk. Die band sê in teks wat die beeld sou sê,
  // en dit is in elk geval wat 'n mens sien wanneer 'n poskliënt beelde
  // blokkeer.
  const logo_ry = m.logo
    ? `<tr><td style="padding:0;font-size:0;line-height:0;">
      <img src="${m.logo}" width="${LOGO_BREEDTE}" alt="" style="display:block;width:${LOGO_BREEDTE}px;max-width:100%;height:auto;border:0;">
    </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="af"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDEBE6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDEBE6;">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #E2DFD9;">
    ${logo_ry}
    <tr><td style="background:${TEAL};padding:18px 32px;">
      <p style="margin:0 0 3px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2px;color:#FFFFFF;">${m.boonste}</p>
      <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;color:#FFFFFF;">${m.onderste}</p>
    </td></tr>
    <tr><td style="padding:30px 32px 8px;">
      <h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;line-height:1.3;color:#171717;font-weight:700;">${opskrif}</h1>
      ${paragrawe}
    </td></tr>
    ${knoppie_ry}
    <tr><td style="padding:16px 32px 22px;border-top:1px solid #EFEDE9;">
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#8B8781;">${m.voet}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// Plat-teks weergawe. Party kliënte wys dit, en dit hou die pos uit
// gemorspos uit — 'n boodskap met net HTML lyk verdag.
function bou_teks(opskrif, reels, knoppie, m) {
  // <br> eers 'n reëlbreuk maak voordat die res van die merkers wegval —
  // andersins loop 'n adres of 'n bedrae-blok in één string saam.
  const skoon = reels.map((r) =>
    r.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
  );
  const skakel = knoppie && knoppie.url ? `\n\n${knoppie.teks || m.knoppie_verstek}: ${knoppie.url}` : "";
  return `${opskrif}\n\n${skoon.join("\n\n")}${skakel}\n\n—\n${m.voet_teks}`;
}

/**
 * Stuur 'n e-pos. Gooi NOOIT — gee { ok: true } of { ok: false, fout }.
 *
 * @param {object} opsies
 * @param {string} opsies.aan        ontvanger se e-posadres
 * @param {string} opsies.onderwerp  onderwerpreël
 * @param {string} opsies.opskrif    groot opskrif binne die pos
 * @param {string[]} opsies.reels    paragrawe (eenvoudige HTML toegelaat)
 * @param {object} [opsies.knoppie]  { teks, url } — opsionele aksieknoppie
 */
async function stuur_epos({ aan, onderwerp, opskrif, reels, knoppie, merk, antwoord_aan }) {
  if (!aan || !onderwerp) {
    return { ok: false, fout: "Ontbrekende ontvanger of onderwerp" };
  }

  let merk_naam = MERKE[merk] ? merk : "winkel";
  let vervoer = kry_vervoerder(merk_naam);
  let antwoord = antwoord_aan || null;

  // DIE TERUGVAL. Is die admin-posbus nie opgestel nie, gaan die pos uit die
  // winkel se posbus met Reply-To: admin@ — die klient se antwoord kom
  // steeds waar hy hoort. 'n Faktuur wat glad nie uitgaan nie, is erger as
  // een wat uit die verkeerde posbus kom, en die terugval word aangeteken
  // sodat dit nie stilweg die normale toestand word nie.
  if (!vervoer && merk_naam !== "winkel") {
    const bedoel = MERKE[merk_naam].gebruiker() || MERKE[merk_naam].antwoord_verstek;
    vervoer = kry_vervoerder("winkel");
    if (vervoer) {
      console.warn(
        `E-pos vir merk "${merk_naam}" gaan uit die winkel se posbus — ` +
          "EPOS_ADMIN_-omgewingsveranderlikes ontbreek."
      );
      if (!antwoord && bedoel) antwoord = bedoel;
      // Die SJABLOON bly die van die merk. Slegs die posbus val terug.
    }
  }

  if (!vervoer) {
    console.warn("E-pos nie gestuur nie — EPOS_-omgewingsveranderlikes ontbreek.");
    return { ok: false, fout: "E-posdiens nie opgestel nie" };
  }

  const m = kry_merk(merk_naam);
  // Watter posbus WERKLIK gebruik word, nie watter een bedoel was nie: 'n
  // "from" wat nie by die geverifieerde posbus pas nie, laat die pos in
  // gemorspos beland.
  const posbus = vervoer === vervoerders.winkel
    ? MERKE.winkel.gebruiker()
    : m.gebruiker();
  // Die winkel se naam bly presies soos hy was: EPOS_VAN as dit gestel is,
  // anders "Future Shop". Die faktuurmerk kry sy eie veranderlike, sodat die
  // een nie die ander se naam kan oorneem nie.
  const van_naam =
    merk_naam === "winkel"
      ? process.env.EPOS_VAN || m.van_verstek
      : process.env.EPOS_VAN_ADMIN || m.van_verstek;
  const lys = Array.isArray(reels) ? reels : [String(reels || "")];

  try {
    const uitslag = await vervoer.sendMail({
      from: `"${van_naam}" <${posbus}>`,
      to: aan,
      ...(antwoord ? { replyTo: antwoord } : {}),
      subject: onderwerp,
      text: bou_teks(opskrif || onderwerp, lys, knoppie, m),
      html: bou_html(opskrif || onderwerp, lys, knoppie, m),
    });
    return { ok: true, id: uitslag.messageId };
  } catch (fout) {
    // Aanteken, nie gooi nie — sien die nota bo-aan.
    console.error("Kon nie e-pos stuur nie:", fout && fout.message);
    return { ok: false, fout: (fout && fout.message) || "Onbekende fout" };
  }
}

module.exports = { stuur_epos, ontsnap };
