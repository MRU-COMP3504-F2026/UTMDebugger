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

export const DEFAULT_SETTINGS = [
  {key: 'captureTrackingRequests', value: false},
  {key: 'excludedPages', value: []},
];
