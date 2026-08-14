# Vendor App Integration Guide

This guide is for developers building content that will be embedded in an iframe with the activity messenger script.

## Overview

The `messages-from-iframe.js` script automatically detects user activity and reports it to the parent page via `postMessage()`. It requires **no configuration** and works out of the box.

However, if your app is part of a **single-page application**, you should manage the script's lifecycle to prevent memory leaks.

---

## Auto-Initialization (Default)

By default, the script auto-initializes when loaded:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Vendor App</title>
</head>
<body>
  <h1>Welcome to Vendor Content</h1>
  
  <!-- Script auto-initializes on load -->
  <script src="https://cdn.example.com/messages-from-iframe.min.js"></script>
</body>
</html>
```

The script immediately:
- ✓ Adds listeners for: click, keydown, scroll, mousemove, visibilitychange
- ✓ Throttles scroll (200ms) and mousemove (500ms) to reduce noise
- ✓ Sends messages to parent whenever activity is detected

---

## Single-Page App: Prevent Memory Leaks

If your vendor app is an SPA (React, Vue, Angular, etc.) and may be mounted/unmounted multiple times, use lifecycle management:

```javascript
// When app is about to unmount:
window.IframeMessenger.cleanup();

// When app is mounted again:
window.IframeMessenger.init();
```

### Framework Examples

#### React

```javascript
import { useEffect } from 'react';

export function VendorApp() {
  useEffect(() => {
    // Ensure initialized when component mounts
    if (!window.IframeMessenger.isInitialized()) {
      window.IframeMessenger.init();
    }

    return () => {
      // Cleanup when component unmounts
      window.IframeMessenger.cleanup();
    };
  }, []);

  return <div>Vendor Content</div>;
}
```

#### Vue

```javascript
export default {
  name: 'VendorApp',

  mounted() {
    // Initialize on mount
    if (!window.IframeMessenger.isInitialized()) {
      window.IframeMessenger.init();
    }
  },

  beforeUnmount() {
    // Cleanup on unmount
    window.IframeMessenger.cleanup();
  },

  template: '<div>Vendor Content</div>'
};
```

#### Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-vendor',
  template: '<div>Vendor Content</div>'
})
export class VendorComponent implements OnInit, OnDestroy {
  ngOnInit() {
    // Initialize on component creation
    if (!(window as any).IframeMessenger.isInitialized()) {
      (window as any).IframeMessenger.init();
    }
  }

  ngOnDestroy() {
    // Cleanup on component destruction
    (window as any).IframeMessenger.cleanup();
  }
}
```

#### Vanilla JavaScript

```javascript
class VendorApp {
  mount() {
    console.log('App mounted');
    if (!window.IframeMessenger.isInitialized()) {
      window.IframeMessenger.init();
    }
  }

  unmount() {
    console.log('App unmounting');
    window.IframeMessenger.cleanup();
  }
}

const app = new VendorApp();
app.mount();
// ... later ...
app.unmount();
```

---

## Public API

### `window.IframeMessenger.init()`

Initializes the activity messenger. Adds all event listeners.

```javascript
window.IframeMessenger.init();
```

- **Effect:** Activates listening for: click, keydown, scroll, mousemove, visibilitychange
- **Safe to call:** Multiple times (will warn if already initialized but won't duplicate listeners)
- **Use case:** When your app mounts or resumes

### `window.IframeMessenger.cleanup()`

Stops listening and removes all event listeners.

```javascript
window.IframeMessenger.cleanup();
```

- **Effect:** Removes all listeners, clears internal state
- **Safe to call:** Multiple times (will log if not initialized)
- **Use case:** When your app unmounts or is destroyed
- **Prevents:** Memory leaks from accumulated listeners

### `window.IframeMessenger.isInitialized()`

Check if the messenger is currently active.

```javascript
if (window.IframeMessenger.isInitialized()) {
  console.log('Activity messenger is active');
} else {
  console.log('Activity messenger is inactive');
}
```

- **Returns:** Boolean (true if initialized, false otherwise)
- **Use case:** Conditional initialization logic

---

## Events Detected

The messenger listens for and reports these events:

| Event | Detection | Throttle | Message Type |
|-------|-----------|----------|--------------|
| **Click** | Any click in viewport | None | `IFRAME_CLICK_MESSAGE` |
| **Typing** | Keydown event | None | `IFRAME_KEYPRESS_MESSAGE` |
| **Scroll** | Window scroll | 200ms | `IFRAME_SCROLL_MESSAGE` |
| **Mouse** | Mouse movement | 500ms | `IFRAME_MOUSEMOVE_MESSAGE` |
| **Visibility** | Tab focus change | None | `IFRAME_VISIBILITY_CHANGE_MESSAGE` |

Each message includes:
- `source`: `'iframe-messages'` (identifies the messenger)
- `type`: Event type (listed above)
- `timestamp`: When the event occurred (milliseconds since epoch)

---

## Troubleshooting

### "Already initialized" warning

**Symptom:** Console shows `Already initialized` when calling `init()`

**Cause:** Script auto-initialized on load, then code tried to initialize again

**Fix:** Check status before init:
```javascript
if (!window.IframeMessenger.isInitialized()) {
  window.IframeMessenger.init();
}
```

### Memory usage grows when navigating

**Symptom:** Browser memory increases each time your app is mounted

**Cause:** `cleanup()` wasn't called when app unmounted

**Fix:** Ensure cleanup in unmount handler:
```javascript
componentWillUnmount() {
  window.IframeMessenger.cleanup();  // Always cleanup!
}
```

### No messages sent after cleanup/reinit

**Symptom:** After calling `cleanup()`, then `init()`, no messages arrive

**Cause:** Parent's message listener needs to be running (parent-side issue, not vendor)

**Fix:** Check parent page has its own listeners active:
```javascript
// In parent page console:
window.UsageMeter.isInitialized()  // Should be true
```

### Script doesn't load in SPA

**Symptom:** Script doesn't execute, no `window.IframeMessenger` available

**Cause:** Script loaded before DOM ready, or timing issue

**Fix:** Ensure script loads after DOM is ready:
```html
<body>
  <div id="app"></div>
  <!-- Load script at end of body -->
  <script src="messages-from-iframe.min.js"></script>
</body>
```

Or load dynamically:
```javascript
const script = document.createElement('script');
script.src = 'https://cdn.example.com/messages-from-iframe.min.js';
script.onload = () => {
  console.log('Messenger loaded');
  window.IframeMessenger.init();
};
document.head.appendChild(script);
```

---

## Best Practices

### ✓ Do

- **Do call `cleanup()` in unmount handlers** — prevents listener accumulation
- **Do check `isInitialized()` before init** — prevents duplicate initialization warnings
- **Do wait for script to load** — ensure `window.IframeMessenger` exists before calling
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
4. **Zero configuration** — Works with any vendor app, no settings needed

That's it! The messenger handles all the complexity of detecting activity and reporting it to the parent.
