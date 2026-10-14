// Default configuration, added once when the database is first created.
// Users can edit or delete these records later. They are never added back automatically.
export const DEFAULT_TRACKING_DOMAINS = [
  // Patrick
  {
    domain: 'analytics.google.com',
    providerName: 'Google Analytics',
    extractorName: 'googleAnalyticsExtractor',
    excludeIfContains: ['script'],
    captureEnabled: true,
  },
  // Kevin
  {
    domain: 'clarity.ms',
    providerName: 'Microsoft Clarity',
    extractorName: 'clarityExtractor',
    excludeIfContains: ['script'],
    captureEnabled: true,
  },
  // Jordan
  {
    domain: 'track.hubspot.com',
    providerName: 'HubSpot',
    extractorName: 'hubSpotExtractor',
    excludeIfContains: ['script'],
    captureEnabled: true,
  },
  // Anferne
  {
    domain: 'www.googleadservices.com',
    providerName: 'Google Ads',
    extractorName: 'googleAdsExtractor',
    excludeIfContains: ['script'],
    captureEnabled: true,
  },
//   {
//     domain: 'px.ads.linkedin.com',
//     providerName: 'LinkedIn Insight Tag',
//     extractorName: 'linkedInInsightTagExtractor',
//     excludeIfContains: ['script'],
//     captureEnabled: true,
//    },
  // Zen
  {
    domain: 'www.facebook.com',
    providerName: 'Meta Pixel',
    extractorName: 'metaPixelExtractor',
    excludeIfContains: ['script'],
    captureEnabled: true,
  },
];

export const DEFAULT_WATCHED_COOKIES = [
  {name: 'hs_login_email', valueType: 'email', providerName: 'HubSpot'},
  {name: 'hs_login_phone', valueType: 'phone', providerName: 'HubSpot'},
  {name: 'ec_email', valueType: 'email', providerName: 'Generic'},
  {name: 'ec_phone', valueType: 'phone', providerName: 'Generic'},
  {name: 'utm_source', valueType: 'source', providerName: 'Generic'},
  {name: 'utm_campaign', valueType: 'campaign', providerName: 'Generic'},
  {name: 'sa-u-source', valueType: 'source', providerName: 'StackAdapt'},
  {name: 'utm_medium', valueType: 'medium', providerName: 'Generic'},
  {name: 'calltrk_landing', valueType: 'landingPage', providerName: 'CallRail'},
  {name: 'calltrk_session_id', valueType: 'sessionId', providerName: 'CallRail'},
  {name: 'sa-user-id', valueType: 'userId', providerName: 'StackAdapt'},
  {name: 'wix_utm_params', valueType: 'source', providerName: 'Wix'},
  {name: 'mpaSessionId', valueType: 'sessionId', providerName: 'Generic'},
];

export const DEFAULT_SETTINGS = [
  {key: 'captureTrackingRequests', value: false},
  {key: 'captureCookieSnapshots', value: false},
  {key: 'excludedPages', value: []},
];
