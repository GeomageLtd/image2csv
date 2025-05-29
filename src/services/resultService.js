const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const CONFIG = require('../config/constants');
const { saveImageData, saveCsvData, readImageAsBase64, deleteFileIfExists } = require('../utils/fileUtils');

// In-memory storage for results (in production, use a database)
let resultsStorage = {};

/**
 * Load existing results from file on startup
 */
const loadResults = async () => {
    try {
        const data = await fs.readFile(CONFIG.FILES.RESULTS_JSON, 'utf8');
        resultsStorage = JSON.parse(data);
        console.log('Loaded existing results from file');
    } catch (error) {
        console.log('No existing results file found, starting fresh');
        resultsStorage = {};
    }
};

/**
 * Save results to file
 */
const saveResults = async () => {
    try {
        await fs.writeFile(CONFIG.FILES.RESULTS_JSON, JSON.stringify(resultsStorage, null, 2));
    } catch (error) {
        console.error('Error saving results:', error);
    }
};

/**
 * Save a new result with image and CSV data
 * @param {Object} data - Result data containing imageData, csvData, prompt, label, timestamp
 * @returns {Object} - Object containing success status, resultId, and shareUrl
 */
const saveResult = async (data) => {
    const { imageData, csvData, prompt, label, timestamp } = data;
    
    if (!imageData || !csvData) {
        throw new Error('Missing required data');
    }

    const resultId = uuidv4();
    const imageArray = Array.isArray(imageData) ? imageData : [imageData];
    const isBatch = imageArray.length > 1;
    
    console.log(`Processing ${imageArray.length} image(s) for result ${resultId}`);
    
    // Save image data
    const imagePaths = [];
    const imageExtensions = [];
    
    for (let i = 0; i < imageArray.length; i++) {
        const { imagePath, imageExtension } = await saveImageData(imageArray[i], resultId, isBatch ? i : null);
        imagePaths.push(imagePath);
        imageExtensions.push(imageExtension);
        console.log(`Image ${i + 1} saved to: ${imagePath}`);
    }
    
    // Save CSV data
    const csvPath = await saveCsvData(csvData, resultId);
    
    // Store metadata
    const resultMetadata = {
        id: resultId,
        timestamp: timestamp || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        prompt: prompt,
        label: label,
        csvPath: csvPath,
        isBatch: isBatch,
        imageCount: imageArray.length,
        imagePaths: imagePaths,
        imageExtensions: imageExtensions
    };

    // Add backward compatibility fields
    if (!isBatch) {
        resultMetadata.imagePath = imagePaths[0];
        resultMetadata.imageExtension = imageExtensions[0];
    }
    
    resultsStorage[resultId] = resultMetadata;
    
    // Save to file
    await saveResults();
    
    console.log(`Successfully saved result ${resultId} with ${imageArray.length} image(s)`);
    
    return { 
        success: true, 
        resultId: resultId,
        shareUrl: `/result/${resultId}`
    };
};

/**
 * Get a specific result by ID
 * @param {string} resultId - Result identifier
 * @returns {Object} - Result data including images and CSV
 */
const getResult = async (resultId) => {
    const result = resultsStorage[resultId];
    
    if (!result) {
        throw new Error('Result not found');
    }
    
    let imageData;
    
    if (result.isBatch && result.imagePaths) {
        // Handle multiple images
        imageData = [];
        for (let i = 0; i < result.imagePaths.length; i++) {
            const imagePath = result.imagePaths[i];
            const imageExtension = result.imageExtensions[i];
            const imageBase64 = await readImageAsBase64(imagePath, imageExtension);
            imageData.push(imageBase64);
        }
    } else {
        // Handle single image (backward compatibility)
        const imagePath = result.imagePath || result.imagePaths[0];
        const imageExtension = result.imageExtension || result.imageExtensions[0];
        imageData = await readImageAsBase64(imagePath, imageExtension);
    }
    
    // Read CSV file
    const csvData = await fs.readFile(result.csvPath, 'utf8');
    
    return {
        id: result.id,
        timestamp: result.timestamp,
        prompt: result.prompt,
        label: result.label,
        imageData: imageData,
        csvData: csvData,
        isBatch: result.isBatch || false,
        imageCount: result.imageCount || 1
    };
};

/**
 * Get all results metadata (without image/CSV data)
 * @returns {Array} - Array of result metadata objects
 */
const getAllResults = () => {
    return Object.values(resultsStorage).map(result => ({
        id: result.id,
        timestamp: result.timestamp,
        label: result.label || 'Untitled',
        imageCount: result.imageCount || 1,
        isBatch: result.isBatch || false
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Update an existing result's CSV data
 * @param {string} resultId - Result identifier
 * @param {string} csvData - New CSV content
 * @returns {Object} - Update result with success status and lastModified timestamp
 */
const updateResult = async (resultId, csvData) => {
    const result = resultsStorage[resultId];
    
    if (!result) {
        throw new Error('Result not found');
    }
    
    if (!csvData) {
        throw new Error('CSV data is required');
    }
    
    // Update CSV file
    await fs.writeFile(result.csvPath, csvData);
    
    // Update timestamp to reflect the edit
    resultsStorage[resultId].lastModified = new Date().toISOString();
    
    // Save to file
    await saveResults();
    
    return { 
        success: true, 
        message: 'Result updated successfully',
        lastModified: resultsStorage[resultId].lastModified
    };
};

/**
 * Delete a result and its associated files
 * @param {string} resultId - Result identifier
 * @returns {Object} - Delete result with success status
 */
const deleteResult = async (resultId) => {
    const result = resultsStorage[resultId];
    
    if (!result) {
        throw new Error('Result not found');
    }
    
    // Delete image files
    try {
        if (result.isBatch && result.imagePaths) {
            // Delete multiple image files
            for (const imagePath of result.imagePaths) {
                await deleteFileIfExists(imagePath);
            }
        } else {
            // Delete single image file (backward compatibility)
            const imagePath = result.imagePath || result.imagePaths[0];
            await deleteFileIfExists(imagePath);
        }
        
        // Delete CSV file
        await deleteFileIfExists(result.csvPath);
    } catch (fileError) {
        console.error('Error deleting files:', fileError);
    }
    
    // Remove from storage
    delete resultsStorage[resultId];
    await saveResults();
    
    return { success: true };
};

module.exports = {
    loadResults,
    saveResults,
    saveResult,
    getResult,
    getAllResults,
    updateResult,
    deleteResult
}; 