/* Thème clair / sombre, partagé par le site et l'app.
   Clair par défaut ; le choix du visiteur est retenu sur cet appareil.
   À charger dans <head>, sans defer, pour éviter un éclair de la mauvaise couleur. */
(function(){
  var CLE="hs_theme",racine=document.documentElement;
  function lire(){try{return localStorage.getItem(CLE)}catch(e){return null}}
  function appliquer(t){
    racine.dataset.theme=t==="dark"?"dark":"light";
    var c=t==="dark"?"#0b1120":(racine.dataset.fond||"#ffffff");
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.removeAttribute("media");m.setAttribute("content",c)});
    /* App native : icônes de la barre d'état lisibles sur le fond. */
    try{var SB=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.StatusBar;if(SB){var p=SB.setStyle({style:t==="dark"?"DARK":"LIGHT"});if(p&&p.catch)p.catch(function(){})}}catch(e){}
    document.querySelectorAll("[data-theme-toggle]").forEach(function(b){
      var sombre=t==="dark";b.setAttribute("aria-pressed",String(sombre));
      b.setAttribute("aria-label",racine.lang.indexOf("en")===0?(sombre?"Switch to light mode":"Switch to dark mode"):(sombre?"Passer en mode clair":"Passer en mode sombre"));
    });
  }
  appliquer(lire());
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-theme-toggle]");if(!b)return;
    var t=racine.dataset.theme==="dark"?"light":"dark";
    try{localStorage.setItem(CLE,t)}catch(err){}
    appliquer(t);
  });
  /* Les boutons ajoutés plus tard (écrans de l'app) reçoivent leur libellé. */
  document.addEventListener("DOMContentLoaded",function(){appliquer(racine.dataset.theme)});
  window.hsTheme={appliquer:function(){appliquer(racine.dataset.theme)}};
})();
