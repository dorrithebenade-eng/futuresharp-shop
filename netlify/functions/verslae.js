// netlify/functions/verslae.js
//
// VERSLAGSKAKELS VIR SKOLE (Oktober 2026). Rol: boekhouding (Dorrithé en
// Ignatius), soos die res van die Future Sharp-paneel.
//
// 'n Verslagskakel is 'n eie Future Sharp-adres, /verslae/<slug>, wat na 'n
// skool se Google Drive-vouer deurstuur. Die eie adres is nodig omdat WhatsApp
// by 'n Drive-skakel net Google se eie voorskou wys; ons bladsy dra die skool
// se beeld (wat die paneel self teken) en stuur die mens dan na Drive.
//
// DEEL EN DEAKTIVEER. Wanneer 'n skakel geskep of weer geaktiveer word, stel
// die paneel die vouer op "enigiemand met die skakel kan kyk". Word dit
// gedeaktiveer, haal die paneel daardie deling weer weg: wie die Drive-adres
// reeds het, kom dan ook nie meer in nie. Persoonlike delings bly staan.
//
// STORE: "verslae" hou die lys (sleutel "skakels") en die sjablone; die beelde
// is in "verslae-beelde" (sleutel = slug); die Google-sleutel in
// "verslae-instellings" (sien _google-drive.js).

const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { portaal_admin } = require("./_portaal");
const G = require("./_google-drive");

const PUBLIEKE_WERF = "https://futureshop.futuresharp.co.za";
const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const TALE = ["af", "en", "tw"];

const STANDAARD_SJABLONE = {
  af: "Goeie dag\n\nDie Future Sharp-verslae vir {skool} is gereed. Julle kan dit hier oopmaak en aflaai:\n\n{skakel}\n\nLaat weet gerus as daar enige vrae is.\n\nVriendelike groete\nFuture Sharp",
  en: "Good day\n\nThe Future Sharp reports for {skool} are ready. You can open and download them here:\n\n{skakel}\n\nPlease let us know if you have any questions.\n\nKind regards\nFuture Sharp",
};

const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });
const store = () => kry_store("verslae");
const beelde = () => kry_store("verslae-beelde");

async function lees_skakels() { return (await store().get("skakels", { type: "json" })) || []; }
async function stoor_skakels(lys) { await store().setJSON("skakels", lys); }
async function lees_sjablone() { return { ...STANDAARD_SJABLONE, ...((await store().get("sjablone", { type: "json" })) || {}) }; }

function maak_slug(naam, bestaande) {
  const basis = String(naam).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "skool";
  let slug = basis, n = 2;
  while (bestaande.has(slug)) slug = basis + "-" + n++;
  return slug;
}

// Die beeld kom as 'n data-URL (JPG) uit die paneel se canvas.
function lees_beeld(data_url) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(data_url || ""));
  if (!m) throw new Error("Die beeld ontbreek");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > 1500000) throw new Error("Die beeld is te groot");
  return buf;
}

function publiek(s) {
  return { ...s, skakel: PUBLIEKE_WERF + "/verslae/" + s.slug, drive: "https://drive.google.com/drive/folders/" + s.vouer_id };
}

// Skole: die name uit Groepskakels plus dié wat al verslagskakels het.
async function skole(skakels) {
  const name = new Set(skakels.map((s) => s.skool));
  try {
    const d = await portaal_admin({ aksie: "groepe" });
    for (const g of d.groepe || []) if (g.naam) name.add(g.naam.trim());
  } catch (f) {
    console.error("verslae: kon nie groepe haal nie:", f.message);
  }
  return [...name].sort((a, b) => a.localeCompare(b, "af"));
}

async function stand() {
  const g = await G.kry_google();
  const skakels = await lees_skakels();
  return {
    google: g ? { gekoppel: true, epos: g.client_email, hoofvouer: g.hoofvouer || null } : { gekoppel: false },
    skakels: skakels.map(publiek),
    skole: await skole(skakels),
    sjablone: await lees_sjablone(),
  };
}

const AKSIES = {
  stand,

  async stoor_sleutel({ sleutel }) {
    let j;
    try { j = typeof sleutel === "string" ? JSON.parse(sleutel) : sleutel; } catch { throw new Error("Die lêer is nie geldige JSON nie"); }
    if (!j || j.type !== "service_account" || !j.client_email || !j.private_key) throw new Error("Dit lyk nie na 'n diensrekening-sleutel (service account) nie");
    const nuut = { client_email: j.client_email, private_key: j.private_key, project_id: j.project_id || "" };
    await G.token(nuut); // Toets dadelik of Google dit aanvaar.
    const ou = await G.kry_google();
    if (ou && ou.client_email === nuut.client_email && ou.hoofvouer) nuut.hoofvouer = ou.hoofvouer;
    await G.stoor_google(nuut);
    return stand();
  },

  async ontkoppel() {
    await kry_store("verslae-instellings").delete("google");
    return stand();
  },

  async hoofvouers() {
    return { vouers: await G.gedeelde_vouers(await G.kry_google()) };
  },

  async stel_hoofvouer({ vouer }) {
    const g = await G.kry_google();
    const id = G.vouer_id_uit(vouer);
    if (!id) throw new Error("Kies of plak die hoofvouer");
    g.hoofvouer = await G.vouer(g, id);
    await G.stoor_google(g);
    return stand();
  },

  async vouers() {
    const g = await G.kry_google();
    if (!g || !g.hoofvouer) throw new Error("Kies eers die hoofvouer");
    return { vouers: await G.subvouers(g, g.hoofvouer.id) };
  },

  async skep({ skool, vouer, taal, beeld }) {
    skool = String(skool || "").trim();
    if (skool.length < 2) throw new Error("Kies of tik die skool se naam");
    if (!TALE.includes(taal)) throw new Error("Kies 'n taal");
    const buf = lees_beeld(beeld);
    const g = await G.kry_google();
    const id = G.vouer_id_uit(vouer);
    if (!id) throw new Error("Kies die skool se vouer");
    const v = await G.vouer(g, id);
    await G.deel_as_kyker(g, v.id);

    const lys = await lees_skakels();
    const s = {
      slug: maak_slug(skool, new Set(lys.map((x) => x.slug))),
      skool, taal, vouer_id: v.id, vouer_naam: v.naam,
      oop: true, beeld_v: 1, geskep_op: new Date().toISOString(), gesluit_op: null,
    };
    await beelde().set(s.slug, buf);
    lys.unshift(s);
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
  },

  // Taal of skoolnaam verander: 'n nuwe beeld, dieselfde skakel.
  async wysig({ slug, skool, taal, beeld }) {
    const lys = await lees_skakels();
    const s = lys.find((x) => x.slug === slug);
    if (!s) throw new Error("Skakel nie gevind nie");
    if (skool !== undefined) { skool = String(skool).trim(); if (skool.length < 2) throw new Error("Tik die skool se naam"); s.skool = skool; }
    if (taal !== undefined) { if (!TALE.includes(taal)) throw new Error("Kies 'n taal"); s.taal = taal; }
    if (beeld) { await beelde().set(s.slug, lees_beeld(beeld)); s.beeld_v = (s.beeld_v || 1) + 1; }
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
  },

  async sluit({ slug, oop }) {
    const lys = await lees_skakels();
    const s = lys.find((x) => x.slug === slug);
    if (!s) throw new Error("Skakel nie gevind nie");
    const g = await G.kry_google();
    if (oop) await G.deel_as_kyker(g, s.vouer_id);
    else await G.hou_op_deel(g, s.vouer_id);
    s.oop = !!oop;
    s.gesluit_op = oop ? null : new Date().toISOString();
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
  },

  async skrap({ slug, naam }) {
    const lys = await lees_skakels();
    const s = lys.find((x) => x.slug === slug);
    if (!s) throw new Error("Skakel nie gevind nie");
    if (s.oop) throw new Error("Deaktiveer die skakel eers");
    if (String(naam || "").trim() !== s.skool) throw new Error("Tik die skool se naam presies om te bevestig");
    await beelde().delete(slug);
    await stoor_skakels(lys.filter((x) => x.slug !== slug));
    return { geskrap: slug };
  },

  // Is die vouer nog gedeel? Iemand kan dit in Drive self verander het.
  async kontroleer({ slug }) {
    const s = (await lees_skakels()).find((x) => x.slug === slug);
    if (!s) throw new Error("Skakel nie gevind nie");
    return { gedeel: await G.is_gedeel(await G.kry_google(), s.vouer_id) };
  },

  async stoor_sjablone({ sjablone }) {
    const af = String((sjablone && sjablone.af) || "").trim();
    const en = String((sjablone && sjablone.en) || "").trim();
    if (!af.includes("{skakel}") || !en.includes("{skakel}")) throw new Error("Elke boodskap moet {skakel} bevat");
    await store().setJSON("sjablone", { af, en });
    return { sjablone: await lees_sjablone() };
  },
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const { rede } = await kry_gebruiker_en_rol_uitslag(event, context, ["boekhouding"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang tot Future Sharp nie" });

  let invoer;
  try { invoer = JSON.parse(event.body || "{}"); } catch { return antwoord(400, { fout: "Ongeldige JSON" }); }
  const doen = Object.prototype.hasOwnProperty.call(AKSIES, invoer.aksie) && AKSIES[invoer.aksie];
  if (!doen) return antwoord(400, { fout: "Onbekende aksie" });

  try {
    return antwoord(200, await doen(invoer));
  } catch (f) {
    console.error("verslae", invoer.aksie, f);
    return antwoord(f.status === 403 ? 403 : 400, { fout: f.message || "Iets het skeefgeloop" });
  }
};

exports._toets = { maak_slug, lees_beeld, AKSIES, STANDAARD_SJABLONE };
