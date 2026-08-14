# Single-Page App Integration Guide

This guide shows how to integrate the Usage Meter into a single-page application (React, Vue, Angular, etc.) with proper lifecycle management to avoid memory leaks.

## The Problem

SPAs load scripts once but may mount/unmount components multiple times. Without proper cleanup:

```javascript
// Bad: SPA mounts component 3 times
// 1st mount: adds listener #1
// 2nd mount: adds listener #2  
// 3rd mount: adds listener #3
// Now same message triggers 3 listeners!
```

## The Solution

Use the `init()` and `cleanup()` methods to manage the lifecycle:

```javascript
// Good: Explicit lifecycle management
componentDidMount() {
  window.UsageMeter.init();      // Start tracking
}

componentWillUnmount() {
  window.UsageMeter.cleanup();   // Stop tracking, remove listeners
}
```

---

## Framework Examples

### React

```javascript
import { useEffect } from 'react';

export function ActivityTracker({ iframeUrl }) {
  useEffect(() => {
    // Initialize usage meter on mount
    window.UsageMeter.init();
    window.UIManager.init();

    return () => {
      // Cleanup on unmount (prevents memory leaks)
      window.UsageMeter.cleanup();
      window.UIManager.cleanup();
    };
  }, []);

  return (
    <iframe 
      id="activity-iframe"
      title="Vendor content"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      src={iframeUrl}
    />
  );
}
```

### Vue

```javascript
export default {
  name: 'ActivityTracker',
  
  mounted() {
    // Initialize on mount
    window.UsageMeter.init();
    window.UIManager.init();
  },

  beforeUnmount() {
    // Cleanup on unmount
    window.UsageMeter.cleanup();
    window.UIManager.cleanup();
  },

  template: `
    <iframe 
      id="activity-iframe"
      title="Vendor content"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      :src="iframeUrl">
    </iframe>
  `
};
```

### Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-activity-tracker',
  template: `
    <iframe 
      id="activity-iframe"
      title="Vendor content"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      [src]="iframeUrl">
    </iframe>
  `
})
export class ActivityTrackerComponent implements OnInit, OnDestroy {
  iframeUrl = 'https://...';

  ngOnInit() {
    // Initialize on component creation
    (window as any).UsageMeter.init();
    (window as any).UIManager.init();
  }

  ngOnDestroy() {
    // Cleanup on component destruction
    (window as any).UsageMeter.cleanup();
    (window as any).UIManager.cleanup();
  }
}
```

### Vanilla JavaScript

```javascript
class ActivityTracker {
  constructor(containerSelector, iframeUrl) {
    this.container = document.querySelector(containerSelector);
    this.iframeUrl = iframeUrl;
  }

  mount() {
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'activity-iframe';
    iframe.title = 'Vendor content';
    iframe.sandbox = 'allow-scripts';
    iframe.referrerPolicy = 'no-referrer';
    iframe.src = this.iframeUrl;
    this.container.appendChild(iframe);

    // Initialize tracking
    window.UsageMeter.init();
    window.UIManager.init();
  }

  unmount() {
    // Cleanup tracking
    window.UsageMeter.cleanup();
    window.UIManager.cleanup();

    // Remove iframe
    const iframe = document.getElementById('activity-iframe');
    if (iframe) {
      iframe.remove();
    }
  }
}

// Usage
const tracker = new ActivityTracker('#container', 'https://...');
tracker.mount();   // Mount component
tracker.unmount(); // Unmount component
```

---

## Loading Scripts Manually

If you prefer NOT to auto-initialize, you can disable auto-init and manage everything manually:

```html
<!-- Don't load scripts in HTML, load via JavaScript -->
<div id="app"></div>

<script>
  // When component is ready:
  const script1 = document.createElement('script');
  script1.src = '/ui-manager.js';
  document.head.appendChild(script1);

  const script2 = document.createElement('script');
  script2.src = '/fake-usage-meter.js';
  script2.onload = () => {
    // Now initialize
    window.UsageMeter.init();
    window.UIManager.init();
  };
  document.head.appendChild(script2);

  // Later, cleanup:
  function cleanup() {
    window.UsageMeter.cleanup();
    window.UIManager.cleanup();
  }
</script>
```

---

## Advanced: Disable Auto-Init

If you want full control over initialization, disable auto-init in the scripts:

**In `fake-usage-meter.js`:**
```javascript
const CONFIG = {
  AUTO_INIT: false,  // ← Set to false
  // ... rest of config
};
```

**In `ui-manager.js`:**
```javascript
// Remove the auto-init call at the end
// init();  // ← Comment this out
```

Then initialize manually when ready:

```javascript
async function bootstrap() {
  // Wait for iframe to load
  await iframeReadyPromise;

  // Then initialize
  window.UsageMeter.init();
  window.UIManager.init();
}
```

---

## Multiple Iframes

If you have multiple vendor iframes, each sends messages with its own `source` identifier:

```html
<iframe id="vendor-1" src="https://vendor1.example.com"></iframe>
<iframe id="vendor-2" src="https://vendor2.example.com"></iframe>
```

The parent-side message handler filters by origin and source, so you can safely have multiple iframes:

```javascript
// Both iframes send messages
// Parent's single listener receives all
// But only processes messages from trusted origins

// vendor-1 message: origin='https://vendor1.example.com', source='iframe-messages' ✓
// vendor-2 message: origin='https://vendor2.example.com', source='iframe-messages' ✗ (wrong origin)
```

To handle multiple vendors, add their origins to a whitelist:

```javascript
const ALLOWED_ORIGINS = [
  'https://vendor1.example.com',
  'https://vendor2.example.com'
];

// In processMessage:
if (!ALLOWED_ORIGINS.includes(event.origin)) {
  warn(`Untrusted origin: ${event.origin}`);
  return;
}
```

---

## Checking Initialization Status

Before using the API, check if it's initialized:

```javascript
// Check status
if (window.UsageMeter.isInitialized()) {
  console.log('Usage Meter is active');
} else {
  console.log('Usage Meter is not initialized');
}

// Same for UI Manager
if (window.UIManager.isInitialized()) {
  console.log('UI Manager is active');
} else {
  console.log('UI Manager is not initialized');
}
```

---

## Debugging Multiple Instances

To debug if listeners are leaking:

```javascript
// In browser console:
window.UsageMeter.setDebug(true);

// Check state
console.log('Meter initialized:', window.UsageMeter.isInitialized());
console.log('UI initialized:', window.UIManager.isInitialized());
console.log('Config:', window.UsageMeter.getConfig());
console.log('Circuit breaker:', window.UsageMeter.getCircuitBreakerState());
```

If you see messages being processed multiple times, listeners aren't being cleaned up.

---

## Troubleshooting

### Issue: Messages being processed multiple times

**Symptom:** Console logs each message 2-3 times

**Cause:** Multiple listeners registered (component mounted multiple times without cleanup)

**Fix:** 
```javascript
// Before reinitializing, always cleanup:
if (window.UsageMeter.isInitialized()) {
  window.UsageMeter.cleanup();
}
window.UsageMeter.init();  // Now safe to reinit
```

### Issue: "Iframe failed to load" error keeps appearing

**Symptom:** Error logged even after iframe loads successfully

**Cause:** iframe src set multiple times, triggering multiple load events

**Fix:** Set src only once:
```javascript
const iframe = document.getElementById('activity-iframe');
if (!iframe.src) {
  iframe.src = 'https://...';  // Set only if not already set
}
```

### Issue: Memory usage grows over time

**Symptom:** Browser memory increases when navigating between pages

**Cause:** Listeners not cleaned up on page unload

**Fix:** Always cleanup in unmount handler:
```javascript
beforeUnmount() {
  window.UsageMeter.cleanup();
  window.UIManager.cleanup();
}
```

---

## Summary

1. **Load scripts** in HTML or dynamically
2. **Initialize** in mount/ngOnInit callback
3. **Cleanup** in unmount/ngOnDestroy callback
4. **Check status** with `.isInitialized()` if needed
5. **Enable debug** with `.setDebug(true)` to troubleshoot

This prevents memory leaks and ensures clean lifecycle in single-page applications.
