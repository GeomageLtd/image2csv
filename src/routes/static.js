const express = require('express');
const path = require('path');
const CONFIG = require('../config/constants');

const router = express.Router();

// Serve the main page
router.get('/', (req, res) => {
    res.sendFile(CONFIG.PATHS.INDEX_HTML);
});

// Serve individual result page
router.get('/result/:id', (req, res) => {
    res.sendFile(CONFIG.PATHS.RESULT_HTML);
});

// Serve TIFF viewer page
router.get('/tiff-viewer', (req, res) => {
    res.sendFile(path.join(CONFIG.PATHS.PUBLIC, 'tiff-viewer.html'));
});

module.exports = router; 