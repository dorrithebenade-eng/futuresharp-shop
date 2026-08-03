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
// STUUR FAAL NOOIT DIE AANROEPER NIE. 'n E-pos wat nie deurkom nie mag
// nooit 'n betaling, 'n bestelling of 'n stoor-aksie laat misluk nie.
// stuur_epos() gooi dus geen fout nie — dit gee { ok, fout } terug en die
// aanroeper besluit self of dit saak maak. Dit is doelbewus: die webhook
// wat 'n outeur inlig, moet die bestelling bevestig al is die pos weg.

const nodemailer = require("nodemailer");

let vervoerder = null;

function kry_vervoerder() {
  if (vervoerder) return vervoerder;

  const gasheer = process.env.EPOS_GASHEER;
  const gebruiker = process.env.EPOS_GEBRUIKER;
  const wagwoord = process.env.EPOS_WAGWOORD;
  if (!gasheer || !gebruiker || !wagwoord) return null;

  const poort = Number(process.env.EPOS_POORT) || 465;

  vervoerder = nodemailer.createTransport({
    host: gasheer,
    port: poort,
    // 465 is implisiete SSL; 587 begin skoon en gaan met STARTTLS oor.
    secure: poort === 465,
    auth: { user: gebruiker, pass: wagwoord },
  });

  return vervoerder;
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

// Ontsnap teks wat in HTML beland. Reels mag eenvoudige HTML bevat en word
// NIE ontsnap nie — maar 'n knoppie se teks en 'n URL kom dikwels uit data.
function ontsnap(teks) {
  return String(teks || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bou_html(opskrif, reels, knoppie) {
  const paragrawe = reels
    .map((r) => `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;line-height:1.65;color:#333333;">${r}</p>`)
    .join("");

  const knoppie_ry = knoppie && knoppie.url
    ? `<tr><td style="padding:10px 32px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${KORAAL};padding:12px 24px;">
            <a href="${ontsnap(knoppie.url)}" style="font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">${ontsnap(knoppie.teks || "Gaan na Future Shop")}</a>
          </td>
        </tr></table>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="af"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDEBE6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDEBE6;">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #E2DFD9;">
    <tr><td style="padding:0;font-size:0;line-height:0;">
      <img src="${LOGO_URL}" width="${LOGO_BREEDTE}" alt="" style="display:block;width:${LOGO_BREEDTE}px;max-width:100%;height:auto;border:0;">
    </td></tr>
    <tr><td style="background:${TEAL};padding:18px 32px;">
      <p style="margin:0 0 3px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2px;color:#FFFFFF;">FUTURE SHARP</p>
      <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;color:#FFFFFF;">Future Shop</p>
    </td></tr>
    <tr><td style="padding:30px 32px 8px;">
      <h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;line-height:1.3;color:#171717;font-weight:700;">${opskrif}</h1>
      ${paragrawe}
    </td></tr>
    ${knoppie_ry}
    <tr><td style="padding:16px 32px 22px;border-top:1px solid #EFEDE9;">
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#8B8781;">Future Shop &middot; futureshop.futuresharp.co.za</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// Plat-teks weergawe. Party kliënte wys dit, en dit hou die pos uit
// gemorspos uit — 'n boodskap met net HTML lyk verdag.
function bou_teks(opskrif, reels, knoppie) {
  const skoon = reels.map((r) => r.replace(/<[^>]+>/g, ""));
  const skakel = knoppie && knoppie.url ? `\n\n${knoppie.teks || "Gaan na Future Shop"}: ${knoppie.url}` : "";
  return `${opskrif}\n\n${skoon.join("\n\n")}${skakel}\n\n—\nFuture Shop · futureshop.futuresharp.co.za`;
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
async function stuur_epos({ aan, onderwerp, opskrif, reels, knoppie }) {
  if (!aan || !onderwerp) {
    return { ok: false, fout: "Ontbrekende ontvanger of onderwerp" };
  }

  const vervoer = kry_vervoerder();
  if (!vervoer) {
    console.warn("E-pos nie gestuur nie — EPOS_-omgewingsveranderlikes ontbreek.");
    return { ok: false, fout: "E-posdiens nie opgestel nie" };
  }

  const van_naam = process.env.EPOS_VAN || "Future Shop";
  const lys = Array.isArray(reels) ? reels : [String(reels || "")];

  try {
    const uitslag = await vervoer.sendMail({
      from: `"${van_naam}" <${process.env.EPOS_GEBRUIKER}>`,
      to: aan,
      subject: onderwerp,
      text: bou_teks(opskrif || onderwerp, lys, knoppie),
      html: bou_html(opskrif || onderwerp, lys, knoppie),
    });
    return { ok: true, id: uitslag.messageId };
  } catch (fout) {
    // Aanteken, nie gooi nie — sien die nota bo-aan.
    console.error("Kon nie e-pos stuur nie:", fout && fout.message);
    return { ok: false, fout: (fout && fout.message) || "Onbekende fout" };
  }
}

module.exports = { stuur_epos };
