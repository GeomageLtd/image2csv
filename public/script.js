// Download CSV button handler
document.getElementById('downloadBtn').addEventListener('click', function() {
    if (!csvData) return;
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parsed_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
});

let csvData = '';
let currentResultId = null;

// Check for result ID in URL on page load
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const resultId = urlParams.get('result');
    
    if (resultId) {
        loadSavedResult(resultId);
    }
    
    loadResultsList();
});

// Auto-fill label when file is selected
document.getElementById('imageFiles').addEventListener('change', function(e) {
    const files = e.target.files;
    const fileInfo = document.getElementById('fileInfo');
    const fileCount = document.getElementById('fileCount');
    
    if (files.length > 0) {
        fileInfo.style.display = 'block';
        fileCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
        
        // Generate default label based on file count and first filename
        const firstFile = files[0];
        let defaultLabel;
        
        if (files.length === 1) {
            const nameWithoutExt = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
            defaultLabel = nameWithoutExt;
        } else {
            const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
            defaultLabel = `${baseName} + ${files.length - 1} more`;
        }
        
        document.getElementById('resultLabel').value = defaultLabel;
        
        // Show image previews immediately with crop functionality
        showImagePreviewsForSelection(files);
    } else {
        fileInfo.style.display = 'none';
        document.getElementById('resultLabel').value = '';
        
        // Hide previews
        hideImagePreviews();
    }
});

/**
 * Show image previews immediately after file selection
 * @param {FileList} files - Selected files
 */
async function showImagePreviewsForSelection(files) {
    // Clear any existing cropped files from previous selections
    croppedFiles.clear();
    
    // Show the preview container
    const batchProgress = document.getElementById('batchProgress');
    batchProgress.style.display = 'block';
    
    // Hide progress bar since we're just showing previews
    const progressBar = batchProgress.querySelector('.progress-bar');
    const progressText = batchProgress.querySelector('.progress-text');
    if (progressBar) progressBar.style.display = 'none';
    if (progressText) progressText.style.display = 'none';
    
    // Create previews with crop functionality
    await createImagePreviewsForSelection(files);
}

/**
 * Hide image previews
 */
function hideImagePreviews() {
    const batchProgress = document.getElementById('batchProgress');
    batchProgress.style.display = 'none';
    
    // Clear cropped files
    croppedFiles.clear();
}

/**
 * Create image previews for file selection (before processing)
 * @param {FileList} imageFiles - Array of image files
 */
async function createImagePreviewsForSelection(imageFiles) {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imageUrl = URL.createObjectURL(file);
        
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <button class="crop-button" onclick="openCropModal(${i})">
                ✂️ Crop
            </button>
            <img src="${imageUrl}" alt="${file.name}" class="preview-image" data-src="${imageUrl}">
            <div class="preview-label">${file.name}</div>
        `;
        
        // Add double-click event listener to open image in new tab
        previewItem.addEventListener('dblclick', function() {
            openImageInNewTab(imageUrl, file.name);
        });
        
        previewContainer.appendChild(previewItem);
    }
}

// Main form submission handler
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value;
    const imageFiles = document.getElementById('imageFiles').files;
    const textPrompt = document.getElementById('textPrompt').value;
    const resultLabel = document.getElementById('resultLabel').value.trim();
    
    if (!apiKey || imageFiles.length === 0 || !textPrompt) {
        showError('Please fill in all fields and select at least one image');
        return;
    }
    
    // Generate final label
    let finalLabel = resultLabel;
    if (!finalLabel) {
        if (imageFiles.length === 1) {
            finalLabel = imageFiles[0].name.substring(0, imageFiles[0].name.lastIndexOf('.')) || imageFiles[0].name;
        } else {
            finalLabel = `Batch of ${imageFiles.length} images`;
        }
    }
    
    try {
        setLoading(true);
        hideError();
        hideResults();
        
        // Sort files alphabetically by filename
        const sortedFiles = Array.from(imageFiles).sort((a, b) => a.name.localeCompare(b.name));
        
        // Process multiple images
        const results = await processBatchImages(apiKey, sortedFiles, textPrompt);
        
        // Combine all CSV results
        const combinedCsv = combineCSVResults(results);
        
        // Display results with sorted files
        displayBatchResults(sortedFiles, combinedCsv, results);
        
        // Save combined result to server with sorted files
        const imageDataArray = await Promise.all(
            sortedFiles.map(file => fileToBase64(file))
        );
        await saveResultToServer(imageDataArray, combinedCsv, textPrompt, finalLabel);
        
    } catch (error) {
        showError('Error: ' + error.message);
    } finally {
        setLoading(false);
        hideBatchProgress();
    }
});

/**
 * Process multiple images in batch (UPDATED to show progress elements)
 * @param {string} apiKey - OpenAI API key
 * @param {FileList} imageFiles - Array of image files
 * @param {string} textPrompt - User prompt
 * @returns {Promise<Array>} Array of processing results
 */
async function processBatchImages(apiKey, imageFiles, textPrompt) {
    const results = [];
    const totalFiles = imageFiles.length;
    
    showBatchProgress();
    updateProgress(0, totalFiles, 'Starting batch processing...');
    
    // Create/update preview for all images (reuse existing if available)
    await createImagePreviews(imageFiles);
    
    for (let i = 0; i < totalFiles; i++) {
        const file = imageFiles[i];
        updateImageStatus(i, 'processing');
        updateProgress(i, totalFiles, `Processing ${file.name}...`);
        
        try {
            // Convert image to base64 (uses cropped version if available)
            const base64Image = await fileToBase64(file, i);
            
            // Make API call to OpenAI
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: textPrompt + "\n\nPlease return the data in CSV format."
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: base64Image
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 4000
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API request failed');
            }
            
            const data = await response.json();
            const csvContent = data.choices[0].message.content;
            
            results.push({
                filename: file.name,
                csvContent: csvContent,
                imageData: base64Image,
                success: true
            });
            
            updateImageStatus(i, 'complete');
            
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            results.push({
                filename: file.name,
                error: error.message,
                success: false
            });
            
            updateImageStatus(i, 'error');
        }
        
        // Small delay between requests to avoid rate limiting
        if (i < totalFiles - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    updateProgress(totalFiles, totalFiles, 'Processing complete!');
    return results;
}

/**
 * Create image previews for batch processing (updated to reuse existing previews)
 * @param {FileList} imageFiles - Array of image files
 */
async function createImagePreviews(imageFiles) {
    const previewContainer = document.getElementById('imagePreview');
    
    // Check if previews already exist from file selection
    const existingPreviews = previewContainer.querySelectorAll('.preview-item');
    
    if (existingPreviews.length === imageFiles.length) {
        // Previews already exist, just add processing status indicators
        existingPreviews.forEach((previewItem, i) => {
            // Check if status indicator already exists
            if (!previewItem.querySelector(`#status-${i}`)) {
                const statusDiv = document.createElement('div');
                statusDiv.className = 'processing-status status-pending';
                statusDiv.id = `status-${i}`;
                statusDiv.textContent = 'Pending';
                previewItem.insertBefore(statusDiv, previewItem.firstChild);
            }
        });
        return;
    }
    
    // Create new previews if they don't exist
    previewContainer.innerHTML = '';
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imageUrl = URL.createObjectURL(file);
        
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <div class="processing-status status-pending" id="status-${i}">Pending</div>
            <button class="crop-button" onclick="openCropModal(${i})">
                ✂️ Crop
            </button>
            <img src="${imageUrl}" alt="${file.name}" class="preview-image" data-src="${imageUrl}">
            <div class="preview-label">${file.name}</div>
        `;
        
        // Add double-click event listener to open image in new tab
        previewItem.addEventListener('dblclick', function() {
            openImageInNewTab(imageUrl, file.name);
        });
        
        previewContainer.appendChild(previewItem);
    }
}

/**
 * Update processing status for a specific image
 * @param {number} index - Image index
 * @param {string} status - Status (pending, processing, complete, error)
 */
function updateImageStatus(index, status) {
    const statusElement = document.getElementById(`status-${index}`);
    if (statusElement) {
        statusElement.className = `processing-status status-${status}`;
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
}

/**
 * Show batch progress UI (updated to show progress elements)
 */
function showBatchProgress() {
    const batchProgress = document.getElementById('batchProgress');
    batchProgress.style.display = 'block';
    
    // Show progress bar and text for processing
    const progressBar = batchProgress.querySelector('.progress-bar');
    const progressText = batchProgress.querySelector('.progress-text');
    if (progressBar) progressBar.style.display = 'block';
    if (progressText) progressText.style.display = 'block';
}

/**
 * Hide batch progress UI
 */
function hideBatchProgress() {
    document.getElementById('batchProgress').style.display = 'none';
}

/**
 * Update progress bar and text
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {string} message - Progress message
 */
function updateProgress(current, total, message) {
    const percentage = (current / total) * 100;
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${message} (${current}/${total})`;
}

/**
 * Combine multiple CSV results into one
 * @param {Array} results - Array of processing results
 * @returns {string} Combined CSV content
 */
function combineCSVResults(results) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
        throw new Error('No images were successfully processed');
    }
    
    let combinedRows = [];
    let referenceHeaders = null;
    
    successfulResults.forEach((result, index) => {
        // Clean CSV content
        const cleanCsv = result.csvContent.replace(/```csv\n?/g, '').replace(/```\n?/g, '').trim();
        const lines = cleanCsv.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) return;
        
        // Parse CSV lines
        const csvRows = lines.map(line => 
            line.split(',').map(cell => cell.trim().replace(/"/g, ''))
        );
        
        if (index === 0) {
            // Use first file's headers as reference
            referenceHeaders = csvRows[0];
            combinedRows.push(referenceHeaders);
            
            // Add data rows from first file
            if (csvRows.length > 1) {
                combinedRows.push(...csvRows.slice(1));
            }
        } else {
            // For subsequent files, check if first row is headers
            let startIndex = 0;
            
            if (csvRows.length > 0) {
                const firstRow = csvRows[0];
                
                // Check if first row looks like headers by comparing with reference
                const isHeaderRow = false;//isLikelyHeaderRow(firstRow, referenceHeaders, csvRows);
                
                if (isHeaderRow) {
                    // Skip the header row
                    startIndex = 1;
                    console.log(`Skipping header row in file ${index + 1}:`, firstRow);
                } else {
                    // First row contains data, start from beginning
                    startIndex = 0;
                    console.log(`No header detected in file ${index + 1}, including all rows`);
                }
                
                // Add data rows from current file
                if (csvRows.length > startIndex) {
                    combinedRows.push(...csvRows.slice(startIndex));
                }
            }
        }
    });
    
    // Convert back to CSV format
    return combinedRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
}

/**
 * Determine if a row is likely to be a header row
 * @param {Array} row - The row to check
 * @param {Array} referenceHeaders - Headers from the first file
 * @param {Array} allRows - All rows from the current file
 * @returns {boolean} True if the row is likely a header
 */
function isLikelyHeaderRow(row, referenceHeaders, allRows) {
    // If we don't have reference headers, assume first row is header
    if (!referenceHeaders || !Array.isArray(referenceHeaders)) {
        return true;
    }
    
    // If the row length doesn't match reference headers, it's probably not a header
    if (row.length !== referenceHeaders.length) {
        return false;
    }
    
    // Check for exact match with reference headers
    const exactMatch = row.every((cell, index) => {
        return cell.toLowerCase().trim() === referenceHeaders[index].toLowerCase().trim();
    });
    if (exactMatch) {
        return true;
    }
    
    // Check if this row contains mostly non-numeric values while subsequent rows are numeric
    // This helps identify cases where headers are descriptive text
    if (allRows.length > 1) {
        const isFirstRowMostlyText = row.some(cell => isNaN(parseFloat(cell)) && cell.trim() !== '');
        const isSecondRowMostlyNumeric = allRows[1].some(cell => !isNaN(parseFloat(cell)));
        
        if (isFirstRowMostlyText && isSecondRowMostlyNumeric) {
            return true;
        }
    }
    
    // Check if the row contains typical header patterns
    const headerPatterns = /^(column|col|header|field|name|time|date|value|data|row|#)/i;
    const hasHeaderPattern = row.some(cell => headerPatterns.test(cell.toString()));
    
    if (hasHeaderPattern) {
        return true;
    }
    
    // Check if all cells in the row look like column identifiers
    // This handles cases like "1", "2", "3" or "A", "B", "C" as headers
    const allSimpleIdentifiers = row.every(cell => {
        const cellStr = cell.toString().trim();
        // Check for simple numeric sequence (1, 2, 3, etc.)
        if (/^\d+$/.test(cellStr)) return true;
        // Check for single letters (A, B, C, etc.)
        if (/^[A-Za-z]$/.test(cellStr)) return true;
        // Check for short descriptive text
        if (cellStr.length <= 20 && !/^\d+\.?\d*$/.test(cellStr)) return true;
        return false;
    });
    
    // If we have multiple rows and first row is all simple identifiers
    // while other rows contain more complex data, treat first as header
    if (allSimpleIdentifiers && allRows.length > 1) {
        const secondRowComplexity = allRows[1].some(cell => {
            const cellStr = cell.toString().trim();
            return cellStr.length > 20 || /^\d+\.\d+$/.test(cellStr);
        });
        
        if (secondRowComplexity) {
            return true;
        }
    }
    
    // Default to treating first row as header if we're unsure and it's reasonable
    // This is safer than accidentally including headers as data
    if (allRows.length > 1) {
        return true;
    }
    
    return false;
}

/**
 * Display batch processing results
 * @param {FileList} imageFiles - Original image files
 * @param {string} combinedCsv - Combined CSV content
 * @param {Array} results - Processing results
 */
function displayBatchResults(imageFiles, combinedCsv, results) {
    // Update section title
    const title = document.getElementById('imagesSectionTitle');
    title.textContent = `📷 Uploaded Images (${imageFiles.length})`;
    
    // Display images
    const displayContainer = document.getElementById('displayImages');
    displayContainer.innerHTML = '';
    displayContainer.className = 'image-preview';
    
    Array.from(imageFiles).forEach((file, index) => {
        const imageUrl = URL.createObjectURL(file);
        const result = results[index];
        
        const imageItem = document.createElement('div');
        imageItem.className = 'preview-item';
        imageItem.innerHTML = `
            <img src="${imageUrl}" alt="${file.name}" class="preview-image">
            <div class="preview-label">
                ${file.name} 
                ${result.success ? '✅' : '❌'}
            </div>
        `;
        
        displayContainer.appendChild(imageItem);
    });
    
    // Store and display CSV
    csvData = combinedCsv;
    displayCSVTableWithValidation(csvData);
    
    // Show results
    document.getElementById('results').style.display = 'block';
}

/**
 * Save result to server (FIXED VERSION)
 * @param {string|Array} imageData - Base64 image data or array of image data
 * @param {string} csvContent - CSV content
 * @param {string} prompt - User prompt
 * @param {string} label - Result label
 */
async function saveResultToServer(imageData, csvContent, prompt, label) {
    try {
        console.log('Saving result to server...', {
            imageCount: Array.isArray(imageData) ? imageData.length : 1,
            csvLength: csvContent.length,
            label: label
        });
        
        const requestData = {
            imageData: imageData, // This should be an array for batch, single string for single
            csvData: csvContent.replace(/```csv\n?/g, '').replace(/```\n?/g, '').trim(),
            prompt: prompt,
            label: label,
            timestamp: new Date().toISOString()
        };
        
        console.log('Request data prepared:', {
            hasImageData: !!requestData.imageData,
            imageDataType: Array.isArray(requestData.imageData) ? 'array' : 'string',
            csvDataLength: requestData.csvData.length
        });
        
        const response = await fetch('/api/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Server response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Result saved successfully:', result);
            currentResultId = result.resultId;
            
            // Update URL with result ID
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('result', result.resultId);
            window.history.pushState({}, '', newUrl);
            
            // Show share options
            showShareOptions(result.resultId, result.shareUrl);
            
            // Refresh results list
            loadResultsList();
        } else {
            const errorData = await response.json();
            console.error('Server error response:', errorData);
            throw new Error(errorData.error || 'Failed to save result');
        }
    } catch (error) {
        console.error('Error saving result:', error);
        showError('Failed to save result: ' + error.message);
    }
}

/**
 * Load a saved result
 * @param {string} resultId - Result ID to load
 */
async function loadSavedResult(resultId) {
    try {
        setLoading(true);
        
        const response = await fetch(`/api/result/${resultId}`);
        if (!response.ok) {
            throw new Error('Result not found');
        }
        
        const result = await response.json();
        
        // Create a mock file object for display
        const mockFile = {
            name: `saved_image_${resultId}`
        };
        
        // Set form values
        document.getElementById('textPrompt').value = result.prompt;
        if (result.label) {
            document.getElementById('resultLabel').value = result.label;
        }
        
        // Display results
        displaySavedResults(result.imageData, result.csvData);
        currentResultId = result.id;
        
        // Show share options
        showShareOptions(result.id, `/result/${result.id}`);
        
    } catch (error) {
        showError('Error loading saved result: ' + error.message);
    } finally {
        setLoading(false);
    }
}

/**
 * Display saved results (updated for batch support)
 * @param {string} imageData - Base64 image data or array
 * @param {string} csvContent - CSV content
 */
function displaySavedResults(imageData, csvContent) {
    // Handle both single image and batch display
    if (Array.isArray(imageData)) {
        // Batch display
        const title = document.getElementById('imagesSectionTitle');
        title.textContent = `📷 Saved Images (${imageData.length})`;
        
        const displayContainer = document.getElementById('displayImages');
        displayContainer.innerHTML = '';
        displayContainer.className = 'image-preview';
        
        imageData.forEach((imgData, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'preview-item';
            imageItem.innerHTML = `
                <img src="${imgData}" alt="Saved image ${index + 1}" class="preview-image">
                <div class="preview-label">Image ${index + 1}</div>
            `;
            displayContainer.appendChild(imageItem);
        });
    } else {
        // Single image display
        const title = document.getElementById('imagesSectionTitle');
        title.textContent = '📷 Uploaded Image';
        
        const displayContainer = document.getElementById('displayImages');
        displayContainer.innerHTML = `<img src="${imageData}" class="uploaded-image" alt="Saved image">`;
        displayContainer.className = '';
    }
    
    // Clean and display CSV
    csvData = csvContent.trim();
    displayCSVTableWithValidation(csvData);
    
    // Show results
    document.getElementById('results').style.display = 'block';
}

/**
 * Show share options
 * @param {string} resultId - Result ID
 * @param {string} shareUrl - Share URL
 */
function showShareOptions(resultId, shareUrl) {
    // Remove existing share section if any
    const existingShare = document.getElementById('shareSection');
    if (existingShare) {
        existingShare.remove();
    }
    
    const shareSection = document.createElement('div');
    shareSection.id = 'shareSection';
    shareSection.className = 'share-section';
    
    shareSection.innerHTML = `
        <h4>🔗 Share Results</h4>
        <div class="share-options">
            <input type="text" id="shareUrl" value="${window.location.origin}${shareUrl}" readonly>
            <button id="copyUrl" class="copy-btn">📋 Copy Link</button>
            <button id="deleteResult" class="delete-btn">🗑️ Delete</button>
        </div>
    `;
    
    // Insert after results
    const results = document.getElementById('results');
    results.appendChild(shareSection);
    
    // Add event listeners
    document.getElementById('copyUrl').addEventListener('click', function() {
        const urlInput = document.getElementById('shareUrl');
        urlInput.select();
        document.execCommand('copy');
        this.textContent = '✅ Copied!';
        setTimeout(() => {
            this.textContent = '📋 Copy Link';
        }, 2000);
    });
    
    document.getElementById('deleteResult').addEventListener('click', async function() {
        if (confirm('Are you sure you want to delete this result?')) {
            await deleteResult(resultId);
        }
    });
}

/**
 * Delete a saved result
 * @param {string} resultId - Result ID to delete
 */
async function deleteResult(resultId) {
    try {
        const response = await fetch(`/api/result/${resultId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Clear URL parameters
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('result');
            window.history.pushState({}, '', newUrl);
            
            // Hide results
            hideResults();
            
            // Remove share section
            const shareSection = document.getElementById('shareSection');
            if (shareSection) {
                shareSection.remove();
            }
            
            // Refresh results list
            loadResultsList();
            
            showError('Result deleted successfully');
            setTimeout(hideError, 3000);
        }
    } catch (error) {
        showError('Error deleting result: ' + error.message);
    }
}

/**
 * Load and display results list
 */
async function loadResultsList() {
    try {
        const response = await fetch('/api/results');
        if (response.ok) {
            const results = await response.json();
            displayResultsList(results);
        }
    } catch (error) {
        console.error('Error loading results list:', error);
    }
}

/**
 * Display results list in sidebar
 * @param {Array} results - Array of result objects
 */
function displayResultsList(results) {
    // Remove existing results list if any
    const existingList = document.getElementById('resultsList');
    if (existingList) {
        existingList.remove();
    }
    
    if (results.length === 0) return;
    
    const listSection = document.createElement('div');
    listSection.id = 'resultsList';
    listSection.className = 'results-list';
    
    listSection.innerHTML = `
        <h3>📚 Saved Results</h3>
        <div class="results-items">
            ${results.map(result => `
                <div class="result-item" data-id="${result.id}">
                    <div class="result-date">${new Date(result.timestamp).toLocaleDateString()}</div>
                    <div class="result-label">
                        ${result.label || 'Untitled'}
                        ${result.isBatch ? ` (${result.imageCount} images)` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Insert before upload section
    const uploadSection = document.querySelector('.upload-section');
    uploadSection.parentNode.insertBefore(listSection, uploadSection);
    
    // Add click handlers
    document.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', function() {
            const resultId = this.dataset.id;
            loadSavedResult(resultId);
        });
    });
}

// Utility Functions

/**
 * Convert file to base64 data URL
 * @param {File} file - The file to convert
 * @returns {Promise<string>} Base64 data URL
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Display the results (image and CSV table)
 * @param {File} imageFile - The uploaded image file
 * @param {string} csvContent - The CSV content from API
 */
function displayResults(imageFile, csvContent) {
    // Display image
    const displayImage = document.getElementById('displayImage');
    displayImage.src = URL.createObjectURL(imageFile);
    
    // Clean CSV content (remove markdown formatting if present)
    csvData = csvContent.replace(/```csv\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse and display CSV
    displayCSVTableWithValidation(csvData);
    
    // Show results
    document.getElementById('results').style.display = 'block';
}


// UI State Management Functions

/**
 * Set loading state
 * @param {boolean} isLoading - Whether to show loading state
 */
function setLoading(isLoading) {
    const loading = document.getElementById('loading');
    const submitBtn = document.getElementById('submitBtn');
    
    if (isLoading) {
        loading.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
    } else {
        loading.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Process Image';
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
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
    document.getElementById('error').style.display = 'none';
}

/**
 * Hide results section
 */
function hideResults() {
    document.getElementById('results').style.display = 'none';
}

/**
 * Create image previews for batch processing (updated with double-click)
 * @param {FileList} imageFiles - Array of image files
 */
async function createImagePreviews(imageFiles) {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imageUrl = URL.createObjectURL(file);
        
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <div class="processing-status status-pending" id="status-${i}">Pending</div>
            <button class="crop-button" onclick="openCropModal(${i})">
                ✂️ Crop
            </button>
            <img src="${imageUrl}" alt="${file.name}" class="preview-image" data-src="${imageUrl}">
            <div class="preview-label">${file.name}</div>
        `;
        
        // Add double-click event listener to open image in new tab
        previewItem.addEventListener('dblclick', function() {
            openImageInNewTab(imageUrl, file.name);
        });
        
        previewContainer.appendChild(previewItem);
    }
}

/**
 * Display batch processing results (updated with double-click)
 * @param {FileList} imageFiles - Original image files
 * @param {string} combinedCsv - Combined CSV content
 * @param {Array} results - Processing results
 */
function displayBatchResults(imageFiles, combinedCsv, results) {
    // Update section title
    const title = document.getElementById('imagesSectionTitle');
    title.textContent = `📷 Uploaded Images (${imageFiles.length})`;
    
    // Display images
    const displayContainer = document.getElementById('displayImages');
    displayContainer.innerHTML = '';
    displayContainer.className = 'image-preview';
    
    Array.from(imageFiles).forEach((file, index) => {
        const imageUrl = URL.createObjectURL(file);
        const result = results[index];
        
        const imageItem = document.createElement('div');
        imageItem.className = 'preview-item';
        imageItem.innerHTML = `
            <img src="${imageUrl}" alt="${file.name}" class="preview-image" data-src="${imageUrl}">
            <div class="preview-label">
                ${file.name} 
                ${result.success ? '✅' : '❌'}
            </div>
        `;
        
        // Add double-click event listener
        imageItem.addEventListener('dblclick', function() {
            openImageInNewTab(imageUrl, file.name);
        });
        
        displayContainer.appendChild(imageItem);
    });
    
    // Store and display CSV
    csvData = combinedCsv;
    displayCSVTableWithValidation(csvData);
    
    // Show results
    document.getElementById('results').style.display = 'block';
}

/**
 * Display saved results (updated for batch support with double-click)
 * @param {string|Array} imageData - Base64 image data or array
 * @param {string} csvContent - CSV content
 */
function displaySavedResults(imageData, csvContent) {
    // Handle both single image and batch display
    if (Array.isArray(imageData)) {
        // Batch display - vertical layout
        const title = document.getElementById('imagesSectionTitle');
        title.textContent = `📷 Saved Images (${imageData.length})`;
        
        const displayContainer = document.getElementById('displayImages');
        displayContainer.innerHTML = '';
        displayContainer.className = 'image-preview';
        
        imageData.forEach((imgData, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'preview-item';
            imageItem.innerHTML = `
                <img src="${imgData}" alt="Saved image ${index + 1}" class="preview-image" data-src="${imgData}">
                <div class="preview-label">Image ${index + 1}</div>
            `;
            
            // Add double-click event listener
            imageItem.addEventListener('dblclick', function() {
                openImageInNewTab(imgData, `Saved_Image_${index + 1}`);
            });
            
            displayContainer.appendChild(imageItem);
        });
    } else {
        // Single image display
        const title = document.getElementById('imagesSectionTitle');
        title.textContent = '📷 Uploaded Image';
        
        const displayContainer = document.getElementById('displayImages');
        displayContainer.innerHTML = `
            <div class="preview-item" style="cursor: pointer;">
                <img src="${imageData}" class="preview-image uploaded-image" alt="Saved image" data-src="${imageData}">
                <div class="preview-label">Saved Image</div>
            </div>
        `;
        displayContainer.className = 'image-preview';
        
        // Add double-click event listener for single image
        const singleImageItem = displayContainer.querySelector('.preview-item');
        singleImageItem.addEventListener('dblclick', function() {
            openImageInNewTab(imageData, 'Saved_Image');
        });
    }
    
    // Clean and display CSV
    csvData = csvContent.trim();
    displayCSVTableWithValidation(csvData);
    
    // Show results
    document.getElementById('results').style.display = 'block';
}

/**
 * Open image in new tab
 * @param {string} imageUrl - Image URL or base64 data
 * @param {string} imageName - Name for the image
 */
function openImageInNewTab(imageUrl, imageName) {
    try {
        // Create a new window/tab
        const newWindow = window.open('', '_blank');
        
        if (!newWindow) {
            // Fallback if popup blocked
            alert('Please allow popups to open images in new tabs');
            return;
        }
        
        // Create HTML content for the new tab
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${imageName} - Image Viewer</title>
                <style>
                    body {
                        margin: 0;
                        padding: 20px;
                        background: #1a1a1a;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    .header {
                        color: white;
                        margin-bottom: 20px;
                        text-align: center;
                    }
                    .image-container {
                        max-width: 95vw;
                        max-height: 85vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white;
                        border-radius: 8px;
                        padding: 10px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    }
                    .main-image {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                        border-radius: 4px;
                    }
                    .controls {
                        margin-top: 20px;
                        text-align: center;
                    }
                    .btn {
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 0 10px;
                        font-size: 14px;
                        transition: background 0.3s ease;
                    }
                    .btn:hover {
                        background: #5a6fd8;
                    }
                    .image-info {
                        color: #ccc;
                        font-size: 14px;
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>${imageName}</h2>
                </div>
                <div class="image-container">
                    <img src="${imageUrl}" alt="${imageName}" class="main-image" id="mainImage">
                </div>
                <div class="controls">
                    <button class="btn" onclick="downloadImage()">📥 Download</button>
                    <button class="btn" onclick="window.close()">✖️ Close</button>
                </div>
                <div class="image-info" id="imageInfo">
                    Click and drag to pan • Use mouse wheel to zoom
                </div>

                <script>
                    // Add zoom and pan functionality
                    let scale = 1;
                    let isDragging = false;
                    let startX, startY, translateX = 0, translateY = 0;
                    
                    const img = document.getElementById('mainImage');
                    const container = document.querySelector('.image-container');
                    
                    // Zoom functionality
                    container.addEventListener('wheel', function(e) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? 0.9 : 1.1;
                        scale *= delta;
                        scale = Math.min(Math.max(0.5, scale), 5);
                        updateTransform();
                    });
                    
                    // Pan functionality
                    container.addEventListener('mousedown', function(e) {
                        isDragging = true;
                        startX = e.clientX - translateX;
                        startY = e.clientY - translateY;
                        container.style.cursor = 'grabbing';
                    });
                    
                    document.addEventListener('mousemove', function(e) {
                        if (!isDragging) return;
                        translateX = e.clientX - startX;
                        translateY = e.clientY - startY;
                        updateTransform();
                    });
                    
                    document.addEventListener('mouseup', function() {
                        isDragging = false;
                        container.style.cursor = 'grab';
                    });
                    
                    function updateTransform() {
                        img.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
                    }
                    
                    // Download functionality
                    function downloadImage() {
                        const link = document.createElement('a');
                        link.href = '${imageUrl}';
                        link.download = '${imageName}';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                    
                    // Reset view on double-click
                    container.addEventListener('dblclick', function() {
                        scale = 1;
                        translateX = 0;
                        translateY = 0;
                        updateTransform();
                    });
                    
                    // Initialize
                    container.style.cursor = 'grab';
                </script>
            </body>
            </html>
        `;
        
        // Write content to new window
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        
    } catch (error) {
        console.error('Error opening image in new tab:', error);
        // Fallback: try to open image URL directly
        window.open(imageUrl, '_blank');
    }
}

// Update the existing displayImages function for result.html (if needed)
/**
 * Display images (updated for result.html with double-click support)
 * @param {string|Array} imageData - Single image or array of images
 * @param {boolean} isBatch - Whether this is a batch result
 */
function displayImages(imageData, isBatch) {
    const title = document.getElementById('imagesSectionTitle');
    const displayContainer = document.getElementById('displayImages');
    
    if (isBatch && Array.isArray(imageData)) {
        // Batch display - vertical layout
        title.textContent = `📷 Images (${imageData.length})`;
        displayContainer.innerHTML = '';
        displayContainer.className = 'image-preview';
        
        imageData.forEach((imgData, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'preview-item';
            imageItem.innerHTML = `
                <img src="${imgData}" alt="Image ${index + 1}" class="preview-image">
                <div class="preview-label">Image ${index + 1}</div>
            `;
            
            // Add double-click event listener
            imageItem.addEventListener('dblclick', function() {
                openImageInNewTab(imgData, `Image_${index + 1}`);
            });
            
            displayContainer.appendChild(imageItem);
        });
    } else {
        // Single image display
        title.textContent = '📷 Image';
        const singleImage = Array.isArray(imageData) ? imageData[0] : imageData;
        displayContainer.innerHTML = `
            <div class="preview-item" style="cursor: pointer;">
                <img src="${singleImage}" class="preview-image uploaded-image" alt="Shared image">
                <div class="preview-label">Shared Image</div>
            </div>
        `;
        displayContainer.className = 'image-preview';
        
        // Add double-click event listener for single image
        const singleImageItem = displayContainer.querySelector('.preview-item');
        singleImageItem.addEventListener('dblclick', function() {
            openImageInNewTab(singleImage, 'Shared_Image');
        });
    }
}

// Global variables for table editing
let csvDataArray = []; // 2D array representation of CSV data
let hasUnsavedChanges = false;
let currentEditingCell = null;

/**
 * Create and display CSV table with editing capabilities (UPDATED for numbered headers)
 * @param {string} csvContent - Raw CSV content
 */
function displayCSVTable(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;
    
    // Parse CSV into 2D array - ALL rows are data now (no header row)
    csvDataArray = lines.map(line => 
        line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );
    
    const container = document.getElementById('csvTableContainer');
    container.innerHTML = '';
    
    // Create table controls
    const controlsDiv = createTableControls();
    container.appendChild(controlsDiv);
    
    // Create edit status indicator
    const statusDiv = document.createElement('div');
    statusDiv.id = 'editStatus';
    statusDiv.className = 'edit-status';
    container.appendChild(statusDiv);
    
    // Create table
    const table = document.createElement('table');
    table.className = 'csv-table';
    table.id = 'editableTable';
    
    // Create header with numbered columns (1, 2, 3, etc.)
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    
    // Generate numbered headers based on the number of columns in first row
    const columnCount = csvDataArray.length > 0 ? csvDataArray[0].length : 0;
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        const th = document.createElement('th');
        th.textContent = (colIndex + 1).toString(); // Headers: "1", "2", "3", etc.
        th.dataset.col = colIndex;
        headerTr.appendChild(th);
    }
    
    thead.appendChild(headerTr);
    table.appendChild(thead);
    
    // Create body with editable cells - ALL CSV rows are data rows now
    const tbody = document.createElement('tbody');
    
    for (let rowIndex = 0; rowIndex < csvDataArray.length; rowIndex++) { // Start from 0 instead of 1
        const row = csvDataArray[rowIndex];
        const tr = document.createElement('tr');
        tr.dataset.row = rowIndex;
        
        row.forEach((cell, colIndex) => {
            const td = document.createElement('td');
            td.textContent = cell;
            td.dataset.row = rowIndex;
            td.dataset.col = colIndex;
            td.setAttribute('tabindex', '0');
            
            // Add edit indicator
            const indicator = document.createElement('div');
            indicator.className = 'edit-indicator';
            td.appendChild(indicator);
            
            // Add event listeners for editing
            addCellEditListeners(td);
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Add keyboard navigation
    addKeyboardNavigation(table);
    
    // Reset unsaved changes flag
    hasUnsavedChanges = false;
    updateEditStatus();
}

/**
 * Create table controls (add/remove rows, save, etc.)
 */
function createTableControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'table-controls';
    
    controlsDiv.innerHTML = `
        <button class="table-control-btn" id="addRowBtn">
            ➕ Add Row
        </button>
        <button class="table-control-btn" id="addColBtn">
            ➕ Add Column
        </button>
        <button class="table-control-btn danger" id="deleteRowBtn" disabled>
            🗑️ Delete Row
        </button>
        <button class="table-control-btn danger" id="deleteColBtn" disabled>
            🗑️ Delete Column
        </button>
        <button class="table-control-btn secondary" id="undoBtn" disabled>
            ↶ Undo
        </button>
        <button class="table-control-btn success" id="saveChangesBtn" disabled>
            💾 Save Changes
        </button>
        <button class="table-control-btn secondary" id="exportBtn">
            📤 Export CSV
        </button>
    `;
    
    // Add event listeners
    controlsDiv.querySelector('#addRowBtn').addEventListener('click', addNewRow);
    controlsDiv.querySelector('#addColBtn').addEventListener('click', addNewColumn);
    controlsDiv.querySelector('#deleteRowBtn').addEventListener('click', deleteSelectedRow);
    controlsDiv.querySelector('#deleteColBtn').addEventListener('click', deleteSelectedColumn);
    controlsDiv.querySelector('#saveChangesBtn').addEventListener('click', saveTableChanges);
    controlsDiv.querySelector('#exportBtn').addEventListener('click', exportUpdatedCSV);
    
    return controlsDiv;
}

/**
 * Add event listeners for cell editing
 * @param {HTMLElement} cell - Table cell element
 */
function addCellEditListeners(cell) {
    // Double-click to edit
    cell.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        startCellEdit(this);
    });
    
    // Enter key to edit
    cell.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !this.classList.contains('editing')) {
            e.preventDefault();
            startCellEdit(this);
        }
    });
    
    // Click to select (highlight row/column)
    cell.addEventListener('click', function(e) {
        if (!this.classList.contains('editing')) {
            selectCell(this);
        }
    });
}

/**
 * Start editing a cell
 * @param {HTMLElement} cell - Cell to edit
 */
function startCellEdit(cell) {
    // Finish any existing edit
    if (currentEditingCell && currentEditingCell !== cell) {
        finishCellEdit(currentEditingCell);
    }
    
    const currentValue = cell.textContent;
    cell.classList.add('editing');
    currentEditingCell = cell;
    
    // Create input element
    const input = document.createElement('textarea');
    input.className = 'cell-input';
    input.value = currentValue;
    input.rows = 1;
    
    // Replace cell content with input
    cell.innerHTML = '';
    cell.appendChild(input);
    
    // Add edit indicator back
    const indicator = document.createElement('div');
    indicator.className = 'edit-indicator';
    cell.appendChild(indicator);
    
    // Focus and select content
    input.focus();
    input.select();
    
    // Auto-resize textarea
    autoResizeTextarea(input);
    
    // Add event listeners
    input.addEventListener('blur', () => finishCellEdit(cell));
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finishCellEdit(cell);
            
            // Move to next cell
            const nextCell = getNextCell(cell);
            if (nextCell) {
                nextCell.focus();
            }
        } else if (e.key === 'Escape') {
            cancelCellEdit(cell, currentValue);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            finishCellEdit(cell);
            
            // Move to next/previous cell
            const nextCell = e.shiftKey ? getPreviousCell(cell) : getNextCell(cell);
            if (nextCell) {
                setTimeout(() => startCellEdit(nextCell), 10);
            }
        }
    });
    
    input.addEventListener('input', () => autoResizeTextarea(input));
}

/**
 * Finish editing a cell
 * @param {HTMLElement} cell - Cell being edited
 */
function finishCellEdit(cell) {
    const input = cell.querySelector('.cell-input');
    if (!input) return;
    
    const newValue = input.value.trim();
    const rowIndex = parseInt(cell.dataset.row);
    const colIndex = parseInt(cell.dataset.col);
    const oldValue = csvDataArray[rowIndex][colIndex];
    
    // Update data if changed
    if (newValue !== oldValue) {
        csvDataArray[rowIndex][colIndex] = newValue;
        hasUnsavedChanges = true;
        updateEditStatus();
    }
    
    // Restore cell
    cell.classList.remove('editing');
    cell.innerHTML = newValue;
    
    // Add edit indicator back
    const indicator = document.createElement('div');
    indicator.className = 'edit-indicator';
    cell.appendChild(indicator);
    
    currentEditingCell = null;
    
    // Update CSV data
    updateCSVData();
}

/**
 * Cancel cell editing
 * @param {HTMLElement} cell - Cell being edited
 * @param {string} originalValue - Original cell value
 */
function cancelCellEdit(cell, originalValue) {
    cell.classList.remove('editing');
    cell.innerHTML = originalValue;
    
    // Add edit indicator back
    const indicator = document.createElement('div');
    indicator.className = 'edit-indicator';
    cell.appendChild(indicator);
    
    currentEditingCell = null;
}

/**
 * Auto-resize textarea based on content
 * @param {HTMLElement} textarea - Textarea element
 */
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(20, textarea.scrollHeight) + 'px';
}

/**
 * Select a cell (highlight row and column)
 * @param {HTMLElement} cell - Cell to select
 */
function selectCell(cell) {
    const table = document.getElementById('editableTable');
    const rowIndex = parseInt(cell.dataset.row);
    const colIndex = parseInt(cell.dataset.col);
    
    // Remove previous highlights
    table.querySelectorAll('.highlight-row, .highlight-col').forEach(el => {
        el.classList.remove('highlight-row', 'highlight-col');
    });
    
    // Highlight current row
    const currentRow = table.querySelector(`tr[data-row="${rowIndex}"]`);
    if (currentRow) {
        currentRow.classList.add('highlight-row');
    }
    
    // Highlight current column
    table.querySelectorAll(`td[data-col="${colIndex}"]`).forEach(td => {
        td.classList.add('highlight-col');
    });
    
    // Update control buttons
    updateControlButtons(rowIndex, colIndex);
}

/**
 * Update control button states (UPDATED for no header considerations)
 * @param {number} selectedRow - Selected row index
 * @param {number} selectedCol - Selected column index
 */
function updateControlButtons(selectedRow, selectedCol) {
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    const deleteColBtn = document.getElementById('deleteColBtn');
    const saveBtn = document.getElementById('saveChangesBtn');
    
    deleteRowBtn.disabled = csvDataArray.length <= 1; // Keep at least 1 data row
    deleteColBtn.disabled = csvDataArray.length > 0 ? csvDataArray[0].length <= 1 : true; // Keep at least 1 column
    saveBtn.disabled = !hasUnsavedChanges;
}

/**
 * Add new row to table
 */
function addNewRow() {
    const colCount = csvDataArray[0].length;
    const newRow = new Array(colCount).fill('');
    
    csvDataArray.push(newRow);
    hasUnsavedChanges = true;
    
    // Rebuild table
    rebuildTable();
    updateEditStatus();
}

/**
 * Add new column to table (UPDATED for numbered headers)
 */
function addNewColumn() {
    const newColumnNumber = csvDataArray.length > 0 ? csvDataArray[0].length + 1 : 1;
    
    // Add to each row
    csvDataArray.forEach((row, index) => {
        row.push(''); // Add empty cell to each row
    });
    
    hasUnsavedChanges = true;
    
    // Rebuild table
    rebuildTable();
    updateEditStatus();
}

/**
 * Delete selected row (UPDATED for no header considerations)
 */
function deleteSelectedRow() {
    const selectedRow = document.querySelector('.highlight-row');
    if (!selectedRow) {
        alert('Please select a row to delete');
        return;
    }
    
    const rowIndex = parseInt(selectedRow.dataset.row);
    if (csvDataArray.length <= 1) {
        alert('Cannot delete row. Table must have at least one data row.');
        return;
    }
    
    if (confirm('Are you sure you want to delete this row?')) {
        csvDataArray.splice(rowIndex, 1);
        hasUnsavedChanges = true;
        
        // Rebuild table
        rebuildTable();
        updateEditStatus();
    }
}

/**
 * Delete selected column
 */
function deleteSelectedColumn() {
    const selectedCol = document.querySelector('.highlight-col');
    if (!selectedCol) {
        alert('Please select a column to delete');
        return;
    }
    
    const colIndex = parseInt(selectedCol.dataset.col);
    if (csvDataArray[0].length <= 1) {
        alert('Cannot delete column. Table must have at least one column.');
        return;
    }
    
    const columnName = csvDataArray[0][colIndex];
    if (confirm(`Are you sure you want to delete column "${columnName}"?`)) {
        // Remove column from each row
        csvDataArray.forEach(row => {
            row.splice(colIndex, 1);
        });
        
        hasUnsavedChanges = true;
        
        // Rebuild table
        rebuildTable();
        updateEditStatus();
    }
}

/**
 * Rebuild the entire table
 */
function rebuildTable() {
    const csvContent = csvDataArray.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    displayCSVTableWithValidation(csvContent);
}

/**
 * Update CSV data from current table state
 */
function updateCSVData() {
    csvData = csvDataArray.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
}

/**
 * Save table changes
 */
function saveTableChanges() {
    updateCSVData();
    hasUnsavedChanges = false;
    updateEditStatus('saved');
    
    // Also update on server if we have a current result ID
    if (currentResultId) {
        updateResultOnServer();
    }
}

/**
 * Update result on server
 */
async function updateResultOnServer() {
    try {
        const response = await fetch(`/api/update-result/${currentResultId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                csvData: csvData
            })
        });
        
        if (response.ok) {
            console.log('Result updated on server');
        }
    } catch (error) {
        console.error('Error updating result on server:', error);
    }
}

/**
 * Export updated CSV
 */
function exportUpdatedCSV() {
    updateCSVData();
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Update edit status indicator
 * @param {string} status - Status type ('unsaved', 'saved', or null)
 */
function updateEditStatus(status = null) {
    const statusDiv = document.getElementById('editStatus');
    if (!statusDiv) return;
    
    statusDiv.className = 'edit-status';
    
    if (status === 'saved') {
        statusDiv.className += ' show saved';
        statusDiv.textContent = '✅ Changes saved successfully';
        setTimeout(() => {
            statusDiv.classList.remove('show');
        }, 3000);
    } else if (hasUnsavedChanges) {
        statusDiv.className += ' show unsaved';
        statusDiv.textContent = '⚠️ You have unsaved changes';
    } else {
        statusDiv.classList.remove('show');
    }
    
    // Update save button
    const saveBtn = document.getElementById('saveChangesBtn');
    if (saveBtn) {
        saveBtn.disabled = !hasUnsavedChanges;
    }
}

/**
 * Add keyboard navigation to table
 * @param {HTMLElement} table - Table element
 */
function addKeyboardNavigation(table) {
    table.addEventListener('keydown', function(e) {
        const activeCell = document.activeElement;
        if (!activeCell.matches('td[data-row][data-col]')) return;
        
        const row = parseInt(activeCell.dataset.row);
        const col = parseInt(activeCell.dataset.col);
        let newCell = null;
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                newCell = table.querySelector(`td[data-row="${row - 1}"][data-col="${col}"]`);
                break;
            case 'ArrowDown':
                e.preventDefault();
                newCell = table.querySelector(`td[data-row="${row + 1}"][data-col="${col}"]`);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                newCell = table.querySelector(`td[data-row="${row}"][data-col="${col - 1}"]`);
                break;
            case 'ArrowRight':
                e.preventDefault();
                newCell = table.querySelector(`td[data-row="${row}"][data-col="${col + 1}"]`);
                break;
        }
        
        if (newCell) {
            newCell.focus();
            selectCell(newCell);
        }
    });
}

/**
 * Get next cell for navigation
 * @param {HTMLElement} cell - Current cell
 * @returns {HTMLElement|null} Next cell
 */
function getNextCell(cell) {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const table = document.getElementById('editableTable');
    
    // Try next column in same row
    let nextCell = table.querySelector(`td[data-row="${row}"][data-col="${col + 1}"]`);
    if (nextCell) return nextCell;
    
    // Try first column of next row
    return table.querySelector(`td[data-row="${row + 1}"][data-col="0"]`);
}

/**
 * Get previous cell for navigation
 * @param {HTMLElement} cell - Current cell
 * @returns {HTMLElement|null} Previous cell
 */
function getPreviousCell(cell) {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const table = document.getElementById('editableTable');
    
    // Try previous column in same row
    let prevCell = table.querySelector(`td[data-row="${row}"][data-col="${col - 1}"]`);
    if (prevCell) return prevCell;
    
    // Try last column of previous row
    const prevRow = row - 1;
    if (prevRow >= 1) {
        const lastCol = csvDataArray[0].length - 1;
        return table.querySelector(`td[data-row="${prevRow}"][data-col="${lastCol}"]`);
    }
    
    return null;
}

// Add warning for unsaved changes when leaving page
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
});

/**
 * Validate table data and highlight inconsistent cells
 */
function validateTableData() {
    if (!csvDataArray || csvDataArray.length < 3) {
        console.log('Insufficient data for validation');
        return;
    }

    // Clear existing validation highlights
    clearValidationHighlights();

    const issues = [];
    const columnCount = csvDataArray[0].length;

    // Check each column for consistency
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        const columnIssues = validateColumn(colIndex);
        issues.push(...columnIssues);
    }

    // Apply highlights to problematic cells
    highlightIssues(issues);

    // Show validation summary
    showValidationSummary(issues);

    return issues;
}

/**
 * Validate a specific column for data consistency (UPDATED - no header skipping)
 * @param {number} colIndex - Column index to validate
 * @returns {Array} Array of issue objects
 */
function validateColumn(colIndex) {
    const issues = [];
    const columnData = [];
    
    // Extract numerical data from the column - START FROM 0 (no header to skip)
    for (let rowIndex = 0; rowIndex < csvDataArray.length; rowIndex++) {
        const cellValue = csvDataArray[rowIndex][colIndex];
        const numValue = parseFloat(cellValue);
        
        if (!isNaN(numValue)) {
            columnData.push({
                value: numValue,
                row: rowIndex,
                col: colIndex,
                originalValue: cellValue
            });
        }
    }

    // Need at least 3 numerical values to calculate deltas
    if (columnData.length < 3) {
        return issues;
    }

    // Calculate deltas between consecutive values
    const deltas = [];
    for (let i = 0; i < columnData.length - 1; i++) {
        const delta = columnData[i + 1].value - columnData[i].value;
        deltas.push({
            delta: delta,
            fromRow: columnData[i].row,
            toRow: columnData[i + 1].row,
            fromValue: columnData[i].value,
            toValue: columnData[i + 1].value
        });
    }

    if (deltas.length === 0) return issues;

    // Calculate median delta
    const sortedDeltas = deltas.map(d => d.delta).sort((a, b) => a - b);
    const medianDelta = calculateMedian(sortedDeltas);
    
    finalTolerance = 0;
    // Find outlier deltas
    deltas.forEach(deltaInfo => {
        const deviation = deltaInfo.delta - medianDelta;
        
        if (deviation > finalTolerance) {
            issues.push({
                type: 'inconsistent_delta',
                row: deltaInfo.toRow,
                col: colIndex,
                expectedDelta: medianDelta,
                actualDelta: deltaInfo.delta,
                deviation: deviation,
                tolerance: finalTolerance,
                fromValue: deltaInfo.fromValue,
                toValue: deltaInfo.toValue,
                suggestion: calculateSuggestedValue(deltaInfo.fromValue, medianDelta)
            });
        }
    });

    return issues;
}

/**
 * Calculate median of an array
 * @param {Array} values - Array of numbers
 * @returns {number} Median value
 */
function calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        return sorted[mid];
    }
}

/**
 * Calculate suggested value based on previous value and median delta
 * @param {number} fromValue - Previous value
 * @param {number} medianDelta - Median delta
 * @returns {number} Suggested value
 */
function calculateSuggestedValue(fromValue, medianDelta) {
    // This is a simple approach - you might want to make it more sophisticated
    // For now, we'll suggest the value that would maintain the median delta
    return fromValue + medianDelta;
}

/**
 * Clear existing validation highlights
 */
function clearValidationHighlights() {
    const table = document.getElementById('editableTable');
    if (!table) return;

    // Remove validation classes
    table.querySelectorAll('.validation-error, .validation-warning').forEach(cell => {
        cell.classList.remove('validation-error', 'validation-warning');
        
        // Remove validation indicators
        const indicator = cell.querySelector('.validation-indicator');
        if (indicator) {
            indicator.remove();
        }
    });
}

/**
 * Highlight cells with issues
 * @param {Array} issues - Array of issue objects
 */
function highlightIssues(issues) {
    const table = document.getElementById('editableTable');
    if (!table) return;

    issues.forEach(issue => {
        const cell = table.querySelector(`td[data-row="${issue.row}"][data-col="${issue.col}"]`);
        if (cell) {
            // Add validation error class
            cell.classList.add('validation-error');
            
            // Add validation indicator
            const indicator = document.createElement('div');
            indicator.className = 'validation-indicator';
            indicator.title = createTooltipText(issue);
            indicator.innerHTML = '⚠️';
            
            cell.appendChild(indicator);
        }
    });
}

/**
 * Create tooltip text for validation issues
 * @param {Object} issue - Issue object
 * @returns {string} Tooltip text
 */
function createTooltipText(issue) {
    return `Inconsistent value detected!\n` +
           `Expected delta: ~${issue.expectedDelta.toFixed(0)}\n` +
           `Actual delta: ${issue.actualDelta.toFixed(0)}\n` +
           `Deviation: ${issue.deviation.toFixed(0)}\n` +
           `Suggested value: ${issue.suggestion.toFixed(0)}\n` +
           `From: ${issue.fromValue} → To: ${issue.toValue}`;
}

/**
 * Show validation summary (UPDATED for numbered headers)
 * @param {Array} issues - Array of issues found
 */
function showValidationSummary(issues) {
    // Remove existing summary
    const existingSummary = document.getElementById('validationSummary');
    if (existingSummary) {
        existingSummary.remove();
    }

    const container = document.getElementById('csvTableContainer');
    if (!container) return;

    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'validationSummary';
    summaryDiv.className = 'validation-summary';

    if (issues.length === 0) {
        summaryDiv.innerHTML = `
            <div class="validation-success">
                ✅ <strong>Data Validation Complete</strong>
                <p>No consistency issues found in the data.</p>
            </div>
        `;
    } else {
        const issuesByColumn = groupIssuesByColumn(issues);
        
        summaryDiv.innerHTML = `
            <div class="validation-issues">
                <h4>⚠️ Data Validation Issues Found (${issues.length})</h4>
                ${Object.entries(issuesByColumn).map(([colIndex, colIssues]) => `
                    <div class="column-issues">
                        <strong>Column ${parseInt(colIndex) + 1}:</strong>
                        <ul>
                            ${colIssues.map(issue => `
                                <li>
                                    Row ${issue.row + 1}: Value ${issue.toValue} 
                                    (expected ~${issue.suggestion.toFixed(0)})
                                    <button class="fix-btn" onclick="applyQuickFix(${issue.row}, ${issue.col}, ${issue.suggestion})">
                                        Quick Fix
                                    </button>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('')}
                <div class="validation-actions">
                    <button class="table-control-btn secondary" onclick="clearValidationHighlights()">
                        Clear Highlights
                    </button>
                    <button class="table-control-btn" onclick="validateTableData()">
                        Re-validate
                    </button>
                </div>
            </div>
        `;
    }

    // Append at the end of the container (after the table)
    container.appendChild(summaryDiv);
}

/**
 * Group issues by column
 * @param {Array} issues - Array of issues
 * @returns {Object} Issues grouped by column index
 */
function groupIssuesByColumn(issues) {
    return issues.reduce((groups, issue) => {
        const colIndex = issue.col;
        if (!groups[colIndex]) {
            groups[colIndex] = [];
        }
        groups[colIndex].push(issue);
        return groups;
    }, {});
}

/**
 * Apply quick fix to a cell
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} suggestedValue - Suggested value
 */
function applyQuickFix(row, col, suggestedValue) {
    if (confirm(`Replace value in Row ${row + 1}, Column ${col + 1} with ${suggestedValue.toFixed(0)}?`)) {
        // Update data array
        csvDataArray[row][col] = suggestedValue.toFixed(0);
        
        // Update cell display
        const table = document.getElementById('editableTable');
        const cell = table.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.textContent = suggestedValue.toFixed(0);
            
            // Add edit indicator
            const indicator = document.createElement('div');
            indicator.className = 'edit-indicator';
            cell.appendChild(indicator);
        }
        
        // Mark as changed
        hasUnsavedChanges = true;
        updateEditStatus();
        updateCSVData();
        
        // Re-validate to update highlights
        setTimeout(() => validateTableData(), 100);
    }
}

/**
 * Enhanced displayCSVTable function with automatic validation
 * Update your existing displayCSVTable function to include this
 */
function displayCSVTableWithValidation(csvContent) {
    // Call the existing displayCSVTable function
    displayCSVTable(csvContent);
    
    // Add validation button to controls
    addValidationButton();
    
    // Automatically run validation after a short delay
    setTimeout(() => {
        validateTableData();
    }, 500);
}

/**
 * Add validation button to table controls
 */
function addValidationButton() {
    const controlsDiv = document.querySelector('.table-controls');
    if (!controlsDiv) return;

    // Check if validation button already exists
    if (controlsDiv.querySelector('#validateBtn')) return;

    const validateBtn = document.createElement('button');
    validateBtn.id = 'validateBtn';
    validateBtn.className = 'table-control-btn secondary';
    validateBtn.innerHTML = '🔍 Validate Data';
    validateBtn.addEventListener('click', validateTableData);

    // Insert after the export button
    const exportBtn = controlsDiv.querySelector('#exportBtn');
    if (exportBtn) {
        exportBtn.parentNode.insertBefore(validateBtn, exportBtn.nextSibling);
    } else {
        controlsDiv.appendChild(validateBtn);
    }
}

// Global variables for cropping
let currentCropFile = null;
let currentCropIndex = -1;
let cropCanvas = null;
let cropCtx = null;
let cropSelection = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isSelecting: false
};
let originalImage = null;
let croppedFiles = new Map(); // Store cropped versions

/**
 * Open crop modal for specific image
 * @param {number} imageIndex - Index of the image to crop
 */
function openCropModal(imageIndex) {
    const imageFiles = document.getElementById('imageFiles').files;
    if (!imageFiles || imageIndex >= imageFiles.length) return;
    
    currentCropFile = imageFiles[imageIndex];
    currentCropIndex = imageIndex;
    
    // Show modal
    const modal = document.getElementById('cropModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Initialize canvas
    setTimeout(() => {
        initializeCropCanvas();
    }, 100);
}

/**
 * Initialize crop canvas with image
 */
function initializeCropCanvas() {
    if (!currentCropFile) return;
    
    cropCanvas = document.getElementById('cropCanvas');
    cropCtx = cropCanvas.getContext('2d');
    
    // Load image
    originalImage = new Image();
    originalImage.onload = function() {
        // Calculate canvas size to fit image while maintaining aspect ratio
        const maxWidth = 800;
        const maxHeight = 600;
        
        let canvasWidth = this.naturalWidth;
        let canvasHeight = this.naturalHeight;
        
        // Scale down if too large
        if (canvasWidth > maxWidth || canvasHeight > maxHeight) {
            const scaleX = maxWidth / canvasWidth;
            const scaleY = maxHeight / canvasHeight;
            const scale = Math.min(scaleX, scaleY);
            
            canvasWidth = canvasWidth * scale;
            canvasHeight = canvasHeight * scale;
        }
        
        cropCanvas.width = canvasWidth;
        cropCanvas.height = canvasHeight;
        
        // Draw image
        cropCtx.drawImage(this, 0, 0, canvasWidth, canvasHeight);
        
        // Add event listeners for selection
        addCropEventListeners();
        
        // Update info
        updateCropInfo('Click and drag to select crop area');
    };
    
    // Use cropped version if exists, otherwise original
    const fileToShow = croppedFiles.get(currentCropIndex) || currentCropFile;
    originalImage.src = URL.createObjectURL(fileToShow);
}

/**
 * Add event listeners for crop selection
 */
function addCropEventListeners() {
    const canvas = cropCanvas;
    const selection = document.getElementById('cropSelection');
    
    let isMouseDown = false;
    
    // Mouse down - start selection
    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        cropSelection.startX = e.clientX - rect.left;
        cropSelection.startY = e.clientY - rect.top;
        cropSelection.isSelecting = true;
        isMouseDown = true;
        
        selection.style.display = 'block';
        selection.style.left = cropSelection.startX + 'px';
        selection.style.top = cropSelection.startY + 'px';
        selection.style.width = '0px';
        selection.style.height = '0px';
    });
    
    // Mouse move - update selection
    canvas.addEventListener('mousemove', function(e) {
        if (!isMouseDown || !cropSelection.isSelecting) return;
        
        const rect = canvas.getBoundingClientRect();
        cropSelection.endX = e.clientX - rect.left;
        cropSelection.endY = e.clientY - rect.top;
        
        // Calculate selection box
        const left = Math.min(cropSelection.startX, cropSelection.endX);
        const top = Math.min(cropSelection.startY, cropSelection.endY);
        const width = Math.abs(cropSelection.endX - cropSelection.startX);
        const height = Math.abs(cropSelection.endY - cropSelection.startY);
        
        selection.style.left = left + 'px';
        selection.style.top = top + 'px';
        selection.style.width = width + 'px';
        selection.style.height = height + 'px';
        
        // Update info
        updateCropInfo(`Selection: ${Math.round(width)} × ${Math.round(height)} pixels`);
    });
    
    // Mouse up - finish selection
    canvas.addEventListener('mouseup', function(e) {
        isMouseDown = false;
        if (cropSelection.isSelecting) {
            const rect = canvas.getBoundingClientRect();
            cropSelection.endX = e.clientX - rect.left;
            cropSelection.endY = e.clientY - rect.top;
            
            // Ensure minimum selection size
            const width = Math.abs(cropSelection.endX - cropSelection.startX);
            const height = Math.abs(cropSelection.endY - cropSelection.startY);
            
            if (width < 10 || height < 10) {
                resetCropSelection();
                updateCropInfo('Selection too small. Click and drag to select crop area.');
            }
        }
    });
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });
}

/**
 * Reset crop selection
 */
function resetCrop() {
    resetCropSelection();
    
    // Redraw original image
    if (originalImage && cropCanvas && cropCtx) {
        cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
        cropCtx.drawImage(originalImage, 0, 0, cropCanvas.width, cropCanvas.height);
    }
    
    updateCropInfo('Click and drag to select crop area');
}

/**
 * Reset crop selection UI
 */
function resetCropSelection() {
    const selection = document.getElementById('cropSelection');
    selection.style.display = 'none';
    
    cropSelection = {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        isSelecting: false
    };
}

/**
 * Apply crop to image
 */
async function applyCrop() {
    if (!cropCanvas || !originalImage) return;
    
    const selection = document.getElementById('cropSelection');
    if (selection.style.display === 'none') {
        alert('Please select an area to crop first');
        return;
    }
    
    // Calculate crop coordinates
    const left = Math.min(cropSelection.startX, cropSelection.endX);
    const top = Math.min(cropSelection.startY, cropSelection.endY);
    const width = Math.abs(cropSelection.endX - cropSelection.startX);
    const height = Math.abs(cropSelection.endY - cropSelection.startY);
    
    if (width < 10 || height < 10) {
        alert('Selection area is too small');
        return;
    }
    
    // Create new canvas for cropped image
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // Calculate scale factors
    const scaleX = originalImage.naturalWidth / cropCanvas.width;
    const scaleY = originalImage.naturalHeight / cropCanvas.height;
    
    // Set cropped canvas size
    croppedCanvas.width = width * scaleX;
    croppedCanvas.height = height * scaleY;
    
    // Draw cropped portion
    croppedCtx.drawImage(
        originalImage,
        left * scaleX, top * scaleY, width * scaleX, height * scaleY,
        0, 0, croppedCanvas.width, croppedCanvas.height
    );
    
    // Convert to blob and create new file
    croppedCanvas.toBlob(function(blob) {
        // Create new file with cropped data
        const croppedFile = new File([blob], currentCropFile.name, {
            type: currentCropFile.type,
            lastModified: Date.now()
        });
        
        // Store cropped file
        croppedFiles.set(currentCropIndex, croppedFile);
        
        // Update preview
        updateImagePreview(currentCropIndex, URL.createObjectURL(croppedFile));
        
        // Close modal
        closeCropModal();
        
        // Show success message
        showCropSuccess();
        
    }, currentCropFile.type, 0.9);
}

/**
 * Close crop modal
 */
function closeCropModal() {
    const modal = document.getElementById('cropModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    
    // Cleanup
    resetCropSelection();
    currentCropFile = null;
    currentCropIndex = -1;
    originalImage = null;
    
    // Clear canvas
    if (cropCanvas && cropCtx) {
        cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    }
}

/**
 * Update crop info display
 * @param {string} message - Info message
 */
function updateCropInfo(message) {
    const infoElement = document.getElementById('cropDimensions');
    if (infoElement) {
        infoElement.textContent = message;
    }
}

/**
 * Update image preview after cropping
 * @param {number} index - Image index
 * @param {string} newUrl - New image URL
 */
function updateImagePreview(index, newUrl) {
    const previewImg = document.querySelector(`#imagePreview .preview-item:nth-child(${index + 1}) .preview-image`);
    if (previewImg) {
        previewImg.src = newUrl;
        previewImg.dataset.src = newUrl;
        
        // Add cropped indicator
        const previewItem = previewImg.closest('.preview-item');
        const cropButton = previewItem.querySelector('.crop-button');
        if (cropButton) {
            cropButton.innerHTML = '✂️ Cropped';
            cropButton.classList.add('cropped');
            
            // Add a subtle border to indicate the image has been cropped
            previewItem.style.border = '2px solid #28a745';
            previewItem.style.boxShadow = '0 4px 15px rgba(40, 167, 69, 0.2)';
        }
    }
}

/**
 * Show crop success message
 */
function showCropSuccess() {
    // Create temporary success message
    const successMsg = document.createElement('div');
    successMsg.className = 'crop-success-msg';
    successMsg.innerHTML = '✅ Image cropped successfully!';
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 12px 20px;
        border-radius: 8px;
        border: 1px solid #c3e6cb;
        z-index: 1001;
        font-weight: 500;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(successMsg);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        successMsg.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations
const cropAnimations = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;

// Add animations to page
if (!document.getElementById('cropAnimations')) {
    const style = document.createElement('style');
    style.id = 'cropAnimations';
    style.textContent = cropAnimations;
    document.head.appendChild(style);
}