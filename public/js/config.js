// Frontend configuration constants
const CONFIG = {
    API: {
        BASE_URL: '/api',
        ENDPOINTS: {
            SAVE_RESULT: '/api/save-result',
            GET_RESULT: '/api/result',
            GET_RESULTS: '/api/results',
            UPDATE_RESULT: '/api/update-result',
            DELETE_RESULT: '/api/result',
            HEALTH: '/api/health'
        },
        OPENAI_URL: 'https://api.openai.com/v1/chat/completions'
    },
    
    FILES: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        MAX_COUNT: 10,
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff']
    },
    
    UI: {
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 500,
        MAX_PREVIEW_SIZE: 400,
        CROP_CANVAS_SIZE: 800,
        PREVIEW_SIZE: 150,
        ZOOM_LEVELS: [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5]
    },
    
    CSV: {
        DEFAULT_DELIMITER: ',',
        MAX_ROWS_FOR_PREVIEW: 100,
        VALIDATION_THRESHOLD: 0.8
    }
};

// Global state variables
const AppState = {
    processedFiles: [],
    originalFileList: [],
    croppedFiles: new Map(), // Maps file index to cropped File object
    csvData: '',
    currentResultId: null,
    
    // Table editing state
    originalTableData: null,
    currentTableData: null,
    
    // UI state
    isLoading: false,
    validationIssues: [],
    lastError: null,
    selectedCell: null,
    cropSettings: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        isSelecting: false,
        selectionStart: null,
        selectionEnd: null
    }
};

window.CONFIG = CONFIG;
window.AppState = AppState; 