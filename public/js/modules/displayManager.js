/**
 * Display Manager Module
 * Handles UI display logic for results, images, and galleries
 */

const DisplayManager = {
    // Current images for the viewer
    currentImages: [],
    currentImageIndex: 0,

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
    }
};

/**
 * Start New Process - Clear all form data and reset UI
 */
function startNewProcess() {
    // Confirm if there's existing data
    const hasData = AppState.processedFiles.length > 0 || 
                   document.getElementById('apiKey').value.trim() ||
                   document.getElementById('textPrompt').value !== document.getElementById('textPrompt').defaultValue ||
                   document.getElementById('resultLabel').value.trim();
    
    if (hasData) {
        const confirmed = confirm(
            '🔄 Start New Process?\n\n' +
            'This will clear all current data including:\n' +
            '• Selected images\n' +
            '• Form fields\n' +
            '• Processing results\n' +
            '\nAre you sure you want to continue?'
        );
        
        if (!confirmed) {
            return;
        }
    }
    
    try {
        console.log('🔄 Starting new process - clearing all data...');
        
        // Clear AppState
        AppState.processedFiles = [];
        AppState.originalFileList = [];
        AppState.croppedFiles.clear();
        AppState.csvData = null;
        AppState.currentResultId = null;
        
        // Clear form fields
        document.getElementById('apiKey').value = '';
        document.getElementById('resultLabel').value = '';
        
        // Reset text prompt to default
        const textPrompt = document.getElementById('textPrompt');
        textPrompt.value = "I'll send to you screenshot with tables. This table contains only numerical values. Please parse it and show it as table. I don't need any other text, just the table. number of columns shouldn't be more than 10.";
        textPrompt.style.height = 'auto';
        textPrompt.style.height = textPrompt.scrollHeight + 'px';
        
        // Clear file input
        const fileInput = document.getElementById('imageFiles');
        fileInput.value = '';
        
        // Hide file info
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.style.display = 'none';
        
        // Hide and clear preview
        ImagePreview.hide();
        const previewContainer = document.getElementById('imagePreview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
        }
        
        // Hide batch progress
        const batchProgress = document.getElementById('batchProgress');
        if (batchProgress) {
            batchProgress.style.display = 'none';
        }
        
        // Hide results
        const results = document.getElementById('results');
        if (results) {
            results.style.display = 'none';
        }
        
        // Clear any displayed images
        const imageGallery = document.getElementById('imageGallery');
        if (imageGallery) {
            imageGallery.innerHTML = '';
        }
        
        // Clear CSV table
        const csvContainer = document.getElementById('csvTableContainer');
        if (csvContainer) {
            csvContainer.innerHTML = '';
        }
        
        // Hide any error messages
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        // Hide loading spinner
        setLoading(false);
        
        // Close any open modals
        if (typeof closeCropModal === 'function') {
            closeCropModal();
        }
        if (typeof closePasswordModal === 'function') {
            closePasswordModal();
        }
        if (typeof closeImageViewer === 'function') {
            closeImageViewer();
        }
        
        // Focus on API key input for new session
        setTimeout(() => {
            document.getElementById('apiKey').focus();
        }, 100);
        
        // Show success notification
        showNewProcessNotification();
        
        console.log('✅ New process started successfully');
        
    } catch (error) {
        console.error('Error starting new process:', error);
        showError('Failed to start new process: ' + error.message);
    }
}

/**
 * Show notification that new process was started
 */
function showNewProcessNotification() {
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
        ✨ New Process Started<br>
        <small>Ready for new image processing session</small>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
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
}

// Make startNewProcess globally available
window.startNewProcess = startNewProcess;

// Export for use in other modules
window.DisplayManager = DisplayManager; 