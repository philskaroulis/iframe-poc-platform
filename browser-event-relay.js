/*
 * Browser Event Relay - Detects and relays browser events to platform parent
 * Supports lifecycle management to prevent memory leaks in partner apps
 *
 * BROWSER COMPATIBILITY:
 * Result: Works on IE9+, Chrome 32+, Safari 10+, Firefox 26+ (no polyfills needed)
 *
 * | Browser | Min Version | Release Date |
 * |---------|-------------|--------------|
 * | IE      | 9+          | 2011         |
 * | Chrome  | 32+         | Dec 2013     |
 * | Safari  | 10+         | Sep 2016     |
 * | Firefox | 26+         | Apr 2014     |
 *
 * COMPATIBILITY NOTES FOR DEVELOPERS:
 *
 * This script intentionally uses older JavaScript APIs to maximize compatibility.
 * IE compatibility logic is isolated in dedicated functions below (see section markers).
 * This makes it easy to modernize when IE support is no longer needed.
 */

(function() {
    var VERSION = '1.0.0';
    var MESSAGE_SOURCE = 'browser-event-relay';
    var LOG_SOURCE = '[' + MESSAGE_SOURCE + '] ';

    // ============ IE COMPATIBILITY: URL PARSING ============
    // This section handles browser incompatibilities with modern URL APIs
    // When dropping IE support: replace with new URL(referrer).origin

    /**
     * IE COMPATIBILITY: Extract origin from referrer string
     *
     * Why: new URL() constructor not supported in IE
     * Alternative: new URL(referrer).origin (Chrome 32+, Safari 10.1+, Firefox 26+)
     *
     * @param {string} referrer - The document.referrer string
     * @returns {string|null} The origin (e.g., "https://example.com") or null if invalid
     */
    function parseOriginFromReferrer(referrer) {
        try {
            // Regex matches "https://example.com" from full URL
            // Pattern: protocol (http/https) + :// + domain (up to next /)
            var match = referrer.match(/^https?:\/\/[^\/]+/);
            return match ? match[0] : null;
        } catch (e) {
            console.error(LOG_SOURCE + 'Failed to parse referrer origin:', e);
            return null;
        }
    }

    /**
     * IE COMPATIBILITY: Extract query parameter from URL
     *
     * Why: URLSearchParams API not supported in IE, Chrome <49, Safari <11.1
     * Alternative: new URLSearchParams(location.search).get(name)
     *
     * @param {string} paramName - The parameter name to retrieve
     * @returns {string|null} The parameter value (URL-decoded) or null if not found
     */
    function getUrlParameter(paramName) {
        try {
            // Remove leading '?' and split by '&' to get individual parameters
            var params = window.location.search.substring(1).split('&');
            for (var i = 0; i < params.length; i++) {
                var pair = params[i].split('=');
                // Decode both key and value to handle URL-encoded characters
                if (decodeURIComponent(pair[0]) === paramName) {
                    return pair[1] ? decodeURIComponent(pair[1]) : '';
                }
            }
            return null;
        } catch (e) {
            console.warn(LOG_SOURCE + 'Failed to extract URL parameter:', e);
            return null;
        }
    }

    // ============ INITIALIZATION ============

    // Derive trusted parent origin from document.referrer (works cross-origin)
    // Referrer is set by platform's referrerpolicy="strict-origin" iframe attribute
    var PARENT_ORIGIN = parseOriginFromReferrer(document.referrer);

    // Retrieve iframe ID from URL parameters (relay token for iframe isolation)
    var IFRAME_ID = getUrlParameter('iframeId');
    if (IFRAME_ID) {
        console.log(LOG_SOURCE + 'Iframe ID initialized:', IFRAME_ID);
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

    // ============ EVENT HANDLER FUNCTIONS ============
    // These are stored by reference so they can be removed during cleanup
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

    // ============ IE COMPATIBILITY: EVENT LISTENERS ============
    // addEventListener/removeEventListener called without options object
    // When dropping IE support: add { passive: true } back for scroll performance

    /**
     * IE COMPATIBILITY: Add event listener without options
     *
     * Why: IE doesn't support options object in addEventListener()
     * Modern approach: addEventListener(event, handler, { passive: true })
     * This version: addEventListener(event, handler) - IE9+ compatible
     *
     * Trade-off: Modern browsers still optimize internally, but won't
     * explicitly suppress default behavior for scroll events (IE never did anyway)
     */
    function addListenerWithoutOptions(target, eventName, handler) {
        target.addEventListener(eventName, handler);
        // Store listener info for cleanup (without options object)
        listeners[eventName] = { target: target, handler: handler };
    }

    /**
     * IE COMPATIBILITY: Remove event listener without options
     *
     * Why: removeEventListener() called with only 2 params (IE compatible)
     * vs. 3 params with options object (modern browsers)
     */
    function removeListenerWithoutOptions(target, eventName, handler) {
        // IE9+ doesn't require the options parameter, so we omit it
        target.removeEventListener(eventName, handler);
    }

    // ============ LIFECYCLE MANAGEMENT ============
    function init() {
        if (initialized) {
            console.warn(LOG_SOURCE + 'Already initialized');
            return;
        }

        // Register event listeners (without options for IE compatibility)
        addListenerWithoutOptions(window, 'click', handleClick);
        addListenerWithoutOptions(window, 'keydown', handleKeydown);
        addListenerWithoutOptions(window, 'scroll', handleScroll);
        addListenerWithoutOptions(window, 'mousemove', handleMousemove);

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
            removeListenerWithoutOptions(listener.target, eventName, listener.handler);
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
