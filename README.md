# Refactoring Documentation

## Overview
This document describes the refactoring of the Image2CSV application from a monolithic structure to a modular, maintainable architecture.

## Before Refactoring
- **server.js**: 424 lines - Contains all server logic in one file
- **public/script.js**: 3,488 lines - Contains all frontend logic in one file
- **public/styles.css**: 1,715 lines - Large CSS file
- **public/result.html**: 484 lines - Large HTML file

## After Refactoring

### Backend Structure
```
src/
├── config/
│   └── constants.js         # Configuration constants
├── middleware/
│   ├── multerConfig.js      # File upload configuration
│   └── errorHandler.js      # Error handling middleware
├── routes/
│   ├── api.js               # API routes
│   └── static.js            # Static page routes
├── services/
│   └── resultService.js     # Business logic for results
└── utils/
    └── fileUtils.js         # File operation utilities

server.js                    # Main server file (refactored)
server-original.js           # Backup of original server
```

### Frontend Structure
```
public/
├── js/
│   ├── config.js           # Frontend configuration & state
│   ├── utils.js            # Common utility functions
│   ├── fileManager.js      # File handling & TIFF processing
│   └── main.js             # Main application entry point
├── script-original.js      # Backup of original script
├── index.html              # Updated to use modular scripts
└── ... (other files)
```

## Key Improvements

### 1. **Separation of Concerns**
- **Config**: All configuration values centralized
- **Utils**: Reusable utility functions
- **Services**: Business logic separated from routes
- **Middleware**: Cross-cutting concerns isolated

### 2. **Maintainability**
- Smaller, focused files (50-200 lines vs 400-3,400 lines)
- Clear module boundaries
- Easier to test individual components
- Reduced cognitive load when working on specific features

### 3. **Scalability**
- Easy to add new features without modifying core files
- Clear extension points for new functionality
- Modular imports allow for tree-shaking and better performance

### 4. **Error Handling**
- Centralized error handling middleware
- Consistent error responses
- Better error logging and debugging

## Migration Status

### ✅ Completed
- [x] Server-side refactoring (complete)
- [x] Backend module structure
- [x] File utilities and configuration
- [x] Basic frontend structure
- [x] File manager module

### 🚧 Partially Implemented
- [ ] Batch processor module (placeholder)
- [ ] CSV processor module (placeholder)
- [ ] Result manager module (partial)
- [ ] Display manager module (placeholder)
- [ ] Image preview module (placeholder)

### ❌ Not Yet Implemented
- [ ] Image cropping module
- [ ] CSV validation module
- [ ] Table editor module
- [ ] Share functionality module
- [ ] Complete frontend refactoring

## How to Complete the Refactoring

### 1. Implement Missing Frontend Modules

Create these additional modules based on the original `script.js`:

```javascript
// public/js/batchProcessor.js
// - processBatchImages function
// - API communication logic
// - Progress tracking

// public/js/csvProcessor.js
// - combineCSVResults function
// - CSV parsing and validation
// - Data transformation utilities

// public/js/displayManager.js
// - Result display functions
// - UI state management
// - Table rendering

// public/js/imagePreview.js
// - Image preview functionality
// - Batch preview management
// - File removal logic

// public/js/cropTool.js
// - Image cropping functionality
// - Canvas manipulation
// - Crop modal management

// public/js/csvEditor.js
// - Editable table functionality
// - Cell editing and validation
// - Data persistence
```

### 2. Extract Remaining Functions

The following functions from `script-original.js` need to be moved to appropriate modules:

- **API Functions**: `processBatchImages()` → `batchProcessor.js`
- **CSV Functions**: `combineCSVResults()`, `displayCSVTable()` → `csvProcessor.js`
- **Display Functions**: `displayBatchResults()`, `showImagePreviews()` → `displayManager.js`
- **Crop Functions**: `openCropModal()`, `applyCrop()` → `cropTool.js`
- **Validation Functions**: `validateTableData()` → `csvEditor.js`

### 3. Update HTML Files

Update `result.html` to use the modular structure as well.

## Benefits Achieved

1. **Code Maintainability**: Reduced file sizes by 80-90%
2. **Developer Experience**: Easier to find and modify specific functionality
3. **Testing**: Individual modules can be unit tested
4. **Performance**: Modular loading allows for lazy loading of features
5. **Collaboration**: Multiple developers can work on different modules without conflicts

## Usage Instructions

### Running the Refactored Application

1. The refactored server should work exactly like the original:
   ```bash
   node server.js
   ```

2. The frontend will load modules in order and provide fallback functions for missing features.

3. All existing functionality should continue to work while new modular structure is gradually implemented.

### Development Workflow

1. Work on one module at a time
2. Test each module independently
3. Gradually replace placeholder functions with actual implementations
4. Remove fallback code once modules are complete

## Next Steps

1. **Priority 1**: Implement `batchProcessor.js` and `csvProcessor.js` for core functionality
2. **Priority 2**: Complete `displayManager.js` and `imagePreview.js` for UI
3. **Priority 3**: Implement `cropTool.js` and `csvEditor.js` for advanced features
4. **Priority 4**: Refactor CSS and HTML files into smaller components

## Rollback Plan

If issues arise, you can easily rollback:

1. **Backend**: `mv server-original.js server.js`
2. **Frontend**: `mv public/script-original.js public/script.js` and revert `index.html`

The original files are preserved as backups. 