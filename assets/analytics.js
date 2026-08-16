/* Pinnpoint analytics — GA4 + LinkedIn Insight Tag, Google Consent Mode v2.
   ---------------------------------------------------------------------------
   PASTE YOUR IDs BELOW. Leave a value as '' and that tag simply never loads,
   so the site keeps working untouched until you fill them in.
     GA4_ID       e.g. 'G-XXXXXXXXXX'  (Admin > Data streams > Measurement ID)
     LINKEDIN_ID  e.g. '1234567'       (Campaign Manager > Analytics > Insight Tag)
   ---------------------------------------------------------------------------
   Consent: storage is DENIED by default. /assets/consent.js calls
   ppConsentUpdate('accepted'|'rejected') and this file flips the signals.
   GA4 still receives cookieless pings before consent, so acquisition
   reporting works without dropping a cookie. */
(function () {
  var GA4_ID      = 'G-D8KGQ9D7Q4';
  var LINKEDIN_ID = '';

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 defaults — must run before any tag.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('js', new Date());

  if (GA4_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    gtag('config', GA4_ID, { anonymize_ip: true });
  }

  // Called by consent.js when the visitor chooses.
  window.ppConsentUpdate = function (state) {
    var granted = state === 'accepted' ? 'granted' : 'denied';
    gtag('consent', 'update', {
      ad_storage: granted,
      ad_user_data: granted,
      ad_personalization: granted,
      analytics_storage: granted
    });
    if (granted === 'granted' && LINKEDIN_ID && !window.__ppLi) {
      window.__ppLi = true;
      window._linkedin_partner_id = LINKEDIN_ID;
      window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
      window._linkedin_data_partner_ids.push(LINKEDIN_ID);
      var l = document.createElement('script');
      l.async = true;
      l.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      document.head.appendChild(l);
    }
  };

  /* Conversion events. Call ppTrack('sample_request', {...}) from a form on
     successful submit — already wired into contact/order/samples. */
  window.ppTrack = function (name, params) {
    try { gtag('event', name, params || {}); } catch (e) {}
  };
})();
