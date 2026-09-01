# iframe-poc-platform

**Part of a two-repo platform/partner `postMessage` POC.** This repo simulates a **platform** that embeds third-party partner content in a cross-origin iframe and monitors user activity inside it. The partner repo (`iframe-poc-partner`) contains the embedded content and is required to load this platform's `browser-event-relay.js` event relay script by reference.

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
   - Verifies relay token (ensures message comes from expected iframe)
   - Validates timestamp (rejects clock-skew events >5s off)
   - Enforces rate limiting via circuit breaker (max 100 events/sec)
   - Routes validated events to registered handlers
   - Updates UI state via `UIManager`
5. **`browser-event-relay.js`** — the **event relay script that partners are required to embed**. See below.
6. **`env-config.js`** — resolves the partner's URL/origin per environment (dev vs. prod).

### The Event Relay Script

**`browser-event-relay.js`** (production: `.min.js`) is **hosted and distributed by this platform repo**. Partners must load it via `<script src>` in their embedded content (see `iframe-poc-partner` for an example).

The script:
- Detects user activity inside the iframe (click, keypress, scroll, mousemove)
- Derives the trusted parent (platform) origin from `document.referrer` (read by browser, available cross-origin if platform iframe has `referrerpolicy="strict-origin"`)
- Sends minimal, focused messages via `window.parent.postMessage()`:
  ```javascript
  {
    source: "browser-event-relay",
    type: "RELAYED_CLICK",    // or RELAYED_KEYPRESS, RELAYED_SCROLL, etc.
    timestamp: 1691743200000,
    iframeId: "abc-123..."    // Unique identifier for iframe isolation
  }
  ```
  For lifecycle events (RELAYED_INIT, RELAYED_CLEANUP), also includes: `version` and `builtAt`
- Supports lifecycle management (`init()`, `cleanup()`, `isInitialized()`) for SPAs.
- Provides diagnostic API (`version()` returns {version, builtAt}, `setDebug()` for debug logging).
- Auto-initializes on load but can be manually managed for partners running single-page apps.

See **[PARTNER_INTEGRATION.md](PARTNER_INTEGRATION.md)** for how partners integrate this script into their own content.

## Relay Token (Iframe Isolation)

To prevent cross-contamination between multiple iframes on the same page, each iframe receives a **unique relay token** (UUID):

1. **Platform generates token** — `index.html` creates a `crypto.randomUUID()` for each iframe
2. **Token passed to iframe** — Added as URL parameter: `?iframeId=<uuid>`
3. **Relay script reads token** — `browser-event-relay.js` extracts `iframeId` from URL
4. **Token included in messages** — Every activity message includes `iframeId` field
5. **Platform validates token** — `fake-usage-meter.js` verifies `event.data.iframeId` matches expected value

This ensures that:
- Messages from iframe A are only processed by iframe A's parent listener
- If another iframe sends messages with iframe A's token, they're rejected
- Each iframe is cryptographically paired with its parent

**Note:** The relay token is *not* cryptographically signed. See the [Security Considerations](#security--validation) section for details.

## Message Contract

The partner iframe sends messages in this exact format:

| Event | Type | Throttle | Notes |
|-------|------|----------|-------|
| Click | `RELAYED_CLICK` | None | Sent every click |
| Keypress | `RELAYED_KEYPRESS` | None | Sent on every keydown |
| Scroll | `RELAYED_SCROLL` | 200ms | Throttled to 5 events/sec max |
| Mouse move | `RELAYED_MOUSEMOVE` | 500ms | Throttled to 2 events/sec max |
| Relay init | `RELAYED_INIT` | None | Sent when relay script binds to events; includes `version` and `builtAt` |
| Relay cleanup | `RELAYED_CLEANUP` | None | Sent when relay script unbinds from events |

## Security & Validation

The platform validates **every** incoming message via a strict multi-layer check:

1. **Message source** — only messages with `source: "browser-event-relay"` are processed
2. **Relay token** — message `iframeId` must match the expected iframe's token (ensures isolation between iframes)
3. **Timestamp deviation** — events with timestamps >5 seconds off the current time are rejected (detects clock-skew or malicious timestamps)
4. **Event type** — only types starting with `RELAYED_` are accepted
5. **Rate limiting** — if >100 events arrive in one second, the circuit breaker opens and drops excess messages until the rate normalizes

**Note on origin validation:** The iframe uses `sandbox="allow-scripts"` without `allow-same-origin`, which strips the origin. The relay token (step 2) and message source (step 1) provide sufficient isolation for the current threat model.

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
[Usage Meter] Message received: {source: "browser-event-relay", type: "RELAYED_CLICK", timestamp: 1691743200000}
[Usage Meter] User clicked inside iframe {timestamp: 1691743200000}
```

### Register Custom Event Handler

```javascript
window.UsageMeter.registerHandler('RELAYED_CLICK', (details, timestamp) => {
  console.log('User clicked in partner iframe', { timestamp });
  // Send to analytics, update database, etc.
});

// Also handle relay lifecycle events
window.UsageMeter.registerHandler('RELAYED_INIT', (details, timestamp) => {
  console.log('Relay script initialized', { timestamp });
});

window.UsageMeter.registerHandler('RELAYED_CLEANUP', (details, timestamp) => {
  console.log('Relay script cleaned up', { timestamp });
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

### Minimum Supported Versions

| Browser | Min Version | Release Date | Status |
|---------|-------------|--------------|--------|
| **Internet Explorer** | 9 | 2011 | ✓ Full support (no passive events) |
| **Chrome** | 32 | Dec 2013 | ✓ Full support |
| **Safari** | 10 | Sep 2016 | ✓ Full support |
| **Firefox** | 26 | Apr 2014 | ✓ Full support |

### Implementation Notes

The **`browser-event-relay.js`** script intentionally uses compatible JavaScript patterns to support IE9+:

- **Manual URL parsing** (instead of `new URL()`) — supports IE9+
- **Manual query string parsing** (instead of `URLSearchParams`) — supports IE9+
- **No passive event listeners** (IE doesn't support options object) — graceful degradation

See script header comments for detailed explanations of each compatibility measure and trade-offs.

### Core Platform Pages

**Other platform files** use modern JavaScript (const/let, arrow functions, ES6):
- `ui-manager.js` — requires modern browsers (ES6+)
- `fake-usage-meter.js` — requires modern browsers (ES6+)

The browser-event-relay script is intentionally conservative to maximize partner reach.

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
| `PARTNER_INTEGRATION.md` | How partners integrate the platform's event relay script |
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
- Minified event relay script (~1KB) for CDN distribution

## License

MIT
