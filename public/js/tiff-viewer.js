/**
 * TIFF Viewer Module
 * Handles TIFF file loading, viewing, and navigation
 */

// Global state variables
let tiffData = null;
let tiffBuffer = null; // Store the ArrayBuffer for decoding
let pageCache = new Map(); // Cache for processed page data
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

    // Clear previous cache
    clearPageCache();

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

            // Store the raw TIFF data and page info
            tiffData = ifds;
            totalPages = ifds.length;
            currentPage = 0;

            console.log(`📄 TIFF file loaded: ${totalPages} page${totalPages > 1 ? 's' : ''} found`);

            // Update UI
            updatePageInfo();
            
            // Start caching all pages
            cacheAllPages();
            
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
 * Cache all pages with progress indication
 */
async function cacheAllPages() {
    const loadingMessage = document.getElementById('loadingMessage');
    const tiffImage = document.getElementById('tiffImage');
    const cachingStatus = document.getElementById('cachingStatus');
    const cachingProgressFill = document.getElementById('cachingProgressFill');
    const cachingText = document.getElementById('cachingText');
    
    try {
        // Show caching status
        cachingStatus.style.display = 'block';
        cachingProgressFill.style.width = '0%';
        cachingText.textContent = 'Starting to cache pages...';
        
        // Update initial loading message
        loadingMessage.innerHTML = '<div class="spinner"></div>Processing pages...';
        
        let processedCount = 0;
        let firstPageDisplayed = false;
        
        // Process pages one at a time to keep UI responsive
        for (let i = 0; i < totalPages; i++) {
            // Update caching status
            const progressPercent = Math.round((i / totalPages) * 100);
            cachingProgressFill.style.width = `${progressPercent}%`;
            cachingText.textContent = `Processing page ${i + 1} of ${totalPages}...`;
            
            // Give UI time to update
            await new Promise(resolve => setTimeout(resolve, 50));
            
            try {
                // Process single page
                await processAndCachePage(i);
                processedCount++;
                
                // Display first page as soon as it's ready
                if (i === 0 && !firstPageDisplayed) {
                    displayPage(0);
                    firstPageDisplayed = true;
                }
                
                // Update progress after successful processing
                const completedPercent = Math.round((processedCount / totalPages) * 100);
                cachingProgressFill.style.width = `${completedPercent}%`;
                cachingText.textContent = `Cached: ${processedCount} / ${totalPages} pages (${completedPercent}%)`;
                
                // Longer delay between pages to prevent freezing
                // Adjust this value if needed - higher = more responsive UI, slower caching
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.warn(`Failed to cache page ${i + 1}:`, error);
                // Continue with next page even if one fails
            }
        }
        
        // All pages cached - update status to complete
        cachingProgressFill.style.width = '100%';
        cachingText.textContent = `✅ All ${totalPages} pages cached successfully!`;
        
        // Hide loading message
        loadingMessage.style.display = 'none';
        
        // Show completion message briefly in file info
        const fileInfo = document.getElementById('fileInfo');
        const originalText = fileInfo.textContent;
        fileInfo.textContent = originalText + ' ✅ Ready';
        
        // Hide caching status after a delay
        setTimeout(() => {
            cachingStatus.style.display = 'none';
            fileInfo.textContent = originalText;
        }, 3000);
        
        console.log(`✅ All ${totalPages} pages cached successfully`);
        
    } catch (error) {
        console.error('Error caching pages:', error);
        loadingMessage.style.display = 'none';
        cachingStatus.style.display = 'none';
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.style.display = 'block';
        errorMessage.textContent = `Error caching pages: ${error.message}`;
    }
}

/**
 * Clear the page cache and release memory
 */
function clearPageCache() {
    // Revoke any existing blob URLs to free memory
    pageCache.forEach(cached => {
        if (cached.blobUrl) {
            URL.revokeObjectURL(cached.blobUrl);
        }
    });
    pageCache.clear();
}

/**
 * Process and cache a page
 */
function processAndCachePage(pageIndex) {
    if (pageCache.has(pageIndex)) {
        return pageCache.get(pageIndex);
    }

    const ifd = tiffData[pageIndex];
    
    // Decode the image data
    UTIF.decodeImage(tiffBuffer, ifd);
    
    // Create canvas and convert to blob URL for better performance
    const canvas = document.createElement('canvas');
    canvas.width = ifd.width;
    canvas.height = ifd.height;
    const ctx = canvas.getContext('2d');
    
    // Create ImageData and use UTIF's efficient conversion
    const imageData = ctx.createImageData(ifd.width, ifd.height);
    const rgba = UTIF.toRGBA8(ifd);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to blob URL (more efficient than data URL)
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            const cachedData = {
                blobUrl: blobUrl,
                width: ifd.width,
                height: ifd.height
            };
            pageCache.set(pageIndex, cachedData);
            resolve(cachedData);
        }, 'image/png', 0.95);
    });
}

/**
 * Display a specific page of the TIFF
 */
function displayPage(pageIndex) {
    if (!tiffData || pageIndex < 0 || pageIndex >= tiffData.length) {
        return;
    }

    const tiffImage = document.getElementById('tiffImage');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    // Check if page is already cached
    if (pageCache.has(pageIndex)) {
        // Page is cached - display immediately
        const cachedData = pageCache.get(pageIndex);
        tiffImage.src = cachedData.blobUrl;
        tiffImage.style.display = 'block';
        errorMessage.style.display = 'none';
        
        // Only hide loading message if we're not still caching other pages
        if (pageCache.size === totalPages) {
            loadingMessage.style.display = 'none';
        }
        
        // Maintain current zoom level and update display
        updateZoom();
        centerImage();
        
        currentPage = pageIndex;
        updatePageInfo();
        
        return;
    }

    // Page not cached yet - this should rarely happen with the new approach
    // but keep it as fallback
    tiffImage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    if (loadingMessage.style.display === 'none') {
        loadingMessage.style.display = 'block';
        loadingMessage.innerHTML = '<div class="spinner"></div>Loading page...';
    }

    // Process and cache the page
    processAndCachePage(pageIndex)
        .then(cachedData => {
            tiffImage.src = cachedData.blobUrl;
            tiffImage.style.display = 'block';
            
            // Maintain current zoom level and update display
            updateZoom();
            centerImage();
            
            currentPage = pageIndex;
            updatePageInfo();
            
            // Only hide loading if all pages are cached
            if (pageCache.size === totalPages) {
                loadingMessage.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error displaying page:', error);
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = `Error displaying page: ${error.message}`;
        });
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