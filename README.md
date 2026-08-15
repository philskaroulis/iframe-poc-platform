# iframe-poc-platform

**Part of a two-repo platform/partner `postMessage` POC.** This repo simulates a **platform** that embeds third-party partner content in a cross-origin iframe and monitors user activity inside it. The partner repo (`iframe-poc-partner`) contains the embedded content and is required to load this platform's `browser-event-relay.js` tracking script by reference.

## Architecture

```
┌─────────────────────────────────────┐
│    PLATFORM PAGE (index.html)       │
│  (this repo, e.g., Vercel)          │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  Header (ACTIVE/INACTIVE)    │   │
│  │  ui-manager.js               │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  Partner Iframe              │   │
│  │  (cross-origin, GitHub Pages)│   │
│  └──────────────────────────────┘   │
│                                     │
│  fake-usage-meter.js:               │
│  - Validates & routes messages      │
│  - Enforces rate limits             │
│  - Manages event handlers           │
└─────────────────────────────────────┘
         ▲
         │ postMessage() events
         │
    ┌────┴──────────────────┐
    │  PARTNER IFRAME       │
    │  (GitHub Pages)       │
    │                       │
    │ Loads browser-event-  │
    │ relay.js from         │
    │ platform by URL       │
    │ (cross-origin script) │
    │                       │
    │ - Detects events      │
    │ - Sends messages      │
    └───────────────────────┘
```

## How It Works

### The Platform (This Repo)

1. **`index.html`** — the host page with a status header and iframe embed.
2. **`styles.css`** — visual styling for the header and layout.
3. **`ui-manager.js`** — manages the ACTIVE/INACTIVE header state and countdown timer based on activity events.
4. **`fake-usage-meter.js`** — listens for activity messages from the partner iframe and:
   - Validates message source and event type
   - Checks message origin against the known partner origin
   - Validates timestamp (rejects clock-skew events >5s off)
   - Enforces rate limiting via circuit breaker (max 100 events/sec)
   - Routes validated events to registered handlers
   - Updates UI state via `UIManager`
5. **`browser-event-relay.js`** — the **tracking script that partners are required to embed**. See below.
6. **`env-config.js`** — resolves the partner's URL/origin per environment (dev vs. prod).

### The Tracking Script

**`browser-event-relay.js`** (production: `.min.js`) is **hosted and distributed by this platform repo**. Partners must load it via `<script src>` in their embedded content (see `iframe-poc-partner` for an example).

The script:
- Detects user activity inside the iframe (click, keypress, scroll, mousemove, visibility change)
- Derives the trusted parent (platform) origin from `document.referrer` (read by browser, available cross-origin if platform iframe has `referrerpolicy="strict-origin"`)
- Sends minimal, focused messages via `window.parent.postMessage()`:
  ```javascript
  {
    source: "browser-event-relay",
    type: "IFRAME_CLICK_MESSAGE",    // or IFRAME_KEYPRESS_MESSAGE, IFRAME_SCROLL_MESSAGE, etc.
    timestamp: 1691743200000
  }
  ```
- Supports lifecycle management (`init()`, `cleanup()`, `isInitialized()`) for SPAs.
- Auto-initializes on load but can be manually managed for partners running single-page apps.

See **[PARTNER_INTEGRATION.md](PARTNER_INTEGRATION.md)** for how partners integrate this script into their own content.

## Message Contract

The partner iframe is expected to send messages in this exact format:

| Event | Type | Throttle | Notes |
|-------|------|----------|-------|
| Click | `IFRAME_CLICK_MESSAGE` | None | Sent every click |
| Keypress | `IFRAME_KEYPRESS_MESSAGE` | None | Sent on every keydown |
| Scroll | `IFRAME_SCROLL_MESSAGE` | 200ms | Throttled to 5 events/sec max |
| Mouse move | `IFRAME_MOUSEMOVE_MESSAGE` | 500ms | Throttled to 2 events/sec max |

## Security & Validation

The platform validates **every** incoming message via a strict multi-layer check:

1. **Message source** — only messages with `source: "browser-event-relay"` are processed
2. **Event type** — only types starting with `IFRAME_` are accepted
3. **Timestamp deviation** — events with timestamps >5 seconds off the current time are rejected (detects clock-skew or malicious timestamps)
4. **Origin validation** — message origin must match the configured `PARTNER_ORIGIN` (only the partner can send valid messages)
5. **Rate limiting** — if >100 events arrive in one second, the circuit breaker opens and drops excess messages until the rate normalizes

## Configuration

Edit `env-config.js` to change the partner's URL or origin:

```javascript
const ENV_CONFIG = {
    prod: {
        PARTNER_URL: 'https://...',     // Where the partner's content is hosted
        PARTNER_ORIGIN: 'https://...'   // Origin to trust for message validation
    },
    dev: {
        PARTNER_URL: 'https://...',
        PARTNER_ORIGIN: 'https://...'
    }
};
```

## Usage

### Basic Setup

1. Include scripts in order:
   ```html
   <script src="env-config.js"></script>
   <script src="ui-manager.js"></script>
   <script src="fake-usage-meter.js"></script>
   ```

2. Create an iframe with the partner's content:
   ```html
   <iframe
     id="activity-iframe"
     sandbox="allow-scripts"
     referrerpolicy="strict-origin"
   ></iframe>
   ```
   **Note:** `referrerpolicy="strict-origin"` is required so that `document.referrer` inside the iframe contains the platform's origin (needed for the partner to trust messages back to you).

3. Set the iframe source:
   ```javascript
   const PARTNER_URL = window.EnvConfig.get('PARTNER_URL');
   document.getElementById('activity-iframe').src = PARTNER_URL;
   ```

### Lifecycle Management (SPAs)

If your platform is a single-page app, manage lifecycle to prevent memory leaks:

```javascript
// On component mount
window.UsageMeter.init();
window.UIManager.init();

// On component unmount
window.UsageMeter.cleanup();
window.UIManager.cleanup();
```

See **[SPA_INTEGRATION.md](SPA_INTEGRATION.md)** for detailed React/Vue/Angular examples.

### Debug Mode

Enable verbose logging in the browser console:

```javascript
window.UsageMeter.setDebug(true);
```

Output example:
```
[Usage Meter] Message received: {source: "browser-event-relay", type: "IFRAME_CLICK_MESSAGE", timestamp: 1691743200000}
[Usage Meter] User clicked inside iframe {timestamp: 1691743200000}
```

### Register Custom Event Handler

```javascript
window.UsageMeter.registerHandler('IFRAME_CLICK_MESSAGE', (details, timestamp) => {
  console.log('User clicked in partner iframe', { timestamp });
  // Send to analytics, update database, etc.
});
```

### Monitor Rate Limiting

```javascript
// Check if partner is being rate-limited
window.UsageMeter.getCircuitBreakerState();  // 'CLOSED', 'OPEN', 'HALF_OPEN'

// Get current event count this second
window.UsageMeter.getEventCountThisSecond();

// Get current configuration
window.UsageMeter.getConfig();
```

## Local Development

### Run Both Repos Locally (Different Origins)

For true cross-origin testing, run partner and platform on different ports:

```bash
# Terminal 1: Serve partner repo on port 8000
cd ../iframe-poc-partner
python3 -m http.server 8000

# Terminal 2: Serve platform on port 8001
python3 -m http.server 8001

# Terminal 3: Open browser
# http://localhost:8001
# ↓
# Detects: localhost environment
# ↓
# Loads: http://localhost:8000/index.html (or index-dev.html)
# ↓
# Cross-origin: platform and partner on different ports = different origins
```

Then update `env-config.js` dev config to:
```javascript
dev: {
    PARTNER_URL: 'http://localhost:8000/index.html',
    PARTNER_ORIGIN: 'http://localhost:8000'
}
```

Open browser console and confirm:
- Header turns GREEN when you interact with the iframe
- Countdown timer counts down
- `window.UsageMeter.setDebug(true)` shows message traffic
- No console errors (especially no `frameElement` or `referrer` errors)

### Verify Referrer is Available

In the browser console:

```javascript
// Platform page
console.log(window.location.origin);  // Should be http://localhost:8001

// In partner iframe (open iframe's console via DevTools)
console.log(document.referrer);  // Should be http://localhost:8001
```

If `document.referrer` is empty, check the platform's iframe `referrerpolicy` — it must be `"strict-origin"` or `"strict-origin-when-cross-origin"` (not `"no-referrer"`).

## Deployment

### To Vercel (Platform)

```bash
git push origin main
# Vercel auto-deploys
# Platform is now live at your Vercel domain
```

Update `env-config.js` prod config with your actual Vercel domain:
```javascript
prod: {
    PARTNER_URL: 'https://philskaroulis.github.io/iframe-poc-partner/index.html',
    PARTNER_ORIGIN: 'https://philskaroulis.github.io'
}
```

### Partner Deployment

Partner content is deployed separately (see `iframe-poc-partner` README). Platform's `env-config.js` points to the partner's deployed URL — update it when partner deploys.

## Browser Compatibility

Works in all modern browsers supporting:
- `postMessage()` API
- ES6 (arrow functions, destructuring, const/let)
- `requestAnimationFrame()`
- `Document.referrer` (cross-origin readable when `Referrer-Policy` allows)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Platform host page with iframe embed |
| `ui-manager.js` | Activity state management, countdown timer, header styling |
| `fake-usage-meter.js` | Message handling, validation, security, rate limiting, event routing |
| `styles.css` | Styling for platform page |
| `browser-event-relay.js` | Tracking script (unminified, for development) |
| `browser-event-relay.min.js` | Tracking script (minified, for production distribution) |
| `env-config.js` | Environment detection and partner URL/origin resolution |
| `PARTNER_INTEGRATION.md` | How partners integrate the platform's tracking script |
| `SPA_INTEGRATION.md` | How platform SPAs manage lifecycle to prevent memory leaks |

## Troubleshooting

### Referrer is empty in partner iframe

**Check:**
- Platform's iframe has `referrerpolicy="strict-origin"` (not `"no-referrer"`)
- Partner's CSP header doesn't suppress referrer (check DevTools Network tab for CSP headers)

**Test:**
```javascript
// In partner iframe console
console.log(document.referrer);  // Should show platform's origin
```

### Messages not being processed

Enable debug mode and check:
```javascript
window.UsageMeter.setDebug(true);
// Interact with iframe
// Look for "[Usage Meter]" console messages
```

If no messages appear:
- Confirm partner script loaded (check `window.BrowserEventRelay`)
- Confirm partner script is the right version (check `window.BrowserEventRelay.getVersion()`)
- Confirm partner is sending messages (check partner iframe's console for `[browser-event-relay]` messages)

### "Cannot read properties of null" or referrer/frameElement errors

**Old code detected.** This repo previously used `window.frameElement.dataset.parentOrigin` which is `null` for cross-origin iframes. If you're using an old version of `browser-event-relay.js`, regenerate from source in this repo — the fix is to derive origin from `document.referrer` instead.

### Header not changing color

- Ensure you're interacting **inside the partner iframe** (not the platform page)
- Check that `ui-manager.js` loaded before `fake-usage-meter.js`
- Verify both scripts exist: `window.UsageMeter` and `window.UIManager` should be defined in console

### Rate limiting preventing events

- Check circuit breaker state: `window.UsageMeter.getCircuitBreakerState()`
- If OPEN, reduce event frequency or increase `MAX_EVENTS_PER_SECOND` in `fake-usage-meter.js`
- Look for runaway event listeners in partner script

## Technical Notes

- Pure JavaScript (no dependencies)
- Modular architecture (UI vs. messaging vs. validation)
- Passive event listeners for better performance
- IIFE pattern for namespace isolation
- Referrer-based origin trust (works cross-origin, no DOM access needed)
- Minified tracking script (~1KB) for CDN distribution

## License

MIT
