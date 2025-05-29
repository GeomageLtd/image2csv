// Crop Manager Module
// Handles image cropping functionality with zoom and pan

// Global crop variables
let currentCropFile = null;
let currentCropIndex = -1;
let cropCanvas = null;
let cropCtx = null;
let originalImage = null;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let imageDisplayWidth = 0;
let imageDisplayHeight = 0;
let imageOffsetX = 0;
let imageOffsetY = 0;

// Crop selection state
let cropSelection = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isSelecting: false
};

/**
 * Open crop modal for specific image
 * @param {number} imageIndex - Index of the image to crop
 */
function openCropModal(imageIndex) {
    // Use processed files if available, otherwise fall back to original files
    const filesToUse = AppState.processedFiles.length > 0 ? AppState.processedFiles : Array.from(document.getElementById('imageFiles').files);
    
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
 * Initialize crop canvas with fullscreen layout
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
    const fileToShow = AppState.croppedFiles.get(currentCropIndex) || currentCropFile;
    
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
    let startX = 0, startY = 0;
    let lastPanX = panX, lastPanY = panY;
    
    // Remove existing listeners to prevent duplicates
    container.removeEventListener('wheel', handleWheel);
    container.removeEventListener('mousedown', handleMouseDown);
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseup', handleMouseUp);
    
    // Mouse wheel for zoom
    function handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.1, Math.min(5, zoomLevel + delta));
        
        if (newZoom !== zoomLevel) {
            zoomLevel = newZoom;
            updateZoomDisplay();
            redrawCanvas();
        }
    }
    
    // Mouse down
    function handleMouseDown(e) {
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
            isMouseDown = true;
            startX = mouseX;
            startY = mouseY;
            lastPanX = panX;
            lastPanY = panY;
            container.style.cursor = 'grabbing';
        }
    }
    
    // Mouse move
    function handleMouseMove(e) {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (isSelecting) {
            // Update selection rectangle
            const canvasX = mouseX - imageOffsetX;
            const canvasY = mouseY - imageOffsetY;
            
            cropSelection.endX = canvasX;
            cropSelection.endY = canvasY;
            
            const left = Math.min(cropSelection.startX, cropSelection.endX) + imageOffsetX;
            const top = Math.min(cropSelection.startY, cropSelection.endY) + imageOffsetY;
            const width = Math.abs(cropSelection.endX - cropSelection.startX);
            const height = Math.abs(cropSelection.endY - cropSelection.startY);
            
            selection.style.left = left + 'px';
            selection.style.top = top + 'px';
            selection.style.width = width + 'px';
            selection.style.height = height + 'px';
            
            updateCropInfo(`Selection: ${Math.round(width)} x ${Math.round(height)} pixels`);
            
        } else if (isMouseDown) {
            // Pan image
            const deltaX = mouseX - startX;
            const deltaY = mouseY - startY;
            
            panX = lastPanX + deltaX;
            panY = lastPanY + deltaY;
            
            updateCanvasPosition();
        }
    }
    
    // Mouse up
    function handleMouseUp(e) {
        if (isSelecting) {
            isSelecting = false;
            container.style.cursor = 'default';
            updateCropInfo('Selection complete. Adjust if needed, then click "Apply Crop"');
        } else if (isMouseDown) {
            isMouseDown = false;
            container.style.cursor = 'default';
        }
    }
    
    // Add event listeners
    container.addEventListener('wheel', handleWheel);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
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
 * Apply crop to image
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
        AppState.croppedFiles.set(currentCropIndex, croppedFile);
        
        console.log('Cropped file stored:', {
            index: currentCropIndex,
            originalFileName: currentCropFile.name,
            croppedFileName: croppedFile.name,
            croppedFileSize: croppedFile.size,
            totalCroppedFiles: AppState.croppedFiles.size,
            allCroppedKeys: Array.from(AppState.croppedFiles.keys())
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

// Add CSS animations for success message
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

// Make functions globally available
window.openCropModal = openCropModal;
window.closeCropModal = closeCropModal;
window.resetCrop = resetCrop;
window.applyCrop = applyCrop;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom; 