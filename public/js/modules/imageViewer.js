/**
 * Image Viewer Module
 * Handles expanded image viewing functionality with navigation
 */

const ImageViewer = {
    /**
     * Open the image viewer in expanded view
     * @param {number} imageIndex - Index of the image to display
     */
    open(imageIndex) {
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
        document.addEventListener('keydown', this.handleKeydown);
    },

    /**
     * Close the image viewer and return to gallery
     */
    close() {
        // Show gallery view
        DisplayManager.showGalleryView();
        
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleKeydown);
    },

    /**
     * Navigate to previous image
     */
    previous() {
        if (DisplayManager.currentImageIndex > 0) {
            this.open(DisplayManager.currentImageIndex - 1);
        }
    },

    /**
     * Navigate to next image
     */
    next() {
        if (DisplayManager.currentImageIndex < DisplayManager.currentImages.length - 1) {
            this.open(DisplayManager.currentImageIndex + 1);
        }
    },

    /**
     * Handle keyboard events in image viewer
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeydown(e) {
        // Only handle keyboard events when expanded view is visible
        const expandedView = document.getElementById('imageExpandedView');
        if (!expandedView.classList.contains('show')) {
            return;
        }
        
        switch(e.key) {
            case 'Escape':
                e.preventDefault();
                ImageViewer.close();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                ImageViewer.previous();
                break;
            case 'ArrowRight':
                e.preventDefault();
                ImageViewer.next();
                break;
        }
    }
};

// Make image viewer functions globally available for onclick handlers
window.openImageViewer = function(imageIndex) {
    ImageViewer.open(imageIndex);
};

window.closeImageViewer = function() {
    ImageViewer.close();
};

window.previousImage = function() {
    ImageViewer.previous();
};

window.nextImage = function() {
    ImageViewer.next();
};

// Export for use in other modules
window.ImageViewer = ImageViewer; 