/* Minimal bridge for this no-bundler Capacitor web app. The native
 * @capacitor/filesystem plugin is registered by name when the Capacitor
 * runtime is present, so auto-backup can write a real file onto the
 * device's storage. Browser/PWA mode simply leaves it absent, and the app
 * falls back to a normal file download instead. */
(function(){
  try {
    var C=window.Capacitor;
    if(!C || typeof C.registerPlugin!=="function") return;
    if(C.Plugins && C.Plugins.Filesystem) return;
    var plugin=C.registerPlugin("Filesystem");
    if(C.Plugins) C.Plugins.Filesystem=plugin;
  } catch(e) { console.warn("Filesystem bridge unavailable",e); }
})();
