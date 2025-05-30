/**
 * Event Handlers Module
 * Handles all event listeners and form processing
 */

const EventHandlers = {
    /**
     * Setup all event listeners for the application
     */
    setupEventListeners() {
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
            uploadForm.addEventListener('submit', this.handleFormSubmission);
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
    },

    /**
     * Handle form submission for image processing
     * @param {Event} e - Form submission event
     */
    async handleFormSubmission(e) {
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
            showError('Please select or paste at least one image to process');
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
};

// Export for use in other modules
window.EventHandlers = EventHandlers; 