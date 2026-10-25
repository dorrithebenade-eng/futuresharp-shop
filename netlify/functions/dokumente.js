// netlify/functions/dokumente.js
//
// DOKUMENTESKAKELS VIR SPESIFIEKE PERSONE (Oktober 2026, FSI op Future Shop se
// versoek). Rol: boekhouding, soos Verslae. Dit werk soos Verslae vir skole,
// met hierdie verskille (Dorrithé, 25 Okt 2026):
//   - die persoon se naam word self ingetik (geen lys uit Groepskakels nie);
//   - die persone se vouers staan in 'n EIE hoofvouer (bv. DOKUMENTE DEEL),
//     apart van Verslae se hoofvouer vir die skole;
//   - die publieke skakel is /dokumente/<lukrake kode>, sodat die naam nie in
//     die adres staan nie;
//   - die beeld en die publieke bladsy dra nie die persoon se naam nie, net
//     "Future Sharp" en die etiket Dokumente (of Documents).
//
// DEEL EN DEAKTIVEER: soos Verslae. Skep of heraktiveer deel die vouer as
// "enigiemand met die skakel kan kyk"; deaktiveer haal daardie deling weg.
//
// HERGEBRUIK: die Google-diensrekening (_google-drive.js, store
// "verslae-instellings"), die verslae@-posbus (_verslae-epos.js) en elkeen se
// handtekening (store "verslae", sleutel handtekening:<e-pos>).
//
// STORE: "dokumente" hou die lys (sleutel "skakels"), die sjablone en die
// hoofvouer; die beelde is in "dokumente-beelde" (sleutel = kode).

const crypto = require("crypto");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const G = require("./_google-drive");
const E = require("./_verslae-epos");

const PUBLIEKE_WERF = "https://futureshop.futuresharp.co.za";
const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const TALE = ["af", "en"];
const ETIKET = { af: "Dokumente", en: "Documents" };
const KNOP = { af: "Maak die dokumente oop", en: "Open the documents" };

const STANDAARD_SJABLONE = {
  af: "{groet}\n\nJou dokumente by Future Sharp is gereed. Jy kan dit hier oopmaak en aflaai:\n\n{skakel}\n\nLaat weet gerus as daar enige vrae is.\n\nVriendelike groete",
  en: "{groet}\n\nYour documents from Future Sharp are ready. You can open and download them here:\n\n{skakel}\n\nPlease let us know if you have any questions.\n\nKind regards",
};

const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });
const store = () => kry_store("dokumente");
const beelde = () => kry_store("dokumente-beelde");

async function lees_skakels() { return (await store().get("skakels", { type: "json" })) || []; }
async function stoor_skakels(lys) { await store().setJSON("skakels", lys); }
async function lees_sjablone() { return { ...STANDAARD_SJABLONE, ...((await store().get("sjablone", { type: "json" })) || {}) }; }
async function lees_hoofvouer() { return (await store().get("hoofvouer", { type: "json" })) || null; }

// Die handtekening is dieselfde as by Verslae: een per aanmelding.
const hand_sleutel = (g) => "handtekening:" + String((g && g.email) || "").trim().toLowerCase();
async function lees_handtekening(g) { return (await kry_store("verslae").get(hand_sleutel(g), { type: "json" })) || null; }

async function wie(g) {
  const h = await lees_handtekening(g);
  return { naam: (h && h.naam) || (g && g.email) || "Onbekend", epos: (g && g.email) || "" };
}

function log(s, wat, deur, ekstra) {
  s.geskiedenis = [{ op: new Date().toISOString(), wat, deur: deur.naam, deur_epos: deur.epos, ...(ekstra || {}) }, ...(s.geskiedenis || [])].slice(0, 60);
}

// 'n Lukrake kode van agt tekens, sonder letters wat maklik verwar word
// (geen 0/o, 1/l/i nie). 31^8 moontlikhede: nie raai nie.
const ABC = "abcdefghjkmnpqrstuvwxyz23456789";
function maak_kode(bestaande) {
  for (;;) {
    const b = crypto.randomBytes(8);
    let k = "";
    for (let i = 0; i < 8; i++) k += ABC[b[i] % ABC.length];
    if (!bestaande.has(k)) return k;
  }
}

function lees_beeld(data_url) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(data_url || ""));
  if (!m) throw new Error("Die beeld ontbreek");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > 1500000) throw new Error("Die beeld is te groot");
  return buf;
}

function publiek(s) {
  return { ...s, skakel: PUBLIEKE_WERF + "/dokumente/" + s.kode, drive: "https://drive.google.com/drive/folders/" + s.vouer_id };
}

const skoon_naam = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, 120);

async function stand(_, gebruiker) {
  const g = await G.kry_google();
  return {
    google: g ? { gekoppel: true, epos: g.client_email, hoofvouer: await lees_hoofvouer() } : { gekoppel: false },
    skakels: (await lees_skakels()).map(publiek),
    sjablone: await lees_sjablone(),
    handtekening: await lees_handtekening(gebruiker),
    epos_gereed: E.instellings().gereed,
  };
}

async function vind(kode) {
  const lys = await lees_skakels();
  const s = lys.find((x) => x.kode === kode);
  if (!s) throw new Error("Skakel nie gevind nie");
  return { lys, s };
}

const AKSIES = {
  stand,

  async hoofvouers() {
    const g = await G.kry_google();
    if (!g) throw new Error("Google Drive is nog nie gekoppel nie; doen dit eers onder Verslae");
    return { vouers: await G.gedeelde_vouers(g) };
  },

  async stel_hoofvouer({ vouer }, gebruiker) {
    const g = await G.kry_google();
    if (!g) throw new Error("Google Drive is nog nie gekoppel nie");
    const id = G.vouer_id_uit(vouer);
    if (!id) throw new Error("Kies of plak die hoofvouer");
    const v = await G.vouer(g, id);
    if (g.hoofvouer && g.hoofvouer.id === v.id) throw new Error("Dit is Verslae se hoofvouer vir die skole. Kies 'n ander vouer vir Dokumente.");
    await store().setJSON("hoofvouer", v);
    return stand(null, gebruiker);
  },

  async vouers() {
    const g = await G.kry_google();
    const h = await lees_hoofvouer();
    if (!g || !h) throw new Error("Kies eers die hoofvouer");
    return { vouers: await G.subvouers(g, h.id) };
  },

  async skep({ naam, vouer, taal, beeld }, gebruiker) {
    naam = skoon_naam(naam);
    if (naam.length < 2) throw new Error("Tik die persoon se naam");
    if (!TALE.includes(taal)) throw new Error("Kies 'n taal");
    const buf = lees_beeld(beeld);
    const g = await G.kry_google();
    const id = G.vouer_id_uit(vouer);
    if (!id) throw new Error("Kies die persoon se vouer");
    const v = await G.vouer(g, id);
    await G.deel_as_kyker(g, v.id);

    const lys = await lees_skakels();
    const deur = await wie(gebruiker);
    const s = {
      kode: maak_kode(new Set(lys.map((x) => x.kode))),
      naam, taal, vouer_id: v.id, vouer_naam: v.naam,
      oop: true, beeld_v: 1, geskep_op: new Date().toISOString(), gesluit_op: null,
      geskep_deur: deur.naam, geskep_deur_epos: deur.epos,
    };
    log(s, "geskep", deur);
    await beelde().set(s.kode, buf);
    lys.unshift(s);
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
  },

  async wysig({ kode, naam, taal, beeld }, gebruiker) {
    const { lys, s } = await vind(kode);
    if (naam !== undefined) { naam = skoon_naam(naam); if (naam.length < 2) throw new Error("Tik die persoon se naam"); s.naam = naam; }
    if (taal !== undefined) { if (!TALE.includes(taal)) throw new Error("Kies 'n taal"); s.taal = taal; }
    if (beeld) { await beelde().set(s.kode, lees_beeld(beeld)); s.beeld_v = (s.beeld_v || 1) + 1; }
    log(s, "gewysig", await wie(gebruiker), { taal: s.taal });
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
  },

  async sluit({ kode, oop }, gebruiker) {
    const { lys, s } = await vind(kode);
    const g = await G.kry_google();
    if (oop) await G.deel_as_kyker(g, s.vouer_id);
    else await G.hou_op_deel(g, s.vouer_id);
    s.oop = !!oop;
    s.gesluit_op = oop ? null : new Date().toISOString();
    log(s, oop ? "geaktiveer" : "gedeaktiveer", await wie(gebruiker));
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
  },

  async skrap({ kode, naam }) {
    const { lys, s } = await vind(kode);
    if (s.oop) throw new Error("Deaktiveer die skakel eers");
    if (skoon_naam(naam) !== s.naam) throw new Error("Tik die persoon se naam presies om te bevestig");
    await beelde().delete(kode);
    await stoor_skakels(lys.filter((x) => x.kode !== kode));
    return { geskrap: kode };
  },

  async kontroleer({ kode }) {
    const { s } = await vind(kode);
    return { gedeel: await G.is_gedeel(await G.kry_google(), s.vouer_id) };
  },

  async stoor_handtekening({ handtekening }, gebruiker) {
    const h = handtekening || {};
    const skoon = (x, n) => String(x || "").replace(/\s+/g, " ").trim().slice(0, n);
    const uit = { naam: skoon(h.naam, 80), titel: skoon(h.titel, 100), epos: skoon(h.epos, 120).toLowerCase(), selfoon: skoon(h.selfoon, 30) };
    if (uit.naam.length < 2) throw new Error("Tik jou naam soos dit onderaan moet staan");
    if (uit.epos && !E.EPOS_RE.test(uit.epos)) throw new Error("Die e-posadres vir antwoorde lyk nie reg nie");
    if (!gebruiker || !gebruiker.email) throw new Error("Kon nie bepaal wie aangemeld is nie");
    await kry_store("verslae").setJSON(hand_sleutel(gebruiker), uit);
    return { handtekening: uit };
  },

  async stuur_epos({ kode, aan, boodskap, afskrif }, gebruiker) {
    const { s } = await vind(kode);
    if (!s.oop) throw new Error("Die skakel is gedeaktiveer");
    const p = publiek(s);
    const teks = String(boodskap || "").trim();
    if (!teks.includes(p.skakel)) throw new Error("Die boodskap moet die skakel bevat");
    if (teks.length > 8000) throw new Error("Die boodskap is te lank");
    const titel = "Future Sharp " + ETIKET[s.taal];
    const r = await E.stuur_verslae_epos({
      aan, afskrif: !!afskrif, taal: s.taal,
      onderwerp: titel, titel,
      beeld: PUBLIEKE_WERF + "/dokumente-beeld/" + s.kode + ".jpg?v=" + (s.beeld_v || 1),
      skakel: p.skakel, boodskap: teks, knop_teks: KNOP[s.taal],
      handtekening: await lees_handtekening(gebruiker),
    });
    const { lys, s: x } = await vind(kode);
    log(x, "epos", await wie(gebruiker), { aan: r.aan.join(", ") });
    await stoor_skakels(lys);
    return { gestuur: r.aan, antwoord: r.antwoord, skakel: publiek(x) };
  },

  async log_whatsapp({ kode, aan }, gebruiker) {
    const { lys, s } = await vind(kode);
    log(s, "whatsapp", await wie(gebruiker), { aan: String(aan || "").replace(/[^\d+ ]/g, "").slice(0, 20) });
    await stoor_skakels(lys);
    return { skakel: publiek(s) };
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
  const { rede, gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["boekhouding"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang tot Future Sharp nie" });

  let invoer;
  try { invoer = JSON.parse(event.body || "{}"); } catch { return antwoord(400, { fout: "Ongeldige JSON" }); }
  const doen = Object.prototype.hasOwnProperty.call(AKSIES, invoer.aksie) && AKSIES[invoer.aksie];
  if (!doen) return antwoord(400, { fout: "Onbekende aksie" });

  try {
    return antwoord(200, await doen(invoer, gebruiker));
  } catch (f) {
    console.error("dokumente", invoer.aksie, f);
    return antwoord(f.status === 403 ? 403 : 400, { fout: f.message || "Iets het skeefgeloop" });
  }
};

exports._toets = { maak_kode, lees_beeld, AKSIES, STANDAARD_SJABLONE };
