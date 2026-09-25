// netlify/functions/wys-bankreel-toe.js
//
// Wys bankreels toe, of ontdoen 'n toewysing. Rol: boekhouding.
//
// Invoer: { sleutel, reels: [{ nr, aksie, kategorie_id?, nota? }] }
//
//   aksie "kategorie"  skep 'n joernaalinskrywing (bron "bank") met hierdie
//                      kategorie, gekoppel aan die reel
//   aksie "oordrag"    tussen eie rekeninge; geen joernaalinskrywing nie
//   aksie "ontdoen"    terug na oop; 'n inskrywing wat hiervoor geskep is, word
//                      uitgevee, en 'n pas word losgemaak
//
// DIE KATEGORIE SE RIGTING MOET DIE REEL S'N WEES. 'n Debiet onder 'n
// inkomstekategorie verskyn op die staat aan die verkeerde kant.
//
// Alles word eers nagegaan en dan geskryf: 'n fout in reel 5 keer ook reel 1
// tot 4, sodat 'n halwe groep nie in die joernaal agterbly nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_joernaal_store, skep_sleutel, nuwe_inskrywing } = require("./_joernaal");
const B = require("./_bankstate");

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
  const opdragte = Array.isArray(invoer.reels) ? invoer.reels.slice(0, 1000) : [];
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

  // ── Nagaan ─────────────────────────────────────────────────────────
  const plan = [];
  for (const o of opdragte) {
    const r = (staat.reels || []).find((x) => x.nr === Number(o.nr));
    if (!r) return { statusCode: 400, body: `Reël ${o.nr} bestaan nie` };
    if (r.stand === "inligting") return { statusCode: 400, body: `Reël ${o.nr} is 'n inligtingsreël en word nie geboek nie` };
    if (o.aksie === "kategorie") {
      if (r.stand === "toegewys" || r.stand === "gepas") {
        return { statusCode: 409, body: `Reël ${o.nr} is reeds verklaar. Ontdoen dit eers.` };
      }
      const k = kats.get(String(o.kategorie_id || ""));
      if (!k) return { statusCode: 400, body: `Kies 'n kategorie vir reël ${o.nr}` };
      if ((k.rigting === "in" ? "in" : "uit") !== r.rigting) {
        return {
          statusCode: 409,
          body: `Reël ${o.nr} is ${r.rigting === "in" ? "'n inbetaling" : "'n uitbetaling"}, maar die kategorie is ${k.rigting === "in" ? "inkomste" : "'n uitgawe"}.`,
        };
      }
      plan.push({ r, o, k });
    } else if (o.aksie === "oordrag") {
      if (r.stand === "toegewys" || r.stand === "gepas") {
        return { statusCode: 409, body: `Reël ${o.nr} is reeds verklaar. Ontdoen dit eers.` };
      }
      plan.push({ r, o });
    } else if (o.aksie === "ontdoen") {
      plan.push({ r, o });
    } else {
      return { statusCode: 400, body: "Onbekende aksie" };
    }
  }

  // ── Skryf ──────────────────────────────────────────────────────────
  const jstore = kry_joernaal_store();
  const nou = new Date().toISOString();
  try {
    for (const { r, o, k } of plan) {
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
        };
        await jstore.setJSON(inskrywing.sleutel, inskrywing);
        r.stand = "toegewys";
        r.kategorie_id = k.id;
        r.joernaal_sleutel = inskrywing.sleutel;
        r.nota = inskrywing.nota;
      } else if (o.aksie === "oordrag") {
        r.stand = "oordrag";
        r.kategorie_id = "";
      } else {
        if (r.stand === "toegewys" && r.joernaal_sleutel) await jstore.delete(r.joernaal_sleutel);
        r.stand = "oop";
        r.pas = null;
        r.kategorie_id = "";
        r.joernaal_sleutel = "";
      }
      r.bygewerk_op = nou;
      r.bygewerk_deur = gebruiker.email || "";
    }
    await store.setJSON(staat.sleutel, staat);
  } catch (fout) {
    // Die staat word laaste geskryf. Misluk dit, kan 'n joernaalinskrywing
    // sonder sy reel bestaan; die log se watter een.
    console.error("Toewysing onvolledig:", fout);
    return { statusCode: 500, body: "Die toewysing is nie volledig gestoor nie. Herlaai en kyk na die stand van die reëls." };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staat }),
  };
};
