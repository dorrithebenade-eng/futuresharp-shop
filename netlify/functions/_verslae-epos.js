// netlify/functions/_verslae-epos.js
//
// DIE VERSLAE-E-POS (Oktober 2026). Uit verslae@futuresharp.co.za, met die
// afsender se naam ("Prof. Ignatius Gous (Future Sharp)") en Reply-To sy eie
// adres. Die e-pos kan nie VAN 'n Gmail-adres af kom nie: ons bediener mag nie
// namens Gmail stuur nie, en die pos sou as vervalsing in die gemorspos beland.
//
// OMGEWINGSVERANDERLIKES (Netlify):
//   EPOS_VERSLAE_GEBRUIKER  verslae@futuresharp.co.za
//   EPOS_VERSLAE_WAGWOORD   daardie posbus se wagwoord
//   EPOS_VERSLAE_GASHEER    opsioneel, verstek EPOS_GASHEER
//   EPOS_VERSLAE_POORT      opsioneel, verstek EPOS_POORT of 465
//
// DIE UITLEG IS 'N TABEL van 600px met inlyn-style, soos _stuur-epos.js, want
// Outlook ignoreer die meeste ander dinge. Die beeld word van die werf gelaai
// (nie aangeheg nie); blokkeer 'n poskliënt beelde, staan die teks en die
// knoppie steeds.

const nodemailer = require("nodemailer");

let vervoerder = null;

function instellings() {
  const gebruiker = process.env.EPOS_VERSLAE_GEBRUIKER;
  const wagwoord = process.env.EPOS_VERSLAE_WAGWOORD;
  const gasheer = process.env.EPOS_VERSLAE_GASHEER || process.env.EPOS_GASHEER;
  const poort = Number(process.env.EPOS_VERSLAE_POORT || process.env.EPOS_POORT) || 465;
  return { gebruiker, wagwoord, gasheer, poort, gereed: !!(gebruiker && wagwoord && gasheer) };
}

function kry_vervoerder() {
  if (vervoerder) return vervoerder;
  const s = instellings();
  if (!s.gereed) return null;
  vervoerder = nodemailer.createTransport({ host: s.gasheer, port: s.poort, secure: s.poort === 465, auth: { user: s.gebruiker, pass: s.wagwoord } });
  return vervoerder;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FONT = "Segoe UI,Helvetica,Arial,sans-serif";
const TEKS = "#1F2933";

// Die boodskap is gewone teks uit die paneel. Paragrawe word deur leë reëls
// geskei. 'n Reël wat net die skakel is, word die knoppie; "---" (tussen twee
// tale) word 'n dun streep.
function lyf_html(boodskap, skakel, knop_teks) {
  const kort = skakel.replace(/^https?:\/\//, "");
  return String(boodskap).replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => {
    if (p === skakel) {
      return `<tr><td align="center" style="padding:6px 32px 22px">
<a href="${esc(skakel)}" style="display:inline-block;background:#00A291;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;font-family:${FONT};padding:13px 28px;border-radius:8px">${esc(knop_teks)}</a>
<div style="font-size:12px;color:#6B7785;margin-top:10px;font-family:${FONT}"><a href="${esc(skakel)}" style="color:#6B7785;text-decoration:none">${esc(kort)}</a></div></td></tr>`;
    }
    if (p === "---") return `<tr><td style="padding:6px 32px 18px"><div style="border-top:1px solid #E1E4E8;font-size:0;line-height:0">&nbsp;</div></td></tr>`;
    const binne = esc(p).split(esc(skakel)).join(`<a href="${esc(skakel)}" style="color:#0B5FA8">${esc(kort)}</a>`).replace(/\n/g, "<br>");
    return `<tr><td style="padding:0 32px 14px;font-size:15px;line-height:1.6;color:${TEKS};font-family:${FONT}">${binne}</td></tr>`;
  }).join("\n");
}

function handtekening_html(h) {
  if (!h || !h.naam) return "";
  const reels = [`<b style="font-size:15px">${esc(h.naam)}</b>`];
  if (h.titel) reels.push(`<span style="color:#5B6675">${esc(h.titel)}</span>`);
  if (h.epos) reels.push(`<a href="mailto:${esc(h.epos)}" style="color:#0B5FA8;text-decoration:none">${esc(h.epos)}</a>`);
  if (h.selfoon) reels.push(`<span style="color:#5B6675">${esc(h.selfoon)}</span>`);
  return `<tr><td style="padding:4px 32px 26px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-left:3px solid #00A291;padding:2px 0 2px 12px;font-size:14px;line-height:1.5;color:${TEKS};font-family:${FONT}">${reels.join("<br>")}</td></tr></table></td></tr>`;
}

function bou_html({ titel, beeld, skakel, boodskap, handtekening, knop_teks, van_adres, taal }) {
  return `<!DOCTYPE html>
<html lang="${taal === "en" ? "en" : "af"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titel)}</title></head>
<body style="margin:0;padding:0;background:#EEF0F3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F3"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #E1E4E8;border-radius:10px;overflow:hidden">
<tr><td><a href="${esc(skakel)}"><img src="${esc(beeld)}" width="600" alt="${esc(titel)}" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>
<tr><td style="height:28px;line-height:28px;font-size:0">&nbsp;</td></tr>
${lyf_html(boodskap, skakel, knop_teks)}
${handtekening_html(handtekening)}
<tr><td style="background:#071630;padding:16px 32px;font-size:12px;color:#C9D2DE;line-height:1.5;font-family:${FONT}">Future Sharp NPC &middot; <span style="color:#ffffff">${esc(van_adres)}</span></td></tr>
</table></td></tr></table></body></html>`;
}

function bou_teks({ boodskap, handtekening }) {
  const h = handtekening && handtekening.naam ? "\n" + [handtekening.naam, handtekening.titel, handtekening.epos, handtekening.selfoon].filter(Boolean).join("\n") : "";
  return String(boodskap).replace(/\r/g, "") + h + "\n";
}

const EPOS_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

async function stuur_verslae_epos({ aan, onderwerp, titel, beeld, skakel, boodskap, handtekening, afskrif, taal }) {
  const s = instellings();
  const v = kry_vervoerder();
  if (!v) throw new Error("Die verslae@-posbus is nog nie in Netlify opgestel nie (EPOS_VERSLAE_GEBRUIKER en EPOS_VERSLAE_WAGWOORD)");
  const ontvangers = String(aan || "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  if (!ontvangers.length) throw new Error("Tik die e-posadres");
  if (ontvangers.length > 5) throw new Error("Hoogstens vyf adresse op 'n slag");
  const sleg = ontvangers.find((x) => !EPOS_RE.test(x));
  if (sleg) throw new Error("Die e-posadres lyk nie reg nie: " + sleg);

  const h = handtekening && handtekening.naam ? handtekening : null;
  const van_naam = h ? h.naam + " (Future Sharp)" : "Future Sharp";
  const antwoord = h && h.epos && EPOS_RE.test(h.epos) ? h.epos : s.gebruiker;
  const knop_teks = taal === "en" ? "Open the reports" : taal === "tw" ? "Maak die verslae oop · Open the reports" : "Maak die verslae oop";

  const info = await v.sendMail({
    from: { name: van_naam, address: s.gebruiker },
    to: ontvangers.join(", "),
    ...(afskrif && antwoord ? { bcc: antwoord } : {}),
    replyTo: antwoord,
    subject: onderwerp,
    text: bou_teks({ boodskap, handtekening: h }),
    html: bou_html({ titel, beeld, skakel, boodskap, handtekening: h, knop_teks, van_adres: s.gebruiker, taal }),
  });
  return { aan: ontvangers, antwoord, id: info && info.messageId };
}

module.exports = { stuur_verslae_epos, bou_html, bou_teks, instellings, EPOS_RE };
