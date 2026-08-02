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

// Sit die weergawe in 'n eenvoudige, veilige HTML-raam. Geen eksterne
// beelde of style-lêers nie — poskliënte blokkeer dit dikwels, en 'n
// kennisgewing moet leesbaar wees selfs wanneer alles geblokkeer word.
function bou_html(opskrif, reels) {
  const paragrawe = reels
    .map((r) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#171717;">${r}</p>`)
    .join("");

  return `<!DOCTYPE html><html lang="af"><body style="margin:0;padding:24px;background:#EDEBE6;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;padding:28px 26px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#479F91;">FUTURE SHOP</p>
    <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#171717;">${opskrif}</h1>
    ${paragrawe}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #E6E4E0;font-size:12px;color:#8B8781;">
      Future Shop · futureshop.futuresharp.co.za
    </p>
  </div>
</body></html>`;
}

// Plat-teks weergawe. Party kliënte wys dit, en dit hou die pos uit
// gemorspos uit — 'n boodskap met net HTML lyk verdag.
function bou_teks(opskrif, reels) {
  const skoon = reels.map((r) => r.replace(/<[^>]+>/g, ""));
  return `${opskrif}\n\n${skoon.join("\n\n")}\n\n—\nFuture Shop · futureshop.futuresharp.co.za`;
}

/**
 * Stuur 'n e-pos. Gooi NOOIT — gee { ok: true } of { ok: false, fout }.
 *
 * @param {object} opsies
 * @param {string} opsies.aan        ontvanger se e-posadres
 * @param {string} opsies.onderwerp  onderwerpreël
 * @param {string} opsies.opskrif    groot opskrif binne die pos
 * @param {string[]} opsies.reels    paragrawe (eenvoudige HTML toegelaat)
 */
async function stuur_epos({ aan, onderwerp, opskrif, reels }) {
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
      text: bou_teks(opskrif || onderwerp, lys),
      html: bou_html(opskrif || onderwerp, lys),
    });
    return { ok: true, id: uitslag.messageId };
  } catch (fout) {
    // Aanteken, nie gooi nie — sien die nota bo-aan.
    console.error("Kon nie e-pos stuur nie:", fout && fout.message);
    return { ok: false, fout: (fout && fout.message) || "Onbekende fout" };
  }
}

module.exports = { stuur_epos };
