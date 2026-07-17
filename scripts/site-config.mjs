/* Shared website information architecture and public-claim guardrails.
   This file is data only: renderers live in build-blog.mjs. Anything marked
   verify must not be promoted as a generally available public capability. */

export const CAPABILITIES = {
  booking: {
    label: '3D booking map', canonical: 'platform/#booking', status: 'approved',
    source: 'Messaging House pillar 4; Clubtech Booking Platform; deck slides 4, 6, 7',
    asset: 'booking-map.webp',
  },
  operations: {
    label: 'Floor operations', canonical: 'platform/#operations', status: 'approved',
    source: 'Messaging House pillar 4; Clubtech Booking Platform; deck slides 10–11',
    asset: 'operator-floor.webp',
  },
  guestLists: {
    label: 'Guest lists and VMS', canonical: 'platform/#guest-lists', status: 'approved',
    source: 'Messaging House pillar 4; deck slides 4, 9–10', asset: 'doorlist-list.webp',
  },
  checkIn: {
    label: 'Door and QR check-in', canonical: 'platform/#check-in', status: 'approved',
    source: 'Clubtech Booking Platform; deck slides 4, 6, 8', asset: 'doorlist-soldout.webp',
  },
  integrations: {
    label: 'Integrations', canonical: 'platform/#integrations', status: 'verify',
    source: 'Messaging House; Clubtech Booking Platform; deck slide 12', asset: 'operator-reservations.webp',
  },
  events: {
    label: 'Events and ticketing', canonical: 'sell/#events', status: 'approved',
    source: 'Clubtech Booking Platform; deck slides 4, 6, 8', asset: 'events-tickets.webp',
  },
  packages: {
    label: 'Packages and add-ons', canonical: 'sell/#packages', status: 'approved',
    source: 'Messaging House; Clubtech Booking Platform; deck slides 4–6', asset: 'events-checkout.webp',
  },
  pricing: {
    label: 'Dynamic pricing', canonical: 'sell/#dynamic-pricing', status: 'approved',
    source: 'Messaging House; Clubtech Booking Platform', asset: 'pricing-rules.webp',
  },
  revenue: {
    label: 'Pre-paid revenue', canonical: 'sell/#revenue', status: 'approved',
    source: 'Messaging House pillar 1; deck slides 5, 18', asset: 'pricing-calendar.webp',
  },
  attribution: {
    label: 'Ads and attribution', canonical: 'grow/#ads', status: 'approved',
    source: 'Messaging House pillar 2; Clubtech Booking Platform', asset: 'intel-attribution.webp',
  },
  intelligence: {
    label: 'Guest intelligence and reports', canonical: 'grow/#guest-data', status: 'approved',
    source: 'Messaging House pillars 3–4; deck slides 14–15', asset: 'intel-reports.webp',
  },
  giftCards: { label: 'Gift cards', canonical: null, status: 'verify', source: 'No approved public source loaded', asset: null },
  reviews: { label: 'Clubtech Reviews', canonical: null, status: 'verify', source: 'No approved public source loaded', asset: null },
  marketingAi: { label: 'Marketing AI', canonical: null, status: 'verify', source: 'AI label is not an approved claim', asset: null },
};

export const LANDING_CONFIG = {
  about: {
    layout: 'company', primary: ['platform/', 'See the platform'], secondary: ['delivery/', 'How we deliver'],
    closing: ['Built close to the floor.', 'See what the platform runs.', 'See the platform'],
    related: ['platform/', 'delivery/', 'blog/finns-beach-club-case-study/'],
  },
  'ai-bookings': {
    layout: 'emerging', primary: ['platform/#ai-agent', 'See the platform boundary'], secondary: ['blog/', 'Read the operator playbooks'],
    closing: ['Emerging capability.', 'Build for the booking channels that come next.', 'See the platform'],
    related: ['platform/', 'platform/#integrations', 'book-a-demo/'],
  },
  careers: {
    layout: 'careers', primary: ['mailto:info@clubtechglobal.com?subject=Careers%20at%20Clubtech', 'Introduce yourself'], secondary: ['about/', 'About Clubtech'],
    closing: ['Operators and builders.', 'Work close to the product and the floor.', 'Introduce yourself'],
    related: ['about/', 'delivery/', 'platform/'],
  },
  'for-hotels': {
    layout: 'segment', primary: ['book-a-demo/', 'Book a hotel demo'], secondary: ['solutions/hotel-pool-booking/', 'See hotel pool booking'],
    closing: ['Your pool channel, owned.', 'Put the property inside the demo.', 'Book a hotel demo'],
    related: ['solutions/hotel-pool-booking/', 'solutions/resorts/', 'delivery/'],
  },
  help: {
    layout: 'help', primary: ['support/', 'Contact support'], secondary: ['platform/', 'Explore the platform'],
    closing: ['Need a venue-specific answer?', 'Existing teams can reach support. Evaluating teams can see the platform.', 'Contact support'],
    related: ['support/', 'platform/', 'delivery/'],
  },
  pricing: {
    layout: 'pricing', primary: ['book-a-demo/', 'Book a discovery call'], secondary: ['sell/#revenue', 'See the revenue model'],
    closing: ['Built around your venue.', 'Shape the right commercial model together.', 'Book a discovery call'],
    related: ['sell/#revenue', 'delivery/', 'book-a-demo/'],
  },
  support: {
    layout: 'support', primary: ['mailto:info@clubtechglobal.com?subject=Clubtech%20support', 'Email support'], secondary: ['help/', 'Visit the help center'],
    closing: ['Keep the issue on the record.', 'Tell the Clubtech team what is happening at your venue.', 'Email support'],
    related: ['help/', 'delivery/', 'platform/'],
  },
  privacy: {
    layout: 'legal', primary: ['book-a-demo/', 'Book a Demo'], secondary: ['platform/', 'See the platform'],
    closing: ['Questions about your data?', 'Reach the team, or see the platform your data runs on.', 'Book a Demo'],
    related: ['cookies/', 'terms/', 'about/'],
  },
  terms: {
    layout: 'legal', primary: ['book-a-demo/', 'Book a Demo'], secondary: ['platform/', 'See the platform'],
    closing: ['Questions about these terms?', 'Reach the team, or see the platform.', 'Book a Demo'],
    related: ['privacy/', 'cookies/', 'about/'],
  },
  cookies: {
    layout: 'legal', primary: ['book-a-demo/', 'Book a Demo'], secondary: ['platform/', 'See the platform'],
    closing: ['Manage your cookie choices anytime.', 'Reach the team, or see the platform.', 'Book a Demo'],
    related: ['privacy/', 'terms/', 'about/'],
  },
};

export const COMPARISON_CONFIG = {
  'access-collins-alternative': { capability: 'booking', solution: 'solutions/beach-clubs/', proof: 'booking-map.webp' },
  'book-tech-labs-alternative': { capability: 'attribution', solution: 'solutions/beach-clubs/', proof: 'intel-attribution.webp' },
  'fourvenues-alternative': { capability: 'events', solution: 'solutions/nightclub-management-software/', proof: 'events-tickets.webp' },
  'hoteligy-alternative': { capability: 'integrations', solution: 'for-hotels/', proof: 'operator-reservations.webp' },
  'megatix-alternative': { capability: 'events', solution: 'solutions/event-ticketing-for-clubs/', proof: 'events-checkout.webp' },
  'resortpass-alternative': { capability: 'booking', solution: 'for-hotels/', proof: 'booking-map.webp' },
  'servme-alternative': { capability: 'operations', solution: 'solutions/restaurants/', proof: 'operator-floor.webp' },
  'sevenrooms-alternative': { capability: 'booking', solution: 'solutions/beach-clubs/', proof: 'booking-map.webp' },
  'tablelist-alternative': { capability: 'operations', solution: 'solutions/nightclub-management-software/', proof: 'operator-floor.webp' },
  'urvenue-alternative': { capability: 'integrations', solution: 'for-hotels/', proof: 'operator-reservations.webp' },
};

export const BLOG_PATHWAYS = {
  'sevenrooms-pricing-what-venues-pay': ['compare/sevenrooms-alternative/', 'pricing/', 'book-a-demo/'],
  'online-guest-list-vs-rsvp-tools': ['platform/#guest-lists', 'solutions/guest-list-management-software/', 'blog/guest-list-management-for-venues/'],
  'how-to-make-a-guest-list-online': ['blog/guest-list-management-for-venues/', 'platform/#guest-lists', 'solutions/guest-list-management-software/'],
  'guest-list-management-for-venues': ['platform/#guest-lists', 'solutions/guest-list-management-software/', 'book-a-demo/'],
  'guest-list-counter': ['blog/guest-list-management-for-venues/', 'platform/#guest-lists', 'solutions/guest-list-management-software/'],
  'door-check-in-qr-scanning-for-venues': ['platform/#check-in', 'solutions/event-ticketing-for-clubs/', 'book-a-demo/'],
  'club-promoter-software': ['solutions/nightclub-management-software/', 'platform/#guest-lists', 'compare/fourvenues-alternative/'],
  'the-hidden-revenue-leak-in-your-beach-club-booking-flow': ['sell/#revenue', 'solutions/beach-clubs/', 'book-a-demo/'],
  'big-match-playbook-major-events-revenue': ['sell/#events', 'solutions/event-ticketing-for-clubs/', 'book-a-demo/'],
  'meta-conversions-api-for-venue-bookings': ['grow/#ads', 'blog/ga4-for-venue-bookings/', 'book-a-demo/'],
  'ga4-for-venue-bookings': ['grow/#ads', 'blog/meta-conversions-api-for-venue-bookings/', 'book-a-demo/'],
  'finns-beach-club-case-study': ['solutions/beach-clubs/', 'platform/#booking', 'book-a-demo/'],
  'dynamic-pricing-for-beach-clubs': ['sell/#dynamic-pricing', 'blog/beach-club-revenue-playbook/', 'book-a-demo/'],
  'beach-club-revenue-playbook': ['sell/#revenue', 'solutions/beach-clubs/', 'book-a-demo/'],
  'beach-club-marketing-strategy': ['grow/#ads', 'grow/#guest-data', 'book-a-demo/'],
  'beach-club-booking-system-complete-guide': ['platform/#booking', 'solutions/beach-clubs/', 'book-a-demo/'],
  'that-last-click-before-checkout-could-be-worth-thousands': ['sell/#packages', 'blog/beach-club-revenue-playbook/', 'book-a-demo/'],
  'the-ux-behind-a-sold-out-saturday': ['platform/#booking', 'solutions/beach-clubs/', 'book-a-demo/'],
  'your-guests-want-to-spend-more-youre-just-not-letting-them': ['sell/#packages', 'blog/beach-club-revenue-playbook/', 'book-a-demo/'],
  'maximize-beach-club-revenue-the-power-of-pre-booked-upsells': ['sell/#packages', 'blog/beach-club-revenue-playbook/', 'book-a-demo/'],
  'why-first-party-data-is-the-future-of-beach-club-marketing': ['grow/#guest-data', 'platform/#guest-lists', 'book-a-demo/'],
};

export const FOOTER_GROUPS = [
  ['Bookings', [['platform/#booking', 'Booking experience'], ['platform/#operations', 'Operations & floor'], ['platform/#guest-lists', 'Guest lists'], ['platform/#integrations', 'Integrations']]],
  ['Revenue', [['sell/#events', 'Events & ticketing'], ['sell/#packages', 'Packages & add-ons'], ['sell/#dynamic-pricing', 'Dynamic pricing'], ['sell/#revenue', 'Pre-paid revenue']]],
  ['Marketing', [['grow/#ads', 'Ads & attribution'], ['grow/#abandoned-recovery', 'Abandoned recovery'], ['grow/#guest-data', 'Guest data & reports'], ['grow/', 'Marketing overview']]],
  ['Solutions', [['for-hotels/', 'Hotels & resorts'], ['solutions/beach-clubs/', 'Beach clubs'], ['solutions/nightclub-management-software/', 'Nightclubs'], ['solutions/guest-list-management-software/', 'Guest lists'], ['solutions/', 'All solutions']]],
  ['Resources', [['blog/', 'The Index'], ['blog/finns-beach-club-case-study/', 'FINNS case study'], ['compare/', 'Compare Clubtech'], ['help/', 'Help center']]],
  ['Company', [['about/', 'About'], ['delivery/', 'How we deliver'], ['careers/', 'Careers'], ['support/', 'Support'], ['pricing/', 'Commercial fit'], ['https://www.guestlistnow.com/', 'Guest List Now ↗']]],
  ['Legal', [['privacy/', 'Privacy'], ['terms/', 'Terms'], ['cookies/', 'Cookies']]],
];

/* Leadership team shown on the About page (assets/team/*.png). */
export const TEAM = [
  { img: 'ctg_profile_teguh.png', name: 'Teguh Santoso', role: 'Chief Technology Officer', blurb: 'Leads engineering and platform architecture — the booking, operations, and data systems Clubtech runs on.' },
  { img: 'ctg_profile_kaiesh2.png', name: 'Kaiesh Vohra', role: 'Chief Operating Officer', blurb: 'Runs operations and delivery, so every venue launch and rollout lands on time.' },
  { img: 'ctg_profile_jack.png', name: 'Jack Herringe', role: 'Senior Manager', blurb: 'Oversees venue partnerships and day-to-day account management across the portfolio.' },
  { img: 'ctg_profile_brad.png', name: 'Brad Vatne', role: 'Solutions Architect', blurb: 'Designs how Clubtech fits each venue — integrations, configuration, and technical rollout.' },
  { img: 'ctg_profile_gus.png', name: 'Gus Murray', role: 'Business Development', blurb: 'Leads growth and new venue partnerships across Clubtech’s markets.' },
];
