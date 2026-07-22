// Gedeelde helper: verifieer Netlify Identity-gebruiker se rol bediener-kant.
//
// BELANGRIK: rolkontrole gebeur HIER (bediener-kant), nie net in die
// front-end nie — front-end-versteekte knoppies kan omseil word via
// blaaier-ontwikkelaarnutsgoed, maar 'n Function wat weier om te reageer
// kan nie omseil word nie.
//
// Gebruik: elke beskermde Function roep kry_gebruiker_en_kontroleer_rol()
// aan die begin van sy handler, voor enige data gelees/geskryf word.

function kry_identity_konteks(event, context) {
  // Netlify voeg outomaties 'n geverifieerde identity-konteks by
  // context.clientContext.user wanneer die versoek 'n geldige
  // Identity-JWT in die Authorization-header bevat.
  return context.clientContext && context.clientContext.user
    ? context.clientContext.user
    : null;
}

function kontroleer_rol(gebruiker, vereiste_rol) {
  if (!gebruiker) return false;
  const rolle = (gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  return rolle.includes(vereiste_rol);
}

/**
 * Gee die geverifieerde gebruiker terug indien hulle die vereiste rol het,
 * of null indien nie (Function moet dan 401/403 terugstuur).
 */
function kry_gebruiker_en_kontroleer_rol(event, context, vereiste_rol) {
  const gebruiker = kry_identity_konteks(event, context);
  if (!kontroleer_rol(gebruiker, vereiste_rol)) {
    return null;
  }
  return gebruiker;
}

module.exports = {
  kry_identity_konteks,
  kontroleer_rol,
  kry_gebruiker_en_kontroleer_rol,
};
