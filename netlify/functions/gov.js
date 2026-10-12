// netlify/functions/gov.js
//
// Die Governance-area se enigste metadata-Function. Een POST met 'n `aksie`,
// dieselfde patroon as portaal.js. Die lêers self gaan deur gov-laai-op.js en
// gov-aflaai.js.
//
// TOEGANG: boekhouding-rol (sien _gov.js).
//
// AKSIES
//   lys                                   alles in een oproep
//   dok_wysig     { id, naam, dokument_datum, nota }
//   dok_skuif     { id, na }
//   dok_argiveer  { id }                  onthou die oorspronklike vouer
//   dok_herstel   { id }                  terug na die oorspronklike vouer
//   dok_skrap     { id }                  slegs uit die argief
//   sper_stoor    { id?, vouer, naam, datum, herhaal, herinner, nota }
//   sper_afhandel { id }                  'n herhalende een skep die volgende
//   sper_heropen  { id }
//   sper_skrap    { id }
//   besluit_stoor { no?, datum, teks, soort, stand, dok_id }
//   besluit_skrap { no }                  slegs 'n konsep
//   vouer_voeg_by { groep, titel }
//   vouer_hernoem { id, titel }
//   vouer_skrap   { id }                  slegs 'n leë, bygevoegde subvouer
//
// DIE GESKIEDENIS. Elke dokument dra 'n lys van wat met hom gebeur het (opgelaai,
// geskuif, geargiveer, herstel, gewysig), met wie en wanneer. Dit word nooit
// uitgevee nie.

const { kry_store } = require("./_blob-store");
const G = require("./_gov");

const HERHAAL = ["", "jaarliks", "maandeliks"];
const HERINNER = ["30_7", "14_3", "geen"];
const SOORTE = ["direksievergadering", "skriftelik", "lede"];
const MAKS_TEKS = 4000;

function skoon(s, maks) {
  return String(s == null ? "" : s).trim().slice(0, maks || 300);
}

function fout(status, teks) {
  return G.json(status, { fout: teks });
}

function wie(gebruiker) {
  return (gebruiker && gebruiker.email) || "onbekend";
}

function volgende_datum(datum, herhaal) {
  const [j, m, d] = datum.split("-").map(Number);
  let nj = j, nm = m;
  if (herhaal === "jaarliks") nj = j + 1;
  else if (herhaal === "maandeliks") { nm = m + 1; if (nm > 12) { nm = 1; nj = j + 1; } }
  else return null;
  // 31 Januarie + een maand is 28 of 29 Februarie, nie 3 Maart nie.
  const laaste = new Date(Date.UTC(nj, nm, 0)).getUTCDate();
  const nd = Math.min(d, laaste);
  return nj + "-" + String(nm).padStart(2, "0") + "-" + String(nd).padStart(2, "0");
}

// ---------- Dokumente ----------

async function kry_dok(id) {
  if (!id) return null;
  return kry_store(G.STORE.dokumente).get(String(id), { type: "json" });
}

async function stoor_dok(dok) {
  await kry_store(G.STORE.dokumente).setJSON(dok.id, dok);
}

function teken_aan(dok, gebruiker, aksie, ekstra) {
  dok.geskiedenis = Array.isArray(dok.geskiedenis) ? dok.geskiedenis : [];
  dok.geskiedenis.push(Object.assign({ op: G.nou_iso(), deur: wie(gebruiker), aksie }, ekstra || {}));
  dok.gewysig_op = G.nou_iso();
}

async function dok_wysig(inv, gebruiker) {
  const dok = await kry_dok(inv.id);
  if (!dok) return fout(404, "Dokument nie gevind nie.");
  const naam = skoon(inv.naam, 200);
  if (!naam) return fout(400, "Die naam is verpligtend.");
  if (inv.dokument_datum && !G.is_datum(inv.dokument_datum)) return fout(400, "Ongeldige datum.");
  const voor = { naam: dok.naam, dokument_datum: dok.dokument_datum };
  dok.naam = naam;
  dok.dokument_datum = inv.dokument_datum || "";
  dok.nota = skoon(inv.nota, 1000);
  teken_aan(dok, gebruiker, "gewysig", { voor });
  await stoor_dok(dok);
  return G.json(200, { dokument: dok });
}

async function dok_skuif(inv, gebruiker) {
  const dok = await kry_dok(inv.id);
  if (!dok) return fout(404, "Dokument nie gevind nie.");
  const vouers = await G.kry_vouers();
  const na = String(inv.na || "");
  if (na === G.ARGIEF) return fout(400, "Gebruik Argiveer om na die argief te skuif.");
  if (!G.geldige_vouer_ids(vouers).has(na)) return fout(400, "Onbekende vouer.");
  if (dok.vouer === G.ARGIEF) return fout(400, "Gebruik Herstel om uit die argief te skuif.");
  if (dok.vouer === na) return G.json(200, { dokument: dok });
  teken_aan(dok, gebruiker, "geskuif", { van: dok.vouer, na });
  dok.vouer = na;
  await stoor_dok(dok);
  return G.json(200, { dokument: dok });
}

async function dok_argiveer(inv, gebruiker) {
  const dok = await kry_dok(inv.id);
  if (!dok) return fout(404, "Dokument nie gevind nie.");
  if (dok.vouer === G.ARGIEF) return G.json(200, { dokument: dok });
  teken_aan(dok, gebruiker, "geargiveer", { van: dok.vouer });
  dok.oorsprong = dok.vouer;
  dok.vouer = G.ARGIEF;
  dok.geargiveer_op = G.nou_iso();
  await stoor_dok(dok);
  return G.json(200, { dokument: dok });
}

async function dok_herstel(inv, gebruiker) {
  const dok = await kry_dok(inv.id);
  if (!dok) return fout(404, "Dokument nie gevind nie.");
  if (dok.vouer !== G.ARGIEF) return G.json(200, { dokument: dok });
  const vouers = await G.kry_vouers();
  const geldig = G.geldige_vouer_ids(vouers);
  // Bestaan die oorspronklike subvouer nie meer nie, gaan die dokument na sy
  // hoofafdeling se Work in Progress.
  let na = dok.oorsprong;
  if (!na || !geldig.has(na) || na === G.ARGIEF) {
    const groep = String(dok.oorsprong || "").split(".")[0];
    na = geldig.has(groep + ".W") ? groep + ".W" : "01.W";
  }
  teken_aan(dok, gebruiker, "herstel", { na });
  dok.vouer = na;
  delete dok.oorsprong;
  delete dok.geargiveer_op;
  await stoor_dok(dok);
  return G.json(200, { dokument: dok });
}

async function dok_skrap(inv) {
  const dok = await kry_dok(inv.id);
  if (!dok) return fout(404, "Dokument nie gevind nie.");
  if (dok.vouer !== G.ARGIEF) return fout(400, "Slegs 'n dokument in die argief kan geskrap word.");
  const besluite = await G.lees_alles(G.STORE.besluite);
  const gekoppel = besluite.find((b) => b.dok_id === dok.id);
  if (gekoppel) return fout(400, "Die dokument is gekoppel aan besluit " + gekoppel.no + ".");
  await kry_store(G.STORE.leers).delete(dok.id);
  await kry_store(G.STORE.dokumente).delete(dok.id);
  return G.json(200, { geskrap: dok.id });
}

// ---------- Sperdatums ----------

async function sper_stoor(inv, gebruiker) {
  const store = kry_store(G.STORE.sperdatums);
  const vouers = await G.kry_vouers();
  const vouer = String(inv.vouer || "");
  if (!G.geldige_vouer_ids(vouers).has(vouer) || vouer === G.ARGIEF) return fout(400, "Onbekende vouer.");
  const naam = skoon(inv.naam, 200);
  if (!naam) return fout(400, "Die beskrywing is verpligtend.");
  if (!G.is_datum(inv.datum)) return fout(400, "Kies 'n sperdatum.");
  const herhaal = HERHAAL.includes(inv.herhaal) ? inv.herhaal : "";
  const herinner = HERINNER.includes(inv.herinner) ? inv.herinner : "30_7";

  let rekord = inv.id ? await store.get(String(inv.id), { type: "json" }) : null;
  if (inv.id && !rekord) return fout(404, "Sperdatum nie gevind nie.");
  if (!rekord) {
    rekord = { id: G.nuwe_id("S"), klaar: false, geskep_op: G.nou_iso(), geskep_deur: wie(gebruiker) };
  }
  // 'n Nuwe datum of 'n ander herinnering begin die herinneringe van voor af.
  if (rekord.datum !== inv.datum || rekord.herinner !== herinner) rekord.herinner_gestuur = [];
  Object.assign(rekord, {
    vouer, naam, datum: inv.datum, herhaal, herinner,
    nota: skoon(inv.nota, 1000),
    gewysig_op: G.nou_iso(), gewysig_deur: wie(gebruiker),
  });
  await store.setJSON(rekord.id, rekord);
  return G.json(200, { sperdatum: rekord });
}

async function sper_afhandel(inv, gebruiker) {
  const store = kry_store(G.STORE.sperdatums);
  const rekord = await store.get(String(inv.id || ""), { type: "json" });
  if (!rekord) return fout(404, "Sperdatum nie gevind nie.");
  if (rekord.klaar) return G.json(200, { sperdatum: rekord });
  rekord.klaar = true;
  rekord.afgehandel_op = G.nou_iso();
  rekord.afgehandel_deur = wie(gebruiker);

  let volgende = null;
  const nuwe_datum = volgende_datum(rekord.datum, rekord.herhaal);
  if (nuwe_datum && !rekord.volgende_id) {
    volgende = {
      id: G.nuwe_id("S"),
      vouer: rekord.vouer, naam: rekord.naam, datum: nuwe_datum,
      herhaal: rekord.herhaal, herinner: rekord.herinner, herinner_gestuur: [],
      nota: rekord.nota || "", klaar: false,
      geskep_op: G.nou_iso(), geskep_deur: wie(gebruiker), vorige_id: rekord.id,
    };
    rekord.volgende_id = volgende.id;
    await store.setJSON(volgende.id, volgende);
  }
  await store.setJSON(rekord.id, rekord);
  return G.json(200, { sperdatum: rekord, volgende });
}

async function sper_heropen(inv) {
  const store = kry_store(G.STORE.sperdatums);
  const rekord = await store.get(String(inv.id || ""), { type: "json" });
  if (!rekord) return fout(404, "Sperdatum nie gevind nie.");
  rekord.klaar = false;
  delete rekord.afgehandel_op;
  delete rekord.afgehandel_deur;
  await store.setJSON(rekord.id, rekord);
  return G.json(200, { sperdatum: rekord });
}

async function sper_skrap(inv) {
  const store = kry_store(G.STORE.sperdatums);
  const id = String(inv.id || "");
  const rekord = await store.get(id, { type: "json" });
  if (!rekord) return fout(404, "Sperdatum nie gevind nie.");
  await store.delete(id);
  return G.json(200, { geskrap: id });
}

// ---------- Besluite ----------

// B-JJJJ-NNN. Die jaar is die besluit se datum s'n, nie vandag s'n nie.
function volgende_no(besluite, jaar) {
  let hoogste = 0;
  for (const b of besluite) {
    const m = /^B-(\d{4})-(\d{3,})$/.exec(b.no || "");
    if (m && m[1] === jaar) hoogste = Math.max(hoogste, Number(m[2]));
  }
  return "B-" + jaar + "-" + String(hoogste + 1).padStart(3, "0");
}

async function besluit_stoor(inv, gebruiker) {
  const store = kry_store(G.STORE.besluite);
  if (!G.is_datum(inv.datum)) return fout(400, "Kies 'n datum.");
  const teks = skoon(inv.teks, MAKS_TEKS);
  if (!teks) return fout(400, "Die besluit se teks is verpligtend.");
  const soort = SOORTE.includes(inv.soort) ? inv.soort : "direksievergadering";
  const stand = inv.stand === "aanvaar" ? "aanvaar" : "konsep";
  const dok_id = inv.dok_id ? String(inv.dok_id) : "";
  if (dok_id && !(await kry_dok(dok_id))) return fout(400, "Die gekoppelde dokument bestaan nie.");

  let rekord = null;
  if (inv.no) {
    rekord = await store.get(String(inv.no), { type: "json" });
    if (!rekord) return fout(404, "Besluit nie gevind nie.");
    // 'n Aanvaarde besluit se inhoud staan vas. Net die gekoppelde dokument
    // kan nog verander, want die getekende notule kom dikwels later.
    if (rekord.stand === "aanvaar") {
      rekord.dok_id = dok_id;
      rekord.gewysig_op = G.nou_iso();
      rekord.gewysig_deur = wie(gebruiker);
      await store.setJSON(rekord.no, rekord);
      return G.json(200, { besluit: rekord });
    }
    // 'n Konsep wat na 'n ander jaar se datum verskuif, kry 'n nuwe nommer
    // in daardie jaar.
    if (rekord.datum.slice(0, 4) !== inv.datum.slice(0, 4)) {
      const almal = await G.lees_alles(G.STORE.besluite);
      await store.delete(rekord.no);
      rekord.no = volgende_no(almal, inv.datum.slice(0, 4));
    }
  } else {
    const almal = await G.lees_alles(G.STORE.besluite);
    rekord = { no: volgende_no(almal, inv.datum.slice(0, 4)), geskep_op: G.nou_iso(), geskep_deur: wie(gebruiker) };
  }

  Object.assign(rekord, { datum: inv.datum, teks, soort, stand, dok_id, gewysig_op: G.nou_iso(), gewysig_deur: wie(gebruiker) });
  if (stand === "aanvaar") {
    rekord.aanvaar_op = G.nou_iso();
    rekord.aanvaar_deur = wie(gebruiker);
  }
  await store.setJSON(rekord.no, rekord);
  return G.json(200, { besluit: rekord });
}

async function besluit_skrap(inv) {
  const store = kry_store(G.STORE.besluite);
  const no = String(inv.no || "");
  const rekord = await store.get(no, { type: "json" });
  if (!rekord) return fout(404, "Besluit nie gevind nie.");
  if (rekord.stand === "aanvaar") return fout(400, "'n Aanvaarde besluit kan nie geskrap word nie.");
  await store.delete(no);
  return G.json(200, { geskrap: no });
}

// ---------- Vouers ----------

async function vouer_voeg_by(inv) {
  const vouers = await G.kry_vouers();
  const groep = vouers.find((g) => g.id === String(inv.groep || ""));
  if (!groep) return fout(400, "Onbekende hoofafdeling.");
  const titel = skoon(inv.titel, 80);
  if (!titel) return fout(400, "Gee die vouer 'n naam.");
  let hoogste = 0;
  for (const s of groep.subs) hoogste = Math.max(hoogste, Number(s.id.split(".")[1]) || 0);
  const nuut = { id: groep.id + "." + (hoogste + 1), titel, bygevoeg: true };
  groep.subs.push(nuut);
  await G.stoor_vouers(vouers);
  return G.json(200, { vouers, vouer: nuut });
}

async function vouer_hernoem(inv) {
  const vouers = await G.kry_vouers();
  const titel = skoon(inv.titel, 80);
  if (!titel) return fout(400, "Gee die vouer 'n naam.");
  for (const g of vouers) {
    const s = g.subs.find((x) => x.id === String(inv.id || ""));
    if (s) {
      s.titel = titel;
      await G.stoor_vouers(vouers);
      return G.json(200, { vouers });
    }
  }
  return fout(404, "Vouer nie gevind nie.");
}

async function vouer_skrap(inv) {
  const id = String(inv.id || "");
  const vouers = await G.kry_vouers();
  const groep = vouers.find((g) => g.subs.some((s) => s.id === id));
  if (!groep) return fout(404, "Vouer nie gevind nie.");
  const sub = groep.subs.find((s) => s.id === id);
  if (!sub.bygevoeg) return fout(400, "Slegs 'n bygevoegde vouer kan verwyder word. Hernoem eerder.");
  const [dokumente, sperdatums] = await Promise.all([G.lees_alles(G.STORE.dokumente), G.lees_alles(G.STORE.sperdatums)]);
  if (dokumente.some((d) => d.vouer === id || d.oorsprong === id)) return fout(400, "Die vouer bevat dokumente (ook in die argief).");
  if (sperdatums.some((s) => s.vouer === id)) return fout(400, "Die vouer het sperdatums.");
  groep.subs = groep.subs.filter((s) => s.id !== id);
  await G.stoor_vouers(vouers);
  return G.json(200, { vouers });
}

// ---------- Lys ----------

async function lys() {
  const [vouers, dokumente, sperdatums, besluite] = await Promise.all([
    G.kry_vouers(),
    G.lees_alles(G.STORE.dokumente),
    G.lees_alles(G.STORE.sperdatums),
    G.lees_alles(G.STORE.besluite),
  ]);
  return G.json(200, { vouers, dokumente, sperdatums, besluite, vandag: G.vandag_sa() });
}

const AKSIES = {
  lys, dok_wysig, dok_skuif, dok_argiveer, dok_herstel, dok_skrap,
  sper_stoor, sper_afhandel, sper_heropen, sper_skrap,
  besluit_stoor, besluit_skrap,
  vouer_voeg_by, vouer_hernoem, vouer_skrap,
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return fout(405, "Metode nie toegelaat nie");

  const toegang = await G.kontroleer(event, context);
  if (toegang.antwoord) return toegang.antwoord;

  let inv;
  try {
    inv = JSON.parse(event.body || "{}");
  } catch {
    return fout(400, "Ongeldige JSON");
  }

  const doen = AKSIES[inv.aksie];
  if (!doen) return fout(400, "Onbekende aksie");

  try {
    return await doen(inv, toegang.gebruiker);
  } catch (f) {
    console.error("gov " + inv.aksie + " het misluk:", f);
    return fout(500, "Kon nie voltooi nie: " + ((f && f.message) || "onbekende fout"));
  }
};

// Vir toetse.
exports._volgende_datum = volgende_datum;
exports._volgende_no = volgende_no;
