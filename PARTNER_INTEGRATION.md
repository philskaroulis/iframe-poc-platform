# Partner App Integration Guide

This guide is for developers building content that will be embedded in an iframe with the browser event relay script.

## Overview

The `browser-event-relay.js` script automatically detects user activity and reports it to the parent page via `postMessage()`. It requires **no configuration** and works out of the box.

However, if your app is part of a **single-page application**, you should manage the script's lifecycle to prevent memory leaks.

---

## How It Works

The platform embeds your content in an iframe with the `referrerpolicy="strict-origin"` attribute. This lets the relay script securely derive the platform's origin (using `document.referrer`) to ensure messages are sent to the correct parent.

The relay script reads an optional `iframeId` parameter from the URL (e.g., `?iframeId=abc-123...`) set by the platform to isolate messages when multiple iframes are embedded. **Partners don't set this — the platform does automatically.**

---

## Auto-Initialization (Default)

By default, the script auto-initializes when loaded:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Partner App</title>
</head>
<body>
  <h1>Welcome to Partner Content</h1>
  
  <!-- Script auto-initializes on load -->
  <script src="https://cdn.example.com/browser-event-relay.min.js"></script>
</body>
</html>
```

The script immediately:
- ✓ Adds event listeners for: click, keydown, scroll, mousemove
- ✓ Throttles scroll (200ms) and mousemove (500ms) to reduce noise
- ✓ Relays events as messages to parent whenever detected
- ✓ Auto-initializes only when loaded inside an iframe (skipped if opened directly in browser)

---

## The BrowserEventRelay Object

Once the script loads, it exposes a global object called `window.BrowserEventRelay`. This object provides methods to check the relay's status and manage its lifecycle.

```javascript
// The relay script creates this global object
window.BrowserEventRelay = {
  init(),              // Start listening for events
  cleanup(),           // Stop listening and remove listeners
  isInitialized(),     // Check if currently active
  getVersion()         // Get script version
};
```

In most partner apps, **you don't need to call these methods**. The script auto-initializes on load and relays events automatically. Only use these if you're building a single-page app that manages lifecycle, or when troubleshooting issues.

---

## Public API

### `window.BrowserEventRelay.init()`

Initializes the activity messenger. Adds all event listeners.

```javascript
window.BrowserEventRelay.init();
```

- **Effect:** Activates listening for: click, keydown, scroll, mousemove
- **Safe to call:** Multiple times (will warn if already initialized but won't duplicate listeners)
- **Use case:** When your app mounts or resumes

### `window.BrowserEventRelay.cleanup()`

Stops listening and removes all event listeners.

```javascript
window.BrowserEventRelay.cleanup();
```

- **Effect:** Removes all listeners, clears internal state
- **Safe to call:** Multiple times (will log if not initialized)
- **Use case:** When your app unmounts or is destroyed
- **Prevents:** Memory leaks from accumulated listeners

### `window.BrowserEventRelay.isInitialized()`

Check if the messenger is currently active.

```javascript
if (window.BrowserEventRelay.isInitialized()) {
  console.log('Event relay is active');
} else {
  console.log('Event relay is inactive');
}
```

- **Returns:** Boolean (true if initialized, false otherwise)
- **Use case:** Conditional initialization logic

### `window.BrowserEventRelay.getVersion()`

Get the script version (useful when troubleshooting issues with platform support).

```javascript
console.log(window.BrowserEventRelay.getVersion());  // → "2.0.0"
```

- **Returns:** String (e.g., "2.0.0")
- **Use case:** When reporting issues to the platform, include your script version to help diagnose if you're running an outdated cached version

---

## Events Detected

The messenger listens for and reports these user interaction events:

| Event | Detection | Throttle | Message Type |
|-------|-----------|----------|--------------|
| **Click** | Any click in viewport | None | `RELAYED_CLICK` |
| **Typing** | Keydown event | None | `RELAYED_KEYPRESS` |
| **Scroll** | Window scroll | 200ms | `RELAYED_SCROLL` |
| **Mouse** | Mouse movement | 500ms | `RELAYED_MOUSEMOVE` |

The messenger also sends lifecycle messages:

| Event | When | Message Type |
|-------|------|--------------|
| **Relay Init** | Relay script binds to events (on `init()` call or auto-init) | `RELAYED_INIT` |
| **Relay Cleanup** | Relay script unbinds from events (on `cleanup()` call) | `RELAYED_CLEANUP` |

Each message includes:
- `source`: `'browser-event-relay'` (identifies the messenger)
- `type`: Event type (listed above)
- `timestamp`: When the event occurred (milliseconds since epoch)
- `iframeId`: (optional) Unique identifier if the platform embedded your content with isolation parameters

**Partners cannot modify or control which events are detected.** Event configuration is determined by the platform.

---

## Verification: Script Loaded and Initialized

After the script loads, verify it's working:

```javascript
// In browser console (while inside the partner iframe):

// 1. Check the script loaded
if (typeof window.BrowserEventRelay === 'undefined') {
  console.error('Script failed to load');
} else {
  console.log('✓ Script loaded, version:', window.BrowserEventRelay.getVersion());
}

// 2. Check initialization status
if (window.BrowserEventRelay.isInitialized()) {
  console.log('✓ Event relay is active');
} else {
  console.log('✗ Event relay not initialized (will auto-init on first interaction or call init() manually)');
}

// 3. Check the parent origin was detected
console.log('Document referrer (should show platform origin):', document.referrer);
```

---

## Single-Page App: Prevent Memory Leaks

If your partner app is an SPA (React, Vue, Angular, etc.) and may be mounted/unmounted multiple times, use lifecycle management to prevent listener accumulation.

**Key principle:** Call `init()` once when your app first loads, and `cleanup()` only if your app is being completely unloaded (e.g., user navigates away). For most SPAs, you don't need to touch the relay lifecycle at all—let it auto-initialize and run for the lifetime of the page.

### Framework Examples

#### React (Recommended: App-Level)

If your app is mounted/unmounted as a whole, initialize at the root level:

```javascript
import { useEffect } from 'react';

export function App() {
  useEffect(() => {
    // Initialize once when app loads (the relay script already auto-initialized,
    // so this is a safety check for apps that manage lifecycle explicitly)
    if (!window.BrowserEventRelay.isInitialized()) {
      window.BrowserEventRelay.init();
    }

    // Only cleanup if your entire app is being destroyed
    return () => {
      window.BrowserEventRelay.cleanup();
    };
  }, []); // Empty dependency array = run once on mount

  return <YourPages />;
}
```

If you're building a **component that's reused** in other apps, wrap it cautiously:

```javascript
// ⚠️ Only do this if this component is added/removed repeatedly
export function PartnerContent() {
  useEffect(() => {
    // Initialize if needed
    if (!window.BrowserEventRelay.isInitialized()) {
      window.BrowserEventRelay.init();
    }

    return () => {
      // Cleanup only if this component unmounts AND no other parts of the app need tracking
      window.BrowserEventRelay.cleanup();
    };
  }, []);

  return <div>Your content here</div>;
}
```

#### Vue

```javascript
export default {
  name: 'PartnerApp',

  mounted() {
    // Initialize on mount
    if (!window.BrowserEventRelay.isInitialized()) {
      window.BrowserEventRelay.init();
    }
  },

  beforeUnmount() {
    // Cleanup on unmount
    window.BrowserEventRelay.cleanup();
  },

  template: '<div>Partner Content</div>'
};
```

#### Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-partner',
  template: '<div>Partner Content</div>'
})
export class PartnerComponent implements OnInit, OnDestroy {
  ngOnInit() {
    // Initialize on component creation
    if (!(window as any).BrowserEventRelay.isInitialized()) {
      (window as any).BrowserEventRelay.init();
    }
  }

  ngOnDestroy() {
    // Cleanup on component destruction
    (window as any).BrowserEventRelay.cleanup();
  }
}
```

#### Vanilla JavaScript

```javascript
class PartnerApp {
  mount() {
    console.log('App mounted');
    if (!window.BrowserEventRelay.isInitialized()) {
      window.BrowserEventRelay.init();
    }
  }

  unmount() {
    console.log('App unmounting');
    window.BrowserEventRelay.cleanup();
  }
}

const app = new PartnerApp();
app.mount();
// ... later ...
app.unmount();
```

---

## Troubleshooting

### "Already initialized" warning

**Symptom:** Console shows `Already initialized` when calling `init()`

**Cause:** Script auto-initialized on load, then code tried to initialize again

**Fix:** Check status before init:
```javascript
if (!window.BrowserEventRelay.isInitialized()) {
  window.BrowserEventRelay.init();
}
```

### Memory usage grows when navigating

**Symptom:** Browser memory increases each time your app is mounted

**Cause:** `cleanup()` wasn't called when app unmounted

**Fix:** Ensure cleanup in unmount handler:
```javascript
componentWillUnmount() {
  window.BrowserEventRelay.cleanup();  // Always cleanup!
}
```

### No messages sent after cleanup/reinit

**Symptom:** After calling `cleanup()`, then `init()`, no messages arrive

**Cause:** Either the parent's listener isn't ready, or the relay script failed to reinitialize

**Fix:** Verify the relay script is initialized:
```javascript
// In partner iframe console:
window.BrowserEventRelay.isInitialized()  // Should be true
console.log(window.BrowserEventRelay.getVersion())  // Confirm script loaded
```

If initialized but still no messages, the platform's parent listener may not be running (that's a platform-side issue). Ask the platform team to check their message handler.

### "Parent origin unknown" warning in console

**Symptom:** Console shows `Cannot send message: parent origin unknown (referrer missing or cross-origin policy suppressed)`

**Cause:** The platform's iframe is missing `referrerpolicy="strict-origin"` attribute, which blocks `document.referrer`

**Fix:** This is **not a partner issue**—ask the platform team to set the iframe's `referrerpolicy` attribute:
```html
<!-- Platform must use this when embedding your content -->
<iframe 
  src="https://partner.example.com"
  referrerpolicy="strict-origin"
></iframe>
```

Without this, the relay script can't verify the parent's origin and refuses to send messages (for security).

---

### Script doesn't load in SPA

**Symptom:** Script doesn't execute, no `window.BrowserEventRelay` available

**Cause:** Script loaded before DOM ready, or timing issue

**Fix:** Ensure script loads after DOM is ready:
```html
<body>
  <div id="app"></div>
  <!-- Load script at end of body -->
  <script src="browser-event-relay.min.js"></script>
</body>
```

Or load dynamically in JavaScript:
```javascript
const script = document.createElement('script');
script.src = 'https://cdn.example.com/browser-event-relay.min.js';
script.onload = () => {
  console.log('✓ Messenger loaded');
  // Script auto-initializes, but you can manually initialize if needed
  if (!window.BrowserEventRelay.isInitialized()) {
    window.BrowserEventRelay.init();
  }
};
script.onerror = () => {
  console.error('✗ Failed to load messenger script');
};
document.head.appendChild(script);
```

### Issues persist after platform updates

**Symptom:** Platform says they deployed a bug fix, but you still see the issue

**Cause:** Your browser cached the old script version; new version hasn't been fetched yet

**Fix:** Hard-refresh your page to bypass browser cache:
- **Mac:** Cmd+Shift+R
- **Windows:** Ctrl+Shift+R

Then verify you have the latest version:
```javascript
window.BrowserEventRelay.getVersion()  // Check script version in console
```

If the version hasn't changed after hard-refresh, the CDN may still be serving the old version. Wait a few minutes and try again, or clear your browser cache entirely.

---

## Best Practices

### ✓ Do

- **Do trust auto-initialization** — the script auto-initializes on load in iframes; you don't need to call `init()` unless you explicitly called `cleanup()`
- **Do check `isInitialized()` before init** — prevents duplicate initialization warnings if your app code might call `init()` multiple times
- **Do wait for script to load** — ensure `window.BrowserEventRelay` exists before calling its methods
- **Do call `cleanup()` only when necessary** — when your entire app is being unloaded, not on every route change
- **Do pass `{ passive: true }` if adding your own listeners** — improves scroll performance (the relay script doesn't use this for IE compatibility)

### ✗ Don't

- **Don't manually call `init()` in mount if auto-init already ran** — only call it after an explicit `cleanup()`
- **Don't call `cleanup()` on every route change in SPAs** — that causes unnecessary listener churn; only cleanup when the app is completely unloaded
- **Don't assume multiple `init()` calls are safe** — they'll log warnings and potentially duplicate listeners
- **Don't manually add your own click/scroll/etc listeners** — they'll duplicate activity messages and bog down performance
- **Don't try to change which events are detected** — the relay script listens for a fixed set of events determined by the platform

---

## Cross-Browser Compatibility

**Minimum Browser Versions:**
- ✓ **IE 9+** (2011)
- ✓ **Chrome 32+** (Dec 2013)
- ✓ **Safari 10+** (Sep 2016)
- ✓ **Firefox 26+** (Apr 2014)

**Implementation:**
- Manual URL parsing (instead of `new URL()`) — IE9+ compatible
- Manual query string parsing (instead of `URLSearchParams`) — IE9+ compatible
- ES5 syntax (no ES6 features like arrow functions, const/let, destructuring)
- No passive event listener option (IE doesn't support addEventListener options object)

All techniques are intentionally vintage to maximize compatibility without polyfills.

---

## Quick Start Checklist

- [ ] **Platform embeds your iframe with `referrerpolicy="strict-origin"`** (ask if unsure)
- [ ] **You load the relay script:** `<script src="https://...browser-event-relay.min.js"></script>`
- [ ] **Script auto-initializes** — nothing to do, events are relayed automatically
- [ ] **For SPAs:** Only call `cleanup()` if your entire app is unloaded; don't cleanup on route changes
- [ ] **Verify it works:** Open browser console inside your iframe, run `window.BrowserEventRelay.isInitialized()`

---

## Summary

| Aspect | Details |
|--------|---------|
| **Setup** | Load the relay script; auto-initializes on load (no config needed) |
| **Events tracked** | Click, keydown, scroll (200ms throttle), mousemove (500ms throttle) |
| **Lifecycle** | Auto-init on load, auto-cleanup on page unload; SPAs should avoid manual cleanup unless fully unloading |
| **API** | `init()`, `cleanup()`, `isInitialized()`, `getVersion()` |
| **Security** | Script derives parent origin from `document.referrer` (requires `referrerpolicy="strict-origin"` on iframe) |

That's it! The relay script handles all the complexity of detecting activity and safely reporting it to the platform.
