// UI Manager - Handles visual representation of activity state
(function() {
    'use strict';

    const ACTIVE_CLASS = 'active';
    const INACTIVE_CLASS = 'inactive';
    const INACTIVITY_TIMEOUT = 10000;

    // Lifecycle state
    let initialized = false;
    let animationFrameId = null;
    let handleVisibilityChange = null;

    // State
    let lastActivityTime = null;
    let inactivityTimer = null;
    let isActive = false;

    // DOM elements
    const header = document.querySelector('header');
    const statusText = document.querySelector('.status-text');
    const countdown = document.querySelector('.countdown');
    const iframeContainer = document.querySelector('.iframe-container');

    function formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }

    function updateCountdown() {
        if (!isActive || !lastActivityTime) {
            countdown.textContent = 'Seconds to INACTIVE: --s';
            return;
        }

        const now = Date.now();
        const elapsed = now - lastActivityTime.getTime();
        const remainingMs = Math.max(0, INACTIVITY_TIMEOUT - elapsed);
        const remainingSeconds = (remainingMs / 1000).toFixed(1);

        countdown.textContent = `Seconds to INACTIVE: ${remainingSeconds}s`;
    }

    function setActive() {
        isActive = true;
        header.classList.remove(INACTIVE_CLASS);
        header.classList.add(ACTIVE_CLASS);
        statusText.textContent = 'ACTIVE';

        if (iframeContainer) {
            iframeContainer.classList.add(ACTIVE_CLASS);
        }

        countdown.classList.remove('disabled');
        lastActivityTime = new Date();

        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }

        inactivityTimer = setTimeout(() => {
            setInactive();
        }, INACTIVITY_TIMEOUT);

        updateCountdown();
    }

    function setInactive() {
        isActive = false;
        header.classList.remove(ACTIVE_CLASS);
        header.classList.add(INACTIVE_CLASS);
        statusText.textContent = 'INACTIVE';

        if (iframeContainer) {
            iframeContainer.classList.remove(ACTIVE_CLASS);
        }

        countdown.classList.add('disabled');

        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
    }

    // ============ LIFECYCLE MANAGEMENT ============
    function init() {
        if (initialized) {
            console.warn('[UI Manager] Already initialized');
            return;
        }

        // Initialize state
        setInactive();
        countdown.classList.add('disabled');

        // Start countdown animation loop
        function animateCountdown() {
            updateCountdown();
            animationFrameId = requestAnimationFrame(animateCountdown);
        }
        animateCountdown();

        // Handle parent window visibility
        handleVisibilityChange = () => {
            if (document.hidden) {
                setInactive();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        initialized = true;
        console.log('[UI Manager] Initialized');
    }

    function cleanup() {
        if (!initialized) {
            console.log('[UI Manager] Not initialized, nothing to clean up');
            return;
        }

        // Cancel animation frame
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Remove visibility listener
        if (handleVisibilityChange) {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            handleVisibilityChange = null;
        }

        // Clear timers
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }

        // Reset state
        lastActivityTime = null;
        isActive = false;

        // Reset UI to default state
        if (header && statusText && countdown) {
            header.classList.remove(ACTIVE_CLASS);
            header.classList.add(INACTIVE_CLASS);
            statusText.textContent = 'INACTIVE';
            countdown.classList.add('disabled');
            countdown.textContent = 'Seconds to INACTIVE: --s';
        }

        if (iframeContainer) {
            iframeContainer.classList.remove(ACTIVE_CLASS);
        }

        initialized = false;
        console.log('[UI Manager] Cleaned up and uninitialized');
    }

    function isInitialized() {
        return initialized;
    }

    // ============ PUBLIC API ============
    window.UIManager = {
        init: init,
        cleanup: cleanup,
        isInitialized: isInitialized,
        setActive: setActive,
        setInactive: setInactive
    };

    // ============ AUTO-INITIALIZATION ============
    // Auto-initialize on script load
    init();
})();
