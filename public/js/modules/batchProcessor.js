/**
 * Batch Processor Module
 * Handles batch processing of images through OpenAI API
 */

const BatchProcessor = {
    async processImages(apiKey, imageFiles, textPrompt) {
        const results = [];
        const totalFiles = imageFiles.length;
        
        this.showBatchProgress();
        this.updateProgress(0, totalFiles, 'Starting batch processing...');
        
        // Create/update preview for all images (reuse existing if available)
        await this.createImagePreviews(imageFiles);
        
        for (let i = 0; i < totalFiles; i++) {
            const file = imageFiles[i];
            this.updateImageStatus(i, 'processing');
            this.updateProgress(i, totalFiles, `Processing ${file.name}...`);
            
            try {
                // Convert image to base64 (uses cropped version if available)
                const base64Image = await fileToBase64(file, i);
                
                // Make API call to OpenAI
                const response = await fetch(CONFIG.API.OPENAI_URL, {
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
                
                this.updateImageStatus(i, 'complete');
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                results.push({
                    filename: file.name,
                    error: error.message,
                    success: false
                });
                
                this.updateImageStatus(i, 'error');
            }
            
            // Small delay between requests to avoid rate limiting
            if (i < totalFiles - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        this.updateProgress(totalFiles, totalFiles, 'Processing complete!');
        return results;
    },

    async createImagePreviews(imageFiles) {
        const previewContainer = document.getElementById('imagePreview');
        
        // Check if previews already exist from file selection
        const existingPreviews = previewContainer.querySelectorAll('.preview-item');
        
        if (existingPreviews.length === imageFiles.length) {
            // Previews already exist, just add processing status indicators
            existingPreviews.forEach((previewItem, i) => {
                // Check if status indicator already exists
                if (!previewItem.querySelector(`#status-${i}`)) {
                    const statusDiv = document.createElement('div');
                    statusDiv.className = 'processing-status status-pending';
                    statusDiv.id = `status-${i}`;
                    statusDiv.textContent = 'Pending';
                    previewItem.insertBefore(statusDiv, previewItem.firstChild);
                }
            });
            return;
        }
        
        // Create new previews if they don't exist
        previewContainer.innerHTML = '';
        
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const imageUrl = URL.createObjectURL(file);
            
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <div class="processing-status status-pending" id="status-${i}">Pending</div>
                <button class="crop-button" onclick="openCropModal(${i})">
                    ✂️ Crop
                </button>
                <button class="open-tab-button" onclick="openInNewTab('${imageUrl}')" title="Open in new tab">
                    🔗 Open
                </button>
                <img src="${imageUrl}" alt="${file.name}" class="preview-image" data-src="${imageUrl}">
                <div class="preview-label">${file.name}</div>
            `;
            
            // Add double-click event listener to open image in new tab
            previewItem.addEventListener('dblclick', function() {
                openInNewTab(imageUrl);
            });
            
            previewContainer.appendChild(previewItem);
        }
    },

    updateImageStatus(index, status) {
        const statusElement = document.getElementById(`status-${index}`);
        if (statusElement) {
            statusElement.className = `processing-status status-${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    },

    showBatchProgress() {
        const batchProgress = document.getElementById('batchProgress');
        batchProgress.style.display = 'block';
        
        // Show progress bar and text for processing
        const progressBar = batchProgress.querySelector('.progress-bar');
        const progressText = batchProgress.querySelector('.progress-text');
        if (progressBar) progressBar.style.display = 'block';
        if (progressText) progressText.style.display = 'block';
    },

    updateProgress(current, total, message) {
        const percentage = (current / total) * 100;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${message} (${current}/${total})`;
    }
};

// Export for use in other modules
window.BatchProcessor = BatchProcessor; 