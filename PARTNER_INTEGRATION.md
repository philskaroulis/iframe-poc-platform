# Partner App Integration Guide

This guide is for developers building content that will be embedded in an iframe with the activity messenger script.

## Overview

The `browser-event-relay.js` script automatically detects user activity and reports it to the parent page via `postMessage()`. It requires **no configuration** and works out of the box.

However, if your app is part of a **single-page application**, you should manage the script's lifecycle to prevent memory leaks.

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
- ✓ Adds listeners for: click, keydown, scroll, mousemove- ✓ Throttles scroll (200ms) and mousemove (500ms) to reduce noise
- ✓ Sends messages to parent whenever activity is detected

---

## Single-Page App: Prevent Memory Leaks

If your partner app is an SPA (React, Vue, Angular, etc.) and may be mounted/unmounted multiple times, use lifecycle management:

```javascript
// When app is about to unmount:
window.BrowserEventRelay.cleanup();

// When app is mounted again:
window.BrowserEventRelay.init();
```

### Framework Examples

#### React

```javascript
import { useEffect } from 'react';

export function PartnerApp() {
  useEffect(() => {
    // Ensure initialized when component mounts
    if (!window.BrowserEventRelay.isInitialized()) {
      window.BrowserEventRelay.init();
    }

    return () => {
      // Cleanup when component unmounts
      window.BrowserEventRelay.cleanup();
    };
  }, []);

  return <div>Partner Content</div>;
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

## Public API

### `window.BrowserEventRelay.init()`

Initializes the activity messenger. Adds all event listeners.

```javascript
window.BrowserEventRelay.init();
```

- **Effect:** Activates listening for: click, keydown, scroll, mousemove- **Safe to call:** Multiple times (will warn if already initialized but won't duplicate listeners)
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
  console.log('Activity messenger is active');
} else {
  console.log('Activity messenger is inactive');
}
```

- **Returns:** Boolean (true if initialized, false otherwise)
- **Use case:** Conditional initialization logic

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
| **Relay Init** | Relay script binds to events (on `init()` call) | `RELAYED_INIT` |
| **Relay Cleanup** | Relay script unbinds from events (on `cleanup()` call) | `RELAYED_CLEANUP` |

Each message includes:
- `source`: `'browser-event-relay'` (identifies the messenger)
- `type`: Event type (listed above)
- `timestamp`: When the event occurred (milliseconds since epoch)

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

**Cause:** Parent's message listener needs to be running (parent-side issue, not partner)

**Fix:** Check parent page has its own listeners active:
```javascript
// In parent page console:
window.UsageMeter.isInitialized()  // Should be true
```

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

Or load dynamically:
```javascript
const script = document.createElement('script');
script.src = 'https://cdn.example.com/browser-event-relay.min.js';
script.onload = () => {
  console.log('Messenger loaded');
  window.BrowserEventRelay.init();
};
document.head.appendChild(script);
```

---

## Best Practices

### ✓ Do

- **Do call `cleanup()` in unmount handlers** — prevents listener accumulation
- **Do check `isInitialized()` before init** — prevents duplicate initialization warnings
- **Do wait for script to load** — ensure `window.BrowserEventRelay` exists before calling
- **Do pass `{ passive: true }` if adding your own listeners** — improves scroll performance

### ✗ Don't

- **Don't rely on auto-init if you're in an SPA** — call `init()` explicitly in mount
- **Don't forget to cleanup** — causes memory leaks and performance degradation
- **Don't assume multiple init calls are safe** — they'll log warnings
- **Don't manually add your own click/scroll/etc listeners** — they'll duplicate activity messages

---

## Cross-Browser Compatibility

The messenger uses:
- ✓ `addEventListener()` / `removeEventListener()` — IE9+, all modern browsers
- ✓ `window.parent.postMessage()` — IE8+, all modern browsers
- ✓ `passive: true` option — modern browsers (gracefully ignored in older browsers)
- ✓ ES5 syntax (no ES6) — works in IE9+

**Minimum requirements:** IE9 or equivalent

---

## Summary

1. **Script loads automatically** — No setup needed for basic usage
2. **SPA environments need cleanup** — Call `cleanup()` on unmount to prevent leaks
3. **Simple API** — Just `init()`, `cleanup()`, and `isInitialized()`
4. **Zero configuration** — Works with any partner app, no settings needed

That's it! The messenger handles all the complexity of detecting activity and reporting it to the parent.
