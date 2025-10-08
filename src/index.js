const TechCorpAuth = require('./auth/TechCorpAuth');

// Main export
module.exports = {
    TechCorpAuth,
    
    // Factory function for easy creation
    createAuth: (config = {}) => {
        return new TechCorpAuth(config);
    },
    
    // Utility exports
    version: '1.0.0'
};