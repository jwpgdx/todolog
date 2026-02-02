const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add wasm asset support for expo-sqlite web
config.resolver.assetExts.push('wasm');

// Ensure server config exists
config.server = config.server || {};

// Add COEP and COOP headers to support SharedArrayBuffer (required for expo-sqlite web)
const originalEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
    // Apply original enhancer if it exists
    let enhancedMiddleware = originalEnhanceMiddleware
        ? originalEnhanceMiddleware(middleware, server)
        : middleware;

    return (req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        enhancedMiddleware(req, res, next);
    };
};

module.exports = withNativeWind(config, { input: './global.css' });