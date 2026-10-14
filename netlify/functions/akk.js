// netlify/functions/akk.js
//
// Die Akkreditasies-area se metadata: een POST met 'n aksie. Dieselfde patroon
// as gov.js (dokumente, sperdatums, vouers), met 'n aansoekregister in plaas
// van die besluiteregister, en instansies wat bygevoeg en hernoem kan word.
// TOEGANG: boekhouding-rol (sien _akk.js).

const { kry_store } = require("./_blob-store");
const G = require("./_akk");

const HERHAAL = ["", "jaarliks", "maandeliks"];
const HERINNER = ["30_7", "14_3", "geen"];
const STANDE = ["beplan", "ingedien", "in_behandeling", "geakkrediteer", "afgekeur", "verval"];
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
  const aansoeke = await G.lees_alles(G.STORE.aansoeke);
  const gekoppel = aansoeke.find((a) => a.dok_id === dok.id);
  if (gekoppel) return fout(400, "Die dokument is gekoppel aan aansoek " + gekoppel.no + ".");
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

// ---------- Aansoeke ----------

// A-JJJJ-NNN, volgens die jaar waarin die aansoek in die register kom.
function volgende_no(aansoeke, jaar) {
  let hoogste = 0;
  for (const a of aansoeke) {
    const m = /^A-(\d{4})-(\d{3,})$/.exec(a.no || "");
    if (m && m[1] === jaar) hoogste = Math.max(hoogste, Number(m[2]));
  }
  return "A-" + jaar + "-" + String(hoogste + 1).padStart(3, "0");
}

// Die aansoekregister. Anders as 'n besluit staan 'n aansoek nooit vas nie:
// sy stand verander soos die instansie reageer. Die nommer kom uit die jaar
// waarin die aansoek in die register kom en verander daarna nie.
async function aansoek_stoor(inv, gebruiker) {
  const store = kry_store(G.STORE.aansoeke);
  const vouers = await G.kry_vouers();
  const instansie = String(inv.instansie || "");
  if (!vouers.some((g) => g.id === instansie)) return fout(400, "Kies 'n instansie.");
  const kursus = skoon(inv.kursus, 200);
  if (!kursus) return fout(400, "Die kursus is verpligtend.");
  const stand = STANDE.includes(inv.stand) ? inv.stand : "beplan";
  for (const veld of ["ingedien", "geldig_tot"]) {
    if (inv[veld] && !G.is_datum(inv[veld])) return fout(400, "Ongeldige datum.");
  }
  const dok_id = inv.dok_id ? String(inv.dok_id) : "";
  if (dok_id && !(await kry_dok(dok_id))) return fout(400, "Die gekoppelde dokument bestaan nie.");

  let rekord = null;
  if (inv.no) {
    rekord = await store.get(String(inv.no), { type: "json" });
    if (!rekord) return fout(404, "Aansoek nie gevind nie.");
  } else {
    const almal = await G.lees_alles(G.STORE.aansoeke);
    rekord = { no: volgende_no(almal, G.vandag_sa().slice(0, 4)), geskep_op: G.nou_iso(), geskep_deur: wie(gebruiker), geskiedenis: [] };
  }
  if (rekord.stand && rekord.stand !== stand) {
    rekord.geskiedenis = Array.isArray(rekord.geskiedenis) ? rekord.geskiedenis : [];
    rekord.geskiedenis.push({ op: G.nou_iso(), deur: wie(gebruiker), van: rekord.stand, na: stand });
  }
  Object.assign(rekord, {
    instansie, kursus, stand,
    ingedien: inv.ingedien || "",
    geldig_tot: inv.geldig_tot || "",
    verwysing: skoon(inv.verwysing, 120),
    nota: skoon(inv.nota, 2000),
    dok_id,
    gewysig_op: G.nou_iso(), gewysig_deur: wie(gebruiker),
  });
  await store.setJSON(rekord.no, rekord);
  return G.json(200, { aansoek: rekord });
}

async function aansoek_skrap(inv) {
  const store = kry_store(G.STORE.aansoeke);
  const no = String(inv.no || "");
  const rekord = await store.get(no, { type: "json" });
  if (!rekord) return fout(404, "Aansoek nie gevind nie.");
  await store.delete(no);
  return G.json(200, { geskrap: no });
}

// ---------- Instansies (hoofvouers) ----------
// 'n Nuwe instansie kry die vier standaard-subvouers. Dit kry die volgende
// vrye nommer en staan onderaan, ná die gedeelde kursusmateriaal.
async function instansie_voeg_by(inv) {
  const vouers = await G.kry_vouers();
  const titel = skoon(inv.titel, 80);
  if (!titel) return fout(400, "Gee die instansie 'n naam.");
  let hoogste = 0;
  for (const g of vouers) hoogste = Math.max(hoogste, Number(g.id) || 0);
  const id = String(hoogste + 1).padStart(2, "0");
  if (Number(id) >= 70) return fout(400, "Te veel instansies.");
  const nuut = Object.assign(G.instansie(id, titel), { bygevoeg: true });
  vouers.push(nuut);
  await G.stoor_vouers(vouers);
  return G.json(200, { vouers, groep: nuut });
}

async function instansie_hernoem(inv) {
  const vouers = await G.kry_vouers();
  const g = vouers.find((x) => x.id === String(inv.id || ""));
  if (!g) return fout(404, "Instansie nie gevind nie.");
  const titel = skoon(inv.titel, 80);
  if (!titel) return fout(400, "Gee die instansie 'n naam.");
  g.titel = titel;
  await G.stoor_vouers(vouers);
  return G.json(200, { vouers });
}

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
  const [vouers, dokumente, sperdatums, aansoeke] = await Promise.all([
    G.kry_vouers(),
    G.lees_alles(G.STORE.dokumente),
    G.lees_alles(G.STORE.sperdatums),
    G.lees_alles(G.STORE.aansoeke),
  ]);
  return G.json(200, { vouers, dokumente, sperdatums, aansoeke, vandag: G.vandag_sa() });
}

const AKSIES = {
  lys, dok_wysig, dok_skuif, dok_argiveer, dok_herstel, dok_skrap,
  sper_stoor, sper_afhandel, sper_heropen, sper_skrap,
  aansoek_stoor, aansoek_skrap,
  instansie_voeg_by, instansie_hernoem,
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
    console.error("akk " + inv.aksie + " het misluk:", f);
    return fout(500, "Kon nie voltooi nie: " + ((f && f.message) || "onbekende fout"));
  }
};

// Vir toetse.
exports._volgende_datum = volgende_datum;
exports._volgende_no = volgende_no;
