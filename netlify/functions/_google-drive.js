// netlify/functions/_google-drive.js
//
// GOOGLE DRIVE VIR DIE VERSLAGSKAKELS (Oktober 2026).
//
// Die paneel praat met Google Drive as 'n DIENSREKENING (service account): 'n
// eie Google-"gebruiker" vir die paneel, met 'n e-posadres soos
// verslae@<projek>.iam.gserviceaccount.com. Dit sien NET die vouers wat met
// daardie adres gedeel is. Julle deel een hoofvouer (bv. "Future Sharp Verslae
// 2026") met die diensrekening as Redigeerder; die skole se vouers daarin is
// wat die paneel wys en deel.
//
// DIE SLEUTEL LEEF IN NETLIFY BLOBS, NIE IN 'N OMGEWINGVERANDERLIKE NIE.
// Netlify Functions het 'n perk van 4 KB vir al die omgewingveranderlikes saam,
// en 'n diensrekening se JSON-sleutel is alleen al omtrent 2,3 KB. Die paneel
// laai die JSON-lêer op (Verslae > Google-koppeling); dit gaan na die store
// "verslae-instellings" en kom nooit weer na die blaaier toe nie.
//
// Geen ekstra pakkette nie: die JWT word met Node se eie crypto onderteken.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");

const OMVANG = "https://www.googleapis.com/auth/drive";
const DRIVE = "https://www.googleapis.com/drive/v3";
const VOUER_TIPE = "application/vnd.google-apps.folder";
const ALLE_DRYWE = "supportsAllDrives=true&includeItemsFromAllDrives=true";

let kas = { epos: null, token: null, verval: 0 };

const instellings_store = () => kry_store("verslae-instellings");

async function kry_google() {
  return (await instellings_store().get("google", { type: "json" })) || null;
}

async function stoor_google(data) {
  await instellings_store().setJSON("google", data);
  kas = { epos: null, token: null, verval: 0 };
}

const b64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

function maak_jwt(epos, sleutel) {
  const nou = Math.floor(Date.now() / 1000);
  const kop = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const lyf = b64url(JSON.stringify({ iss: epos, scope: OMVANG, aud: "https://oauth2.googleapis.com/token", iat: nou, exp: nou + 3600 }));
  const teken = crypto.createSign("RSA-SHA256").update(kop + "." + lyf).sign(sleutel);
  return kop + "." + lyf + "." + b64url(teken);
}

// Haal 'n toegangstoken. Die kas hou dit tot vyf minute voor dit verval.
async function token(g) {
  if (!g || !g.client_email || !g.private_key) throw new Error("Google Drive is nog nie gekoppel nie");
  if (kas.epos === g.client_email && kas.token && Date.now() < kas.verval) return kas.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: maak_jwt(g.client_email, g.private_key) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error("Google het die sleutel nie aanvaar nie" + (d.error_description ? ": " + d.error_description : ""));
  kas = { epos: g.client_email, token: d.access_token, verval: Date.now() + (Number(d.expires_in || 3600) - 300) * 1000 };
  return kas.token;
}

async function drive(g, pad, opsies = {}) {
  const r = await fetch(DRIVE + pad, {
    method: opsies.metode || "GET",
    headers: { Authorization: "Bearer " + (await token(g)), ...(opsies.lyf ? { "Content-Type": "application/json" } : {}) },
    body: opsies.lyf ? JSON.stringify(opsies.lyf) : undefined,
  });
  if (r.status === 204) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const boodskap = (d.error && d.error.message) || "Fout " + r.status;
    const f = new Error(r.status === 404 ? "Die vouer is nie gevind nie, of nie met die paneel gedeel nie" : "Google Drive: " + boodskap);
    f.status = r.status;
    throw f;
  }
  return d;
}

// Lees die vouer-id uit 'n Drive-skakel, of aanvaar 'n kaal id.
function vouer_id_uit(teks) {
  const t = String(teks || "").trim();
  const m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(t) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(t);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : "";
}

async function lys_alles(g, q, velde) {
  const uit = [];
  let blad = "";
  do {
    const d = await drive(g, "/files?" + ALLE_DRYWE + "&pageSize=200&orderBy=name&fields=" + encodeURIComponent("nextPageToken,files(" + velde + ")") +
      "&q=" + encodeURIComponent(q) + (blad ? "&pageToken=" + encodeURIComponent(blad) : ""));
    uit.push(...(d.files || []));
    blad = d.nextPageToken || "";
  } while (blad && uit.length < 1000);
  return uit;
}

// Vouers wat met die diensrekening gedeel is: die moontlike hoofvouers.
async function gedeelde_vouers(g) {
  const lys = await lys_alles(g, "sharedWithMe and mimeType='" + VOUER_TIPE + "' and trashed=false", "id,name,modifiedTime");
  return lys.map((f) => ({ id: f.id, naam: f.name, verander: f.modifiedTime }));
}

// Die skole se vouers: die vouers direk binne die hoofvouer.
async function subvouers(g, ouer_id) {
  const lys = await lys_alles(g, "'" + ouer_id + "' in parents and mimeType='" + VOUER_TIPE + "' and trashed=false", "id,name,modifiedTime");
  return lys.map((f) => ({ id: f.id, naam: f.name, verander: f.modifiedTime }));
}

async function vouer(g, id) {
  const f = await drive(g, "/files/" + encodeURIComponent(id) + "?supportsAllDrives=true&fields=id,name,mimeType,trashed");
  if (f.mimeType !== VOUER_TIPE) throw new Error("Hierdie skakel is nie 'n vouer nie");
  if (f.trashed) throw new Error("Hierdie vouer is in Google Drive se asblik");
  return { id: f.id, naam: f.name };
}

async function lees_delings(g, id) {
  const d = await drive(g, "/files/" + encodeURIComponent(id) + "/permissions?supportsAllDrives=true&fields=permissions(id,type,role)");
  return d.permissions || [];
}

// Enigiemand met die skakel kan KYK (nie redigeer of kommentaar lewer nie).
// Bestaan daar reeds 'n "enigiemand"-deling met 'n ander rol, word dit kyker.
async function deel_as_kyker(g, id) {
  const enige = (await lees_delings(g, id)).find((p) => p.type === "anyone");
  if (enige && enige.role === "reader") return { gedeel: true, verander: false };
  if (enige) {
    await drive(g, "/files/" + encodeURIComponent(id) + "/permissions/" + enige.id + "?supportsAllDrives=true", { metode: "PATCH", lyf: { role: "reader" } });
    return { gedeel: true, verander: true, was: enige.role };
  }
  await drive(g, "/files/" + encodeURIComponent(id) + "/permissions?supportsAllDrives=true&sendNotificationEmail=false", {
    metode: "POST",
    lyf: { type: "anyone", role: "reader", allowFileDiscovery: false },
  });
  return { gedeel: true, verander: true };
}

// Haal die "enigiemand met die skakel"-deling weg. Persoonlike delings bly.
async function hou_op_deel(g, id) {
  for (const p of await lees_delings(g, id)) {
    if (p.type === "anyone") await drive(g, "/files/" + encodeURIComponent(id) + "/permissions/" + p.id + "?supportsAllDrives=true", { metode: "DELETE" });
  }
  return { gedeel: false };
}

async function is_gedeel(g, id) {
  return (await lees_delings(g, id)).some((p) => p.type === "anyone" && p.role === "reader");
}

module.exports = {
  kry_google, stoor_google, token, vouer_id_uit,
  gedeelde_vouers, subvouers, vouer, deel_as_kyker, hou_op_deel, is_gedeel,
};
