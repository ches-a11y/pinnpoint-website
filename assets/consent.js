/* Pinnpoint cookie consent — gates tawk.to (chat), GTranslate (translation) and Vimeo (video)
   until the visitor accepts. No third-party script runs before consent. */
(function () {
  var CKEY = 'pp_consent';

  function loadTawk() {
    if (window.__ppTawk) return; window.__ppTawk = true;
    window.Tawk_API = window.Tawk_API || {}; window.Tawk_LoadStart = new Date();
    var s1 = document.createElement('script'), s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/65bca9688d261e1b5f5b2ca5/1hlkfbh1v';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);
    keepTitle();
  }

  // Stop the live-chat widget from hijacking the browser tab title with a
  // blinking "N new message(s)" alert — keep the real page title stable.
  function keepTitle() {
    try {
      var realTitle = document.title;
      var tEl = document.querySelector('title');
      if (!tEl || !window.MutationObserver) return;
      new MutationObserver(function () {
        if (document.title !== realTitle) document.title = realTitle;
      }).observe(tEl, { childList: true });
    } catch (e) {}
  }

  function loadGT() {
    if (window.__ppGT) return; window.__ppGT = true;
    gtStyles();
    window.gtranslateSettings = {"default_language":"en","native_language_names":true,"languages":["en","de","es","fr","it","nl","pt","sv"],"wrapper_selector":".gtranslate_wrapper","switcher_horizontal_position":"inline","flag_style":"3d","flag_size":24};
    var s = document.createElement('script');
    s.src = 'https://cdn.gtranslate.net/widgets/latest/dwf.js';
    s.defer = true;
    document.body.appendChild(s);
  }

  // Restyle the GTranslate switcher into a compact pill that matches the header.
  function gtStyles() {
    if (document.getElementById('pp-gt-css')) return;
    var st = document.createElement('style'); st.id = 'pp-gt-css';
    st.textContent =
      ".gtranslate_wrapper .gt_switcher{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_selected{width:auto!important;background:#fff!important;border:1px solid #e4e9f0!important;border-radius:999px!important;box-shadow:none!important;overflow:visible!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_selected a{display:inline-flex!important;align-items:center;gap:7px;padding:6px 24px 6px 12px!important;font-size:14px!important;font-weight:500!important;color:#0e2a47!important;line-height:1!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_selected a img{width:18px!important;height:18px!important;border-radius:3px}" +
      ".gtranslate_wrapper .gt_switcher .gt_selected:hover{border-color:#2196f3!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_selected:hover a{color:#2196f3!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_option{border-radius:10px!important;box-shadow:0 12px 30px rgba(14,42,71,.16)!important;border:1px solid #e4e9f0!important;overflow:hidden!important;margin-top:8px!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_option a{padding:8px 14px!important;font-size:13.5px!important;color:#33383f!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_option a:hover{background:#f5f8fc!important}" +
      ".gtranslate_wrapper .gt_switcher .gt_option a img{width:18px!important;height:18px!important;border-radius:3px}";
    document.head.appendChild(st);
  }

  function loadVideos() {
    var f = document.querySelectorAll('iframe[data-src]');
    for (var i = 0; i < f.length; i++) {
      f[i].src = f[i].getAttribute('data-src');
      f[i].removeAttribute('data-src');
    }
    var ov = document.querySelectorAll('.pp-vfacade');
    for (var j = 0; j < ov.length; j++) ov[j].parentNode.removeChild(ov[j]);
  }

  function enableAll() { loadGT(); loadTawk(); loadVideos(); }

  function styles() {
    if (document.getElementById('pp-cookie-css')) return;
    var st = document.createElement('style'); st.id = 'pp-cookie-css';
    st.textContent =
      '#pp-cookie{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0a2038;color:#dce6f2;box-shadow:0 -6px 24px rgba(0,0,0,.28);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '#pp-cookie .pp-ck-inner{max-width:1160px;margin:0 auto;padding:16px 24px;display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap}' +
      '#pp-cookie .pp-ck-txt{font-size:13.5px;line-height:1.55;max-width:760px}' +
      '#pp-cookie .pp-ck-txt strong{color:#fff}' +
      '#pp-cookie a{color:#8fc4f5;text-decoration:underline}' +
      '#pp-cookie .pp-ck-btns{display:flex;gap:10px;flex-shrink:0}' +
      '#pp-cookie button{font-family:inherit;font-weight:600;font-size:14px;padding:10px 22px;border-radius:999px;cursor:pointer;border:1.5px solid transparent;transition:.2s}' +
      '#pp-cookie .pp-ck-decline{background:transparent;border-color:rgba(255,255,255,.35);color:#dce6f2}' +
      '#pp-cookie .pp-ck-decline:hover{background:rgba(255,255,255,.08)}' +
      '#pp-cookie .pp-ck-accept{background:#e07a56;color:#fff}' +
      '#pp-cookie .pp-ck-accept:hover{background:#cf6a48}' +
      '.pp-vfacade{position:absolute;inset:0;background:#0e2a47;color:#dce6f2;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:inherit;font-family:Inter,system-ui,sans-serif;font-size:13.5px;padding:16px}' +
      '.pp-vfacade button{margin:10px 0 6px;font-family:inherit;font-weight:600;font-size:14px;padding:9px 20px;border-radius:999px;cursor:pointer;border:0;background:#e07a56;color:#fff}' +
      '.pp-vfacade button:hover{background:#cf6a48}' +
      '.pp-vfacade span{display:block;font-size:11.5px;color:#9bb6d6;margin-top:2px}';
    document.head.appendChild(st);
  }

  function addVideoFacades() {
    var frames = document.querySelectorAll('iframe[data-src]');
    for (var i = 0; i < frames.length; i++) {
      var p = frames[i].parentElement;
      if (!p || p.querySelector('.pp-vfacade')) continue;
      var o = document.createElement('div');
      o.className = 'pp-vfacade';
      o.innerHTML = '<div>This video is hosted on Vimeo.' +
        '<button type="button" onclick="ppSetConsent(\'accepted\')">Load video</button>' +
        '<span>Accepting enables Vimeo, chat &amp; translation cookies.</span></div>';
      p.appendChild(o);
    }
  }

  function removeBanner() { var b = document.getElementById('pp-cookie'); if (b) b.parentNode.removeChild(b); }

  function showBanner() {
    if (document.getElementById('pp-cookie')) return;
    styles();
    var d = document.createElement('div');
    d.id = 'pp-cookie';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Cookie consent');
    d.innerHTML = '<div class="pp-ck-inner">' +
      '<div class="pp-ck-txt"><strong>We use cookies.</strong> Pinnpoint uses third-party cookies only to power live chat, on-page translation and embedded videos. Nothing non-essential loads until you accept. Read our <a href="privacy.html">Privacy Policy</a>.</div>' +
      '<div class="pp-ck-btns">' +
      '<button type="button" class="pp-ck-decline" onclick="ppSetConsent(\'rejected\')">Decline</button>' +
      '<button type="button" class="pp-ck-accept" onclick="ppSetConsent(\'accepted\')">Accept</button>' +
      '</div></div>';
    document.body.appendChild(d);
  }

  // public API
  window.ppSetConsent = function (v) {
    try { localStorage.setItem(CKEY, v); } catch (e) {}
    removeBanner();
    if (v === 'accepted') enableAll();
  };
  window.ppOpenConsent = function () { showBanner(); };

  function boot() {
    var c = null; try { c = localStorage.getItem(CKEY); } catch (e) {}
    if (c === 'accepted') { enableAll(); return; }
    styles();
    addVideoFacades();          // show click-to-load on any videos
    if (c !== 'rejected') showBanner();  // first visit -> ask
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
