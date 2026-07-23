// Gedeelde helper: verifieer Netlify Identity-gebruiker se rol bediener-kant.
//
// BELANGRIK: rolkontrole gebeur HIER (bediener-kant), nie net in die
// front-end nie — front-end-versteekte knoppies kan omseil word via
// blaaier-ontwikkelaarnutsgoed, maar 'n Function wat weier om te reageer
// kan nie omseil word nie.
//
// AGTERGROND (Julie 2026): Netlify se OUTOMATIESE Identity-konteks-
// inspuiting (context.clientContext.user) het dieselfde tipe
// onbetroubaarheid getoon as hulle Blobs-konteks-inspuiting — dit werk
// soms nie op vars, korrek-opgestelde werwe nie. In plaas daarvan om
// daarop te vertrou, verifieer ons die JWT HIER self, direk teen Netlify
// se onderliggende Identity-API (GoTrue) — dieselfde patroon wat
// public/js/identiteit.js reeds gebruik i.p.v. die onbetroubare widget.
// Dit kos een ekstra HTTP-versoek per beskermde oproep, maar is
// heeltemal onafhanklik van Netlify se outo-inspuitingsprobleem.
//
// Gebruik: elke beskermde Function roep AWAIT kry_gebruiker_en_kontroleer_rol()
// aan die begin van sy handler, voor enige data gelees/geskryf word.

function kry_bearer_token(event) {
  const kop = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!kop || !kop.toLowerCase().startsWith("bearer ")) return null;
  return kop.slice(7).trim();
}

function kry_identity_basis_url() {
  const werf_url = process.env.URL || process.env.DEPLOY_URL;
  return `${werf_url}/.netlify/identity`;
}

async function kry_gebruiker_vanaf_token(token) {
  if (!token) return null;
  try {
    const resp = await fetch(`${kry_identity_basis_url()}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (fout) {
    console.error("Kon nie gebruiker by Identity-API verifieer nie:", fout);
    return null;
  }
}

function kontroleer_rol(gebruiker, vereiste_rol) {
  if (!gebruiker) return false;
  const rolle = (gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  return rolle.includes(vereiste_rol);
}

/**
 * Gee die geverifieerde gebruiker terug indien hulle die vereiste rol het,
 * of null indien nie (Function moet dan 401/403 terugstuur).
 * LET WEL: nou asinkroon — roep aan met `await`.
 */
async function kry_gebruiker_en_kontroleer_rol(event, context, vereiste_rol) {
  const token = kry_bearer_token(event);
  const gebruiker = await kry_gebruiker_vanaf_token(token);
  if (!kontroleer_rol(gebruiker, vereiste_rol)) {
    return null;
  }
  return gebruiker;
}

module.exports = {
  kry_gebruiker_en_kontroleer_rol,
};
