const fs = require('fs').promises;
const path = require('path');
const CONFIG = require('../config/constants');

/**
 * Create necessary directories for the application
 */
const createDirectories = async () => {
    try {
        await fs.mkdir(CONFIG.DIRECTORIES.DATA, { recursive: true });
        await fs.mkdir(CONFIG.DIRECTORIES.IMAGES, { recursive: true });
        await fs.mkdir(CONFIG.DIRECTORIES.CSV, { recursive: true });
        await fs.mkdir(CONFIG.DIRECTORIES.PUBLIC, { recursive: true });
        console.log('Directories created successfully');
    } catch (error) {
        console.error('Error creating directories:', error);
    }
};

/**
 * Save image data to file system
 * @param {string} imageData - Base64 image data
 * @param {string} resultId - Unique result identifier
 * @param {number} index - Image index for batch processing
 * @returns {Object} - Object containing imagePath and imageExtension
 */
const saveImageData = async (imageData, resultId, index = null) => {
    if (!imageData || typeof imageData !== 'string' || !imageData.includes('data:image/')) {
        throw new Error('Invalid image data format');
    }

    const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
    const imageExtension = imageData.split(';')[0].split('/')[1];
    
    const filename = index !== null ? `${resultId}_${index}.${imageExtension}` : `${resultId}.${imageExtension}`;
    const imagePath = path.join(CONFIG.DIRECTORIES.IMAGES, filename);
    
    await fs.writeFile(imagePath, imageBuffer);
    
    return { imagePath, imageExtension };
};

/**
 * Save CSV data to file system
 * @param {string} csvData - CSV content
 * @param {string} resultId - Unique result identifier
 * @returns {string} - Path to saved CSV file
 */
const saveCsvData = async (csvData, resultId) => {
    const csvPath = path.join(CONFIG.DIRECTORIES.CSV, `${resultId}.csv`);
    await fs.writeFile(csvPath, csvData);
    return csvPath;
};

/**
 * Read image file and convert to base64
 * @param {string} imagePath - Path to image file
 * @param {string} imageExtension - Image file extension
 * @returns {string} - Base64 encoded image data
 */
const readImageAsBase64 = async (imagePath, imageExtension) => {
    const imageBuffer = await fs.readFile(imagePath);
    return `data:image/${imageExtension};base64,${imageBuffer.toString('base64')}`;
};

/**
 * Delete file if it exists
 * @param {string} filePath - Path to file to delete
 */
const deleteFileIfExists = async (filePath) => {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
    }
};

module.exports = {
    createDirectories,
    saveImageData,
    saveCsvData,
    readImageAsBase64,
    deleteFileIfExists
}; 