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
                <button class="open-tab-button" onclick="openInNewTab('${imageUrl}')" title="Open in new tab">
                    🔗 Open
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
        // Prepare complete session state for restoration
        const sessionState = {
            // Form data
            prompt: prompt,
            label: label,
            
            // Original file information (reconstructed from current state)
            originalFiles: await this.prepareOriginalFilesData(),
            
            // Current file order (indices in the processedFiles array)
            fileOrder: AppState.processedFiles.map((file, index) => ({
                index: index,
                filename: file.name,
                originalTiffName: file.originalTiffName || null,
                pageNumber: file.pageNumber || null,
                totalPages: file.totalPages || null
            })),
            
            // Cropped files data
            croppedFiles: await this.prepareCroppedFilesData(),
            
            // Processing results
            imageData: imageData,
            csvData: csvContent,
            
            // Metadata
            timestamp: new Date().toISOString(),
            fileCount: AppState.processedFiles.length,
            isBatch: AppState.processedFiles.length > 1
        };
        
        const response = await fetch('/api/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionState)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save result');
        }
        
        return await response.json();
    },
    
    /**
     * Prepare original files data for saving
     */
    async prepareOriginalFilesData() {
        const originalFilesData = [];
        
        for (let i = 0; i < AppState.processedFiles.length; i++) {
            const file = AppState.processedFiles[i];
            const fileData = await fileToBase64WithMeta(file);
            
            originalFilesData.push({
                index: i,
                name: file.name,
                type: file.type,
                size: file.size,
                data: fileData,
                originalTiffName: file.originalTiffName || null,
                pageNumber: file.pageNumber || null,
                totalPages: file.totalPages || null
            });
        }
        
        return originalFilesData;
    },
    
    /**
     * Prepare cropped files data for saving
     */
    async prepareCroppedFilesData() {
        const croppedFilesData = {};
        
        for (const [index, croppedFile] of AppState.croppedFiles.entries()) {
            const croppedData = await fileToBase64WithMeta(croppedFile);
            croppedFilesData[index] = {
                name: croppedFile.name,
                type: croppedFile.type,
                size: croppedFile.size,
                data: croppedData
            };
        }
        
        return croppedFilesData;
    },
    
    async loadSavedResult(resultId) {
        try {
            const response = await fetch(`/api/result/${resultId}`);
            if (response.ok) {
                const result = await response.json();
                await this.restoreSessionState(result);
            } else {
                showError('Failed to load saved result');
            }
        } catch (error) {
            console.error('Error loading saved result:', error);
            showError('Error loading saved result: ' + error.message);
        }
    },
    
    /**
     * Restore complete session state from saved result
     */
    async restoreSessionState(result) {
        try {
            console.log('🔄 Restoring session state from saved result...');
            
            // Store current result ID
            AppState.currentResultId = result.id;
            AppState.csvData = result.csvData;
            
            // Restore form fields
            if (result.prompt) {
                const promptField = document.getElementById('textPrompt');
                if (promptField) {
                    promptField.value = result.prompt;
                    // Trigger auto-resize
                    promptField.style.height = 'auto';
                    promptField.style.height = promptField.scrollHeight + 'px';
                }
            }
            
            if (result.label) {
                const labelField = document.getElementById('resultLabel');
                if (labelField) labelField.value = result.label;
            }
            
            // Restore original files if available
            if (result.originalFiles && result.originalFiles.length > 0) {
                await this.restoreOriginalFiles(result);
                await this.restoreCroppedFiles(result);
                await this.restoreFileOrder(result);
                
                // Show file info
                this.updateFileInfoFromRestored(result);
                
                // Show image previews with drag/drop reordering
                ImagePreview.showForSelection(AppState.processedFiles);
                
                console.log('✅ Session state restored with original files and edit capabilities');
            } else {
                // Fallback to display-only mode for older saved results
                DisplayManager.displayImages(result.imageData, result.isBatch);
            }
            
            // Display CSV with editing capabilities
            displayCSVTableWithValidation(result.csvData);
            
            // Show results section
            document.getElementById('results').style.display = 'block';
            
            // Add restore notification
            this.showRestoreNotification(result);
            
        } catch (error) {
            console.error('Error restoring session state:', error);
            showError('Error restoring session: ' + error.message);
            
            // Fallback to basic display
            DisplayManager.showSavedResult(result);
        }
    },
    
    /**
     * Restore original files from saved data
     */
    async restoreOriginalFiles(result) {
        const restoredFiles = [];
        
        for (const fileData of result.originalFiles) {
            try {
                const file = await this.base64ToFile(fileData.data, fileData.name, fileData.type);
                
                // Restore TIFF metadata if present
                if (fileData.originalTiffName) {
                    file.originalTiffName = fileData.originalTiffName;
                    file.pageNumber = fileData.pageNumber;
                    file.totalPages = fileData.totalPages;
                }
                
                restoredFiles.push(file);
            } catch (error) {
                console.error('Error restoring file:', fileData.name, error);
            }
        }
        
        AppState.processedFiles = restoredFiles;
        AppState.originalFileList = [...restoredFiles];
    },
    
    /**
     * Restore cropped files from saved data
     */
    async restoreCroppedFiles(result) {
        AppState.croppedFiles.clear();
        
        if (result.croppedFiles) {
            for (const [indexStr, croppedData] of Object.entries(result.croppedFiles)) {
                try {
                    const index = parseInt(indexStr);
                    const croppedFile = await this.base64ToFile(
                        croppedData.data, 
                        croppedData.name, 
                        croppedData.type
                    );
                    
                    AppState.croppedFiles.set(index, croppedFile);
                } catch (error) {
                    console.error('Error restoring cropped file:', error);
                }
            }
        }
    },
    
    /**
     * Restore file order from saved data
     */
    async restoreFileOrder(result) {
        if (result.fileOrder && result.fileOrder.length > 0) {
            // The files are already in the correct order from restoreOriginalFiles
            // Just verify the order matches
            console.log('📋 File order restored:', result.fileOrder.map(f => f.filename));
        }
    },
    
    /**
     * Convert base64 data back to File object
     */
    async base64ToFile(base64Data, filename, mimeType) {
        // Remove data URL prefix if present
        const base64 = base64Data.replace(/^data:.*,/, '');
        
        // Convert base64 to blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        // Create File object from blob
        return new File([blob], filename, { type: mimeType });
    },
    
    /**
     * Update file info display from restored result
     */
    updateFileInfoFromRestored(result) {
        const fileInfo = document.getElementById('fileInfo');
        const fileCount = document.getElementById('fileCount');
        
        if (fileInfo && fileCount) {
            fileInfo.style.display = 'block';
            
            const count = result.fileCount || AppState.processedFiles.length;
            fileCount.textContent = `${count} file${count > 1 ? 's' : ''} restored from history`;
            
            // Show remove all button
            const removeBtn = fileInfo.querySelector('.remove-all-btn');
            if (removeBtn) {
                removeBtn.style.display = 'inline-flex';
            }
        }
    },
    
    /**
     * Show notification that session was restored
     */
    showRestoreNotification(result) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #28a745, #20c997);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 2000;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;
        notification.innerHTML = `
            ✅ Session restored: "${result.label}"<br>
            <small>You can now modify and rerun processing</small>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
        
        // Add CSS animations if not already present
        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    },
    
    async loadResultsList() {
        try {
            const response = await fetch('/api/results');
            if (response.ok) {
                const results = await response.json();
                this.allResults = results; // Store all results for search
                this.displayResultsList(results);
            }
        } catch (error) {
            console.error('Error loading results list:', error);
        }
    },
    
    displayResultsList(results, searchTerm = '') {
        // Remove existing results list if any
        const existingList = document.getElementById('resultsList');
        if (existingList) {
            existingList.remove();
        }
        
        if (!this.allResults || this.allResults.length === 0) return;
        
        // Filter results based on search term
        const filteredResults = searchTerm ? this.filterResults(this.allResults, searchTerm) : results;
        
        const listSection = document.createElement('div');
        listSection.id = 'resultsList';
        listSection.className = 'results-list';
        
        const searchResultsText = searchTerm ? 
            `<small class="search-results-count">${filteredResults.length} of ${this.allResults.length} results</small>` : '';
        
        listSection.innerHTML = `
            <div class="results-header">
                <h3>📚 Saved Results</h3>
                <div class="search-container">
                    <div class="search-input-group">
                        <input type="text" 
                               id="resultsSearch" 
                               class="search-input" 
                               placeholder="🔍 Search results..." 
                               value="${searchTerm}"
                               autocomplete="off">
                        <button class="search-clear-btn" 
                                id="searchClearBtn" 
                                onclick="ResultManager.clearSearch()"
                                title="Clear search"
                                style="display: ${searchTerm ? 'flex' : 'none'}">
                            ✕
                        </button>
                    </div>
                    ${searchResultsText}
                </div>
            </div>
            <div class="results-items" id="resultsItemsContainer">
                ${filteredResults.length > 0 ? filteredResults.map(result => `
                    <div class="result-item" data-id="${result.id}">
                        <div class="result-content" onclick="ResultManager.loadSavedResult('${result.id}')">
                            <div class="result-date">${formatTimestamp(result.timestamp)}</div>
                            <div class="result-label">
                                ${this.highlightSearchTerm(result.label || 'Untitled', searchTerm)}
                                ${result.isBatch ? ` (${result.imageCount} images)` : ''}
                            </div>
                        </div>
                        <div class="result-actions">
                            <button class="result-action-btn rename-btn" onclick="showRenameDialog('${result.id}', '${(result.label || 'Untitled').replace(/'/g, '&#39;')}')" title="Rename">
                                ✏️
                            </button>
                            <button class="result-action-btn delete-btn" onclick="showDeleteDialog('${result.id}')" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="no-results">
                        ${searchTerm ? `🔍 No results found for "${searchTerm}"` : '📄 No saved results yet'}
                    </div>
                `}
            </div>
        `;
        
        // Insert before upload section
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            uploadSection.parentNode.insertBefore(listSection, uploadSection);
        }
        
        // Setup search functionality
        this.setupSearch();
    },
    
    /**
     * Setup search input event listeners
     */
    setupSearch() {
        const searchInput = document.getElementById('resultsSearch');
        if (searchInput) {
            // Remove existing event listeners to avoid duplicates
            searchInput.removeEventListener('input', this.handleSearchInput);
            searchInput.removeEventListener('keydown', this.handleSearchKeydown);
            
            // Add debounced search
            searchInput.addEventListener('input', this.handleSearchInput.bind(this));
            searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
        }
    },
    
    /**
     * Handle search input with debouncing
     */
    handleSearchInput(e) {
        const searchTerm = e.target.value.trim();
        
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search to avoid too many updates
        this.searchTimeout = setTimeout(() => {
            this.performSearch(searchTerm);
        }, 300);
        
        // Update clear button visibility
        const clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) {
            clearBtn.style.display = searchTerm ? 'flex' : 'none';
        }
    },
    
    /**
     * Handle search input keyboard events
     */
    handleSearchKeydown(e) {
        if (e.key === 'Escape') {
            this.clearSearch();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const searchTerm = e.target.value.trim();
            this.performSearch(searchTerm);
        }
    },
    
    /**
     * Perform search and update display
     */
    performSearch(searchTerm) {
        console.log('Searching for:', searchTerm);
        this.displayResultsList(this.allResults, searchTerm);
    },
    
    /**
     * Clear search and show all results
     */
    clearSearch() {
        const searchInput = document.getElementById('resultsSearch');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        this.displayResultsList(this.allResults, '');
    },
    
    /**
     * Filter results based on search term
     */
    filterResults(results, searchTerm) {
        if (!searchTerm) return results;
        
        const term = searchTerm.toLowerCase();
        
        return results.filter(result => {
            // Search in label
            const label = (result.label || 'untitled').toLowerCase();
            if (label.includes(term)) return true;
            
            // Search in formatted date
            const dateStr = formatTimestamp(result.timestamp).toLowerCase();
            if (dateStr.includes(term)) return true;
            
            // Search in full date
            const fullDate = new Date(result.timestamp).toLocaleDateString().toLowerCase();
            if (fullDate.includes(term)) return true;
            
            // Search by image count
            if (term.includes('image')) {
                const imageCountStr = `${result.imageCount} image${result.imageCount > 1 ? 's' : ''}`;
                if (imageCountStr.toLowerCase().includes(term)) return true;
            }
            
            // Search by batch type
            if (result.isBatch && (term.includes('batch') || term.includes('multiple'))) return true;
            if (!result.isBatch && (term.includes('single') || term.includes('one'))) return true;
            
            return false;
        });
    },
    
    /**
     * Highlight search term in text
     */
    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) return text;
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    },
    
    async deleteResult(resultId) {
        try {
            console.log('Making DELETE request to:', `/api/result/${resultId}`);
            const response = await fetch(`/api/result/${resultId}`, {
                method: 'DELETE'
            });
            
            console.log('Delete response status:', response.status);
            console.log('Delete response headers:', response.headers);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Delete successful:', result);
                
                // Refresh results list
                this.loadResultsList();
                
                // If this was the currently displayed result, clear the display
                if (AppState.currentResultId === resultId) {
                    AppState.currentResultId = null;
                    document.getElementById('results').style.display = 'none';
                }
                
                showSuccess('Result deleted successfully!');
            } else {
                const errorText = await response.text();
                console.error('Delete failed. Status:', response.status, 'Response:', errorText);
                
                let errorMessage = 'Failed to delete result';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = `Server error (${response.status}): ${errorText}`;
                }
                
                showError(errorMessage);
            }
        } catch (error) {
            console.error('Error deleting result:', error);
            showError('Error deleting result: ' + error.message);
        }
    },
    
    async renameResult(resultId, newLabel) {
        try {
            console.log('Making PUT request to:', `/api/result/${resultId}/rename`);
            console.log('Request body:', { newLabel });
            
            const response = await fetch(`/api/result/${resultId}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newLabel })
            });
            
            console.log('Rename response status:', response.status);
            console.log('Rename response headers:', response.headers);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Rename successful:', result);
                
                // Refresh results list
                this.loadResultsList();
                
                // Show success message
                showSuccess('Result renamed successfully!');
            } else {
                const errorText = await response.text();
                console.error('Rename failed. Status:', response.status, 'Response:', errorText);
                
                let errorMessage = 'Failed to rename result';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = `Server error (${response.status}): ${errorText}`;
                }
                
                showError(errorMessage);
            }
        } catch (error) {
            console.error('Error renaming result:', error);
            showError('Error renaming result: ' + error.message);
        }
    }
};

const DisplayManager = {
    showBatchResults(imageFiles, combinedCsv, results) {
        // Update section title
        const title = document.getElementById('imagesSectionTitle');
        title.textContent = `📷 Uploaded Images (${imageFiles.length})`;
        
        // Display images in gallery
        const galleryContainer = document.getElementById('imageGallery');
        galleryContainer.innerHTML = '';
        galleryContainer.className = imageFiles.length > 1 ? 'multiple-images' : '';
        
        // Store images for viewer
        this.currentImages = [];
        
        Array.from(imageFiles).forEach((file, index) => {
            // Use cropped version if available, otherwise use original
            const fileToDisplay = AppState.croppedFiles.has(index) ? AppState.croppedFiles.get(index) : file;
            const imageUrl = URL.createObjectURL(fileToDisplay);
            const result = results[index];
            
            // Store image data for viewer
            this.currentImages.push({
                url: imageUrl,
                name: file.name,
                isCropped: AppState.croppedFiles.has(index)
            });
            
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            
            // Add a visual indicator if the image was cropped
            const croppedIndicator = AppState.croppedFiles.has(index) ? 
                '<span class="cropped-indicator" title="This image was cropped">✂️ Cropped</span>' : '';
            
            imageItem.innerHTML = `
                <button class="open-tab-button-result" onclick="openInNewTab('${imageUrl}')" title="Open in new tab">
                    🔗 Open
                </button>
                <img src="${imageUrl}" alt="${file.name}" onclick="openImageViewer(${index})">
                <div class="image-label">
                    ${file.name} 
                    ${result && result.success ? '✅' : '❌'}
                    ${croppedIndicator}
                </div>
            `;
            
            galleryContainer.appendChild(imageItem);
        });
        
        // Ensure gallery is visible and expanded view is hidden
        this.showGalleryView();
        
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
        const galleryContainer = document.getElementById('imageGallery');
        const title = document.getElementById('imagesSectionTitle');
        
        // Store images for viewer
        this.currentImages = [];
        
        if (isBatch && Array.isArray(imageData)) {
            title.textContent = `📷 Uploaded Images (${imageData.length})`;
            
            // Add class for multiple images horizontal layout
            galleryContainer.className = imageData.length > 1 ? 'multiple-images' : '';
            
            galleryContainer.innerHTML = imageData.map((imgData, index) => {
                // Store image data for viewer
                this.currentImages.push({
                    url: imgData,
                    name: `Image ${index + 1}`,
                    isCropped: false
                });
                
                return `
                    <div class="image-item">
                        <button class="open-tab-button-result" onclick="openInNewTab('${imgData}')" title="Open in new tab">
                            🔗 Open
                        </button>
                        <img src="${imgData}" alt="Uploaded image ${index + 1}" 
                             onclick="openImageViewer(${index})" />
                        <div class="image-label">Image ${index + 1}</div>
                    </div>
                `;
            }).join('');
        } else {
            title.textContent = '📷 Uploaded Image';
            galleryContainer.className = ''; // Single image, no special class
            
            // Store single image for viewer
            this.currentImages.push({
                url: imageData,
                name: 'Uploaded Image',
                isCropped: false
            });
            
            galleryContainer.innerHTML = `
                <div class="image-item">
                    <button class="open-tab-button-result" onclick="openInNewTab('${imageData}')" title="Open in new tab">
                        🔗 Open
                    </button>
                    <img src="${imageData}" alt="Uploaded image" 
                         onclick="openImageViewer(0)" />
                    <div class="image-label">Uploaded Image</div>
                </div>
            `;
        }
        
        // Ensure gallery is visible
        this.showGalleryView();
    },
    
    showGalleryView() {
        const galleryView = document.getElementById('imageGalleryView');
        const expandedView = document.getElementById('imageExpandedView');
        
        galleryView.classList.remove('hidden');
        expandedView.classList.remove('show');
    },
    
    showExpandedView() {
        const galleryView = document.getElementById('imageGalleryView');
        const expandedView = document.getElementById('imageExpandedView');
        
        galleryView.classList.add('hidden');
        expandedView.classList.add('show');
    },
    
    displayCSVTable(csvContent) {
        // Legacy function - now redirects to enhanced table editor
        displayCSVTableWithValidation(csvContent);
    },

    // Current images for the viewer
    currentImages: [],
    currentImageIndex: 0
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
            previewItem.draggable = true;
            previewItem.dataset.fileIndex = i;
            
            // Add special styling for TIFF pages
            if (file.originalTiffName) {
                previewItem.classList.add('tiff-page-item');
            }
            
            previewItem.innerHTML = `
                <div class="drag-handle" title="Drag to reorder">
                    <span class="order-number">${i + 1}</span>
                    <span class="drag-icon">⋮⋮</span>
                </div>
                <button class="remove-button" onclick="removeImageFromPreview(${i})" title="Remove this image">
                    ❌
                </button>
                <button class="crop-button" onclick="openCropModal(${i})">
                    ✂️ Crop
                </button>
                <button class="open-tab-button" onclick="openInNewTab('${imageUrl}')" title="Open in new tab">
                    🔗 Open
                </button>
                ${file.originalTiffName ? '<div class="tiff-page-badge">📄 TIFF Page</div>' : ''}
                <img src="${imageUrl}" alt="${displayLabel}" class="preview-image" data-src="${imageUrl}">
                <div class="preview-label">${displayLabel}</div>
            `;
            
            // Add drag and drop event listeners
            this.addDragAndDropListeners(previewItem, i);
            
            // Add double-click event listener to open image in new tab
            previewItem.addEventListener('dblclick', function() {
                openInNewTab(imageUrl);
            });
            
            previewContainer.appendChild(previewItem);
        }
    },

    /**
     * Add drag and drop event listeners to preview item
     * @param {HTMLElement} previewItem - Preview item element
     * @param {number} index - File index
     */
    addDragAndDropListeners(previewItem, index) {
        previewItem.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', index);
            e.dataTransfer.effectAllowed = 'move';
            this.classList.add('dragging');
            
            // Create drag image with order number
            const dragImage = this.cloneNode(true);
            dragImage.style.transform = 'rotate(5deg)';
            dragImage.style.opacity = '0.8';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 50, 50);
            setTimeout(() => document.body.removeChild(dragImage), 0);
        });
        
        previewItem.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            // Remove all drop indicators
            document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        
        previewItem.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Add visual indicator
            this.classList.add('drag-over');
            
            // Show drop indicator
            const rect = this.getBoundingClientRect();
            const mouseX = e.clientX;
            const centerX = rect.left + rect.width / 2;
            
            // Remove existing drop indicators
            document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
            
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.style.cssText = `
                position: absolute;
                top: 0;
                bottom: 0;
                width: 3px;
                background: #007bff;
                z-index: 1000;
                pointer-events: none;
            `;
            
            if (mouseX < centerX) {
                // Drop before this item
                indicator.style.left = '0px';
                this.style.position = 'relative';
                this.appendChild(indicator);
            } else {
                // Drop after this item
                indicator.style.right = '0px';
                this.style.position = 'relative';
                this.appendChild(indicator);
            }
        });
        
        previewItem.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over');
        });
        
        previewItem.addEventListener('drop', function(e) {
            e.preventDefault();
            const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = parseInt(this.dataset.fileIndex);
            
            if (sourceIndex !== targetIndex) {
                const rect = this.getBoundingClientRect();
                const mouseX = e.clientX;
                const centerX = rect.left + rect.width / 2;
                
                let newIndex;
                if (mouseX < centerX) {
                    // Drop before this item
                    newIndex = targetIndex;
                } else {
                    // Drop after this item
                    newIndex = targetIndex + 1;
                }
                
                // Adjust for source position
                if (sourceIndex < newIndex) {
                    newIndex--;
                }
                
                ImagePreview.reorderFiles(sourceIndex, newIndex);
            }
            
            // Cleanup
            this.classList.remove('drag-over');
            document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        });
    },

    /**
     * Reorder files in the array and update UI
     * @param {number} fromIndex - Source index
     * @param {number} toIndex - Target index
     */
    reorderFiles(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        console.log(`📋 Reordering: moving file from position ${fromIndex + 1} to position ${toIndex + 1}`);
        
        // Update the files array
        const fileToMove = AppState.processedFiles.splice(fromIndex, 1)[0];
        AppState.processedFiles.splice(toIndex, 0, fileToMove);
        
        // Update cropped files map
        const newCroppedFiles = new Map();
        AppState.croppedFiles.forEach((croppedFile, index) => {
            let newIndex = index;
            
            if (index === fromIndex) {
                // This is the moved file
                newIndex = toIndex;
            } else if (fromIndex < toIndex) {
                // Moving forward: shift indices between fromIndex and toIndex back
                if (index > fromIndex && index <= toIndex) {
                    newIndex = index - 1;
                }
            } else {
                // Moving backward: shift indices between toIndex and fromIndex forward
                if (index >= toIndex && index < fromIndex) {
                    newIndex = index + 1;
                }
            }
            
            newCroppedFiles.set(newIndex, croppedFile);
        });
        AppState.croppedFiles = newCroppedFiles;
        
        // Refresh the preview with new order
        this.createImagePreviewsForSelection(AppState.processedFiles);
        
        // Update result label
        updateResultLabel();
        
        console.log(`✅ Files reordered successfully. New order affects CSV processing.`);
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

/**
 * Image Viewer Functions
 */

/**
 * Open the image viewer in expanded view
 * @param {number} imageIndex - Index of the image to display
 */
function openImageViewer(imageIndex) {
    if (!DisplayManager.currentImages || DisplayManager.currentImages.length === 0) {
        console.error('No images available for viewing');
        return;
    }

    DisplayManager.currentImageIndex = imageIndex;
    const expandedView = document.getElementById('imageExpandedView');
    const image = document.getElementById('expandedImage');
    const title = document.getElementById('expandedImageTitle');
    const info = document.getElementById('expandedImageInfo');
    const counter = document.getElementById('expandedCounter');
    const navigation = document.getElementById('expandedNavigation');
    const prevBtn = document.getElementById('expandedPrevBtn');
    const nextBtn = document.getElementById('expandedNextBtn');
    
    // Set current image
    const currentImage = DisplayManager.currentImages[imageIndex];
    image.src = currentImage.url;
    image.alt = currentImage.name;
    
    // Update title and info
    const croppedText = currentImage.isCropped ? ' (Cropped)' : '';
    title.textContent = currentImage.name;
    info.textContent = `${imageIndex + 1} / ${DisplayManager.currentImages.length}${croppedText}`;
    
    // Update counter and navigation
    const totalImages = DisplayManager.currentImages.length;
    counter.textContent = `${imageIndex + 1} / ${totalImages}`;
    
    // Show/hide navigation based on number of images
    if (totalImages > 1) {
        navigation.style.display = 'flex';
        prevBtn.disabled = imageIndex === 0;
        nextBtn.disabled = imageIndex === totalImages - 1;
    } else {
        navigation.style.display = 'none';
    }
    
    // Show expanded view
    DisplayManager.showExpandedView();
    
    // Add keyboard event listener
    document.addEventListener('keydown', handleImageViewerKeydown);
}

/**
 * Close the image viewer and return to gallery
 */
function closeImageViewer() {
    // Show gallery view
    DisplayManager.showGalleryView();
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleImageViewerKeydown);
}

/**
 * Navigate to previous image
 */
function previousImage() {
    if (DisplayManager.currentImageIndex > 0) {
        openImageViewer(DisplayManager.currentImageIndex - 1);
    }
}

/**
 * Navigate to next image
 */
function nextImage() {
    if (DisplayManager.currentImageIndex < DisplayManager.currentImages.length - 1) {
        openImageViewer(DisplayManager.currentImageIndex + 1);
    }
}

/**
 * Handle keyboard events in image viewer
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleImageViewerKeydown(e) {
    // Only handle keyboard events when expanded view is visible
    const expandedView = document.getElementById('imageExpandedView');
    if (!expandedView.classList.contains('show')) {
        return;
    }
    
    switch(e.key) {
        case 'Escape':
            e.preventDefault();
            closeImageViewer();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            previousImage();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextImage();
            break;
    }
}

// Make image viewer functions globally available
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
window.previousImage = previousImage;
window.nextImage = nextImage;

/**
 * Password Protection Functions
 */

// Global variables for password operations
let pendingOperation = null;
let pendingOperationData = null;

/**
 * Show delete confirmation dialog with password protection
 * @param {string} resultId - ID of the result to delete
 */
function showDeleteDialog(resultId) {
    pendingOperation = 'delete';
    pendingOperationData = { resultId };
    
    document.getElementById('passwordModalTitle').textContent = '🗑️ Delete Result';
    document.getElementById('passwordModalMessage').textContent = 'Enter the admin password to delete this result:';
    
    showPasswordModal();
}

/**
 * Show rename dialog with password protection
 * @param {string} resultId - ID of the result to rename
 * @param {string} currentLabel - Current label of the result
 */
function showRenameDialog(resultId, currentLabel) {
    pendingOperation = 'rename';
    pendingOperationData = { resultId, currentLabel };
    
    document.getElementById('passwordModalTitle').textContent = '✏️ Rename Result';
    document.getElementById('passwordModalMessage').textContent = 'Enter the admin password to rename this result:';
    
    showPasswordModal();
}

/**
 * Show password modal
 */
function showPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    const passwordError = document.getElementById('passwordError');
    
    // Clear previous input and errors
    passwordInput.value = '';
    passwordError.style.display = 'none';
    
    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
        passwordInput.focus();
    }, 10);
    
    // Add Enter key listener
    passwordInput.addEventListener('keydown', handlePasswordEnterKey);
}

/**
 * Close password modal
 */
function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Remove Enter key listener
    passwordInput.removeEventListener('keydown', handlePasswordEnterKey);
    
    // Clear pending operation
    pendingOperation = null;
    pendingOperationData = null;
}

/**
 * Handle Enter key in password input
 * @param {KeyboardEvent} e - Keyboard event
 */
function handlePasswordEnterKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitPassword();
    }
}

/**
 * Submit password and execute pending operation
 */
function submitPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const passwordError = document.getElementById('passwordError');
    const password = passwordInput.value;
    
    console.log('Password submitted:', password === 'geomage' ? 'CORRECT' : 'INCORRECT');
    console.log('Pending operation:', pendingOperation);
    console.log('Pending operation data:', pendingOperationData);
    
    // Check password
    if (password === 'geomage') {
        // Store the pending operation data before closing modal
        const operationToExecute = pendingOperation;
        const operationData = pendingOperationData;
        
        // Password correct, close modal and execute operation
        closePasswordModal();
        
        // Execute operation immediately after modal closes with stored data
        setTimeout(() => {
            executeStoredOperation(operationToExecute, operationData);
        }, 50);
    } else {
        // Password incorrect, show error
        passwordError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
        
        // Shake animation for error
        passwordInput.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            passwordInput.style.animation = '';
        }, 500);
    }
}

/**
 * Execute stored operation with provided data
 */
function executeStoredOperation(operation, operationData) {
    console.log('Executing stored operation:', operation, operationData);
    
    if (!operation || !operationData) {
        console.error('No operation or data available');
        return;
    }
    
    try {
        switch (operation) {
            case 'delete':
                console.log('Executing delete for:', operationData.resultId);
                executeDelete(operationData.resultId);
                break;
            case 'rename':
                console.log('Executing rename for:', operationData.resultId);
                executeRename(operationData.resultId, operationData.currentLabel);
                break;
            default:
                console.error('Unknown operation:', operation);
        }
    } catch (error) {
        console.error('Error executing operation:', error);
        showError('Failed to execute operation: ' + error.message);
    }
}

/**
 * Execute the pending operation after password verification
 */
function executePendingOperation() {
    console.log('Executing pending operation:', pendingOperation, pendingOperationData);
    
    if (!pendingOperation || !pendingOperationData) {
        console.error('No pending operation or data available');
        return;
    }
    
    try {
        switch (pendingOperation) {
            case 'delete':
                console.log('Executing delete for:', pendingOperationData.resultId);
                executeDelete(pendingOperationData.resultId);
                break;
            case 'rename':
                console.log('Executing rename for:', pendingOperationData.resultId);
                executeRename(pendingOperationData.resultId, pendingOperationData.currentLabel);
                break;
            default:
                console.error('Unknown pending operation:', pendingOperation);
        }
    } catch (error) {
        console.error('Error executing pending operation:', error);
        showError('Failed to execute operation: ' + error.message);
    }
    
    // Clear pending operation
    pendingOperation = null;
    pendingOperationData = null;
}

/**
 * Execute delete operation
 * @param {string} resultId - ID of the result to delete
 */
function executeDelete(resultId) {
    console.log('Delete function called for result:', resultId);
    
    if (confirm('Are you sure you want to delete this result? This action cannot be undone.')) {
        console.log('User confirmed deletion, calling ResultManager.deleteResult');
        try {
            ResultManager.deleteResult(resultId);
        } catch (error) {
            console.error('Error in deleteResult:', error);
            showError('Failed to delete result: ' + error.message);
        }
    } else {
        console.log('User cancelled deletion');
    }
}

/**
 * Execute rename operation
 * @param {string} resultId - ID of the result to rename
 * @param {string} currentLabel - Current label of the result
 */
function executeRename(resultId, currentLabel) {
    console.log('Rename function called for result:', resultId, 'current label:', currentLabel);
    
    // Decode HTML entities
    const decodedLabel = currentLabel.replace(/&#39;/g, "'");
    const newLabel = prompt('Enter new name for this result:', decodedLabel);
    
    console.log('User entered new label:', newLabel);
    
    if (newLabel !== null && newLabel.trim() !== '') {
        if (newLabel.trim() !== decodedLabel) {
            console.log('Label changed, calling ResultManager.renameResult');
            try {
                ResultManager.renameResult(resultId, newLabel.trim());
            } catch (error) {
                console.error('Error in renameResult:', error);
                showError('Failed to rename result: ' + error.message);
            }
        } else {
            console.log('Label unchanged, no action needed');
        }
    } else {
        console.log('User cancelled or entered empty label');
    }
}

// Make password functions globally available
window.showDeleteDialog = showDeleteDialog;
window.showRenameDialog = showRenameDialog;
window.closePasswordModal = closePasswordModal;
window.submitPassword = submitPassword; 