/* Minimal bridge for this no-bundler Capacitor web app. If a native
 * biometric plugin (e.g. capacitor-native-biometric, registered under
 * the name "NativeBiometric") is present in the native build, this
 * registers it so app.js can call isAvailable()/verifyIdentity() and
 * trigger the device's own Face ID / fingerprint prompt. In a plain
 * browser/PWA (or a native build without that plugin installed) this
 * simply does nothing, and the app falls back to the standard WebAuthn
 * platform authenticator instead (handled in app.js). */
(function(){
  try {
    var C=window.Capacitor;
    if(!C || typeof C.registerPlugin!=="function") return;
    if(C.Plugins && C.Plugins.NativeBiometric) return;
    var plugin=C.registerPlugin("NativeBiometric");
    if(C.Plugins) C.Plugins.NativeBiometric=plugin;
  } catch(e) { console.warn("Biometric bridge unavailable",e); }
})();
