// Browser Event Relay - Detects and reports user activity to parent
// Supports lifecycle management to prevent memory leaks in partner apps
(function() {
    var VERSION = '2.0.0';
    // Derive trusted parent origin from document.referrer (works cross-origin)
    // Referrer is set by platform's referrerpolicy="strict-origin" iframe attribute
    var PARENT_ORIGIN = null;
    if (document.referrer) {
        try {
            PARENT_ORIGIN = new URL(document.referrer).origin;
        } catch (e) {
            console.error('[partnername-browser-event-relay] Failed to parse referrer:', e);
        }
    }
    var MESSAGE_SOURCE = 'partnername-browser-event-relay';
    var LOG_SOURCE = '[' + MESSAGE_SOURCE + '] ';

    // Lifecycle state
    var initialized = false;
    var listeners = {};

    // ============ CORE FUNCTIONS ============
    function sendMessageToParent(eventType) {
        if (!PARENT_ORIGIN) {
            console.warn(LOG_SOURCE + 'Cannot send message: parent origin unknown (referrer missing or cross-origin policy suppressed)');
            return;
        }
        try {
            window.parent.postMessage({
                source: MESSAGE_SOURCE,
                type: eventType,
                timestamp: Date.now()
            }, PARENT_ORIGIN);
        } catch (e) {
            console.error(LOG_SOURCE + 'Failed to postMessage to parent:', e);
        }
    }

    function throttle(func, limit) {
        var inThrottle;
        return function() {
            if (!inThrottle) {
                func();
                inThrottle = true;
                setTimeout(function() {
                    inThrottle = false;
                }, limit);
            }
        };
    }

    // ============ NAMED HANDLER FUNCTIONS ============
    // These are stored by reference so they can be removed
    function handleClick() {
        sendMessageToParent('IFRAME_CLICK_MESSAGE');
    }

    function handleKeydown() {
        sendMessageToParent('IFRAME_KEYPRESS_MESSAGE');
    }

    var handleScroll = throttle(function() {
        sendMessageToParent('IFRAME_SCROLL_MESSAGE');
    }, 200);

    var handleMousemove = throttle(function() {
        sendMessageToParent('IFRAME_MOUSEMOVE_MESSAGE');
    }, 500);

    // ============ LIFECYCLE MANAGEMENT ============
    function init() {
        if (initialized) {
            console.warn(LOG_SOURCE + 'Already initialized');
            return;
        }

        // Register click listener
        window.addEventListener('click', handleClick, { passive: true });
        listeners.click = { target: window, handler: handleClick, options: { passive: true } };

        // Register keydown listener
        window.addEventListener('keydown', handleKeydown, { passive: true });
        listeners.keydown = { target: window, handler: handleKeydown, options: { passive: true } };

        // Register scroll listener (throttled)
        window.addEventListener('scroll', handleScroll, { passive: true });
        listeners.scroll = { target: window, handler: handleScroll, options: { passive: true } };

        // Register mousemove listener (throttled)
        window.addEventListener('mousemove', handleMousemove, { passive: true });
        listeners.mousemove = { target: window, handler: handleMousemove, options: { passive: true } };

        initialized = true;
        console.log(LOG_SOURCE + 'Initialized and listening for events');
    }

    function cleanup() {
        if (!initialized) {
            console.log(LOG_SOURCE + 'Not initialized, nothing to clean up');
            return;
        }

        // Remove all listeners
        var eventNames = Object.keys(listeners);
        for (var i = 0; i < eventNames.length; i++) {
            var eventName = eventNames[i];
            var listener = listeners[eventName];
            listener.target.removeEventListener(eventName, listener.handler, listener.options);
        }

        // Clear listener references
        listeners = {};
        initialized = false;

        console.log(LOG_SOURCE + 'Cleaned up and stopped listening');
    }

    function isInitialized() {
        return initialized;
    }

    // ============ PUBLIC API ============
    window.BrowserEventRelay = {
        init: init,
        cleanup: cleanup,
        isInitialized: isInitialized,
        getVersion: function() { return VERSION; }
    };

    // Backward compatibility alias
    window.IframeMessenger = window.BrowserEventRelay;

    // ============ AUTO-INITIALIZATION ============
    // Only initialize if this script is loaded inside an iframe
    // (not when the partner's page is opened directly in a browser tab)
    if (window.parent !== window) {
        init();
    } else {
        console.info(LOG_SOURCE + 'Loaded outside iframe (top-level page), initialization skipped');
    }
})();
