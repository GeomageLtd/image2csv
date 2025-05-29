// Main Application Entry Point
// This file coordinates all modules and handles the primary application flow

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
});

/**
 * Initialize the application
 */
function initializeApplication() {
    console.log('🚀 Initializing Image2CSV Application...');
    
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
    setupEventListeners();
    
    console.log('✅ Application initialized successfully');
}

/**
 * Setup all event listeners for the application
 */
function setupEventListeners() {
    // File input change handler
    const imageFilesInput = document.getElementById('imageFiles');
    if (imageFilesInput) {
        imageFilesInput.addEventListener('change', async function(e) {
            await handleFileSelection(e.target.files);
        });
    }
    
    // Form submission handler
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFormSubmission);
    }
    
    // Download CSV button handler
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            if (!AppState.csvData) return;
            downloadFile(AppState.csvData, 'parsed_data.csv', 'text/csv');
        });
    }
    
    // Auto-resize text prompt area
    const textPrompt = document.getElementById('textPrompt');
    if (textPrompt) {
        textPrompt.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }
}

/**
 * Handle form submission for image processing
 * @param {Event} e - Form submission event
 */
async function handleFormSubmission(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value.trim();
    const textPrompt = document.getElementById('textPrompt').value.trim();
    const resultLabel = document.getElementById('resultLabel').value.trim();
    
    // Validation
    if (!apiKey) {
        showError('Please enter your OpenAI API key');
        return;
    }
    
    if (!textPrompt) {
        showError('Please enter a prompt describing what data to extract');
        return;
    }
    
    const filesToProcess = AppState.processedFiles.length > 0 ? AppState.processedFiles : [];
    if (filesToProcess.length === 0) {
        showError('Please select at least one image file');
        return;
    }
    
    // Determine label
    let finalLabel = resultLabel || `Processing ${filesToProcess.length} images`;
    
    try {
        setLoading(true);
        
        // Sort files by name for consistent processing order
        const sortedFiles = filesToProcess.sort((a, b) => a.name.localeCompare(b.name));
        
        // Process images
        const results = await BatchProcessor.processImages(apiKey, sortedFiles, textPrompt);
        
        // Combine CSV results
        const combinedCsv = CSVProcessor.combineResults(results);
        AppState.csvData = combinedCsv;
        
        // Prepare image data for saving
        const imageDataArray = await Promise.all(
            sortedFiles.map((file, index) => fileToBase64(file, index))
        );
        
        // Save result to server
        const saveResponse = await ResultManager.saveResult(imageDataArray, combinedCsv, textPrompt, finalLabel);
        
        // Display results
        DisplayManager.showBatchResults(sortedFiles, combinedCsv, results);
        
        // Show share options
        if (saveResponse && saveResponse.resultId) {
            AppState.currentResultId = saveResponse.resultId;
            DisplayManager.showShareOptions(saveResponse.resultId, saveResponse.shareUrl);
        }
        
        // Refresh results list
        ResultManager.loadResultsList();
        
    } catch (error) {
        console.error('Error processing images:', error);
        showError('Error processing images: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// Placeholder modules that need to be implemented
// These would normally be in separate files

const BatchProcessor = {
    async processImages(apiKey, imageFiles, textPrompt) {
        const results = [];
        const totalFiles = imageFiles.length;
        
        this.showBatchProgress();
        this.updateProgress(0, totalFiles, 'Starting batch processing...');
        
        // Create/update preview for all images (reuse existing if available)
        await this.createImagePreviews(imageFiles);
        
        for (let i = 0; i < totalFiles; i++) {
            const file = imageFiles[i];
            this.updateImageStatus(i, 'processing');
            this.updateProgress(i, totalFiles, `Processing ${file.name}...`);
            
            try {
                // Convert image to base64 (uses cropped version if available)
                const base64Image = await fileToBase64(file, i);
                
                // Make API call to OpenAI
                const response = await fetch(CONFIG.API.OPENAI_URL, {
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
                
                this.updateImageStatus(i, 'complete');
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                results.push({
                    filename: file.name,
                    error: error.message,
                    success: false
                });
                
                this.updateImageStatus(i, 'error');
            }
            
            // Small delay between requests to avoid rate limiting
            if (i < totalFiles - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        this.updateProgress(totalFiles, totalFiles, 'Processing complete!');
        return results;
    },

    async createImagePreviews(imageFiles) {
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
                openInNewTab(imageUrl);
            });
            
            previewContainer.appendChild(previewItem);
        }
    },

    updateImageStatus(index, status) {
        const statusElement = document.getElementById(`status-${index}`);
        if (statusElement) {
            statusElement.className = `processing-status status-${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    },

    showBatchProgress() {
        const batchProgress = document.getElementById('batchProgress');
        batchProgress.style.display = 'block';
        
        // Show progress bar and text for processing
        const progressBar = batchProgress.querySelector('.progress-bar');
        const progressText = batchProgress.querySelector('.progress-text');
        if (progressBar) progressBar.style.display = 'block';
        if (progressText) progressText.style.display = 'block';
    },

    updateProgress(current, total, message) {
        const percentage = (current / total) * 100;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${message} (${current}/${total})`;
    }
};

const CSVProcessor = {
    combineResults(results) {
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
                    const isHeaderRow = this.isLikelyHeaderRow(firstRow, referenceHeaders, csvRows);
                    
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
    },

    isLikelyHeaderRow(row, referenceHeaders, allRows) {
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
        
        // Default to treating first row as header if we're unsure and it's reasonable
        if (allRows.length > 1) {
            return true;
        }
        
        return false;
    }
};

const ResultManager = {
    async saveResult(imageData, csvContent, prompt, label) {
        // Implementation for saving results to server
        const response = await fetch('/api/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageData,
                csvData: csvContent,
                prompt,
                label,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save result');
        }
        
        return await response.json();
    },
    
    async loadSavedResult(resultId) {
        try {
            const response = await fetch(`/api/result/${resultId}`);
            if (response.ok) {
                const result = await response.json();
                DisplayManager.showSavedResult(result);
            } else {
                showError('Failed to load saved result');
            }
        } catch (error) {
            console.error('Error loading saved result:', error);
            showError('Error loading saved result: ' + error.message);
        }
    },
    
    async loadResultsList() {
        try {
            const response = await fetch('/api/results');
            if (response.ok) {
                const results = await response.json();
                this.displayResultsList(results);
            }
        } catch (error) {
            console.error('Error loading results list:', error);
        }
    },
    
    displayResultsList(results) {
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
                        <div class="result-date">${formatTimestamp(result.timestamp)}</div>
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
        if (uploadSection) {
            uploadSection.parentNode.insertBefore(listSection, uploadSection);
        }
        
        // Add click handlers
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', function() {
                const resultId = this.dataset.id;
                ResultManager.loadSavedResult(resultId);
            });
        });
    },
    
    async deleteResult(resultId) {
        try {
            const response = await fetch(`/api/result/${resultId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Refresh results list
                this.loadResultsList();
                
                // If this was the currently displayed result, clear the display
                if (AppState.currentResultId === resultId) {
                    AppState.currentResultId = null;
                    document.getElementById('results').style.display = 'none';
                }
            } else {
                showError('Failed to delete result');
            }
        } catch (error) {
            console.error('Error deleting result:', error);
            showError('Error deleting result: ' + error.message);
        }
    }
};

const DisplayManager = {
    showBatchResults(imageFiles, combinedCsv, results) {
        // Update section title
        const title = document.getElementById('imagesSectionTitle');
        title.textContent = `📷 Uploaded Images (${imageFiles.length})`;
        
        // Display images
        const displayContainer = document.getElementById('displayImages');
        displayContainer.innerHTML = '';
        displayContainer.className = imageFiles.length > 1 ? 'multiple-images' : '';
        
        Array.from(imageFiles).forEach((file, index) => {
            // Use cropped version if available, otherwise use original
            const fileToDisplay = AppState.croppedFiles.has(index) ? AppState.croppedFiles.get(index) : file;
            const imageUrl = URL.createObjectURL(fileToDisplay);
            const result = results[index];
            
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            
            // Add a visual indicator if the image was cropped
            const croppedIndicator = AppState.croppedFiles.has(index) ? 
                '<span class="cropped-indicator" title="This image was cropped">✂️ Cropped</span>' : '';
            
            imageItem.innerHTML = `
                <img src="${imageUrl}" alt="${file.name}" ondblclick="openInNewTab('${imageUrl}')">
                <div class="image-label">
                    ${file.name} 
                    ${result && result.success ? '✅' : '❌'}
                    ${croppedIndicator}
                </div>
            `;
            
            displayContainer.appendChild(imageItem);
        });
        
        // Store and display CSV with editing capabilities
        AppState.csvData = combinedCsv;
        displayCSVTableWithValidation(combinedCsv);
        
        // Show results
        document.getElementById('results').style.display = 'block';
    },
    
    showShareOptions(resultId, shareUrl) {
        // Implementation for showing share options
        console.log('Showing share options for:', resultId);
        // This would show sharing UI
    },
    
    showSavedResult(result) {
        // Display the saved result
        AppState.currentResultId = result.id;
        AppState.csvData = result.csvData;
        
        // Display images
        this.displayImages(result.imageData, result.isBatch);
        
        // Display CSV with editing capabilities
        displayCSVTableWithValidation(result.csvData);
        
        // Show results section
        document.getElementById('results').style.display = 'block';
    },
    
    displayImages(imageData, isBatch) {
        const displayContainer = document.getElementById('displayImages');
        const title = document.getElementById('imagesSectionTitle');
        
        if (isBatch && Array.isArray(imageData)) {
            title.textContent = `📷 Uploaded Images (${imageData.length})`;
            
            // Add class for multiple images grid layout
            displayContainer.className = imageData.length > 1 ? 'multiple-images' : '';
            
            displayContainer.innerHTML = imageData.map((imgData, index) => `
                <div class="image-item">
                    <img src="${imgData}" alt="Uploaded image ${index + 1}" 
                         ondblclick="openInNewTab('${imgData}')" />
                    <div class="image-label">Image ${index + 1}</div>
                </div>
            `).join('');
        } else {
            title.textContent = '📷 Uploaded Image';
            displayContainer.className = ''; // Single image, no special class
            displayContainer.innerHTML = `
                <div class="image-item">
                    <img src="${imageData}" alt="Uploaded image" 
                         ondblclick="openInNewTab('${imageData}')" />
                </div>
            `;
        }
    },
    
    displayCSVTable(csvContent) {
        // Legacy function - now redirects to enhanced table editor
        displayCSVTableWithValidation(csvContent);
    }
};

const ImagePreview = {
    async showForSelection(files) {
        // Clear any existing cropped files from previous selections
        AppState.croppedFiles.clear();
        
        // Show the preview container
        const batchProgress = document.getElementById('batchProgress');
        batchProgress.style.display = 'block';
        
        // Hide progress bar since we're just showing previews
        const progressBar = batchProgress.querySelector('.progress-bar');
        const progressText = batchProgress.querySelector('.progress-text');
        if (progressBar) progressBar.style.display = 'none';
        if (progressText) progressText.style.display = 'none';
        
        // Create previews with crop functionality
        await this.createImagePreviewsForSelection(files);
    },
    
    hide() {
        const batchProgress = document.getElementById('batchProgress');
        if (batchProgress) {
            batchProgress.style.display = 'none';
        }
        AppState.croppedFiles.clear();
    },

    async createImagePreviewsForSelection(imageFiles) {
        const previewContainer = document.getElementById('imagePreview');
        previewContainer.innerHTML = '';
        
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const imageUrl = URL.createObjectURL(file);
            
            // Create label with TIFF page info if applicable
            let displayLabel = file.name;
            if (file.originalTiffName) {
                displayLabel = `${file.originalTiffName} - Page ${file.pageNumber}/${file.totalPages}`;
            }
            
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.id = `preview-item-${i}`;
            
            // Add special styling for TIFF pages
            if (file.originalTiffName) {
                previewItem.classList.add('tiff-page-item');
            }
            
            previewItem.innerHTML = `
                <button class="remove-button" onclick="removeImageFromPreview(${i})" title="Remove this image">
                    ❌
                </button>
                <button class="crop-button" onclick="openCropModal(${i})">
                    ✂️ Crop
                </button>
                ${file.originalTiffName ? '<div class="tiff-page-badge">📄 TIFF Page</div>' : ''}
                <img src="${imageUrl}" alt="${displayLabel}" class="preview-image" data-src="${imageUrl}">
                <div class="preview-label">${displayLabel}</div>
            `;
            
            // Add double-click event listener to open image in new tab
            previewItem.addEventListener('dblclick', function() {
                openInNewTab(imageUrl);
            });
            
            previewContainer.appendChild(previewItem);
        }
    }
};

// Export for use in other modules
window.AppMain = {
    initializeApplication,
    handleFormSubmission,
    BatchProcessor,
    CSVProcessor,
    ResultManager,
    DisplayManager,
    ImagePreview
};

/**
 * Remove an image from the preview (before processing)
 * @param {number} imageIndex - Index of the image to remove
 */
function removeImageFromPreview(imageIndex) {
    if (!AppState.processedFiles || imageIndex >= AppState.processedFiles.length) {
        console.error('Invalid image index for removal:', imageIndex);
        return;
    }
    
    const fileToRemove = AppState.processedFiles[imageIndex];
    const fileName = fileToRemove.name;
    
    // Confirm removal
    const confirmMessage = fileToRemove.originalTiffName ? 
        `Remove TIFF page "${fileName}"?` : 
        `Remove image "${fileName}"?`;
        
    if (!confirm(confirmMessage)) {
        return;
    }
    
    console.log('Removing image:', fileName, 'Index:', imageIndex);
    
    // Remove from processed files array
    AppState.processedFiles.splice(imageIndex, 1);
    
    // Remove any cropped version of this file
    if (AppState.croppedFiles.has(imageIndex)) {
        AppState.croppedFiles.delete(imageIndex);
    }
    
    // Update cropped files indices (shift down indices after the removed one)
    const newCroppedFiles = new Map();
    AppState.croppedFiles.forEach((croppedFile, index) => {
        if (index > imageIndex) {
            newCroppedFiles.set(index - 1, croppedFile);
        } else if (index < imageIndex) {
            newCroppedFiles.set(index, croppedFile);
        }
    });
    AppState.croppedFiles = newCroppedFiles;
    
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
    
    if (AppState.processedFiles.length === 0) {
        // No files left, hide file info and clear everything
        fileInfo.style.display = 'none';
        resultLabel.value = '';
        ImagePreview.hide();
        
        // Reset file input
        const fileInput = document.getElementById('imageFiles');
        fileInput.value = '';
        
        return;
    }
    
    // Update count display
    const originalCount = AppState.originalFileList.length;
    const processedCount = AppState.processedFiles.length;
    
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
    
    if (AppState.processedFiles.length === 0) {
        resultLabel.value = '';
        return;
    }
    
    const firstFile = AppState.processedFiles[0];
    let defaultLabel;
    
    if (AppState.processedFiles.length === 1) {
        const nameWithoutExt = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        defaultLabel = nameWithoutExt;
    } else {
        const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        const tiffPageCount = AppState.processedFiles.filter(f => f.originalTiffName).length;
        
        if (tiffPageCount > 0) {
            defaultLabel = `${baseName} + ${AppState.processedFiles.length - 1} more (inc. TIFF pages)`;
        } else {
            defaultLabel = `${baseName} + ${AppState.processedFiles.length - 1} more`;
        }
    }
    
    resultLabel.value = defaultLabel;
}

/**
 * Refresh image previews after removal (re-index everything)
 */
function refreshImagePreviews() {
    if (AppState.processedFiles.length === 0) {
        return;
    }
    
    // Recreate the previews with updated indices
    ImagePreview.createImagePreviewsForSelection(AppState.processedFiles);
}

// Make functions globally available for onclick handlers
window.removeImageFromPreview = removeImageFromPreview;
window.updateResultLabel = updateResultLabel; 