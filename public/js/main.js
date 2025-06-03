/**
 * Main Application Entry Point (Refactored)
 * This file coordinates all modules and handles the primary application flow
 */

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApplication();
});

/**
 * Initialize the application
 */
async function initializeApplication() {
    console.log('🚀 Initializing Image2CSV Application...');
    
    // Initialize API Key Manager first to load default key
    await ApiKeyManager.initialize();
    
    // Initialize ImagePreview with clipboard support
    ImagePreview.initialize();
    
    // Check for result ID in URL on page load
    const resultId = getQueryParam('result');
    if (resultId) {
        ResultManager.loadSavedResult(resultId);
    }
    
    // Load results list
    ResultManager.loadResultsList();
    
    // Check TIFF library status
    checkTiffLibraryStatus();
    
    // Setup event listeners
    EventHandlers.setupEventListeners();
    
    console.log('✅ Application initialized successfully');
}

/**
 * Get query parameter value from URL
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Check TIFF library status
 */
function checkTiffLibraryStatus() {
    // Check if TIFF.js is available
    if (typeof UTIF !== 'undefined') {
        console.log('✅ TIFF.js library loaded successfully');
            } else {
        console.warn('⚠️ TIFF.js library not loaded - TIFF files may not be supported');
    }
}

/**
 * Open TIFF viewer in a new tab
 */
function openTiffViewer() {
    window.open('/tiff-viewer', '_blank');
}

// Make openTiffViewer globally accessible
window.openTiffViewer = openTiffViewer;

// Export for use in other modules
window.AppMain = {
    initializeApplication,
    getQueryParam,
    checkTiffLibraryStatus,
    openTiffViewer,
    
    // Re-export main modules for backwards compatibility
    BatchProcessor,
    CSVProcessor,
    ResultManager,
    DisplayManager,
    ImagePreview,
    ImageViewer,
    PasswordManager,
    EventHandlers
}; 