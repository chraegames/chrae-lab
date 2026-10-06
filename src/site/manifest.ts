// Page manifest — the single source of truth for every URL across the three
// Chrae Lab sites, each on its own subdomain and built separately:
//
//   fire  → https://fire.chraegames.cloud   the FIRE planner (home) + its guides
//   games → https://games.chraegames.cloud  games landing + one page per game
//   tools → https://tools.chraegames.cloud  tools landing + one page per tool
//
// Paths are relative to their site's origin, so '/' exists once per site. Slugs
// are global ids (stable across the split: they are the pre-split paths without
// slashes, which is what the apex 301 map in deploy/nginx.conf relies on).
//
// Pure data (no React, no browser APIs) so it can be consumed from the Vite
// config / prerender plugin (Node), the pure prerendered components, and the
// client apps alike without import cycles.
//
// Adding a tool = add an entry here (status 'soon' keeps it off every page until it ships), create
// sites/<site>/<path>/index.html + src/tools/<slug>/main.tsx, and map the slug in
// src/site/prerenderPages.tsx if it isn't a plain ToolStatic page. Vite inputs,
// <head> tags, sitemap, landing-page cards and breadcrumbs all derive from this file.

/** Registrable domain. The bare apex only redirects now (deploy/nginx.conf) and serves the storage bridge. */
export const ROOT_DOMAIN = 'chraegames.cloud';
export const LEGACY_ORIGIN = `https://${ROOT_DOMAIN}`;
/** Umbrella brand: publisher in JSON-LD, "More from Chrae Lab" links. */
export const BRAND_NAME = 'Chrae Lab';
/** Public source repository — linked from every footer and the Organization JSON-LD. */
export const SITE_REPO = 'https://github.com/chraegames/chrae-lab';

export type SiteId = 'fire' | 'games' | 'tools';

export interface Site {
  id: SiteId;
  /** https://<sub>.chraegames.cloud, no trailing slash. */
  origin: string;
  /** Brand shown in headers, crumbs, footers and og:site_name. */
  name: string;
  /** Label for the link back to this site's home from inside it ("All games"). */
  homeLabel: string;
}

export const SITES: Record<SiteId, Site> = {
  fire: { id: 'fire', origin: `https://fire.${ROOT_DOMAIN}`, name: 'FIRE Planner', homeLabel: 'Open the planner' },
  games: { id: 'games', origin: `https://games.${ROOT_DOMAIN}`, name: 'Chrae Games', homeLabel: 'All games' },
  tools: { id: 'tools', origin: `https://tools.${ROOT_DOMAIN}`, name: 'Chrae Tools', homeLabel: 'All tools' },
};

export const SITE_IDS: SiteId[] = ['fire', 'tools', 'games'];

export function isSiteId(value: unknown): value is SiteId {
  return typeof value === 'string' && (SITE_IDS as string[]).includes(value);
}

export type CategoryId = 'finance' | 'utilities' | 'productivity' | 'games';

export interface Category {
  id: CategoryId;
  name: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'finance',
    name: 'Finance',
    blurb: 'Plan long horizons with numbers that stay on your device.',
  },
  {
    id: 'utilities',
    name: 'Utilities',
    blurb: 'Everyday converters and calculators, no ads in the way.',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    blurb: 'Small tools for keeping track of things.',
  },
  {
    id: 'games',
    name: 'Games',
    blurb: 'Quick browser games for a short break.',
  },
];

export type PageKind = 'hub' | 'app' | 'content';
export type PageStatus = 'live' | 'soon';

/** Indexable copy for a tool page: rendered below the tool (static + live) and emitted as WebApplication + FAQPage JSON-LD. */
export interface ToolAbout {
  /** 1–2 sentence lede shown under the tool. */
  intro: string;
  /** Concrete features, one per bullet. */
  features: string[];
  /** Rendered as an FAQ section and as FAQPage JSON-LD — keep text identical in both. */
  faq: { q: string; a: string }[];
  /** schema.org applicationCategory, e.g. 'UtilitiesApplication'. */
  applicationCategory: string;
}

export interface SiteEntry {
  /** Global id = the pre-split path without slashes: 'fire-planner', 'fire-planner/how-it-works', 'games' (landing). */
  slug: string;
  /** Which subdomain serves the page. */
  site: SiteId;
  /** Path on that site, with trailing slash: '/', '/sudoku/', '/how-it-works/'. */
  path: string;
  kind: PageKind;
  status: PageStatus;
  /** Short human name — breadcrumbs, landing cards, tool headers. */
  name: string;
  /** One-line card subtitle. */
  tagline: string;
  /** <title> */
  title: string;
  /** <meta name="description"> */
  description: string;
  /** Apps only: which landing-page section the card belongs to (games site → 'games', tools site → utilities/productivity). */
  category?: CategoryId;
  /** Content pages only: slug of the parent app; scopes "Related" links + breadcrumbs. */
  area?: string;
  /** Content pages only: short label for "Related" links. */
  label?: string;
  ogType?: 'website' | 'article';
  /** Extra JSON-LD blocks (BreadcrumbList is generated automatically). */
  jsonLd?: object[];
  /** Search-engine verification metas, by meta name. */
  verification?: Record<string, string>;
  /** Apps only: on-page About/FAQ copy; drives the auto-generated JSON-LD. */
  about?: ToolAbout;
  /** YYYY-MM-DD of the last meaningful content change — sitemap <lastmod>. */
  updated?: string;
}

const FIRE_DESCRIPTION =
  'Free, private, browser-only retirement planner. Model income, expenses, investments, taxes, and withdrawals. No signup — your data stays on your device.';

const SEARCH_VERIFICATION = {
  'google-site-verification': '_YvK_tmQTsoqwLulyMDeviiu-Zo8t3r3k8td2_n4gr4',
  'msvalidate.01': '61A673581896A67618A278792FCC5D0C',
};

export const PAGES: SiteEntry[] = [
  // ─── fire.chraegames.cloud ──────────────────────────────────────────────
  {
    slug: 'fire-planner',
    updated: '2026-08-21',
    site: 'fire',
    path: '/',
    kind: 'app',
    status: 'live',
    category: 'finance',
    name: 'FIRE Planner',
    tagline: 'Model your retirement year by year — income, taxes, withdrawals.',
    title: 'FIRE Planner — Plan your retirement in your browser. Free & private',
    description: FIRE_DESCRIPTION,
    verification: SEARCH_VERIFICATION,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'FIRE Planner',
        url: `${SITES.fire.origin}/`,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description: FIRE_DESCRIPTION,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What can I do with FIRE Planner?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Project income, expenses, investment growth, illustrative federal taxes, and withdrawals across a configurable horizon. Compare scenarios side-by-side, record actuals year by year as life happens, and let an optimizer pick a tax-efficient withdrawal schedule.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does FIRE Planner work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Everything runs in your browser — the simulation, the optimizer, the charts. There is no server-side computation. Plans persist in your browser's localStorage so they're here when you come back.",
            },
          },
          {
            '@type': 'Question',
            name: 'What happens to my data?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No account, no server, no tracking of personal information. Export and import plans as JSON files you control. Clearing your browser data erases everything — nothing is kept anywhere else.',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'fire-planner/coast-fire-calculator',
    updated: '2026-08-21',
    site: 'fire',
    path: '/coast-fire-calculator/',
    kind: 'content',
    status: 'live',
    area: 'fire-planner',
    name: 'Coast FIRE calculator',
    label: 'Coast FIRE calculator',
    tagline: 'Model your Coast FIRE number.',
    title: 'Coast FIRE calculator — model your number in your browser',
    description:
      'Work out your Coast FIRE number — the amount that grows into a full retirement nest egg without further contributions — and model it free in your browser.',
    ogType: 'article',
  },
  {
    slug: 'fire-planner/4-percent-rule',
    updated: '2026-08-21',
    site: 'fire',
    path: '/4-percent-rule/',
    kind: 'content',
    status: 'live',
    area: 'fire-planner',
    name: '4% rule',
    label: '4% rule explained',
    tagline: 'Safe withdrawal rates, explained.',
    title: 'The 4% rule and safe withdrawal rates, explained',
    description:
      'What the 4% rule is, where it comes from, and where it breaks down — then model your own safe withdrawal rate year by year in a free browser-based planner.',
    ogType: 'article',
  },
  {
    slug: 'fire-planner/retirement-withdrawal-strategy',
    updated: '2026-08-21',
    site: 'fire',
    path: '/retirement-withdrawal-strategy/',
    kind: 'content',
    status: 'live',
    area: 'fire-planner',
    name: 'Withdrawal strategy',
    label: 'Withdrawal strategy',
    tagline: 'Tax-efficient drawdown order.',
    title: 'Tax-efficient retirement withdrawal strategy',
    description:
      'How withdrawal order across brokerage, Roth, and IRA accounts changes the tax you pay — and how an optimizer can pick a tax-efficient drawdown schedule for you.',
    ogType: 'article',
  },
  {
    slug: 'fire-planner/how-it-works',
    updated: '2026-08-21',
    site: 'fire',
    path: '/how-it-works/',
    kind: 'content',
    status: 'live',
    area: 'fire-planner',
    name: 'How it works',
    label: 'How it works',
    tagline: 'Methodology and limits.',
    title: 'How FIRE Planner works — methodology and limits',
    description:
      'What FIRE Planner models, the tax assumptions it uses (2026 MFJ, illustrative), and what it deliberately leaves out. An honest look under the hood.',
    ogType: 'article',
  },
  // ─── tools.chraegames.cloud ─────────────────────────────────────────────
  {
    slug: 'tools',
    site: 'tools',
    path: '/',
    kind: 'hub',
    status: 'live',
    name: SITES.tools.name,
    tagline: 'Small tools that run in your browser.',
    title: 'Chrae Tools — free tools that run in your browser',
    description:
      'Free, private tools that run entirely in your browser: a unit converter, a scientific calculator, a to-do list and a TV buying guide. No accounts, no ads, nothing sent to a server.',
    verification: SEARCH_VERIFICATION,
    updated: '2026-10-05',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITES.tools.name,
        url: `${SITES.tools.origin}/`,
        description:
          'Free, private tools that run entirely in your browser: a unit converter, a scientific calculator, a to-do list and a TV buying guide. No accounts, no ads, nothing sent to a server.',
        inLanguage: 'en',
        publisher: { '@type': 'Organization', name: BRAND_NAME, sameAs: [SITE_REPO] },
      },
    ],
  },
  {
    slug: 'unit-converter',
    site: 'tools',
    path: '/unit-converter/',
    kind: 'app',
    status: 'live',
    category: 'utilities',
    name: 'Unit converter',
    tagline: 'Length, weight, volume, area, speed and temperature.',
    title: 'Unit converter — metric and imperial, free and instant',
    description:
      'Free online unit converter for length, weight, volume, area, speed and temperature. Convert metric to imperial and back instantly — runs entirely in your browser.',
    updated: '2026-08-21',
    about: {
      applicationCategory: 'UtilitiesApplication',
      intro:
        'A fast online unit converter for everyday measurements. Pick a category, type a value, and the result updates as you type — no page reloads, no ads, nothing sent to a server.',
      features: [
        'Six categories: length, weight and mass, volume, area, speed and temperature.',
        'Metric and imperial units side by side — metres to feet, kilograms to pounds, litres to gallons, Celsius to Fahrenheit and more.',
        'Swap the from and to units with one click and see the conversion both ways.',
        'Remembers your last category and units on this device.',
      ],
      faq: [
        {
          q: 'How do I convert metric to imperial units?',
          a: 'Choose a category such as length or weight, pick the unit you have (for example metres) and the unit you want (for example feet), then type the value. The converted result appears instantly and updates as you type.',
        },
        {
          q: 'Which units does the converter support?',
          a: 'Length (millimetres to miles), weight and mass (grams to tons), volume (millilitres to gallons), area (square metres to acres), speed (km/h, mph, m/s, knots) and temperature (Celsius, Fahrenheit, Kelvin).',
        },
        {
          q: 'How accurate are the conversions?',
          a: 'Every unit is defined against an exact base unit using published conversion factors, so results are as precise as the numbers you enter. Results are rounded for display but computed at full precision.',
        },
        {
          q: 'Is the unit converter free and private?',
          a: 'Yes. It is free, has no ads or account, and the conversion happens entirely in your browser. Your last-used units are kept in your browser storage only.',
        },
      ],
    },
  },
  {
    slug: 'calculator',
    site: 'tools',
    path: '/calculator/',
    kind: 'app',
    status: 'live',
    category: 'utilities',
    name: 'Calculator',
    tagline: 'Basic and scientific, with keyboard input and history.',
    title: 'Online calculator — basic and scientific, with history',
    description:
      'A free online calculator with scientific functions, keyboard input and a history of your recent calculations. No ads, no signup — runs entirely in your browser.',
    updated: '2026-08-21',
    about: {
      applicationCategory: 'UtilitiesApplication',
      intro:
        'A free online calculator that works like a real one: type a whole expression, press Enter, and get the answer. Switch to scientific mode for trigonometry, logarithms, powers and roots.',
      features: [
        'Basic and scientific modes — sin, cos, tan, log, ln, square root, powers, factorial and constants like π and e.',
        'Type full expressions with parentheses; operator precedence is respected, so 2 + 3 × 4 is 14.',
        'Keyboard input on desktop and a tap-friendly keypad on mobile.',
        'A history of recent calculations you can tap to reuse, saved on this device.',
        'Degrees or radians for trigonometric functions.',
      ],
      faq: [
        {
          q: 'Can I use the calculator with my keyboard?',
          a: 'Yes. Type numbers and operators directly, use parentheses for grouping, and press Enter to evaluate. Backspace edits the expression and Escape clears it.',
        },
        {
          q: 'What scientific functions are included?',
          a: 'Trigonometric functions (sin, cos, tan and their inverses), logarithms (log and ln), exponents and roots, factorial, percentages, and the constants π and e. A toggle switches between degrees and radians.',
        },
        {
          q: 'Does the calculator keep a history?',
          a: 'Each evaluated expression and its result is added to a history panel. Tap an entry to put it back into the input. The history is stored in your browser and can be cleared at any time.',
        },
        {
          q: 'Is this calculator free?',
          a: 'Yes — no ads, no account and no downloads. Everything runs in your browser and nothing is sent to a server.',
        },
      ],
    },
  },
  {
    slug: 'todo',
    site: 'tools',
    path: '/todo/',
    kind: 'app',
    status: 'live',
    category: 'productivity',
    name: 'To-do list',
    tagline: 'Simple lists with due dates, saved on your device.',
    title: 'To-do list — simple, private, saved in your browser',
    description:
      'A free online to-do list with multiple lists and due dates. Everything is stored in your browser — no account, no sync, no tracking.',
    updated: '2026-08-21',
    about: {
      applicationCategory: 'ProductivityApplication',
      intro:
        'A simple online to-do list with no sign-up. Add tasks, set due dates, tick them off, and keep separate lists for work, home or anything else — all saved in your browser.',
      features: [
        'Multiple lists — switch between them from the list picker.',
        'Due dates with Today, Tomorrow and overdue labels so what matters stands out.',
        'Check items off, edit them in place, or clear completed tasks in one go.',
        'No ads and no tracking — nothing is sent to a server.',
      ],
      faq: [
        {
          q: 'Do I need an account to use the to-do list?',
          a: 'No. There is no sign-up and no login. Your lists are saved in your browser’s local storage on the device you are using.',
        },
        {
          q: 'Will my tasks sync between devices?',
          a: 'Not at the moment. Because everything is stored locally for privacy, each browser keeps its own lists. Clearing your browser data will remove them.',
        },
        {
          q: 'Can I have more than one list?',
          a: 'Yes. Create as many lists as you like — for example Work, Groceries and Weekend — and switch between them. Each list keeps its own tasks and due dates.',
        },
        {
          q: 'Is the to-do list free?',
          a: 'Yes. It is free, ad-free and runs entirely in your browser.',
        },
      ],
    },
  },
  // ─── games.chraegames.cloud ─────────────────────────────────────────────
  {
    slug: 'games',
    site: 'games',
    path: '/',
    kind: 'hub',
    status: 'live',
    name: SITES.games.name,
    tagline: 'Quick games that play in your browser.',
    title: 'Chrae Games — free browser games, no download',
    description:
      'Free browser games with no download, no account and no ads: Sudoku, a bingo caller, online Go, the Magic Tower puzzle RPG and a 3D city builder. Progress saves on your device.',
    verification: SEARCH_VERIFICATION,
    updated: '2026-10-05',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITES.games.name,
        url: `${SITES.games.origin}/`,
        description:
          'Free browser games with no download, no account and no ads: Sudoku, a bingo caller, online Go, the Magic Tower puzzle RPG and a 3D city builder. Progress saves on your device.',
        inLanguage: 'en',
        publisher: { '@type': 'Organization', name: BRAND_NAME, sameAs: [SITE_REPO] },
      },
    ],
  },
  {
    slug: 'sudoku',
    site: 'games',
    path: '/sudoku/',
    kind: 'app',
    status: 'live',
    category: 'games',
    name: 'Sudoku',
    tagline: 'Four difficulties, pencil marks, hints — progress saved on your device.',
    title: 'Sudoku — free online Sudoku puzzles, easy to expert',
    description:
      'Play free Sudoku online with four difficulty levels, pencil marks, hints and undo. Every puzzle has a unique solution and your game is saved on your device.',
    updated: '2026-08-21',
    about: {
      applicationCategory: 'GameApplication',
      intro:
        'Play Sudoku online for free, with no ads and no account. Choose easy, medium, hard or expert, use pencil marks to track candidates, and pick up where you left off — your game is saved on this device.',
      features: [
        'Four difficulty levels: easy, medium, hard and expert. Every puzzle is generated with exactly one solution.',
        'Fast input: tap a number, then tap the cells where it goes — or pick a cell first, or use the keyboard.',
        'Pencil marks (notes) with automatic clean-up when you place a digit, plus undo, erase and hints.',
        'Conflict highlighting, same-number highlighting and a timer.',
        'Your current game is saved automatically and resumes when you come back.',
      ],
      faq: [
        {
          q: 'How do you play Sudoku?',
          a: 'Fill the 9×9 grid so that every row, every column and every 3×3 box contains the digits 1 to 9 exactly once. Start from the given numbers and use logic — never guessing — to work out the rest.',
        },
        {
          q: 'What do the difficulty levels mean?',
          a: 'Easy puzzles start with around 40 given numbers and can be solved with basic scanning. Medium, hard and expert remove more givens (down to about 24), so you will need pencil marks and more advanced techniques.',
        },
        {
          q: 'How do pencil marks work?',
          a: 'Turn on Notes (or press N) and tap a number to write it as a small candidate in the selected cell. When you place a final digit, matching notes in the same row, column and box are cleared automatically.',
        },
        {
          q: 'Does a hint give away the answer?',
          a: 'A hint fills in the selected cell with its correct value (or fixes the first wrong cell if there is one). Hints are counted, so you can see how many you used when you finish.',
        },
        {
          q: 'Is my game saved?',
          a: 'Yes. The puzzle, your entries, notes and the timer are saved in your browser, so closing the tab and coming back later resumes the same game.',
        },
      ],
    },
  },
  {
    slug: 'bingo',
    site: 'games',
    path: '/bingo/',
    kind: 'app',
    status: 'live',
    category: 'games',
    name: 'Bingo caller',
    tagline: 'Random number caller for real-life bingo — 75, 90 or 30 ball, with a flashboard and call history.',
    title: 'Bingo number generator — free random bingo caller (75, 90 & 30 ball)',
    description:
      'Free bingo number generator and caller for real-life games. Draws truly random numbers one at a time, shows the B-I-N-G-O letter, tracks every call on a flashboard and can read calls aloud. 75-ball, 90-ball and 30-ball.',
    updated: '2026-08-24',
    about: {
      applicationCategory: 'UtilitiesApplication',
      intro:
        'A bingo caller for games you play in real life. Instead of a cage and balls, tap once to draw the next number at random, see it big enough for the whole room with its B-I-N-G-O letter, and keep an ordered record of every call so disputes are settled at a glance. It does not generate cards — bring your own.',
      features: [
        'Truly random draws: each number is picked uniformly from the balls still in play using the browser\'s cryptographic random generator, so no number is ever repeated in a game.',
        '75-ball (B-I-N-G-O, 1–75), 90-ball (UK / housie, 1–90) and 30-ball speed bingo.',
        'A big current-call display with the column letter, a flashboard that lights up every called number, and a call history in order.',
        'Undo an accidental draw, clear the board with New game, and pick up where you left off — the game is saved on your device.',
        'Optional auto-call on a timer (5–30 seconds) and voice announcements that read each call aloud.',
        'Keyboard-friendly: Space draws the next number, U undoes, A toggles auto-call.',
      ],
      faq: [
        {
          q: 'How are the numbers picked?',
          a: 'Every draw picks one of the remaining numbers with equal probability using the browser\'s cryptographically secure random generator (the same one used for encryption keys), with rejection sampling so no number is favoured. A number that has been called cannot come up again until you start a new game.',
        },
        {
          q: 'Which letter goes with which numbers?',
          a: 'In 75-ball bingo B covers 1–15, I covers 16–30, N covers 31–45, G covers 46–60 and O covers 61–75. 30-ball speed bingo uses B for 1–10, I for 11–20 and N for 21–30. 90-ball bingo has no letters — numbers are called on their own.',
        },
        {
          q: 'Does this make bingo cards?',
          a: 'No. It is a caller: it replaces the ball cage and the flashboard. Use it alongside printed cards or any cards you already have.',
        },
        {
          q: 'What if I draw a number by mistake?',
          a: 'Press Undo last (or the U key) to take back the most recent call. It goes back into the pool and the flashboard and history update immediately.',
        },
        {
          q: 'Can it call numbers automatically?',
          a: 'Yes. Turn on Auto-call and pick an interval from 5 to 30 seconds; it draws a new number at that pace until you pause it or the numbers run out. Turn on Voice to have each call read aloud by your browser.',
        },
        {
          q: 'Is my game saved if I close the tab?',
          a: 'Yes. The called numbers and your settings are saved in this browser, so reopening the page resumes the same game.',
        },
      ],
    },
  },
  {
    slug: 'go',
    site: 'games',
    path: '/go/',
    kind: 'app',
    status: 'live',
    category: 'games',
    name: 'Go',
    tagline: 'Play Go online against another person — quick match or a private room, 9×9 to 19×19, no account.',
    title: 'Play Go online with a friend — free two-player Go board (9×9, 13×13, 19×19)',
    description:
      'Free online Go for two people. Get paired with whoever is waiting, or create a room and send a friend the link. 9×9, 13×13 and 19×19 boards, captures, ko and area scoring. Moves travel directly between the two browsers — no account, no server storing your game.',
    updated: '2026-09-02',
    about: {
      applicationCategory: 'GameApplication',
      intro:
        'A two-player Go board for people in different places. Pick a board size and press Find an opponent to be paired with the next person waiting, or create a room and send a friend the four-letter code. The board enforces the rules — captures, suicide, ko — and scores the game when both players pass.',
      features: [
        'Quick match: the first two people waiting on the same board size are paired automatically. Colours are drawn at random.',
        'Private rooms: create a room to get a four-letter code and a share link; the game starts the moment your friend opens it.',
        '9×9, 13×13 and 19×19 boards with star points, a last-move marker and a hover preview of your stone.',
        'Rules enforced on both sides: captures are removed, suicide is refused, and simple ko stops an immediate retake.',
        'Two consecutive passes end the game with area scoring (stones plus surrounded territory) and 7.5 komi; either player can resign.',
        'Peer-to-peer: after the two browsers are introduced, every move goes straight from one to the other over WebRTC. Nothing is stored on a server.',
      ],
      faq: [
        {
          q: 'How does the matching work without a server?',
          a: 'Each browser announces itself on public Nostr relays under a room name — the lobby for your board size, or your private room code. When two browsers see each other they exchange connection details through the relays and open a direct WebRTC channel. From then on the relays are out of the picture and moves travel browser to browser.',
        },
        {
          q: 'What leaves my device?',
          a: 'The connection handshake (which includes your public IP address) passes through public relays and reaches your opponent, as with any peer-to-peer call. The moves themselves go directly to the other player. Nothing is stored anywhere: close the tab and the game is gone.',
        },
        {
          q: 'It says it is looking for an opponent but nobody comes.',
          a: 'Quick match only pairs people who are waiting at the same time on the same board size. Create a room instead and send a friend the link — the game starts as soon as they open it.',
        },
        {
          q: 'We both see each other but the game never starts.',
          a: 'Some networks (strict corporate firewalls, some mobile carriers) block direct peer-to-peer connections. There is no relay server to fall back on, so try a different network, a phone hotspot, or a different browser.',
        },
        {
          q: 'How is the game scored?',
          a: 'Area scoring: each player counts their stones on the board plus the empty points surrounded only by their stones, and White adds 7.5 komi. Dead stones are not marked automatically, so capture anything you think is dead before you pass. Two passes in a row end the game.',
        },
        {
          q: 'What happens if my opponent leaves?',
          a: 'The game ends and you are recorded as the winner. There is no reconnection — if either tab closes or the connection drops, start a new game.',
        },
      ],
    },
  },
  {
    slug: 'magic-tower',
    site: 'games',
    path: '/magic-tower/',
    kind: 'app',
    status: 'live',
    category: 'games',
    name: 'Magic Tower',
    tagline: '魔塔 — ten towers of 99 generated floors. Every fight is arithmetic; every floor is a puzzle.',
    title: 'Magic Tower 魔塔 — free online puzzle RPG, 10 × 99 generated floors',
    description:
      'Play Magic Tower (魔塔 / Tower of the Sorcerer) online for free. Ten playthroughs of 99 procedurally generated floors, deterministic combat with a live damage manual, keys, gems, potions, vaults you can only reach by breaching the floor, and blessings after every boss. Saves stay on your device.',
    updated: '2026-09-03',
    about: {
      applicationCategory: 'GameApplication',
      intro:
        'A Magic Tower (魔塔, the Chinese classic descended from Tower of the Sorcerer) that builds itself. Ten towers of 99 floors are generated from a seed, and each one is proven solvable before you set foot in it: the generator walks its own solution line and checks that a careless line fails. Combat is pure arithmetic with no dice — the monster manual tells you exactly what a fight costs before you commit, so the whole game is deciding what to fight, in what order, and where to spend keys, gems and potions.',
      features: [
        'Ten playthroughs of 99 floors. Each tower adds new monster abilities (first strike 先攻, magic 魔攻, sturdy 坚固, vampire 吸血 and more), new rules and new puzzle types; one of them is climbed fifty floors up and forty-nine down.',
        'Deterministic combat exactly as in the classic: you hit for ATK − DEF, the monster hits back, damage is known in advance. The manual shows every monster on the floor, what it will cost you, and the ATK or DEF that would make it cheaper.',
        'Breach Stones 穿层石: a scarce item that punches through the ceiling or the floor onto the same square of the next level. It skips a guard, or opens a vault 密室 — a sealed room with no door.',
        'Route ledger: click any tile to see every fight, door and pickup on the way and your stats afterwards before you move.',
        'A blessing after every zone boss, elites with combined abilities, keys that must sometimes be carried back to an earlier floor, and a solvability check that runs on every tower.',
        'Saves in your browser: an autosave after every step plus three manual slots. Getting stuck is part of the genre — that is what the slots are for.',
      ],
      faq: [
        {
          q: 'How does combat work?',
          a: 'Each turn you deal your ATK minus the monster’s DEF; if that is zero you cannot fight it at all. The monster deals its ATK minus your DEF back after every one of your hits except the last. Special abilities change the sum: first strike adds one hit, magic ignores your DEF, sturdy monsters take only one damage per hit, and so on. The manual does this arithmetic for you.',
        },
        {
          q: 'Is every tower really beatable?',
          a: 'Yes. Floors are generated from a dependency graph (which key opens which door, which gem makes which monster affordable) and the generator then walks a full solution line through the zone, setting each monster’s numbers as it goes so that line survives. A search then looks for a stronger line and re-tunes the boss to it, and six naive strategies are checked to make sure the obvious way through fails. What is not guaranteed is that your line works: spend the wrong key or fight the wrong monster and you can get stuck, exactly as in the classic.',
        },
        {
          q: 'What are Breach Stones and vaults?',
          a: 'A Breach Stone lets you punch through the ceiling or the floor and land on the same square of the next level, as long as that square is open. The hole stays as a two-way passage. Vaults are sealed rooms with no door that hold one valuable item; the only way in is to breach from the aligned square on the floor below. Each zone boss drops one stone, so where you use it is the decision.',
        },
        {
          q: 'What changes between the ten towers?',
          a: 'Nothing carries over but the unlock. Each tower adds abilities, rules and puzzle types: elites, magic and sturdy monsters, a tower with a false summit where the true path goes down from floor one, keys that turn to gold at every boss, mirrored floors, counter-attacks, zones that cost HP to walk past, auras that make kill order matter, and invincible monsters that need the cross.',
        },
        {
          q: 'Where is my game saved?',
          a: 'In this browser only. There is an autosave after every move and three manual slots. Only the seed and what you changed are stored; the tower is rebuilt from them when you load.',
        },
      ],
    },
  },
  {
    slug: 'city',
    site: 'games',
    path: '/city/',
    kind: 'app',
    status: 'live',
    category: 'games',
    name: 'City',
    tagline: 'A 3D city simulation with a progression ladder. Zone, build, tax and watch a statistical model of a city respond.',
    title: 'City — free 3D city-building simulation in your browser',
    description:
      'Build a city in 3D in your browser: zone residential, commercial and industrial land, lay roads, run power, water and garbage, fund fire, police, schools and hospitals, climb nine population milestones that unlock new buildings, and watch demand, land value, traffic, pollution, crime and your budget respond every month. Everything is generated and simulated on your device.',
    updated: '2026-09-08',
    about: {
      applicationCategory: 'GameApplication',
      intro:
        'A city builder in the SimCity tradition, rendered in 3D from nothing but code. The map, every building and every vehicle are generated on the fly, and underneath runs a detailed statistical simulation: residential, commercial and industrial demand by wealth tier, desirability per tile, land value, air and water pollution, crime, fire risk, traffic assignment over your road network, power, water and rubbish collection, service coverage, city ordinances and a monthly budget. Nine population milestones unlock buildings and pay a grant, every troubled building shows what it is missing, and the city lives in this browser tab only.',
      features: [
        'Zoning with three densities and three wealth tiers per zone type. Buildings grow, upgrade, change wealth and get abandoned based on demand and how desirable the tile is, and the inspector lists exactly what a lot needs for its next level.',
        'A milestone ladder from Outpost to Megalopolis: each population tier unlocks buildings, denser zoning, avenues, loans or policies and pays a cash grant, so a first city teaches itself.',
        'Thirty-one facilities: wind, coal, gas, solar, hydro and nuclear power, pumps, towers and a treatment plant, landfill, incinerator and recycling centre, fire and police stations and headquarters, clinics and a hospital, schools, a library and a university, parks, a plaza, a bus depot, city hall, a stadium and a landmark tower.',
        'Power, water and garbage as real networks: plants, pumps and collection facilities feed connected tiles, a shortfall causes brownouts, dry lots or rubbish piling up, and floating icons over buildings say which of eight problems each lot has.',
        'Traffic assigned every month over the road graph with congestion feedback; buses take cars off the streets, avenues carry more, and eight ordinances trade a monthly cost for less crime, cleaner air, fewer fires or more shoppers.',
        'A monthly ledger with tax rates per zone, service funding, loans and policies, an advisor that points at the problem holding the city back, fourteen data views with legends, city statistics with 30-year graphs, and a day/night cycle with lit windows.',
      ],
      faq: [
        {
          q: 'How does the simulation work?',
          a: 'The city is a 128 × 128 grid of tiles. Every tick the simulation updates a set of per-tile layers: desirability, land value, pollution, crime, fire risk, utility and service coverage, traffic and commute time. Buildings grow or decay from those layers and from city-wide demand for each zone type and wealth tier, and once a month taxes are collected, services are paid for, demand is recomputed and milestones are checked. It is a statistical model in the style of the classic SimCity games, not one that tracks individual citizens.',
        },
        {
          q: 'Why does nothing grow?',
          a: 'Zones need a road within three tiles, power, and (for medium and high density) water. Industry also needs a road that reaches the edge of the map so goods can leave. Turn on the problem icons or click a building with the inspect tool: it lists what is missing and how to fix it, and the advisor names the most likely city-wide cause.',
        },
        {
          q: 'How do I unlock more buildings?',
          a: 'Grow the population. Each milestone (400 residents for a hamlet, 1,200 for a village, 3,000 for a town and so on up to 100,000) unlocks a bundle of buildings and features and pays a grant. Locked tools show the tier they need, and the milestones panel lists the whole ladder. Nothing is ever locked again if the population later drops.',
        },
        {
          q: 'Is the 3D scene downloaded from somewhere?',
          a: 'No. There are no models or textures; the terrain, buildings, roads, trees and vehicles are built from code in your browser. The only download is the three.js rendering library, which loads once when you open the page.',
        },
        {
          q: 'Where is my city saved?',
          a: 'In this browser only, automatically at the end of every month and when you leave the page. Only the layers you changed are stored; the terrain is rebuilt from the seed. Clearing site data deletes the city.',
        },
        {
          q: 'Does it run on a phone?',
          a: 'Yes, on any device with WebGL. On a touch screen one finger pans and two fingers zoom and rotate; turn on the paint toggle to apply the selected tool with a single finger drag.',
        },
      ],
    },
  },
  // ─── TV buying guide (one app + four content chapters under /tv-guide/) ──
  // Dates: keep every `updated` here equal to GUIDE_REVIEWED in
  // src/tools/tv-guide/data.ts (data.test.ts enforces the lockstep).
  {
    slug: 'tv-guide',
    site: 'tools',
    path: '/tv-guide/',
    kind: 'app',
    status: 'live',
    category: 'utilities',
    name: 'TV buying guide',
    tagline: 'OLED vs QLED vs Mini-LED, and what every brand\'s name for them really means — updated for 2026.',
    title: 'TV buying guide 2026 — OLED, QLED, Mini-LED & RGB explained',
    description:
      'Plain-English guide to 2026 TV technology: how OLED and LCD panels work, what Neo QLED, QNED, ULED, Micro RGB and other brand names actually mean, pros and cons, and which type suits your room. No models, no prices.',
    updated: '2026-08-26',
    about: {
      applicationCategory: 'EducationalApplication',
      intro:
        'A buying guide for people who want to understand what they are paying for before they walk into a store. It explains the two families every modern TV belongs to (LCD with a backlight, and self-emitting OLED), every variation you will see in 2026, and decodes the marketing names each manufacturer uses for the same technology. It deliberately does not list models, specifications or prices.',
      features: [
        'Technology explainers with animated layer diagrams showing where the light comes from and how colour is made.',
        'A brand-name decoder: type a name like Neo QLED, QNED, ULED, Bravia, Micro RGB or True RGB and see the real panel technology behind it.',
        'Brand pages for Samsung, LG, Sony, TCL, Hisense, Panasonic, Roku, Amazon Fire TV and Vizio with links to their official sites.',
        'Side-by-side comparison of any technologies on black level, brightness, colour, viewing angle, burn-in risk, blooming, motion and typical price tier.',
        'A short "help me choose" that turns your room, what you watch and your budget into a recommended technology and the names to look for.',
        'Dated: every page shows when it was last reviewed, and a changelog records what changed as new technology arrives.',
      ],
      faq: [
        {
          q: 'Is QLED a type of OLED?',
          a: 'No. QLED is an LCD with a quantum-dot colour film in front of a backlight. OLED has no backlight — each pixel makes its own light and can switch fully off. The similar names are marketing; the technologies are unrelated.',
        },
        {
          q: 'Are Neo QLED, QNED, ULED and Bravia different technologies?',
          a: 'They are brand names, not technologies. Neo QLED is Samsung\'s name for mini-LED with quantum dots; QNED is LG\'s LCD range (only some models have mini-LED); ULED is Hisense\'s umbrella for its premium LCDs; Bravia is simply Sony\'s TV brand and covers LCD and OLED alike. The decoder page maps each name to what is inside.',
        },
        {
          q: 'What are RGB Mini-LED, Micro RGB and True RGB?',
          a: 'The same new idea under three names: a mini-LED LCD whose backlight uses separate red, green and blue LEDs instead of white or blue ones, so colour is made in the backlight with no conversion loss. Samsung says Micro RGB, Sony says True RGB, Hisense and TCL say RGB Mini-LED. None of them is Micro-LED.',
        },
        {
          q: 'Which is better, OLED or Mini-LED?',
          a: 'It depends on the room. OLED wins on black level, viewing angle and motion, so it is the pick for dim rooms and film nights. Mini-LED is far brighter with no burn-in risk, so it wins in sunlit rooms, for sport and for anything that leaves static content on screen for hours. The "help me choose" on the overview page walks through the trade-off.',
        },
        {
          q: 'Does this guide recommend specific models or prices?',
          a: 'No. It has no live product data, so it stays at the level of technologies and the series names brands use for them, and links you to each manufacturer\'s official site. Use it to decide what kind of TV you want, then compare current models in independent reviews.',
        },
        {
          q: 'How current is the information?',
          a: 'Every page shows the date it was last reviewed, and the changelog on the overview lists what changed. The guide is revised as new panel technologies reach the market.',
        },
      ],
    },
  },
  {
    slug: 'tv-guide/technologies',
    site: 'tools',
    path: '/tv-guide/technologies/',
    kind: 'content',
    status: 'live',
    area: 'tv-guide',
    name: 'TV technologies explained',
    label: 'Technologies',
    tagline: 'Edge-lit to Tandem OLED: how each panel makes light and colour, with pros, cons and animated diagrams.',
    title: 'TV panel technologies explained — LCD, QLED, Mini-LED, RGB Mini-LED, OLED & QD-OLED (2026)',
    description:
      'How every 2026 TV panel works, layer by layer: edge-lit and direct-lit LED, QLED, Mini-LED, RGB Mini-LED, Micro RGB, SQD-MiniLED, W-OLED, QD-OLED and Tandem OLED — with animated diagrams, pros and cons, and what each is best for.',
    ogType: 'article',
    updated: '2026-08-26',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'TV panel technologies explained — LCD, QLED, Mini-LED, RGB Mini-LED, OLED & QD-OLED',
        description:
          'How every 2026 TV panel works, layer by layer, with animated diagrams, pros and cons, and what each is best for.',
        url: `${SITES.tools.origin}/tv-guide/technologies/`,
        datePublished: '2026-08-26',
        dateModified: '2026-08-26',
        author: { '@type': 'Organization', name: BRAND_NAME },
        publisher: { '@type': 'Organization', name: BRAND_NAME },
      },
    ],
  },
  {
    slug: 'tv-guide/brands',
    site: 'tools',
    path: '/tv-guide/brands/',
    kind: 'content',
    status: 'live',
    area: 'tv-guide',
    name: 'TV brand names decoded',
    label: 'Brand names',
    tagline: 'What Samsung, LG, Sony, TCL, Hisense and the rest actually mean by Neo QLED, QNED, Bravia, ULED, Micro RGB and more.',
    title: 'TV brand names decoded — Neo QLED, QNED, ULED, Bravia, Micro RGB & more by manufacturer (2026)',
    description:
      'Brand by brand, what each TV marketing name means: Samsung Crystal UHD / QLED / Neo QLED / Micro RGB, LG QNED / OLED evo / Primary RGB Tandem, Sony Bravia, TCL Q / QM / SQD, Hisense ULED, Panasonic, Roku, Amazon Fire TV and Vizio — mapped to the real panel technology.',
    ogType: 'article',
    updated: '2026-08-26',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'TV brand names decoded — what each manufacturer\'s marketing name really means',
        description:
          'Brand by brand, each TV marketing name mapped to the real panel technology behind it.',
        url: `${SITES.tools.origin}/tv-guide/brands/`,
        datePublished: '2026-08-26',
        dateModified: '2026-08-26',
        author: { '@type': 'Organization', name: BRAND_NAME },
        publisher: { '@type': 'Organization', name: BRAND_NAME },
      },
    ],
  },
  {
    slug: 'tv-guide/decoder',
    site: 'tools',
    path: '/tv-guide/decoder/',
    kind: 'content',
    status: 'live',
    area: 'tv-guide',
    name: 'TV name decoder',
    label: 'Decoder',
    tagline: 'Type any brand name and see the real technology — or pick a technology and see every brand\'s name for it.',
    title: 'TV name decoder — look up any brand name and find the real panel technology',
    description:
      'Two-way lookup between TV marketing names and panel technologies. Search Neo QLED, QNED, ULED, Bravia, True RGB or any other name to see what is inside, or pick a technology to see what every brand calls it.',
    updated: '2026-08-26',
  },
  {
    slug: 'tv-guide/compare',
    site: 'tools',
    path: '/tv-guide/compare/',
    kind: 'content',
    status: 'live',
    area: 'tv-guide',
    name: 'Compare TV technologies',
    label: 'Compare',
    tagline: 'Pick up to four technologies and compare blacks, brightness, colour, viewing angle, burn-in risk, blooming, motion and price tier.',
    title: 'Compare TV technologies side by side — OLED vs QLED vs Mini-LED vs RGB Mini-LED',
    description:
      'Side-by-side comparison of TV panel technologies: OLED, QD-OLED, Tandem OLED, Mini-LED, RGB Mini-LED, QLED and LED — rated on black level, brightness, colour, viewing angle, burn-in risk, blooming, motion clarity and typical price tier.',
    updated: '2026-08-26',
  },
];

export function siteOf(entry: SiteEntry): Site {
  return SITES[entry.site];
}

/** The page served at a site's '/': the FIRE planner itself, or the games / tools landing. */
export function siteHome(site: SiteId): SiteEntry {
  return PAGES.find(p => p.site === site && p.path === '/')!;
}

export function livePages(site?: SiteId): SiteEntry[] {
  return PAGES.filter(p => p.status === 'live' && (!site || p.site === site));
}

/** Live apps, in manifest order. */
export function liveTools(site?: SiteId): SiteEntry[] {
  return livePages(site).filter(p => p.kind === 'app');
}

/** Live content guides, in manifest order. */
export function contentPages(site?: SiteId): SiteEntry[] {
  return livePages(site).filter(p => p.kind === 'content');
}

/**
 * Other live tools on the same site for "More …" links: same category first,
 * then the rest in manifest order. Never crosses sites — the other sites are
 * linked once, by their home page (otherSites).
 */
export function relatedTools(entry: SiteEntry): SiteEntry[] {
  const others = liveTools(entry.site).filter(t => t.slug !== entry.slug);
  return [
    ...others.filter(t => t.category === entry.category),
    ...others.filter(t => t.category !== entry.category),
  ];
}

/** Home pages of the other two sites, for the "More from Chrae Lab" links. */
export function otherSites(site: SiteId): SiteEntry[] {
  return SITE_IDS.filter(id => id !== site).map(siteHome);
}

/** Live apps in a category (landings show no placeholders for unshipped tools). */
export function toolsIn(category: CategoryId): SiteEntry[] {
  return liveTools().filter(p => p.category === category);
}

export function byPath(site: SiteId, path: string): SiteEntry | undefined {
  return PAGES.find(p => p.site === site && p.path === path);
}

/** Resolves a slug to its entry; throws at build/test time on a typo. */
export function bySlug(slug: string): SiteEntry {
  const entry = PAGES.find(p => p.slug === slug);
  if (!entry) throw new Error(`Unknown page slug: ${slug}`);
  return entry;
}

/** Path of a slug on its own site. */
export function pathFor(slug: string): string {
  return bySlug(slug).path;
}

/** Site home → parent app (content pages) → the page itself, without repeats (the FIRE home is both). */
export function breadcrumbs(entry: SiteEntry): SiteEntry[] {
  const trail: SiteEntry[] = [siteHome(entry.site)];
  if (entry.area) {
    const parent = PAGES.find(p => p.slug === entry.area);
    if (parent && !trail.includes(parent)) trail.push(parent);
  }
  if (!trail.includes(entry)) trail.push(entry);
  return trail;
}

export function siteUrl(site: SiteId, path: string): string {
  return `${SITES[site].origin}${path}`;
}

export function absoluteUrl(entry: SiteEntry): string {
  return siteUrl(entry.site, entry.path);
}

/** Link to `to` from a page on `from`: a relative path on the same site, else an absolute URL. */
export function hrefFor(to: SiteEntry, from: SiteId): string {
  return to.site === from ? to.path : absoluteUrl(to);
}
