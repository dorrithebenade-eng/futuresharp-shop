// netlify/functions/gov-laai-op.js
//
// Laai 'n dokument op na die Governance-area. Dieselfde patroon as
// laai-dokument-op.js: die lêer gaan in "gov-leers" en 'n JSON-rekord met die
// metadata in "gov-dokumente", onder dieselfde sleutel. Die lys laai dus
// sonder om enige lêer se inhoud te haal.
//
// TOEGANG: boekhouding-rol (sien _gov.js).
//
// DIE PERK IS 4 MB. Netlify se Functions aanvaar 'n liggaam van hoogstens
// 6 MB, en base64 maak 'n lêer 'n derde groter: 4 MB word sowat 5,4 MB.
//
// Liggaam (JSON): { naam, vouer, dokument_datum?, nota?, lêernaam, inhoud_tipe, data_base64 }

const { kry_store } = require("./_blob-store");
const G = require("./_gov");

const MAKS_GROOTTE_GREPE = 4 * 1024 * 1024;

const TOEGELATE_TIPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "image/jpeg": "jpg",
  "image/png": "png",
  "text/csv": "csv",
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return G.json(405, { fout: "Metode nie toegelaat nie" });

  const toegang = await G.kontroleer(event, context);
  if (toegang.antwoord) return toegang.antwoord;

  let inv;
  try {
    inv = JSON.parse(event.body || "{}");
  } catch {
    return G.json(400, { fout: "Ongeldige JSON" });
  }

  const naam = String(inv.naam || "").trim().slice(0, 200);
  const vouer = String(inv.vouer || "");
  const inhoud_tipe = String(inv.inhoud_tipe || "");
  const lêernaam = String(inv["lêernaam"] || "").trim().slice(0, 200);

  if (!naam) return G.json(400, { fout: "Die naam is verpligtend." });
  if (!inv.data_base64) return G.json(400, { fout: "Geen lêer ontvang nie." });
  if (!TOEGELATE_TIPES[inhoud_tipe]) {
    return G.json(400, { fout: "Slegs PDF, Word, Excel, PowerPoint, CSV, JPG of PNG." });
  }
  if (inv.dokument_datum && !G.is_datum(inv.dokument_datum)) return G.json(400, { fout: "Ongeldige datum." });

  const vouers = await G.kry_vouers();
  if (!G.geldige_vouer_ids(vouers).has(vouer) || vouer === G.ARGIEF) {
    return G.json(400, { fout: "Kies 'n vouer." });
  }

  let buffer;
  try {
    buffer = Buffer.from(inv.data_base64, "base64");
  } catch {
    return G.json(400, { fout: "Die lêer kon nie gelees word nie." });
  }
  if (!buffer.length) return G.json(400, { fout: "Die lêer is leeg." });
  if (buffer.length > MAKS_GROOTTE_GREPE) return G.json(413, { fout: "Die lêer is groter as 4 MB." });

  const uitbreiding = TOEGELATE_TIPES[inhoud_tipe];
  const id = G.nuwe_id("D");
  const nou = G.nou_iso();
  const deur = (toegang.gebruiker && toegang.gebruiker.email) || "onbekend";

  const rekord = {
    id,
    naam,
    "lêernaam": lêernaam || naam + "." + uitbreiding,
    uitbreiding,
    inhoud_tipe,
    grootte: buffer.length,
    vouer,
    dokument_datum: inv.dokument_datum || "",
    nota: String(inv.nota || "").trim().slice(0, 1000),
    opgelaai_op: nou,
    opgelaai_deur: deur,
    gewysig_op: nou,
    geskiedenis: [{ op: nou, deur, aksie: "opgelaai", na: vouer }],
  };

  try {
    // Die lêer eerste. Misluk die rekord daarna, is daar 'n weeslêer wat
    // niemand sien nie; andersom sou daar 'n rekord wees sonder lêer.
    await kry_store(G.STORE.leers).set(id, buffer, { metadata: { inhoud_tipe } });
    await kry_store(G.STORE.dokumente).setJSON(id, rekord);
  } catch (f) {
    console.error("Governance-oplaai het misluk:", f);
    return G.json(500, { fout: "Kon nie stoor nie." });
  }

  return G.json(200, { dokument: rekord });
};
