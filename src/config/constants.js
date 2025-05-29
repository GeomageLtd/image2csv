const path = require('path');

const CONFIG = {
    PORT: process.env.PORT || 3000,
    UPLOAD_LIMITS: {
        FILE_SIZE: 10 * 1024 * 1024, // 10MB
        FIELD_SIZE: 50 * 1024 * 1024  // 50MB for JSON body
    },
    DIRECTORIES: {
        DATA: 'data',
        IMAGES: 'data/images',
        CSV: 'data/csv',
        PUBLIC: 'public'
    },
    FILES: {
        RESULTS_JSON: 'data/results.json'
    },
    PATHS: {
        PUBLIC: path.join(__dirname, '../../public'),
        INDEX_HTML: path.join(__dirname, '../../public', 'index.html'),
        RESULT_HTML: path.join(__dirname, '../../public', 'result.html')
    }
};

module.exports = CONFIG; 