const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configuration and utilities
const CONFIG = require('./src/config/constants');
const { createDirectories } = require('./src/utils/fileUtils');
const resultService = require('./src/services/resultService');
const errorHandler = require('./src/middleware/errorHandler');

// Import routes
const apiRoutes = require('./src/routes/api');
const staticRoutes = require('./src/routes/static');

const app = express();

// Initialize application
const initializeApp = async () => {
    // Create necessary directories
    await createDirectories();
    
    // Load existing results
    await resultService.loadResults();
    
    console.log('Application initialized successfully');
};

// Configure middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(CONFIG.PATHS.PUBLIC));

// Additional static file serving for common paths
app.use('/styles.css', express.static(path.join(CONFIG.PATHS.PUBLIC, 'styles.css')));
app.use('/script.js', express.static(path.join(CONFIG.PATHS.PUBLIC, 'script.js')));

// Mount routes
app.use('/api', apiRoutes);
app.use('/', staticRoutes);

// Error handling middleware (should be last)
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async () => {
    console.log('\nShutting down server...');
    await resultService.saveResults();
    process.exit(0);
};

// Start server
const startServer = async () => {
    try {
        await initializeApp();
        
        app.listen(CONFIG.PORT, () => {
            console.log(`Server running on http://localhost:${CONFIG.PORT}`);
            console.log(`Results will be saved to the '${CONFIG.DIRECTORIES.DATA}' directory`);
        });
        
        // Setup graceful shutdown
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer(); 