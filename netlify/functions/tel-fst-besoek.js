// PUBLIEK — tel een besoek aan FutureSharp Talks. Die FST-blad, 'n talk se
// eie bladsy en die teater roep dit, maar die blaaier stuur dit net een
// keer per besoek (sien fst_tel_besoek in fst-gedeel.js), sodat iemand
// wat van die tuisblad na drie talks klik as een besoeker tel.
//
// Dieselfde vier syfers as die winkel se teller, onder "fst-"-sleutels.

const { AFDELINGS, tel_besoek } = require("./_besoek-teller");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  await tel_besoek(AFDELINGS.fst);
  return { statusCode: 204, body: "" };
};
