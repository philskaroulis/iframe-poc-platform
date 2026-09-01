// Partner Browser Event Relay - Detects and relays browser events to platform
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
            console.error('[browser-event-relay] Failed to parse referrer:', e);
        }
    }
    var MESSAGE_SOURCE = 'browser-event-relay';
    var LOG_SOURCE = '[' + MESSAGE_SOURCE + '] ';

    // Retrieve iframe ID from URL parameters
    var IFRAME_ID = null;
    try {
        var urlParams = new URLSearchParams(window.location.search);
        IFRAME_ID = urlParams.get('iframeId');
        if (IFRAME_ID) {
            console.log(LOG_SOURCE + 'Iframe ID initialized:', IFRAME_ID);
        }
    } catch (e) {
        console.warn(LOG_SOURCE + 'Failed to parse iframe ID from URL:', e);
    }

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
            var message = {
                source: MESSAGE_SOURCE,
                type: eventType,
                timestamp: Date.now(),
                iframeId: IFRAME_ID
            };
            window.parent.postMessage(message, PARENT_ORIGIN);
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
        sendMessageToParent('RELAYED_CLICK');
    }

    function handleKeydown() {
        sendMessageToParent('RELAYED_KEYPRESS');
    }

    var handleScroll = throttle(function() {
        sendMessageToParent('RELAYED_SCROLL');
    }, 200);

    var handleMousemove = throttle(function() {
        sendMessageToParent('RELAYED_MOUSEMOVE');
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

        // Notify platform that relay is now active
        if (PARENT_ORIGIN) {
            try {
                var initMessage = {
                    source: MESSAGE_SOURCE,
                    type: 'RELAYED_INIT',
                    timestamp: Date.now()
                };
                if (IFRAME_ID) {
                    initMessage.iframeId = IFRAME_ID;
                }
                window.parent.postMessage(initMessage, PARENT_ORIGIN);
            } catch (e) {
                console.error(LOG_SOURCE + 'Failed to notify platform of init:', e);
            }
        }
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

        // Notify platform that relay is now inactive
        if (PARENT_ORIGIN) {
            try {
                var cleanupMessage = {
                    source: MESSAGE_SOURCE,
                    type: 'RELAYED_CLEANUP',
                    timestamp: Date.now()
                };
                if (IFRAME_ID) {
                    cleanupMessage.iframeId = IFRAME_ID;
                }
                window.parent.postMessage(cleanupMessage, PARENT_ORIGIN);
            } catch (e) {
                console.error(LOG_SOURCE + 'Failed to notify platform of cleanup:', e);
            }
        }
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

    // ============ AUTO-INITIALIZATION ============
    // Only initialize if this script is loaded inside an iframe
    // (not when the partner's page is opened directly in a browser tab)
    if (window.parent !== window) {
        init();
    } else {
        console.info(LOG_SOURCE + 'Page loaded outside of an iframe (top-level page), so initialization is skipped');
    }

    console.info(LOG_SOURCE + 'Relay script done loading');
})();
