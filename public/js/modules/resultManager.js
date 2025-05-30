/**
 * Result Manager Module
 * Handles saving, loading, deleting, and managing processing results
 */

const ResultManager = {
    allResults: null, // Store all results for search

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

// Export for use in other modules
window.ResultManager = ResultManager; 