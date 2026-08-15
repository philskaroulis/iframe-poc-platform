// Environment Configuration - Platform detects environment and resolves partner URL/origin
// Shared across platform scripts (ui-manager.js, fake-usage-meter.js, index.html)

(function() {
    // ============ ENVIRONMENT DETECTION ============
    // isDevelopment is true on localhost OR on vercel preview deployments
    const isDevelopment = window.location.hostname.includes('vercel.app') ||
                         window.location.hostname === 'localhost';

    // ============ CONFIGURATION ============
    // Platform needs to know where the partner's content is hosted and what origin to trust
    const ENV_CONFIG = {
        prod: {
            // Partner's production URL (served from GitHub Pages)
            PARTNER_URL: 'https://philskaroulis.github.io/iframe-poc-partner/index.html',
            // Partner's production origin (for message origin validation)
            PARTNER_ORIGIN: 'https://philskaroulis.github.io'
        },
        dev: {
            // Partner's dev/preview URL (also served from GitHub Pages, just the -dev variant)
            PARTNER_URL: 'https://philskaroulis.github.io/iframe-poc-partner/index-dev.html',
            // Partner's origin (same as prod, only the content differs)
            PARTNER_ORIGIN: 'https://philskaroulis.github.io'
        }
    };

    // Select appropriate config based on environment
    const activeConfig = isDevelopment ? ENV_CONFIG.dev : ENV_CONFIG.prod;

    // ============ PUBLIC API ============
    window.EnvConfig = {
        isDevelopment: isDevelopment,
        get: (key) => activeConfig[key],
        getAll: () => ({ ...activeConfig }),
        environment: isDevelopment ? 'development' : 'production'
    };

    console.log('[EnvConfig] Initialized for', window.EnvConfig.environment, 'environment');
    console.log('[EnvConfig] PARTNER_ORIGIN:', activeConfig.PARTNER_ORIGIN);
})();
