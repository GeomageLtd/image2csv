/**
 * Image Preview Module
 * Handles image preview, reordering, and drag-and-drop functionality
 */

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

// Export for use in other modules
window.ImagePreview = ImagePreview; 