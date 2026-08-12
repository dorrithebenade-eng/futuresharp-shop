// Gedeelde, suiwer logika vir 'n uitnodigingskakel se leeftyd. Geen
// Blob-toegang, geen event — net datums in en uit, sodat skep, kry,
// kry-alle en voltooi almal met DIESELFDE getal reken. Verskil een van
// hulle, is 'n skakel op die een skerm dood en op die ander lewendig.
//
// WAAROM DIE TERUGVAL OP geskep_op:
// Die uitnodigings wat voor hierdie verandering geskep is, het geen
// verval_op nie. Sonder die terugval sou hulle vir altyd bly leef —
// presies die probleem wat hier reggestel word. Met die terugval is
// elkeen van hulle onmiddellik dood, sonder dat iemand 'n ou rekord met
// die hand hoef aan te raak.

const UITNODIGING_GELDIG_DAE = 14;
const MS_PER_DAG = 24 * 60 * 60 * 1000;

function is_geldige_datum(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

// Die vervaldatum vir 'n NUWE uitnodiging, as ISO-string.
function nuwe_verval_op(vanaf) {
  const basis = vanaf ? new Date(vanaf) : new Date();
  const veilig = is_geldige_datum(basis) ? basis : new Date();
  return new Date(veilig.getTime() + UITNODIGING_GELDIG_DAE * MS_PER_DAG).toISOString();
}

// Die werklike vervaldatum van 'n BESTAANDE rekord: sy eie verval_op as
// hy een het, anders geskep_op plus dieselfde tydperk. null beteken daar
// is niks bruikbaars om mee te reken nie.
function verval_op_van(uitnodiging) {
  if (!uitnodiging) return null;

  if (uitnodiging.verval_op) {
    const eie = new Date(uitnodiging.verval_op);
    if (is_geldige_datum(eie)) return eie.toISOString();
  }

  if (uitnodiging.geskep_op) {
    const geskep = new Date(uitnodiging.geskep_op);
    if (is_geldige_datum(geskep)) return nuwe_verval_op(geskep);
  }

  return null;
}

function is_verval(uitnodiging, nou) {
  // 'n Voltooide uitnodiging verval nie. Haar werk is klaar en haar
  // waarde is nou die rekord van wie wanneer aangesluit het.
  if (uitnodiging && uitnodiging.status === "voltooi") return false;

  const verval = verval_op_van(uitnodiging);

  // Geen bruikbare datum nie: behandel as verval. 'n Rekord sonder
  // geskep_op is stukkend, en 'n stukkende rekord mag nie 'n permanente
  // sleutel na 'n vorm wees wat 'n inskrywing skep nie.
  if (!verval) return true;

  const tans = nou ? new Date(nou) : new Date();
  const punt = is_geldige_datum(tans) ? tans : new Date();
  return punt.getTime() >= new Date(verval).getTime();
}

module.exports = {
  UITNODIGING_GELDIG_DAE,
  nuwe_verval_op,
  verval_op_van,
  is_verval,
};
