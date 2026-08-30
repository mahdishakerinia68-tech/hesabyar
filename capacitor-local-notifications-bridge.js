/* Minimal bridge for this no-bundler Capacitor web app. The native
 * @capacitor/local-notifications plugin is registered by name when the
 * Capacitor runtime is present. Browser/PWA mode simply leaves it absent. */
(function(){
  try {
    var C=window.Capacitor;
    if(!C || typeof C.registerPlugin!=="function") return;
    if(C.Plugins && C.Plugins.LocalNotifications) return;
    var plugin=C.registerPlugin("LocalNotifications");
    if(C.Plugins) C.Plugins.LocalNotifications=plugin;
  } catch(e) { console.warn("Local Notifications bridge unavailable",e); }
})();
