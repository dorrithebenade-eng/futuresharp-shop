// netlify/functions/wys-bankreel-toe.js
// Weergawe 8 (16 Oktober 2026): AKSIE "pas" { nr, aksie: "pas", ref }. Die
// banktransaksie word gepas teen 'n faktuur se ontvangs of 'n uitbetaling
// (sien _faktuur-pas.js), in plaas van 'n eie kategorie te kry. Was dit reeds
// toegewys, gaan daardie bankinskrywing uit die joernaal; die faktuur se eie
// inskrywing dra die geld. Bedrag en rigting word hier weer nagegaan, en een
// faktuurref word nooit aan twee banktransaksies gepas nie. 'n Transaksie met
// bewyse word nie so verander nie; die bewyse sou saam met die inskrywing
// verdwyn.
//
// Weergawe 7 (16 Oktober 2026): WEESKINDERS. Netlify se stoor gee soms vir
// 'n oomblik 'n ou weergawe van 'n staat terug. Is 'n reel intussen reeds
// toegewys (bv. deur die soortgelyk-reel uit 'n ander staat) en bevestig
// iemand dit op 'n skerm wat dit nog as oop wys, kon daar twee
// joernaalinskrywings vir een bankreel ontstaan; die eerste het dan geen reel
// meer nie en is dubbel getel (Junie 2025: FNB-bankkoste R23 twee keer). Elke
// toewysing en ontdoening vee nou ook elke ander inskrywing uit wat na
// dieselfde bankreel wys. Om 'n bestaande dubbeling reg te stel: ontdoen die
// reel en wys dit weer toe.
//
// Weergawe 6 (16 Oktober 2026): SOORTGELYK OOR ALLE STATE. 'n Kategorie wat
// met die hand gekies word (`soortgelyk: true`), gaan ook na elke oop of
// voorgestelde transaksie in die ANDER state met dieselfde rigting en patroon,
// solank daardie state dieselfde soort is (regte by regte, toets by toets).
// Wat reeds toegewys, gepas of oordrag is, word nooit aangeraak nie, en 'n
// regstelling versprei steeds nie. Die antwoord se `ekstra_ander` tel hulle.
//
// Weergawe 5 (16 Oktober 2026): die antwoord dra die voorstelle soos
// kry-bankstate dit by die lees maak, sodat die oorblywende voorstelle op die
// skerm bly staan na 'n bevestiging. Die stoor self bly onveranderd.
// Weergawe 4 (28 September 2026): bewyse. 'n Regstelling na 'n ander
// kategorie neem die bewyse na die nuwe inskrywing oor; ontdoen, of 'n
// regstelling na oordrag (wat geen inskrywing het nie), vee hulle uit.
//
// Wys bankreels toe, of ontdoen 'n toewysing. Rol: boekhouding.
//
// Invoer: { sleutel, reels: [{ nr, aksie, kategorie_id?, nota? }], soortgelyk? }
//
//   aksie "kategorie"  skep 'n joernaalinskrywing (bron "bank") met hierdie
//                      kategorie, gekoppel aan die reel. Is die reel reeds
//                      toegewys, word die ou inskrywing in dieselfde stap
//                      vervang: 'n regstelling sonder eers te ontdoen.
//   aksie "oordrag"    tussen eie rekeninge; geen joernaalinskrywing nie
//   aksie "ontdoen"    terug na oop; 'n inskrywing wat hiervoor geskep is, word
//                      uitgevee, en 'n pas word losgemaak
//
// SOORTGELYKE REELS (25 September 2026). Met `soortgelyk: true` kry elke ander
// reel in dieselfde staat wat nog OOP of net VOORGESTEL is, met dieselfde
// rigting en dieselfde patroon (die beskrywing sonder syfers), dieselfde aksie.
// Wat reeds gepas of toegewys is, word nie aangeraak nie; en 'n REGSTELLING
// van 'n toegewysde reel versprei nie, sodat dit nie ongemerk ander reels
// verander nie.
//
// DIE KATEGORIE SE RIGTING MOET DIE REEL S'N WEES. 'n Debiet onder 'n
// inkomstekategorie verskyn op die staat aan die verkeerde kant.
//
// Alles word eers nagegaan en dan geskryf: 'n fout in reel 5 keer ook reel 1
// tot 4, sodat 'n halwe groep nie in die joernaal agterbly nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_joernaal_store, skep_sleutel, nuwe_inskrywing, finansiele_jaar, jaar_voorvoegsel } = require("./_joernaal");

// bankreel-verwysing -> [joernaalsleutels], per finansiele jaar een keer gelees.
function maak_indeks(jstore) {
  const jare = new Map();
  async function vir(datum) {
    const jaar = finansiele_jaar(datum);
    if (!jare.has(jaar)) {
      const kaart = new Map();
      const { blobs } = await jstore.list({ prefix: jaar_voorvoegsel(jaar) });
      const ink = await Promise.all((blobs || []).map((b) => jstore.get(b.key, { type: "json" })));
      ink.filter((x) => x && x.bankreel).forEach((x) => {
        const l = kaart.get(x.bankreel) || [];
        l.push(x.sleutel);
        kaart.set(x.bankreel, l);
      });
      jare.set(jaar, kaart);
    }
    return jare.get(jaar);
  }
  // Vee elke inskrywing vir `ref` uit behalwe `behou`.
  async function vee_ander(datum, ref, behou) {
    const kaart = await vir(datum);
    const sleutels = (kaart.get(ref) || []).filter((k) => k !== behou);
    for (const k of sleutels) {
      await vee_uit_vir_joernaal(jstore, k);
      await jstore.delete(k);
      await vee_uit_vir_inskrywing(k);
    }
    kaart.set(ref, behou ? [behou] : []);
    return sleutels.length;
  }
  return { vee_ander };
}
// Weergawe 3 (25 September 2026): 'n inskrywing wat hier weggaan, neem sy
// koppeling aan 'n toekenning saam (sien _koppelings.js).
const { vee_uit_vir_inskrywing } = require("./_koppelings");
const B = require("./_bankstate");
const FP = require("./_faktuur-pas");
const { vee_lys_uit, vee_uit_vir_joernaal, kort_lys } = require("./_bewysstukke");

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
  const sleutel = String(invoer.sleutel || "");
  let opdragte = Array.isArray(invoer.reels) ? invoer.reels.slice(0, 1000) : [];
  if (!sleutel || !opdragte.length) return { statusCode: 400, body: "Niks om toe te wys nie" };

  const store = B.kry_bankstate_store();
  let staat;
  let kats;
  try {
    staat = await store.get(sleutel, { type: "json" });
    const ks = kry_store("fin-kategoriee");
    const { blobs } = await ks.list();
    kats = new Map((await Promise.all((blobs || []).map((b) => ks.get(b.key, { type: "json" }))))
      .filter(Boolean).map((k) => [k.id, k]));
    // Die vaste twee bestaan dalk nie in die store nie.
    if (!kats.has("diensinkomste")) kats.set("diensinkomste", { id: "diensinkomste", rigting: "in" });
    if (!kats.has("paystack-transaksiefooi")) kats.set("paystack-transaksiefooi", { id: "paystack-transaksiefooi", rigting: "uit" });
  } catch (fout) {
    console.error("Kon nie lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die staat laai nie" };
  }
  if (!staat) return { statusCode: 404, body: "Staat nie gevind nie" };

  // -- Soortgelyke reels byvoeg ---------------------------------------
  let ekstra = 0;
  const versprei = [];   // { rigting, p, o } vir die ander state
  if (invoer.soortgelyk === true) {
    const gedek = new Set(opdragte.map((o) => Number(o.nr)));
    const by = [];
    opdragte.forEach((o) => {
      if (o.aksie !== "kategorie" && o.aksie !== "oordrag") return;
      const r = (staat.reels || []).find((x) => x.nr === Number(o.nr));
      if (!r || r.stand === "toegewys" || r.stand === "oordrag") return;   // 'n regstelling versprei nie
      const p = B.patroon(r.beskrywing);
      if (!p) return;
      versprei.push({ rigting: r.rigting, p, o: { aksie: o.aksie, kategorie_id: o.kategorie_id, nota: o.nota } });
      (staat.reels || []).forEach((x) => {
        if (gedek.has(x.nr)) return;
        if (x.stand !== "oop" && x.stand !== "voorstel") return;
        if (x.rigting !== r.rigting || B.patroon(x.beskrywing) !== p) return;
        gedek.add(x.nr);
        by.push({ ...o, nr: x.nr });
      });
    });
    ekstra = by.length;
    opdragte = opdragte.concat(by);
  }

  // -- Nagaan ---------------------------------------------------------
  const plan = [];
  let fp_kand = null;
  let fp_gebruik = null;
  for (const o of opdragte) {
    const r = (staat.reels || []).find((x) => x.nr === Number(o.nr));
    if (!r) return { statusCode: 400, body: `Transaksie ${o.nr} bestaan nie` };
    if (r.stand === "inligting") return { statusCode: 400, body: `Transaksie ${o.nr} is 'n kennisgewing van die bank en word nie geboek nie` };
    if (o.aksie === "kategorie") {
      if (r.stand === "gepas") {
        return { statusCode: 409, body: `Transaksie ${o.nr} is reeds verklaar. Ontdoen dit eers.` };
      }
      const k = kats.get(String(o.kategorie_id || ""));
      if (!k) return { statusCode: 400, body: `Kies 'n kategorie vir transaksie ${o.nr}` };
      if ((k.rigting === "in" ? "in" : "uit") !== r.rigting) {
        return {
          statusCode: 409,
          body: `Transaksie ${o.nr} is ${r.rigting === "in" ? "'n inbetaling" : "'n uitbetaling"}, maar die kategorie is ${k.rigting === "in" ? "inkomste" : "'n uitgawe"}.`,
        };
      }
      plan.push({ r, o, k });
    } else if (o.aksie === "oordrag") {
      if (r.stand === "gepas") {
        return { statusCode: 409, body: `Transaksie ${o.nr} is reeds verklaar. Ontdoen dit eers.` };
      }
      plan.push({ r, o });
    } else if (o.aksie === "ontdoen") {
      plan.push({ r, o });
    } else if (o.aksie === "pas") {
      if (r.stand === "gepas") {
        return { statusCode: 409, body: `Transaksie ${o.nr} is reeds gepas.` };
      }
      if (Array.isArray(r.dokumente) && r.dokumente.length) {
        return { statusCode: 409, body: `Transaksie ${o.nr} het bewyse. Verwyder hulle eers, of heg hulle by die faktuur aan.` };
      }
      try {
        if (!fp_kand) {
          fp_kand = await FP.kandidate();
          const almal = await B.lees_almal(store);
          fp_gebruik = FP.gebruik(almal.filter((x) => x.sleutel !== staat.sleutel).concat([staat]));
        }
      } catch (fout) {
        console.error("Kon nie die fakture lees nie:", fout);
        return { statusCode: 500, body: "Kon nie die fakture lees nie" };
      }
      const kd = fp_kand.find((x) => x.ref === String(o.ref || ""));
      if (!kd) return { statusCode: 400, body: `Die faktuur vir transaksie ${o.nr} is nie gevind nie.` };
      if (kd.rigting !== r.rigting || kd.bedrag_sent !== r.bedrag_sent) {
        return { statusCode: 409, body: `Transaksie ${o.nr} se bedrag of rigting klop nie met ${kd.beskrywing} nie.` };
      }
      if (fp_gebruik.has(kd.ref)) {
        return { statusCode: 409, body: `${kd.beskrywing} is reeds aan 'n ander banktransaksie gepas.` };
      }
      fp_gebruik.add(kd.ref);
      plan.push({ r, o, kd });
    } else {
      return { statusCode: 400, body: "Onbekende aksie" };
    }
  }

  // -- Skryf ----------------------------------------------------------
  const jstore = kry_joernaal_store();
  const nou = new Date().toISOString();
  try {
    const indeks = maak_indeks(jstore);
    for (const { r, o, k, kd } of plan) {
      // 'n Regstelling: die ou inskrywing gaan eers weg. Sy bewyse word eers
      // gelees, sodat 'n nuwe kategorie hulle kan oorneem.
      let ou_bewyse = [];
      if ((o.aksie === "kategorie" || o.aksie === "oordrag") && r.stand === "toegewys" && r.joernaal_sleutel) {
        try {
          const ou = await jstore.get(r.joernaal_sleutel, { type: "json" });
          ou_bewyse = (ou && Array.isArray(ou.dokumente)) ? ou.dokumente : [];
        } catch (fout) {
          console.error(`Kon nie die bewyse van ${r.joernaal_sleutel} lees nie:`, fout);
        }
        await jstore.delete(r.joernaal_sleutel);
        await vee_uit_vir_inskrywing(r.joernaal_sleutel);
        r.joernaal_sleutel = "";
      }
      if (o.aksie === "kategorie") {
        const inskrywing = {
          ...nuwe_inskrywing(),
          sleutel: skep_sleutel(r.datum),
          datum: r.datum,
          beskrywing: r.beskrywing || "Bankreel",
          bedrag_sent: r.bedrag_sent,
          rigting: r.rigting,
          kategorie_id: k.id,
          nota: String(o.nota || "").slice(0, 500),
          geskep_deur: gebruiker.email || "",
          bron: "bank",
          bankreel: B.verw(staat.sleutel, r.nr),
          toets: staat.toets === true,
          dokumente: ou_bewyse,
        };
        await jstore.setJSON(inskrywing.sleutel, inskrywing);
        r.stand = "toegewys";
        r.kategorie_id = k.id;
        r.joernaal_sleutel = inskrywing.sleutel;
        r.nota = inskrywing.nota;
        r.dokumente = kort_lys(ou_bewyse);
      } else if (o.aksie === "oordrag") {
        await vee_lys_uit(ou_bewyse);
        r.stand = "oordrag";
        r.kategorie_id = "";
        r.dokumente = [];
      } else if (o.aksie === "pas") {
        // Die bankinskrywing (as daar een was) gaan hieronder saam met enige
        // weeskind uit die joernaal: vee_ander behou niks vir hierdie reel nie.
        r.stand = "gepas";
        r.pas = { soort: kd.soort, ref: kd.ref, beskrywing: kd.beskrywing };
        r.kategorie_id = "";
        r.voorstel_kategorie = "";
        r.joernaal_sleutel = "";
        r.nota = "";
        r.dokumente = [];
      } else {
        if (r.stand === "toegewys" && r.joernaal_sleutel) {
          await vee_uit_vir_joernaal(jstore, r.joernaal_sleutel);
          await jstore.delete(r.joernaal_sleutel);
          await vee_uit_vir_inskrywing(r.joernaal_sleutel);
        }
        r.stand = "oop";
        r.pas = null;
        r.kategorie_id = "";
        r.joernaal_sleutel = "";
        r.dokumente = [];
      }
      r.bygewerk_op = nou;
      r.bygewerk_deur = gebruiker.email || "";
      try {
        const weg = await indeks.vee_ander(r.datum, B.verw(staat.sleutel, r.nr), r.joernaal_sleutel || "");
        if (weg) console.log(`${weg} weeskind(ers) vir ${staat.sleutel}#${r.nr} uitgevee`);
      } catch (fout) {
        console.error(`Kon nie weeskinders vir ${staat.sleutel}#${r.nr} nagaan nie:`, fout);
      }
    }
    await store.setJSON(staat.sleutel, staat);
  } catch (fout) {
    // Die staat word laaste geskryf. Misluk dit, kan 'n joernaalinskrywing
    // sonder sy reel bestaan; die log se watter een.
    console.error("Toewysing onvolledig:", fout);
    return { statusCode: 500, body: "Die toewysing is nie volledig gestoor nie. Herlaai en kyk na die stand van die transaksies." };
  }

  // -- Die ander state ------------------------------------------------
  // Elke staat word apart geskryf. Misluk een, bly die vorige staan en die
  // toewysing in hierdie staat is reeds klaar; die log se watter een.
  let ander = [];
  let ekstra_ander = 0;
  try {
    ander = (await B.lees_almal(store)).filter((x) => x.sleutel !== staat.sleutel);
  } catch (fout) {
    console.error("Kon nie die ander state lees nie:", fout);
  }
  if (versprei.length) {
    const soort = staat.toets === true;
    const indeks2 = maak_indeks(jstore);
    for (const s2 of ander) {
      if ((s2.toets === true) !== soort) continue;
      let verander = false;
      for (const r of s2.reels || []) {
        if (r.stand !== "oop" && r.stand !== "voorstel") continue;
        const v = versprei.find((x) => x.rigting === r.rigting && x.p === B.patroon(r.beskrywing));
        if (!v) continue;
        try {
          if (v.o.aksie === "kategorie") {
            const inskrywing = {
              ...nuwe_inskrywing(),
              sleutel: skep_sleutel(r.datum),
              datum: r.datum,
              beskrywing: r.beskrywing || "Bankreel",
              bedrag_sent: r.bedrag_sent,
              rigting: r.rigting,
              kategorie_id: v.o.kategorie_id,
              nota: String(v.o.nota || "").slice(0, 500),
              geskep_deur: gebruiker.email || "",
              bron: "bank",
              bankreel: B.verw(s2.sleutel, r.nr),
              toets: s2.toets === true,
              dokumente: [],
            };
            await jstore.setJSON(inskrywing.sleutel, inskrywing);
            r.stand = "toegewys";
            r.kategorie_id = v.o.kategorie_id;
            r.joernaal_sleutel = inskrywing.sleutel;
            r.nota = inskrywing.nota;
          } else {
            r.stand = "oordrag";
            r.kategorie_id = "";
          }
          r.voorstel_kategorie = "";
          r.dokumente = [];
          r.bygewerk_op = nou;
          r.bygewerk_deur = gebruiker.email || "";
          verander = true;
          ekstra_ander += 1;
          await indeks2.vee_ander(r.datum, B.verw(s2.sleutel, r.nr), r.joernaal_sleutel || "");
        } catch (fout) {
          console.error(`Kon nie ${s2.sleutel}#${r.nr} toewys nie:`, fout);
        }
      }
      if (verander) {
        try {
          await store.setJSON(s2.sleutel, s2);
        } catch (fout) {
          console.error(`Kon nie ${s2.sleutel} stoor nie:`, fout);
        }
      }
    }
  }

  // Die voorstelle vir die antwoord. Misluk die lees, gaan die staat sonder
  // voorstelle terug; die toewysing self is reeds gestoor.
  let antwoord = staat;
  try {
    const kaart = B.voorstel_kaart(ander.concat([staat]).filter((x) => x.toets !== true));
    let met_pas = staat;
    if (staat.toets !== true) {
      try {
        const kand = fp_kand || await FP.kandidate();
        met_pas = { ...staat, reels: FP.stel_voor(staat.reels, kand, FP.gebruik(ander.concat([staat]))) };
      } catch (fout) {
        console.error("Kon nie die faktuurvoorstelle bereken nie:", fout);
      }
    }
    antwoord = B.voeg_voorstelle(met_pas, kaart);
  } catch (fout) {
    console.error("Kon nie die voorstelle bereken nie:", fout);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staat: antwoord, ekstra, ekstra_ander }),
  };
};
