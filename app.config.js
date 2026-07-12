const appJson = require('./app.json');

// GH_PAGES_BASE on asetettu vain GitHub Pages -julkaisuputkessa (esim. "/Wtf"),
// jotta viedyt asset-polut osoittavat oikeaan alipolkuun. Paikallisessa
// kehityksessä, `npx expo start`issa ja artifact-buildissa tätä ei aseteta,
// jolloin polut jäävät juureen kuten ennenkin.
module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  experiments: {
    ...(appJson.expo.experiments ?? {}),
    baseUrl: process.env.GH_PAGES_BASE ?? '',
  },
});
