/* Clubtech consent bootstrap.
   Runs synchronously in <head> so the denied Consent Mode v2 defaults are
   queued before any analytics or marketing tag can start. */
(function (w) {
  'use strict';

  w.dataLayer = w.dataLayer || [];
  w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };

  if (w.__ctgConsentDefaulted) return;
  w.__ctgConsentDefaulted = true;

  w.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
})(window);
