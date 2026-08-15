// Usage Meter - Message Handling & Security
// Responsibilities:
// - Receive and validate messages from iframe
// - Timestamp validation
// - Rate limiting & circuit breaker
// - Event handler routing

(function() {
    'use strict';

    // ============ VERSION INFO ============
    var VERSION = '2.0.0';

    // ============ CONFIGURATION ============
    const CONFIG = {
        MESSAGE_SOURCE: 'browser-event-relay',
        PARTNER_ORIGIN: window.EnvConfig ? window.EnvConfig.get('PARTNER_ORIGIN') : 'https://philskaroulis.github.io',
        DEBUG: false,
        MAX_EVENTS_PER_SECOND: 100,
        MAX_TIMESTAMP_DEVIATION_MS: 5000,
        AUTO_INIT: true  // Automatically initialize on load (set to false for manual init)
    };

    // ============ STATE ============
    // Lifecycle state
    let initialized = false;
    let handleMessage = null;

    // Circuit breaker state
    let circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let eventCountThisSecond = 0;
    let lastEventCountReset = Date.now();

    // Event handler registry
    const eventHandlers = new Map();

    // ============ LOGGING UTILITIES ============
    function log(message, data) {
        if (CONFIG.DEBUG) {
            console.log(`[Usage Meter] ${message}`, data || '');
        }
    }

    function warn(message, data) {
        console.warn(`[Usage Meter] ⚠️  ${message}`, data || '');
    }

    function error(message, data) {
        console.error(`[Usage Meter] ❌ ${message}`, data || '');
    }

    // ============ TIMESTAMP VALIDATION ============
    function validateTimestamp(eventTimestamp) {
        const now = Date.now();
        const deviation = Math.abs(now - eventTimestamp);

        if (deviation > CONFIG.MAX_TIMESTAMP_DEVIATION_MS) {
            warn(`Timestamp deviation exceeds threshold: ${deviation}ms (event: ${eventTimestamp}, now: ${now})`);
            return false;
        }

        return true;
    }

    // ============ RATE LIMITING & CIRCUIT BREAKER ============
    function checkRateLimit() {
        const now = Date.now();

        // Reset counter every second
        if (now - lastEventCountReset >= 1000) {
            eventCountThisSecond = 0;
            lastEventCountReset = now;
        }

        eventCountThisSecond++;

        // Transition: CLOSED -> OPEN (rate limit exceeded)
        if (eventCountThisSecond > CONFIG.MAX_EVENTS_PER_SECOND && circuitBreakerState === 'CLOSED') {
            circuitBreakerState = 'OPEN';
            error(`Rate limit exceeded (${eventCountThisSecond}/${CONFIG.MAX_EVENTS_PER_SECOND} events/sec). Circuit breaker OPEN.`);
            return false;
        }

        // Transition: OPEN -> HALF_OPEN (rate dropped below 50%)
        if (circuitBreakerState === 'OPEN' && eventCountThisSecond < CONFIG.MAX_EVENTS_PER_SECOND / 2) {
            circuitBreakerState = 'HALF_OPEN';
            log('Circuit breaker HALF_OPEN - attempting recovery');
        }

        // Transition: HALF_OPEN -> CLOSED (rate normalized)
        if (circuitBreakerState === 'HALF_OPEN' && eventCountThisSecond < 10) {
            circuitBreakerState = 'CLOSED';
            log('Circuit breaker CLOSED - recovered');
        }

        // Reject if circuit is open
        if (circuitBreakerState === 'OPEN') {
            return false;
        }

        return true;
    }

    // ============ EVENT HANDLER REGISTRY ============
    function registerEventHandler(eventType, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`Handler for ${eventType} must be a function`);
        }
        eventHandlers.set(eventType, handler);
        log(`Registered handler for ${eventType}`);
    }

    function createDefaultHandlers() {
        registerEventHandler('IFRAME_CLICK_MESSAGE', (details, eventTimestamp) => {
            log(`User clicked inside iframe`, { timestamp: eventTimestamp });
        });

        registerEventHandler('IFRAME_KEYPRESS_MESSAGE', (details, eventTimestamp) => {
            log(`User typing detected inside iframe`, { timestamp: eventTimestamp });
        });

        registerEventHandler('IFRAME_SCROLL_MESSAGE', (details, eventTimestamp) => {
            log(`User scrolled inside iframe`, { timestamp: eventTimestamp });
        });

        registerEventHandler('IFRAME_MOUSEMOVE_MESSAGE', (details, eventTimestamp) => {
            log(`Active mouse movement detected inside iframe`, { timestamp: eventTimestamp });
        });

        registerEventHandler('IFRAME_VISIBILITY_CHANGE_MESSAGE', (details, eventTimestamp) => {
            log(`iFrame visibility changed`, { timestamp: eventTimestamp });
        });
    }

    // ============ MESSAGE PROCESSING ============
    function processMessage(event) {
        try {
            console.log('[Usage Meter] Message received:', event.data);

            // 1. Verify message has data
            if (!event.data) {
                return;
            }

            // 2. Source identifier validation (quick filter for non-iframe messages)
            if (event.data.source !== CONFIG.MESSAGE_SOURCE) {
                // This is not for us (likely from dev tools, other iframes, etc.)
                // Silently ignore instead of warning
                return;
            }

            // 3. Security: Origin validation (CRITICAL - only check after confirming it's our message)
            // Note: event.origin may be null when iframe uses sandbox="allow-scripts" without allow-same-origin
            // In that case, we skip strict origin check since message source and timestamp validation provide security
            if (event.origin !== null && event.origin !== CONFIG.PARTNER_ORIGIN) {
                warn(`Message from untrusted origin: ${event.origin} (expected: ${CONFIG.PARTNER_ORIGIN})`);
                return;
            }

            // 4. Extract and validate data
            const { type, timestamp: eventTimestamp, ...details } = event.data;

            // 5. Timestamp validation
            if (!validateTimestamp(eventTimestamp)) {
                return;
            }

            // 6. Event type validation
            if (!type || !type.startsWith('IFRAME_')) {
                warn(`Unknown event type: ${type}`);
                return;
            }

            // 7. Rate limiting / Circuit breaker
            if (!checkRateLimit()) {
                log(`Message dropped - circuit breaker OPEN or rate limit exceeded`);
                return;
            }

            // 8. Route to handler
            const handler = eventHandlers.get(type);
            if (handler) {
                handler(details, eventTimestamp);
            } else {
                warn(`No handler registered for event type: ${type}`);
            }

            // 9. Update UI state
            if (window.UIManager) {
                if (type === 'IFRAME_VISIBILITY_CHANGE_MESSAGE') {
                    window.UIManager.setInactive();
                } else {
                    window.UIManager.setActive();
                }
            }

        } catch (e) {
            error(`Failed to process message from iframe: ${e.message}`);
        }
    }

    // ============ LIFECYCLE MANAGEMENT ============
    function init() {
        if (initialized) {
            warn('Already initialized');
            return;
        }

        // Store reference to handler for cleanup
        handleMessage = processMessage;

        // Register message listener
        window.addEventListener('message', handleMessage);

        // Register default event handlers
        createDefaultHandlers();

        // Mark as initialized
        initialized = true;

        // Log initialization
        console.log('[Usage Meter] Initialized with:');
        console.log('  ✓ Origin validation (partner: ' + CONFIG.PARTNER_ORIGIN + ')');
        console.log('  ✓ Message source verification');
        console.log('  ✓ Timestamp validation');
        console.log('  ✓ Rate limiting & circuit breaker');
        console.log('  ✓ Extensible event handlers');
        console.log('[Usage Meter] Ready for messages from iframe');
    }

    function cleanup() {
        if (!initialized) {
            log('Not initialized, nothing to clean up');
            return;
        }

        // Remove message listener
        window.removeEventListener('message', handleMessage);

        // Clear handler reference
        handleMessage = null;

        // Clear event handlers
        eventHandlers.clear();

        // Reset state
        circuitBreakerState = 'CLOSED';
        eventCountThisSecond = 0;
        lastEventCountReset = Date.now();

        // Mark as uninitialized
        initialized = false;

        console.log('[Usage Meter] Cleaned up and uninitialized');
    }

    function isInitialized() {
        return initialized;
    }

    // ============ PUBLIC API ============
    window.UsageMeter = {
        init: init,
        cleanup: cleanup,
        isInitialized: isInitialized,
        registerHandler: registerEventHandler,
        setDebug: (enabled) => {
            CONFIG.DEBUG = enabled;
            log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
        },
        setVendorOrigin: (origin) => {
            CONFIG.PARTNER_ORIGIN = origin;
            log(`Vendor origin updated to: ${origin}`);
        },
        getVersion: () => VERSION,
        getCircuitBreakerState: () => circuitBreakerState,
        getEventCountThisSecond: () => eventCountThisSecond,
        getConfig: () => ({ ...CONFIG })
    };

    // ============ AUTO-INITIALIZATION ============
    // Initialize automatically if configured (default behavior for backward compatibility)
    if (CONFIG.AUTO_INIT) {
        init();
    } else {
        console.log('[Usage Meter] Loaded but not initialized. Call window.UsageMeter.init() to start.');
    }
})();
