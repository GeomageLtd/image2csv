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

// Global variables for TIFF processing
let processedFiles = []; // Store processed files (including TIFF pages)
let originalFileList = []; // Store original file list for reference

// Check for result ID in URL on page load
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const resultId = urlParams.get('result');
    
    if (resultId) {
        loadSavedResult(resultId);
    }
    
    loadResultsList();
    
    // Check TIFF library status
    checkTiffLibraryStatus();
});

/**
 * Check if TIFF library is loaded and working
 */
function checkTiffLibraryStatus() {
    try {
        if (typeof UTIF !== 'undefined') {
            console.log('✅ UTIF library loaded successfully');
            
            // Add a small indicator to the file input label
            const label = document.querySelector('label[for="imageFiles"]');
            if (label) {
                const status = document.createElement('small');
                status.style.color = '#28a745';
                status.style.marginLeft = '8px';
                status.innerHTML = '✅ TIFF support enabled';
                label.appendChild(status);
            }
        } else {
            console.warn('⚠️ UTIF library not loaded - TIFF support disabled');
            
            // Show warning to user
            const label = document.querySelector('label[for="imageFiles"]');
            if (label) {
                const status = document.createElement('small');
                status.style.color = '#dc3545';
                status.style.marginLeft = '8px';
                status.innerHTML = '⚠️ TIFF support unavailable';
                label.appendChild(status);
            }
        }
    } catch (error) {
        console.error('Error checking TIFF library status:', error);
    }
}

// Auto-fill label when file is selected
document.getElementById('imageFiles').addEventListener('change', async function(e) {
    const files = e.target.files;
    const fileInfo = document.getElementById('fileInfo');
    const fileCount = document.getElementById('fileCount');
    
    if (files.length > 0) {
        // Store original file list
        originalFileList = Array.from(files);
        
        // Show loading for TIFF processing
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'tiffProcessing';
        loadingMsg.style.cssText = 'margin-top: 8px; color: #667eea; font-size: 0.9em;';
        loadingMsg.innerHTML = '⏳ Processing files...';
        fileInfo.appendChild(loadingMsg);
        fileInfo.style.display = 'block';
        
        try {
            // Process files and extract TIFF pages if needed
            processedFiles = await processFilesWithTiff(files);
            
            // Remove loading message
            const processingMsg = document.getElementById('tiffProcessing');
            if (processingMsg) {
                processingMsg.remove();
            }
            
            // Update file count to show processed files
            const originalCount = files.length;
            const processedCount = processedFiles.length;
            
            let countText = `${processedCount} file${processedCount > 1 ? 's' : ''} ready for processing`;
            if (processedCount > originalCount) {
                countText += ` (${processedCount - originalCount} extracted from TIFF)`;
            }
            fileCount.textContent = countText;
        
        // Generate default label based on file count and first filename
            const firstFile = processedFiles[0] || files[0];
        let defaultLabel;
        
            if (processedFiles.length === 1) {
            const nameWithoutExt = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
            defaultLabel = nameWithoutExt;
        } else {
            const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
                if (processedCount > originalCount) {
                    // Include TIFF info in label
                    defaultLabel = `${baseName} + ${processedCount - 1} more (inc. TIFF pages)`;
                } else {
                    defaultLabel = `${baseName} + ${processedCount - 1} more`;
                }
        }
        
        document.getElementById('resultLabel').value = defaultLabel;
        
        // Show image previews immediately with crop functionality
            showImagePreviewsForSelection(processedFiles);
            
        } catch (error) {
            console.error('Error processing files:', error);
            showError('Error processing files: ' + error.message);
            
            // Remove loading message
            const processingMsg = document.getElementById('tiffProcessing');
            if (processingMsg) {
                processingMsg.remove();
            }
            
            // Fall back to original files
            processedFiles = Array.from(files);
            fileCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
            document.getElementById('resultLabel').value = files[0].name.substring(0, files[0].name.lastIndexOf('.')) || files[0].name;
        showImagePreviewsForSelection(files);
        }
    } else {
        fileInfo.style.display = 'none';
        document.getElementById('resultLabel').value = '';
        
        // Clear processed files
        processedFiles = [];
        originalFileList = [];
        
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
 * @param {FileList|Array} imageFiles - Array of image files
 */
async function createImagePreviewsForSelection(imageFiles) {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imageUrl = URL.createObjectURL(file);
        
        // Create label with TIFF page info if applicable
        let displayLabel = file.name;
        if (file.isTiffPage) {
            displayLabel = `${file.originalTiffName} - Page ${file.pageNumber}/${file.totalPages}`;
        }
        
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.id = `preview-item-${i}`;
        
        // Add special styling for TIFF pages
        if (file.isTiffPage) {
            previewItem.classList.add('tiff-page-item');
        }
        
        previewItem.innerHTML = `
            <button class="remove-button" onclick="removeImageFromPreview(${i})" title="Remove this image">
                ❌
            </button>
            <button class="crop-button" onclick="openCropModal(${i})">
                ✂️ Crop
            </button>
            ${file.isTiffPage ? '<div class="tiff-page-badge">📄 TIFF Page</div>' : ''}
            <img src="${imageUrl}" alt="${displayLabel}" class="preview-image" data-src="${imageUrl}">
            <div class="preview-label">${displayLabel}</div>
        `;
        
        // Add double-click event listener to open image in new tab
        previewItem.addEventListener('dblclick', function() {
            openImageInNewTab(imageUrl, displayLabel);
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
    
    // Use processed files if available, otherwise fall back to original files
    const filesToProcess = processedFiles.length > 0 ? processedFiles : Array.from(imageFiles);
    
    if (!apiKey || filesToProcess.length === 0 || !textPrompt) {
        showError('Please fill in all fields and select at least one image');
        return;
    }
    
    // Generate final label
    let finalLabel = resultLabel;
    if (!finalLabel) {
        if (filesToProcess.length === 1) {
            finalLabel = filesToProcess[0].name.substring(0, filesToProcess[0].name.lastIndexOf('.')) || filesToProcess[0].name;
        } else {
            finalLabel = `Batch of ${filesToProcess.length} images`;
        }
    }
    
    try {
        setLoading(true);
        hideError();
        hideResults();
        
        // Sort files alphabetically by filename
        const sortedFiles = filesToProcess.sort((a, b) => a.name.localeCompare(b.name));
        
        // Process multiple images
        const results = await processBatchImages(apiKey, sortedFiles, textPrompt);
        
        // Combine all CSV results
        const combinedCsv = combineCSVResults(results);
        
        // Display results with sorted files
        displayBatchResults(sortedFiles, combinedCsv, results);
        
        // Save combined result to server with sorted files
        const imageDataArray = await Promise.all(
            sortedFiles.map((file, index) => fileToBase64(file, index))
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
 * @param {number} index - Optional index for cropped file lookup
 * @returns {Promise<string>} Base64 data URL
 */
function fileToBase64(file, index = null) {
    return new Promise((resolve, reject) => {
        // Check for cropped version first if index provided
        if (index !== null && croppedFiles.has(index)) {
            const croppedFile = croppedFiles.get(index);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(croppedFile);
            return;
        }
        
        // Use original file
        console.log('Using original file for index', index, 'file:', file.name);
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
    
    // Create table container for scrolling
    const tableContainer = document.createElement('div');
    tableContainer.className = 'csv-table-container';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'csv-table';
    table.id = 'editableTable';
    
    // Generate dynamic column widths based on content
    const columnCount = csvDataArray.length > 0 ? csvDataArray[0].length : 0;
    const columnWidths = calculateOptimalColumnWidths(csvDataArray, columnCount);
    
    // Apply column widths to table
    if (columnWidths.length > 0) {
        const colGroup = document.createElement('colgroup');
        columnWidths.forEach(width => {
            const col = document.createElement('col');
            col.style.width = width;
            colGroup.appendChild(col);
        });
        table.appendChild(colGroup);
    }
    
    // Create header with numbered columns (1, 2, 3, etc.)
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    
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
            td.title = cell; // Add tooltip for full content
            
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
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);
    
    // Add keyboard navigation
    addKeyboardNavigation(table);
    
    // Reset unsaved changes flag
    hasUnsavedChanges = false;
    updateEditStatus();
}

/**
 * Calculate optimal column widths based on content
 * @param {Array} data - 2D array of data
 * @param {number} columnCount - Number of columns
 * @returns {Array} Array of width percentages
 */
function calculateOptimalColumnWidths(data, columnCount) {
    if (columnCount === 0) return [];
    
    // Calculate content length for each column
    const columnLengths = new Array(columnCount).fill(0);
    
    data.forEach(row => {
        row.forEach((cell, colIndex) => {
            if (colIndex < columnCount) {
                const cellLength = String(cell).length;
                columnLengths[colIndex] = Math.max(columnLengths[colIndex], cellLength);
            }
        });
    });
    
    // Add header length (column numbers)
    for (let i = 0; i < columnCount; i++) {
        columnLengths[i] = Math.max(columnLengths[i], String(i + 1).length);
    }
    
    // Calculate total length
    const totalLength = columnLengths.reduce((sum, length) => sum + length, 0);
    
    // Convert to percentages with minimum width
    const minWidth = Math.max(8, 100 / columnCount * 0.5); // Minimum 8% or half of equal distribution
    const widths = columnLengths.map(length => {
        const percentage = totalLength > 0 ? (length / totalLength) * 100 : 100 / columnCount;
        return Math.max(minWidth, percentage) + '%';
    });
    
    return widths;
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

// Global variables for cropping - Enhanced with zoom/pan
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

// Enhanced zoom and pan variables
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;
let imageDisplayWidth = 0;
let imageDisplayHeight = 0;
let imageOffsetX = 0;
let imageOffsetY = 0;

/**
 * Initialize crop canvas with image - Enhanced for fullscreen with zoom/pan
 */
function initializeCropCanvas() {
    if (!currentCropFile) {
        console.error('No current crop file available');
        updateCropInfo('Error: No image file available for cropping');
        return;
    }
    
    console.log('Initializing fullscreen crop canvas for file:', currentCropFile.name, 'Type:', currentCropFile.type);
    
    cropCanvas = document.getElementById('cropCanvas');
    cropCtx = cropCanvas.getContext('2d');
    
    // Reset zoom and pan
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    updateZoomDisplay();
    
    // Load image
    originalImage = new Image();
    originalImage.onload = function() {
        console.log('Image loaded successfully:', this.naturalWidth, 'x', this.naturalHeight);
        
        // Get container dimensions (fullscreen minus header/footer)
        const container = document.getElementById('cropCanvasContainer');
        const containerRect = container.getBoundingClientRect();
        const maxWidth = containerRect.width - 40; // Padding
        const maxHeight = containerRect.height - 40; // Padding
        
        console.log('Container size:', maxWidth, 'x', maxHeight);
        
        // Calculate initial scale to fit image in container
        const scaleX = maxWidth / this.naturalWidth;
        const scaleY = maxHeight / this.naturalHeight;
        const initialScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        // Set display dimensions
        imageDisplayWidth = this.naturalWidth * initialScale;
        imageDisplayHeight = this.naturalHeight * initialScale;
        
        // Set canvas size to match display size initially
        cropCanvas.width = imageDisplayWidth;
        cropCanvas.height = imageDisplayHeight;
        
        console.log('Initial display size:', imageDisplayWidth, 'x', imageDisplayHeight);
        
        // Center the canvas in container
        centerCanvas();
        
        // Draw image
        redrawCanvas();
        
        // Add event listeners for zoom, pan, and selection
        addEnhancedCropEventListeners();
        
        // Update info
        updateCropInfo('Use mouse wheel to zoom, drag to pan, click and drag to select crop area');
        
        console.log('Enhanced crop canvas initialized successfully');
    };
    
    originalImage.onerror = function() {
        console.error('Failed to load image for cropping');
        updateCropInfo('Error: Failed to load image');
    };
    
    // Use cropped version if exists, otherwise original
    const fileToShow = croppedFiles.get(currentCropIndex) || currentCropFile;
    
    try {
        const imageUrl = URL.createObjectURL(fileToShow);
        console.log('Created object URL for cropping:', imageUrl);
        originalImage.src = imageUrl;
    } catch (error) {
        console.error('Error creating object URL for crop file:', error);
        updateCropInfo('Error: Cannot display image for cropping');
    }
}

/**
 * Center canvas in container
 */
function centerCanvas() {
    const container = document.getElementById('cropCanvasContainer');
    const containerRect = container.getBoundingClientRect();
    
    imageOffsetX = (containerRect.width - cropCanvas.width) / 2;
    imageOffsetY = (containerRect.height - cropCanvas.height) / 2;
    
    cropCanvas.style.position = 'absolute';
    cropCanvas.style.left = imageOffsetX + 'px';
    cropCanvas.style.top = imageOffsetY + 'px';
}

/**
 * Redraw canvas with current zoom and pan
 */
function redrawCanvas() {
    if (!originalImage || !cropCanvas || !cropCtx) return;
    
    // Calculate current canvas size based on zoom
    const currentWidth = imageDisplayWidth * zoomLevel;
    const currentHeight = imageDisplayHeight * zoomLevel;
    
    // Update canvas size
    cropCanvas.width = currentWidth;
    cropCanvas.height = currentHeight;
    
    // Clear canvas
    cropCtx.clearRect(0, 0, currentWidth, currentHeight);
    
    // Draw image with current zoom
    cropCtx.drawImage(originalImage, 0, 0, currentWidth, currentHeight);
    
    // Update canvas position with pan
    updateCanvasPosition();
}

/**
 * Update canvas position based on pan
 */
function updateCanvasPosition() {
    const container = document.getElementById('cropCanvasContainer');
    const containerRect = container.getBoundingClientRect();
    
    // Calculate base centered position
    const baseCenterX = (containerRect.width - cropCanvas.width) / 2;
    const baseCenterY = (containerRect.height - cropCanvas.height) / 2;
    
    // Apply pan offset
    const newX = baseCenterX + panX;
    const newY = baseCenterY + panY;
    
    cropCanvas.style.left = newX + 'px';
    cropCanvas.style.top = newY + 'px';
    
    // Update stored offsets for coordinate conversion
    imageOffsetX = newX;
    imageOffsetY = newY;
}

/**
 * Add enhanced event listeners for zoom, pan, and crop selection
 */
function addEnhancedCropEventListeners() {
    const canvas = cropCanvas;
    const container = document.getElementById('cropCanvasContainer');
    const selection = document.getElementById('cropSelection');
    
    let isMouseDown = false;
    let isSelecting = false;
    
    // Mouse wheel for zoom
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.1, Math.min(5, zoomLevel + delta));
        
        if (newZoom !== zoomLevel) {
            zoomLevel = newZoom;
            updateZoomDisplay();
            redrawCanvas();
        }
    });
    
    // Mouse events for pan and selection
    container.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Check if clicking on canvas (image)
        const canvasRect = canvas.getBoundingClientRect();
        const containerBounds = container.getBoundingClientRect();
        const relativeCanvasRect = {
            left: canvasRect.left - containerBounds.left,
            top: canvasRect.top - containerBounds.top,
            right: canvasRect.right - containerBounds.left,
            bottom: canvasRect.bottom - containerBounds.top
        };
        
        if (mouseX >= relativeCanvasRect.left && mouseX <= relativeCanvasRect.right &&
            mouseY >= relativeCanvasRect.top && mouseY <= relativeCanvasRect.bottom) {
            
            // Clicking on image - start selection
            isSelecting = true;
            container.style.cursor = 'crosshair';
            
            // Convert to canvas coordinates
            const canvasX = mouseX - imageOffsetX;
            const canvasY = mouseY - imageOffsetY;
            
            cropSelection.startX = canvasX;
            cropSelection.startY = canvasY;
            cropSelection.isSelecting = true;
            
            selection.style.display = 'block';
            selection.style.left = mouseX + 'px';
            selection.style.top = mouseY + 'px';
            selection.style.width = '0px';
            selection.style.height = '0px';
        } else {
            // Clicking outside image - start pan
            isPanning = true;
            container.classList.add('grabbing');
            lastPanX = mouseX;
            lastPanY = mouseY;
        }
        
        isMouseDown = true;
    });
    
    container.addEventListener('mousemove', function(e) {
        if (!isMouseDown) return;
        
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (isSelecting && cropSelection.isSelecting) {
            // Update selection
            const canvasX = mouseX - imageOffsetX;
            const canvasY = mouseY - imageOffsetY;
            
            cropSelection.endX = canvasX;
            cropSelection.endY = canvasY;
            
            // Calculate selection box in container coordinates
            const left = Math.min(cropSelection.startX + imageOffsetX, mouseX);
            const top = Math.min(cropSelection.startY + imageOffsetY, mouseY);
            const width = Math.abs(mouseX - (cropSelection.startX + imageOffsetX));
            const height = Math.abs(mouseY - (cropSelection.startY + imageOffsetY));
            
            selection.style.left = left + 'px';
            selection.style.top = top + 'px';
            selection.style.width = width + 'px';
            selection.style.height = height + 'px';
            
            // Update info
            const realWidth = width / zoomLevel;
            const realHeight = height / zoomLevel;
            updateCropInfo(`Selection: ${Math.round(realWidth)} × ${Math.round(realHeight)} pixels`);
        } else if (isPanning) {
            // Update pan
            const deltaX = mouseX - lastPanX;
            const deltaY = mouseY - lastPanY;
            
            panX += deltaX;
            panY += deltaY;
            
            updateCanvasPosition();
            
            lastPanX = mouseX;
            lastPanY = mouseY;
        }
    });
    
    container.addEventListener('mouseup', function(e) {
        isMouseDown = false;
        
        if (isSelecting) {
            // Finish selection
            const width = Math.abs(cropSelection.endX - cropSelection.startX);
            const height = Math.abs(cropSelection.endY - cropSelection.startY);
            
            if (width < 5 || height < 5) {
                resetCropSelection();
                updateCropInfo('Selection too small. Click and drag on image to select crop area.');
            }
            
            isSelecting = false;
            container.style.cursor = 'grab';
        }
        
        if (isPanning) {
            isPanning = false;
            container.classList.remove('grabbing');
        }
    });
    
    // Touch events for mobile
    container.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        container.dispatchEvent(mouseEvent);
    });
    
    container.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        container.dispatchEvent(mouseEvent);
    });
    
    container.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        container.dispatchEvent(mouseEvent);
    });
}

/**
 * Zoom functions
 */
function zoomIn() {
    zoomLevel = Math.min(5, zoomLevel + 0.25);
    updateZoomDisplay();
    redrawCanvas();
}

function zoomOut() {
    zoomLevel = Math.max(0.1, zoomLevel - 0.25);
    updateZoomDisplay();
    redrawCanvas();
}

function resetZoom() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    updateZoomDisplay();
    redrawCanvas();
    updateCropInfo('Zoom and pan reset. Click and drag on image to select crop area.');
}

/**
 * Update zoom level display
 */
function updateZoomDisplay() {
    const zoomDisplay = document.getElementById('zoomLevel');
    if (zoomDisplay) {
        zoomDisplay.textContent = Math.round(zoomLevel * 100) + '%';
    }
}

/**
 * Open crop modal for specific image
 * @param {number} imageIndex - Index of the image to crop
 */
function openCropModal(imageIndex) {
    // Use processed files if available, otherwise fall back to original files
    const filesToUse = processedFiles.length > 0 ? processedFiles : Array.from(document.getElementById('imageFiles').files);
    
    if (!filesToUse || imageIndex >= filesToUse.length) {
        console.error('Invalid image index or no files available for cropping');
        return;
    }
    
    currentCropFile = filesToUse[imageIndex];
    currentCropIndex = imageIndex;
    
    console.log('Opening crop modal for:', currentCropFile.name, 'Index:', imageIndex);
    
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
 * Reset crop selection and zoom/pan
 */
function resetCrop() {
    resetCropSelection();
    resetZoom();
    
    updateCropInfo('Zoom and pan reset. Click and drag on image to select crop area');
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
 * Apply crop to image - Enhanced for zoom/pan
 */
async function applyCrop() {
    if (!cropCanvas || !originalImage) return;
    
    const selection = document.getElementById('cropSelection');
    if (selection.style.display === 'none') {
        alert('Please select an area to crop first');
        return;
    }
    
    // Calculate crop coordinates in original image space
    const left = Math.min(cropSelection.startX, cropSelection.endX);
    const top = Math.min(cropSelection.startY, cropSelection.endY);
    const width = Math.abs(cropSelection.endX - cropSelection.startX);
    const height = Math.abs(cropSelection.endY - cropSelection.startY);
    
    if (width < 5 || height < 5) {
        alert('Selection area is too small');
        return;
    }
    
    // Convert from display coordinates to original image coordinates
    // Current scale factor considering both initial scaling and zoom
    const container = document.getElementById('cropCanvasContainer');
    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width - 40;
    const maxHeight = containerRect.height - 40;
    
    const scaleX = maxWidth / originalImage.naturalWidth;
    const scaleY = maxHeight / originalImage.naturalHeight;
    const initialScale = Math.min(scaleX, scaleY, 1);
    
    // Total scale factor = initial scale * zoom level
    const totalScale = initialScale * zoomLevel;
    
    // Convert selection coordinates to original image coordinates
    const originalLeft = left / totalScale;
    const originalTop = top / totalScale;
    const originalWidth = width / totalScale;
    const originalHeight = height / totalScale;
    
    console.log('Crop coordinates:', {
        display: { left, top, width, height },
        original: { originalLeft, originalTop, originalWidth, originalHeight },
        totalScale: totalScale,
        imageSize: { width: originalImage.naturalWidth, height: originalImage.naturalHeight }
    });
    
    // Ensure coordinates are within image bounds
    const clampedLeft = Math.max(0, Math.min(originalLeft, originalImage.naturalWidth - 1));
    const clampedTop = Math.max(0, Math.min(originalTop, originalImage.naturalHeight - 1));
    const clampedWidth = Math.min(originalWidth, originalImage.naturalWidth - clampedLeft);
    const clampedHeight = Math.min(originalHeight, originalImage.naturalHeight - clampedTop);
    
    if (clampedWidth < 1 || clampedHeight < 1) {
        alert('Invalid crop area');
        return;
    }
    
    // Create new canvas for cropped image
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // Set cropped canvas size
    croppedCanvas.width = clampedWidth;
    croppedCanvas.height = clampedHeight;
    
    // Draw cropped portion from original image
    croppedCtx.drawImage(
        originalImage,
        clampedLeft, clampedTop, clampedWidth, clampedHeight,
        0, 0, clampedWidth, clampedHeight
    );
    
    // Convert to blob and create new file
    croppedCanvas.toBlob(function(blob) {
        if (!blob) {
            alert('Failed to create cropped image');
            return;
        }
        
        // Create new file with cropped data
        const croppedFile = new File([blob], currentCropFile.name, {
            type: currentCropFile.type,
            lastModified: Date.now()
        });
        
        // Store cropped file
        croppedFiles.set(currentCropIndex, croppedFile);
        
        console.log('Cropped file stored:', {
            index: currentCropIndex,
            originalFileName: currentCropFile.name,
            croppedFileName: croppedFile.name,
            croppedFileSize: croppedFile.size,
            totalCroppedFiles: croppedFiles.size,
            allCroppedKeys: Array.from(croppedFiles.keys())
        });
        
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

// TIFF Processing Functions

/**
 * Check if a file is a TIFF file
 * @param {File} file - File to check
 * @returns {boolean} True if file is TIFF
 */
function isTiffFile(file) {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return name.endsWith('.tif') || name.endsWith('.tiff') || 
           type === 'image/tiff' || type === 'image/tif';
}

/**
 * Extract pages from a multipage TIFF file using UTIF.js
 * @param {File} tiffFile - TIFF file to process
 * @returns {Promise<Array>} Array of File objects for each page
 */
async function extractTiffPages(tiffFile) {
    return new Promise((resolve, reject) => {
        // Check if UTIF is available
        if (typeof UTIF === 'undefined') {
            reject(new Error('UTIF library not loaded. Please refresh the page and try again.'));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const buffer = e.target.result;
                
                // Decode TIFF file
                let ifds;
                try {
                    ifds = UTIF.decode(buffer);
                } catch (decodeError) {
                    reject(new Error(`Failed to decode TIFF file "${tiffFile.name}": ${decodeError.message}`));
                    return;
                }
                
                const pageCount = ifds.length;
                
                console.log(`TIFF file "${tiffFile.name}" has ${pageCount} page(s)`);
                
                if (pageCount === 0) {
                    reject(new Error(`No pages found in TIFF file "${tiffFile.name}"`));
                    return;
                }
                
                const baseName = tiffFile.name.replace(/\.(tiff?|TIF+)$/i, '');
                const pages = [];
                let processedCount = 0;
                
                // Process each page
                for (let i = 0; i < pageCount; i++) {
                    try {
                        const ifd = ifds[i];
                        UTIF.decodeImage(buffer, ifd);
                        
                        // Create canvas for this page
                        const canvas = document.createElement('canvas');
                        canvas.width = ifd.width;
                        canvas.height = ifd.height;
                        const ctx = canvas.getContext('2d');
                        
                        // Convert RGBA data to ImageData
                        const rgba = UTIF.toRGBA8(ifd);
                        const imageData = new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height);
                        
                        // Draw to canvas
                        ctx.putImageData(imageData, 0, 0);
                        
                        // Convert canvas to blob
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                console.error(`Failed to create blob for page ${i + 1}`);
                                processedCount++;
                                if (processedCount === pageCount) {
                                    const sortedPages = pages.filter(p => p).sort((a, b) => a.pageIndex - b.pageIndex);
                                    if (sortedPages.length === 0) {
                                        reject(new Error(`No pages could be processed from TIFF file "${tiffFile.name}"`));
                                    } else {
                                        resolve(sortedPages);
                                    }
                                }
                                return;
                            }
                            
                            // Create file object for this page
                            const fileName = pageCount === 1 ? 
                                `${baseName}.png` : 
                                `${baseName}_page_${i + 1}.png`;
                                
                            const pageFile = new File([blob], fileName, { type: 'image/png' });
                            
                            // Add metadata to identify as TIFF page
                            pageFile.isTiffPage = true;
                            pageFile.originalTiffName = tiffFile.name;
                            pageFile.pageNumber = i + 1;
                            pageFile.totalPages = pageCount;
                            pageFile.pageIndex = i; // Add page index for sorting
                            
                            pages[i] = pageFile; // Store in correct position
                            processedCount++;
                            
                            // Resolve when all pages are processed
                            if (processedCount === pageCount) {
                                // Filter out any undefined entries and sort by page index
                                const sortedPages = pages.filter(p => p).sort((a, b) => a.pageIndex - b.pageIndex);
                                if (sortedPages.length === 0) {
                                    reject(new Error(`No pages could be processed from TIFF file "${tiffFile.name}"`));
                                } else {
                                    resolve(sortedPages);
                                }
                            }
                        }, 'image/png', 0.9);
                        
                    } catch (pageError) {
                        console.error(`Error processing page ${i + 1}:`, pageError);
                        processedCount++;
                        
                        // Continue with other pages even if one fails
                        if (processedCount === pageCount) {
                            const sortedPages = pages.filter(p => p).sort((a, b) => a.pageIndex - b.pageIndex);
                            if (sortedPages.length === 0) {
                                reject(new Error(`No pages could be processed from TIFF file "${tiffFile.name}"`));
                            } else {
                                resolve(sortedPages);
                            }
                        }
                    }
                }
                
            } catch (error) {
                console.error('Error processing TIFF file:', error);
                reject(new Error(`Failed to process TIFF file "${tiffFile.name}": ${error.message}`));
            }
        };
        
        reader.onerror = () => {
            reject(new Error(`Failed to read TIFF file "${tiffFile.name}"`));
        };
        
        reader.readAsArrayBuffer(tiffFile);
    });
}

/**
 * Process files and extract TIFF pages if needed
 * @param {FileList} files - Selected files
 * @returns {Promise<Array>} Array of processed files
 */
async function processFilesWithTiff(files) {
    const processedFiles = [];
    let hasTiffFile = false;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (isTiffFile(file)) {
            hasTiffFile = true;
            console.log(`Processing TIFF file: ${file.name}`);
            
            try {
                const tiffPages = await extractTiffPages(file);
                console.log(`Extracted ${tiffPages.length} pages from ${file.name}`);
                processedFiles.push(...tiffPages);
            } catch (error) {
                console.error('Error processing TIFF:', error);
                // Show error but continue with other files
                showError(`Error processing TIFF "${file.name}": ${error.message}`);
                
                // Add original file as fallback
                processedFiles.push(file);
            }
        } else {
            // Regular image file
            processedFiles.push(file);
        }
    }
    
    // Show TIFF info and update styling if any TIFF files were processed
    const tiffInfo = document.getElementById('tiffInfo');
    const fileInfo = document.getElementById('fileInfo');
    
    if (hasTiffFile) {
        if (tiffInfo) {
            tiffInfo.style.display = 'block';
        }
        if (fileInfo) {
            fileInfo.classList.add('has-tiff');
        }
    } else {
        if (tiffInfo) {
            tiffInfo.style.display = 'none';
        }
        if (fileInfo) {
            fileInfo.classList.remove('has-tiff');
        }
    }
    
    return processedFiles;
}

/**
 * Remove an image from the preview (before processing)
 * @param {number} imageIndex - Index of the image to remove
 */
function removeImageFromPreview(imageIndex) {
    if (!processedFiles || imageIndex >= processedFiles.length) {
        console.error('Invalid image index for removal:', imageIndex);
        return;
    }
    
    const fileToRemove = processedFiles[imageIndex];
    const fileName = fileToRemove.name;
    
    // Confirm removal
    const confirmMessage = fileToRemove.isTiffPage ? 
        `Remove TIFF page "${fileName}"?` : 
        `Remove image "${fileName}"?`;
        
    if (!confirm(confirmMessage)) {
        return;
    }
    
    console.log('Removing image:', fileName, 'Index:', imageIndex);
    
    // Remove from processed files array
    processedFiles.splice(imageIndex, 1);
    
    // Remove any cropped version of this file
    if (croppedFiles.has(imageIndex)) {
        croppedFiles.delete(imageIndex);
    }
    
    // Update cropped files indices (shift down indices after the removed one)
    const newCroppedFiles = new Map();
    croppedFiles.forEach((croppedFile, index) => {
        if (index > imageIndex) {
            newCroppedFiles.set(index - 1, croppedFile);
        } else if (index < imageIndex) {
            newCroppedFiles.set(index, croppedFile);
        }
    });
    croppedFiles = newCroppedFiles;
    
    // Update UI
    updateFileInfoAfterRemoval();
    refreshImagePreviews();
}

/**
 * Update file info display after image removal
 */
function updateFileInfoAfterRemoval() {
    const fileCount = document.getElementById('fileCount');
    const fileInfo = document.getElementById('fileInfo');
    const resultLabel = document.getElementById('resultLabel');
    
    if (processedFiles.length === 0) {
        // No files left, hide file info and clear everything
        fileInfo.style.display = 'none';
        resultLabel.value = '';
        hideImagePreviews();
        
        // Reset file input
        const fileInput = document.getElementById('imageFiles');
        fileInput.value = '';
        
        return;
    }
    
    // Update count display
    const originalCount = originalFileList.length;
    const processedCount = processedFiles.length;
    
    let countText = `${processedCount} file${processedCount > 1 ? 's' : ''} ready for processing`;
    if (processedCount !== originalCount) {
        const difference = originalCount - processedCount;
        if (difference > 0) {
            countText += ` (${difference} removed)`;
        } else {
            countText += ` (${processedCount - originalCount} extracted from TIFF)`;
        }
    }
    fileCount.textContent = countText;
    
    // Update result label
    updateResultLabel();
}

/**
 * Update result label based on remaining files
 */
function updateResultLabel() {
    const resultLabel = document.getElementById('resultLabel');
    
    if (processedFiles.length === 0) {
        resultLabel.value = '';
        return;
    }
    
    const firstFile = processedFiles[0];
    let defaultLabel;
    
    if (processedFiles.length === 1) {
        const nameWithoutExt = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        defaultLabel = nameWithoutExt;
    } else {
        const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        const tiffPageCount = processedFiles.filter(f => f.isTiffPage).length;
        
        if (tiffPageCount > 0) {
            defaultLabel = `${baseName} + ${processedFiles.length - 1} more (inc. TIFF pages)`;
        } else {
            defaultLabel = `${baseName} + ${processedFiles.length - 1} more`;
        }
    }
    
    resultLabel.value = defaultLabel;
}

/**
 * Refresh image previews after removal (re-index everything)
 */
function refreshImagePreviews() {
    if (processedFiles.length === 0) {
        return;
    }
    
    // Recreate the previews with updated indices
    createImagePreviewsForSelection(processedFiles);
}

/**
 * Remove all images from preview
 */
function removeAllImages() {
    if (!processedFiles || processedFiles.length === 0) {
        return;
    }
    
    const fileCount = processedFiles.length;
    const confirmMessage = `Remove all ${fileCount} image${fileCount > 1 ? 's' : ''}?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    console.log('Removing all images');
    
    // Clear all arrays
    processedFiles = [];
    originalFileList = [];
    croppedFiles.clear();
    
    // Reset file input
    const fileInput = document.getElementById('imageFiles');
    fileInput.value = '';
    
    // Update UI
    const fileInfo = document.getElementById('fileInfo');
    const resultLabel = document.getElementById('resultLabel');
    
    fileInfo.style.display = 'none';
    resultLabel.value = '';
    hideImagePreviews();
}