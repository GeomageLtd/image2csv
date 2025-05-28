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
});let csvData = '';
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
document.getElementById('imageFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Extract filename without extension as default label
        const filename = file.name;
        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
        document.getElementById('resultLabel').value = nameWithoutExt;
    }
});

// Main form submission handler
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value;
    const imageFile = document.getElementById('imageFile').files[0];
    const textPrompt = document.getElementById('textPrompt').value;
    const resultLabel = document.getElementById('resultLabel').value.trim();
    
    if (!apiKey || !imageFile || !textPrompt) {
        showError('Please fill in all fields');
        return;
    }
    
    // Use filename as fallback if no label provided
    const finalLabel = resultLabel || (imageFile.name.substring(0, imageFile.name.lastIndexOf('.')) || imageFile.name);
    
    setLoading(true);
    hideError();
    hideResults();
    
    try {
        // Convert image to base64
        const base64Image = await fileToBase64(imageFile);
        
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
        
        // Display results
        displayResults(imageFile, csvContent);
        
        // Save result to server
        await saveResultToServer(base64Image, csvContent, textPrompt, finalLabel);
        
    } catch (error) {
        showError('Error: ' + error.message);
    } finally {
        setLoading(false);
    }
});

/**
 * Save result to server
 * @param {string} imageData - Base64 image data
 * @param {string} csvContent - CSV content
 * @param {string} prompt - User prompt
 * @param {string} label - User-defined label
 */
async function saveResultToServer(imageData, csvContent, prompt, label) {
    try {
        const response = await fetch('/api/save-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageData: imageData,
                csvData: csvContent.replace(/```csv\n?/g, '').replace(/```\n?/g, '').trim(),
                prompt: prompt,
                label: label,
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            currentResultId = result.resultId;
            
            // Update URL with result ID
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('result', result.resultId);
            window.history.pushState({}, '', newUrl);
            
            // Show share options
            showShareOptions(result.resultId, result.shareUrl);
            
            // Refresh results list
            loadResultsList();
        }
    } catch (error) {
        console.error('Error saving result:', error);
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
 * Display saved results (similar to displayResults but for loaded data)
 * @param {string} imageData - Base64 image data
 * @param {string} csvContent - CSV content
 */
function displaySavedResults(imageData, csvContent) {
    // Display image
    const displayImage = document.getElementById('displayImage');
    displayImage.src = imageData;
    
    // Clean CSV content
    csvData = csvContent.trim();
    
    // Parse and display CSV
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
                    <div class="result-label">${result.label || 'Untitled'}</div>
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