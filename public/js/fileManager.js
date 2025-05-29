// File Management Module

/**
 * Check if TIFF library is loaded and working
 */
function checkTiffLibraryStatus() {
    try {
        if (typeof UTIF !== 'undefined') {
            console.log('✅ UTIF library loaded successfully');
            
            // Add a small indicator to the file input label
            const label = document.querySelector('label[for="imageFiles"]');
            if (label) {
                const status = createElement('small', {
                    style: 'color: #28a745; margin-left: 8px;'
                }, '✅ TIFF support enabled');
                label.appendChild(status);
            }
        } else {
            console.warn('⚠️ UTIF library not loaded - TIFF support disabled');
            
            // Show warning to user
            const label = document.querySelector('label[for="imageFiles"]');
            if (label) {
                const status = createElement('small', {
                    style: 'color: #dc3545; margin-left: 8px;'
                }, '⚠️ TIFF support unavailable');
                label.appendChild(status);
            }
        }
    } catch (error) {
        console.error('Error checking TIFF library status:', error);
    }
}

/**
 * Check if a file is a TIFF file
 * @param {File} file - File to check
 * @returns {boolean} True if TIFF file
 */
function isTiffFile(file) {
    const tiffExtensions = ['.tif', '.tiff'];
    const tiffMimeTypes = ['image/tiff', 'image/tif'];
    
    const hasValidExtension = tiffExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
    );
    const hasValidMimeType = tiffMimeTypes.includes(file.type.toLowerCase());
    
    return hasValidExtension || hasValidMimeType;
}

/**
 * Extract individual pages from a TIFF file
 * @param {File} tiffFile - TIFF file to process
 * @returns {Promise<File[]>} Array of individual page files
 */
async function extractTiffPages(tiffFile) {
    return new Promise((resolve, reject) => {
        if (typeof UTIF === 'undefined') {
            console.warn('UTIF library not available, returning original file');
            resolve([tiffFile]);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const buffer = e.target.result;
                const ifds = UTIF.decode(buffer);
                const extractedFiles = [];

                // If only one page, return original file
                if (ifds.length <= 1) {
                    resolve([tiffFile]);
                    return;
                }

                console.log(`📄 Found ${ifds.length} pages in TIFF file: ${tiffFile.name}`);

                for (let i = 0; i < ifds.length; i++) {
                    const ifd = ifds[i];
                    UTIF.decodeImage(buffer, ifd);
                    
                    // Create canvas and draw the image
                    const canvas = document.createElement('canvas');
                    canvas.width = ifd.width;
                    canvas.height = ifd.height;
                    const ctx = canvas.getContext('2d');
                    
                    // Create ImageData and put pixel data
                    const imageData = ctx.createImageData(ifd.width, ifd.height);
                    const rgba = UTIF.toRGBA8(ifd);
                    imageData.data.set(rgba);
                    ctx.putImageData(imageData, 0, 0);
                    
                    // Convert canvas to blob and create file
                    canvas.toBlob((blob) => {
                        const baseName = tiffFile.name.replace(/\.[^/.]+$/, '');
                        const newFileName = `${baseName}_page_${i + 1}.png`;
                        const newFile = new File([blob], newFileName, { type: 'image/png' });
                        newFile.originalTiffName = tiffFile.name;
                        newFile.pageNumber = i + 1;
                        newFile.totalPages = ifds.length;
                        
                        extractedFiles.push(newFile);
                        
                        // If this is the last page, resolve with all files
                        if (extractedFiles.length === ifds.length) {
                            console.log(`✅ Successfully extracted ${extractedFiles.length} pages from ${tiffFile.name}`);
                            resolve(extractedFiles);
                        }
                    }, 'image/png', 0.9);
                }
            } catch (error) {
                console.error('Error processing TIFF file:', error);
                // Fall back to original file if processing fails
                resolve([tiffFile]);
            }
        };

        reader.onerror = function(error) {
            console.error('Error reading TIFF file:', error);
            reject(error);
        };

        reader.readAsArrayBuffer(tiffFile);
    });
}

/**
 * Process files and extract TIFF pages if needed
 * @param {FileList} files - Original file list
 * @returns {Promise<File[]>} Processed files array
 */
async function processFilesWithTiff(files) {
    const processedFiles = [];
    const fileArray = Array.from(files);
    
    console.log(`🔄 Processing ${fileArray.length} files for TIFF extraction...`);
    
    for (const file of fileArray) {
        if (isTiffFile(file)) {
            console.log(`📋 Processing TIFF file: ${file.name}`);
            try {
                const extractedPages = await extractTiffPages(file);
                processedFiles.push(...extractedPages);
                
                if (extractedPages.length > 1) {
                    console.log(`📑 Extracted ${extractedPages.length} pages from ${file.name}`);
                }
            } catch (error) {
                console.error(`❌ Error processing TIFF file ${file.name}:`, error);
                // Add original file if extraction fails
                processedFiles.push(file);
            }
        } else {
            // Non-TIFF files are added as-is
            processedFiles.push(file);
        }
    }
    
    console.log(`✅ File processing complete. Total files: ${processedFiles.length}`);
    return processedFiles;
}

/**
 * Validate file type and size
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateFile(file) {
    const errors = [];
    
    // Check file size
    if (file.size > CONFIG.FILES.MAX_SIZE) {
        errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(CONFIG.FILES.MAX_SIZE)})`);
    }
    
    // Check file type
    const isValidType = CONFIG.FILES.ALLOWED_TYPES.some(type => 
        file.type === type || file.name.toLowerCase().endsWith(type.replace('image/', '.'))
    );
    
    if (!isValidType) {
        errors.push(`File type not supported. Supported types: ${CONFIG.FILES.ALLOWED_TYPES.join(', ')}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Handle file selection and processing
 * @param {FileList} files - Selected files
 */
async function handleFileSelection(files) {
    const fileInfo = document.getElementById('fileInfo');
    const fileCount = document.getElementById('fileCount');
    
    if (files.length > 0) {
        // Store original file list
        AppState.originalFileList = Array.from(files);
        
        // Validate files
        const invalidFiles = [];
        for (const file of files) {
            const validation = validateFile(file);
            if (!validation.isValid) {
                invalidFiles.push({ file, errors: validation.errors });
            }
        }
        
        if (invalidFiles.length > 0) {
            const errorMessage = invalidFiles.map(({ file, errors }) => 
                `${file.name}: ${errors.join(', ')}`
            ).join('\n');
            showError(`Invalid files:\n${errorMessage}`);
            return;
        }
        
        // Show loading for TIFF processing
        const loadingMsg = createElement('div', {
            id: 'tiffProcessing',
            style: 'margin-top: 8px; color: #667eea; font-size: 0.9em;'
        }, '⏳ Processing files...');
        fileInfo.appendChild(loadingMsg);
        fileInfo.style.display = 'block';
        
        try {
            // Process files and extract TIFF pages if needed
            AppState.processedFiles = await processFilesWithTiff(files);
            
            // Remove loading message
            const processingMsg = document.getElementById('tiffProcessing');
            if (processingMsg) {
                processingMsg.remove();
            }
            
            // Update file count to show processed files
            const originalCount = files.length;
            const processedCount = AppState.processedFiles.length;
            
            let countText = `${processedCount} file${processedCount > 1 ? 's' : ''} ready for processing`;
            if (processedCount > originalCount) {
                countText += ` (${processedCount - originalCount} extracted from TIFF)`;
            }
            fileCount.textContent = countText;
            
            // Generate default label and show previews
            updateResultLabel();
            ImagePreview.showForSelection(AppState.processedFiles);
            
        } catch (error) {
            console.error('Error processing files:', error);
            showError('Error processing files: ' + error.message);
            
            // Remove loading message
            const processingMsg = document.getElementById('tiffProcessing');
            if (processingMsg) {
                processingMsg.remove();
            }
            
            // Fall back to original files
            AppState.processedFiles = Array.from(files);
            fileCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
            updateResultLabel();
            ImagePreview.showForSelection(files);
        }
    } else {
        fileInfo.style.display = 'none';
        document.getElementById('resultLabel').value = '';
        
        // Clear processed files
        AppState.processedFiles = [];
        AppState.originalFileList = [];
        
        // Hide previews
        ImagePreview.hide();
    }
}

/**
 * Update result label based on selected files
 */
function updateResultLabel() {
    const firstFile = AppState.processedFiles[0] || AppState.originalFileList[0];
    if (!firstFile) return;
    
    let defaultLabel;
    const processedCount = AppState.processedFiles.length;
    const originalCount = AppState.originalFileList.length;
    
    if (processedCount === 1) {
        const nameWithoutExt = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        defaultLabel = nameWithoutExt;
    } else {
        const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        if (processedCount > originalCount) {
            // Include TIFF info in label
            defaultLabel = `${baseName} + ${processedCount - 1} more (inc. TIFF pages)`;
        } else {
            defaultLabel = `${baseName} + ${processedCount - 1} more`;
        }
    }
    
    document.getElementById('resultLabel').value = defaultLabel;
} 