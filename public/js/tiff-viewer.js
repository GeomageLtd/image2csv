/**
 * TIFF Viewer Module
 * Handles TIFF file loading, viewing, and navigation
 */

// Global state variables
let tiffData = null;
let tiffBuffer = null; // Store the ArrayBuffer for decoding
let currentPage = 0;
let totalPages = 0;
let currentZoom = 1;
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

/**
 * Initialize the TIFF viewer when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeTiffViewer();
});

/**
 * Initialize all event listeners and functionality
 */
function initializeTiffViewer() {
    console.log('🖼️ Initializing TIFF Viewer...');
    
    setupEventListeners();
    setupDragAndDrop();
    setupMouseControls();
    setupKeyboardShortcuts();
    
    console.log('✅ TIFF Viewer initialized successfully');
}

/**
 * Setup basic event listeners
 */
function setupEventListeners() {
    const tiffInput = document.getElementById('tiffInput');
    if (tiffInput) {
        tiffInput.addEventListener('change', handleFileSelect);
    }
}

/**
 * Setup drag and drop functionality
 */
function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.includes('tif')) {
            handleFile(files[0]);
        }
    });
}

/**
 * Setup mouse controls for the image container
 */
function setupMouseControls() {
    const imageContainer = document.getElementById('imageContainer');
    if (!imageContainer) return;

    // Scroll to zoom functionality
    imageContainer.addEventListener('wheel', handleWheelZoom);
    
    // Mouse drag functionality
    imageContainer.addEventListener('mousedown', handleMouseDown);
    imageContainer.addEventListener('mouseleave', handleMouseUp);
    imageContainer.addEventListener('mouseup', handleMouseUp);
    imageContainer.addEventListener('mousemove', handleMouseMove);
    
    // Prevent context menu on right click
    imageContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

/**
 * Handle wheel zoom functionality
 */
function handleWheelZoom(e) {
    e.preventDefault();
    
    // Get mouse position relative to the container
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get current scroll position and mouse position relative to the image
    const scrollX = e.currentTarget.scrollLeft + mouseX;
    const scrollY = e.currentTarget.scrollTop + mouseY;
    
    // Get current image dimensions
    const tiffImage = document.getElementById('tiffImage');
    const currentImageWidth = tiffImage.offsetWidth;
    const currentImageHeight = tiffImage.offsetHeight;
    
    // Calculate mouse position as percentage of current image
    const mouseXPercent = scrollX / currentImageWidth;
    const mouseYPercent = scrollY / currentImageHeight;
    
    const oldZoom = currentZoom;
    
    if (e.deltaY < 0) {
        // Scroll up - zoom in
        zoomIn();
    } else {
        // Scroll down - zoom out
        zoomOut();
    }
    
    // Adjust scroll position after zoom change
    if (currentZoom !== oldZoom) {
        setTimeout(() => {
            const newImageWidth = tiffImage.offsetWidth;
            const newImageHeight = tiffImage.offsetHeight;
            
            // Calculate new scroll position to keep mouse position fixed
            const newScrollX = (mouseXPercent * newImageWidth) - mouseX;
            const newScrollY = (mouseYPercent * newImageHeight) - mouseY;
            
            e.currentTarget.scrollLeft = Math.max(0, newScrollX);
            e.currentTarget.scrollTop = Math.max(0, newScrollY);
        }, 10); // Small delay to let the image resize
    }
}

/**
 * Handle mouse down for dragging
 */
function handleMouseDown(e) {
    // Always allow dragging regardless of zoom level
    isDragging = true;
    const container = e.currentTarget;
    startX = e.pageX - container.offsetLeft;
    startY = e.pageY - container.offsetTop;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
    container.style.cursor = 'grabbing';
    e.preventDefault(); // Prevent text selection
}

/**
 * Handle mouse up/leave for dragging
 */
function handleMouseUp() {
    isDragging = false;
    const imageContainer = document.getElementById('imageContainer');
    if (imageContainer) {
        imageContainer.style.cursor = 'grab';
    }
}

/**
 * Handle mouse move for dragging
 */
function handleMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const container = e.currentTarget;
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = (x - startX) * 2;
    const walkY = (y - startY) * 2;
    container.scrollLeft = scrollLeft - walkX;
    container.scrollTop = scrollTop - walkY;
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (!tiffData) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                previousPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextPage();
                break;
            case '+':
            case '=':
                e.preventDefault();
                zoomIn();
                break;
            case '-':
                e.preventDefault();
                zoomOut();
                break;
            case '0':
                e.preventDefault();
                resetZoom();
                break;
        }
    });
}

/**
 * Handle file selection from input
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

/**
 * Handle file processing (from input or drag-drop)
 */
function handleFile(file) {
    const fileInfo = document.getElementById('fileInfo');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const viewerSection = document.getElementById('viewerSection');
    const tiffImage = document.getElementById('tiffImage');

    // Show viewer section and loading state
    viewerSection.style.display = 'block';
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    tiffImage.style.display = 'none';

    // Update file info
    fileInfo.textContent = `File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

    // Read the file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            tiffBuffer = arrayBuffer; // Store for later use
            const ifds = UTIF.decode(arrayBuffer);
            
            if (ifds.length === 0) {
                throw new Error('No pages found in TIFF file');
            }

            // Store the raw TIFF data and page info without decoding all pages
            tiffData = ifds;
            totalPages = ifds.length;
            currentPage = 0;

            console.log(`📄 TIFF file loaded: ${totalPages} page${totalPages > 1 ? 's' : ''} found`);

            // Update UI and display first page
            updatePageInfo();
            
            // Use setTimeout to allow UI update before displaying first page
            setTimeout(() => {
                displayPage(0);
            }, 10);
            
        } catch (error) {
            console.error('Error processing TIFF:', error);
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = `Error: ${error.message}`;
        }
    };

    reader.onerror = function() {
        loadingMessage.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Failed to read file';
    };

    reader.readAsArrayBuffer(file);
}

/**
 * Display a specific page of the TIFF
 */
function displayPage(pageIndex) {
    if (!tiffData || pageIndex < 0 || pageIndex >= tiffData.length) {
        return;
    }

    // Show loading state for page switching
    const tiffImage = document.getElementById('tiffImage');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    tiffImage.style.display = 'none';
    errorMessage.style.display = 'none';
    loadingMessage.style.display = 'block';
    loadingMessage.innerHTML = '<div class="spinner"></div>Loading page...';

    // Use setTimeout to allow UI update before processing
    setTimeout(() => {
        try {
            const ifd = tiffData[pageIndex];
            
            // First decode the image data (this is necessary!)
            UTIF.decodeImage(tiffBuffer, ifd);
            
            // Use the same efficient approach as the main page
            const canvas = document.createElement('canvas');
            canvas.width = ifd.width;
            canvas.height = ifd.height;
            const ctx = canvas.getContext('2d');
            
            // Create ImageData and use UTIF's efficient conversion
            const imageData = ctx.createImageData(ifd.width, ifd.height);
            const rgba = UTIF.toRGBA8(ifd);
            imageData.data.set(rgba);
            ctx.putImageData(imageData, 0, 0);
            
            tiffImage.src = canvas.toDataURL();
            tiffImage.style.display = 'block';
            
            // Reset zoom to 1 and apply proper sizing
            currentZoom = 1;
            updateZoom();
            
            // Center the image in the container
            centerImage();
            
            currentPage = pageIndex;
            updatePageInfo();
            
            loadingMessage.style.display = 'none';
            
        } catch (error) {
            console.error('Error displaying page:', error);
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = `Error displaying page: ${error.message}`;
        }
    }, 10); // Small delay to allow UI update
}

/**
 * Update page information and navigation buttons
 */
function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    pageInfo.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage === totalPages - 1;
}

/**
 * Navigate to previous page
 */
function previousPage() {
    if (currentPage > 0) {
        displayPage(currentPage - 1);
    }
}

/**
 * Navigate to next page
 */
function nextPage() {
    if (currentPage < totalPages - 1) {
        displayPage(currentPage + 1);
    }
}

/**
 * Zoom in
 */
function zoomIn() {
    currentZoom = Math.min(currentZoom * 1.1, 10);
    updateZoom();
}

/**
 * Zoom out
 */
function zoomOut() {
    currentZoom = Math.max(currentZoom / 1.1, 0.1);
    updateZoom();
}

/**
 * Reset zoom to 100%
 */
function resetZoom() {
    currentZoom = 1;
    updateZoom();
    centerImage(); // Center the image when resetting zoom
}

/**
 * Update zoom level and image size
 */
function updateZoom() {
    const tiffImage = document.getElementById('tiffImage');
    const zoomLevel = document.getElementById('zoomLevel');
    
    if (tiffImage.src) {
        const container = document.getElementById('imageContainer');
        const containerWidth = container.clientWidth - 40; // Subtract padding
        
        // Calculate actual dimensions based on zoom
        const baseWidth = containerWidth;
        const actualWidth = baseWidth * currentZoom;
        
        // Use actual width/height instead of transform for proper scrolling
        tiffImage.style.width = `${actualWidth}px`;
        tiffImage.style.height = 'auto';
        tiffImage.style.transform = 'none'; // Remove transform
        
        // Center horizontally only at 100% zoom
        if (currentZoom === 1) {
            tiffImage.style.margin = '0 auto';
        } else {
            tiffImage.style.margin = '0';
        }
    }
    
    zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
}

/**
 * Center the image in the container
 */
function centerImage() {
    const container = document.getElementById('imageContainer');
    const image = document.getElementById('tiffImage');
    
    if (image.src) {
        setTimeout(() => {
            // Get container dimensions
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Get actual image dimensions (now using real width/height)
            const imageWidth = image.offsetWidth;
            const imageHeight = image.offsetHeight;
            
            // Calculate scroll position to center the image
            const scrollLeft = Math.max(0, (imageWidth - containerWidth) / 2);
            const scrollTop = Math.max(0, (imageHeight - containerHeight) / 2);
            
            // Apply scroll position
            container.scrollLeft = scrollLeft;
            container.scrollTop = scrollTop;
        }, 100); // Slightly longer delay for image resize
    }
}

// Make functions globally available for onclick handlers
window.previousPage = previousPage;
window.nextPage = nextPage;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.handleFileSelect = handleFileSelect; 