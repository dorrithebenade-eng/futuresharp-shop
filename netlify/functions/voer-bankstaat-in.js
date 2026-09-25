// netlify/functions/voer-bankstaat-in.js
//
// Voer een gelese FNB-staat in. Rol: boekhouding.
//
// DIE BLAAIER LEES, DIE BEDIENER KONTROLEER WEER. Die PDF verlaat nooit die
// rekenaar nie; wat hier aankom, is die reels wat bankstaat-fnb.js uitgehaal
// het. Die saldo-ketting word hier van voor af nagereken: 'n staat wat nie
// van die opening tot die sluitsaldo klop nie, word nie gestoor nie, ongeag
// wat die blaaier gese het.
//
// DRIE WEIERINGS
//
//   'n Ander rekening as Future Sharp s'n, tensy dit 'n toetsstaat is.
//   'n Tydperk wat 'n reeds ingevoerde staat van dieselfde rekening
//     oorvleuel (net teen ander regte state; toetse oorvleuel vrylik).
//   Presies dieselfde staat twee keer.
//
// DIE OUTOMATIESE PAS, in hierdie volgorde, en elke vereffening of
// joernaalinskrywing net een keer:
//
//   1. 'n Krediet wat presies gelyk is aan 'n Paystack-uitbetaling na die
//      hoofrekening (status success), binne vier dae: verklaar deur Paystack.
//      Die joernaal boek daardie geld reeds bruto, met die fooi apart.
//   2. 'n Reel wat met 'n handinskrywing in die joernaal ooreenstem: dieselfde
//      rigting en bedrag, binne drie dae.
//   3. Die FNB-fooireels: voorstel Bankkoste.
//   4. Die res: voorstel uit vorige toewysings met dieselfde patroon.
//
// 'N TOETSSTAAT WORD NIE GEPAS NIE. Dit kom van 'n ander rekening en mag nie
// 'n werklike vereffening of inskrywing opgebruik nie; dit kry net voorstelle.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { finansiele_jaar, jaar_voorvoegsel: jn_jaar } = require("./_joernaal");
const { jaar_voorvoegsel: vf_jaar } = require("./_vereffenings");
const B = require("./_bankstate");

function heel(n) {
  const x = Number(n);
  return Number.isInteger(x) ? x : null;
}

async function lees_prefix(store, voorvoegsels) {
  const blobs = [];
  for (const p of voorvoegsels) {
    const lys = await store.list({ prefix: p });
    (lys.blobs || []).forEach((b) => blobs.push(b));
  }
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const toets = invoer.toets === true;
  const st = invoer.staat || {};
  const rekening4 = String((st.rekening && st.rekening.nommer) || "").replace(/\D/g, "").slice(-4);
  const van = String((st.tydperk && st.tydperk.van) || "");
  const tot = String((st.tydperk && st.tydperk.tot) || "");
  const opening = heel(st.opening_sent);
  const sluit = heel(st.sluit_sent);
  const lyne = Array.isArray(st.transaksies) ? st.transaksies.slice(0, 1000) : [];

  if (!rekening4 || !/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot) ||
      opening === null || sluit === null || !lyne.length) {
    return { statusCode: 400, body: "Die staat is onvolledig." };
  }
  if (!toets && !B.EIE_REKENINGE.includes(rekening4)) {
    return {
      statusCode: 409,
      body: `Hierdie staat is van rekening …${rekening4}, nie Future Sharp se rekening nie. Merk dit as toetsstaat om dit te toets.`,
    };
  }

  // ── Die ketting, van voor af ────────────────────────────────────────
  let loop = opening;
  const reels = [];
  for (let n = 0; n < lyne.length; n++) {
    const l = lyne[n];
    const bedrag = heel(l.bedrag_sent);
    const saldo = heel(l.saldo_sent);
    const rigting = l.rigting === "in" ? "in" : "uit";
    if (bedrag === null || bedrag < 0 || saldo === null || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.datum))) {
      return { statusCode: 400, body: `Reël ${n + 1} is onvolledig.` };
    }
    loop += rigting === "in" ? bedrag : -bedrag;
    if (Math.abs(loop) !== saldo) {
      return { statusCode: 409, body: `Die saldo-ketting klop nie by reël ${n + 1}. Niks is gestoor nie.` };
    }
    reels.push({
      nr: n + 1,
      datum: String(l.datum),
      beskrywing: String(l.beskrywing || "").slice(0, 200),
      verwysing: String(l.verwysing || "").slice(0, 120),
      bedrag_sent: bedrag,
      rigting,
      saldo_sent: loop,
      fnb_fooi: l.fnb_fooi === true,
      stand: bedrag === 0 ? "inligting" : "oop",
      pas: null,
      voorstel_kategorie: "",
      kategorie_id: "",
      joernaal_sleutel: "",
      nota: "",
    });
  }
  if (loop !== sluit) {
    return { statusCode: 409, body: "Die reëls tel nie tot die sluitsaldo op nie. Niks is gestoor nie." };
  }

  const store = B.kry_bankstate_store();
  const sleutel = (toets ? "B-T" : "B-") + B.skep_sleutel(rekening4, van).slice(2);

  let state;
  try {
    if (await store.get(sleutel, { type: "json" })) {
      return { statusCode: 409, body: "Hierdie staat is reeds ingevoer." };
    }
    state = await B.lees_almal(store);
  } catch (fout) {
    console.error("Kon nie die bankstate lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die bankstate laai nie" };
  }

  const regte = state.filter((s) => !s.toets);
  if (!toets) {
    const bots = regte.find((s) => s.rekening4 === rekening4 && s.van <= tot && s.tot >= van);
    if (bots) {
      return {
        statusCode: 409,
        body: `Hierdie tydperk oorvleuel met die staat van ${bots.van} tot ${bots.tot} wat reeds ingevoer is.`,
      };
    }
  }

  // ── Pas ─────────────────────────────────────────────────────────────
  const gebruik = B.gebruikte_verwysings(regte);
  const kaart = B.voorstel_kaart(regte);

  let bankkoste = "";
  try {
    const ks = kry_store("fin-kategoriee");
    const { blobs } = await ks.list();
    const kats = (await Promise.all((blobs || []).map((b) => ks.get(b.key, { type: "json" })))).filter(Boolean);
    const k = kats.find((x) => x.aktief !== false && x.rigting === "uit" && /bankkoste/i.test(x.naam || ""));
    bankkoste = k ? k.id : "";
  } catch (fout) {
    console.error("Kon nie die kategoriee lees nie:", fout);
  }

  if (!toets) {
    const jare = [...new Set([finansiele_jaar(van), finansiele_jaar(tot)])].filter((j) => j !== null);
    let vereffenings = [];
    let hand = [];
    try {
      vereffenings = (await lees_prefix(kry_store("vereffenings"), jare.map(vf_jaar)))
        .filter((v) => v.is_hoofrekening && v.status === "success" && !gebruik.vereffenings.has(v.sleutel));
      hand = (await lees_prefix(kry_store("joernaal"), jare.map(jn_jaar)))
        .filter((j) => j.bron !== "bank" && !gebruik.joernaal.has(j.sleutel));
    } catch (fout) {
      console.error("Kon nie vir die pas lees nie:", fout);
      return { statusCode: 500, body: "Kon nie die vereffenings of die joernaal lees nie. Niks is gestoor nie." };
    }

    reels.forEach((r) => {
      if (r.stand !== "oop") return;
      if (r.rigting === "in") {
        const v = vereffenings.find((x) => x.netto_sent === r.bedrag_sent && B.dae_tussen(x.datum, r.datum) <= 4);
        if (v) {
          r.stand = "gepas";
          r.pas = { soort: "vereffening", ref: v.sleutel };
          vereffenings = vereffenings.filter((x) => x !== v);
          return;
        }
      }
      const j = hand.find((x) =>
        (x.rigting === "in" ? "in" : "uit") === r.rigting &&
        Number(x.bedrag_sent) === r.bedrag_sent &&
        B.dae_tussen(x.datum, r.datum) <= 3);
      if (j) {
        r.stand = "gepas";
        r.pas = { soort: "joernaal", ref: j.sleutel };
        hand = hand.filter((x) => x !== j);
      }
    });
  }

  reels.forEach((r) => {
    if (r.stand !== "oop") return;
    if (r.fnb_fooi) {
      r.stand = "voorstel";
      r.voorstel_kategorie = bankkoste;
      return;
    }
    const vk = kaart.get(r.rigting + "|" + B.patroon(r.beskrywing));
    if (vk) {
      r.stand = "voorstel";
      r.voorstel_kategorie = vk;
    }
  });

  const rekord = {
    sleutel,
    bank: "FNB",
    rekening4,
    rekening_naam: String((st.rekening && st.rekening.naam) || "").slice(0, 80),
    van,
    tot,
    opening_sent: opening,
    sluit_sent: sluit,
    toets,
    reels,
    ingevoer_op: new Date().toISOString(),
    ingevoer_deur: gebruiker.email || "",
  };

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error("Kon nie die staat stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die staat stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staat: rekord }),
  };
};
