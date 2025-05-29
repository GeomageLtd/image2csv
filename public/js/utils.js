// Utility functions for the application

/**
 * Convert file to base64 string
 * @param {File} file - File to convert
 * @param {number} index - File index for logging
 * @returns {Promise<string>} Base64 encoded string
 */
function fileToBase64(file, index = null) {
    return new Promise((resolve, reject) => {
        // Use cropped version if available
        const fileToUse = (index !== null && AppState.croppedFiles.has(index)) ? 
            AppState.croppedFiles.get(index) : file;
            
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        reader.onerror = function(error) {
            console.error(`Error reading file ${index !== null ? index : ''}:`, error);
            reject(error);
        };
        reader.readAsDataURL(fileToUse);
    });
}

/**
 * Show error message to user
 * @param {string} message - Error message
 */
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'none';
}

/**
 * Show/hide loading state
 * @param {boolean} isLoading - Whether to show loading state
 */
function setLoading(isLoading) {
    const submitButton = document.querySelector('button[type="submit"]');
    const loadingDiv = document.getElementById('loading');
    
    if (isLoading) {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
        loadingDiv.style.display = 'block';
        hideError();
    } else {
        submitButton.disabled = false;
        submitButton.textContent = 'Process Images';
        loadingDiv.style.display = 'none';
    }
}

/**
 * Create a DOM element with attributes
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Attributes to set
 * @param {string} textContent - Text content
 * @returns {HTMLElement} Created element
 */
function createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else {
            element[key] = value;
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * Download file with specified content
 * @param {string} content - File content
 * @param {string} filename - Name for the downloaded file
 * @param {string} mimeType - MIME type for the file
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
}

/**
 * Open image in new tab
 * @param {string} imageUrl - URL of the image to open
 */
function openInNewTab(imageUrl) {
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
        <html>
            <head>
                <title>Image Viewer</title>
                <style>
                    body { margin: 0; padding: 20px; background: #f0f0f0; text-align: center; }
                    img { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
                </style>
            </head>
            <body>
                <img src="${imageUrl}" alt="Image" />
            </body>
        </html>
    `);
    newWindow.document.close();
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value
 */
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Set query parameter in URL
 * @param {string} param - Parameter name
 * @param {string} value - Parameter value
 */
function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.replaceState({}, '', url);
}

/**
 * Hide results section
 */
function hideResults() {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
    }
    
    // Clear state
    AppState.csvData = '';
    AppState.currentResultId = null;
}

// Make functions globally available
window.openInNewTab = openInNewTab;
window.getQueryParam = getQueryParam;
window.formatTimestamp = formatTimestamp;
window.hideResults = hideResults; 