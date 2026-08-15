// Environment Configuration - Platform detects environment and resolves partner URL/origin
// Shared across platform scripts (ui-manager.js, fake-usage-meter.js, index.html)

(function() {
    // ============ ENVIRONMENT DETECTION ============
    // isDevelopment is true on localhost OR on vercel preview deployments
    const isDevelopment = window.location.hostname.includes('git-develop') ||
                         window.location.hostname === 'localhost';

    // ============ CONFIGURATION ============
    // Platform needs to know where the partner's content is hosted and what origin to trust
    const ENV_CONFIG = {
        prod: {
            // Partner's production URL
            PARTNER_URL: 'https://iframe-poc-partner.vercel.app/index.html',
            // Partner's production origin (for message origin validation)
            PARTNER_ORIGIN: 'https://iframe-poc-partner.vercel.app'
        },
        dev: {
            // Partner's development URL
            PARTNER_URL: 'https://iframe-poc-partner-git-develop-phil-skaroulis-projects.vercel.app/index-dev.html',
            // Partner's development origin (for message origin validation)
            PARTNER_ORIGIN: 'https://iframe-poc-partner-git-develop-phil-skaroulis-projects.vercel.app'
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
