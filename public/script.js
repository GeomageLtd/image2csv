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
    } else {
        fileInfo.style.display = 'none';
        document.getElementById('resultLabel').value = '';
    }
});

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
        
        // Process multiple images
        const results = await processBatchImages(apiKey, imageFiles, textPrompt);
        
        // Combine all CSV results
        const combinedCsv = combineCSVResults(results);
        
        // Display results
        displayBatchResults(imageFiles, combinedCsv, results);
        
        // Save combined result to server
        const imageDataArray = await Promise.all(
            Array.from(imageFiles).map(file => fileToBase64(file))
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
 * Process multiple images in batch
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
    
    // Create preview for all images
    await createImagePreviews(imageFiles);
    
    for (let i = 0; i < totalFiles; i++) {
        const file = imageFiles[i];
        updateImageStatus(i, 'processing');
        updateProgress(i, totalFiles, `Processing ${file.name}...`);
        
        try {
            // Convert image to base64
            const base64Image = await fileToBase64(file);
            
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
 * Create image previews for batch processing
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
            <img src="${imageUrl}" alt="${file.name}" class="preview-image">
            <div class="preview-label">${file.name}</div>
        `;
        
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
 * Show batch progress UI
 */
function showBatchProgress() {
    document.getElementById('batchProgress').style.display = 'block';
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
    let headers = null;
    
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
            // Use first file's headers
            headers = csvRows[0];
            combinedRows.push(headers);
            
            // Add data rows from first file
            if (csvRows.length > 1) {
                combinedRows.push(...csvRows.slice(1));
            }
        } else {
            // For subsequent files, skip headers and add data rows
            if (csvRows.length > 1) {
                combinedRows.push(...csvRows.slice(1));
            }
        }
    });
    
    // Convert back to CSV format
    return combinedRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
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
    displayCSVTable(csvData);
    
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
    displayCSVTable(csvData);
    
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
    displayCSVTable(csvData);
    
    // Show results
    document.getElementById('results').style.display = 'block';
}

/**
 * Create and display CSV table
 * @param {string} csvContent - Raw CSV content
 */
function displayCSVTable(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;
    
    const table = document.createElement('table');
    table.className = 'csv-table';
    
    // Create header
    const headerRow = lines[0].split(',').map(cell => cell.trim().replace(/"/g, ''));
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    
    headerRow.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerTr.appendChild(th);
    });
    
    thead.appendChild(headerTr);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''));
        const tr = document.createElement('tr');
        
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    
    const container = document.getElementById('csvTableContainer');
    container.innerHTML = '';
    container.appendChild(table);
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
    displayCSVTable(csvData);
    
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
    displayCSVTable(csvData);
    
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