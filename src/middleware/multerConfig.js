const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const CONFIG = require('../config/constants');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, CONFIG.DIRECTORIES.IMAGES);
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: CONFIG.UPLOAD_LIMITS.FILE_SIZE }
});

module.exports = upload; 