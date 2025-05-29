/**
 * Global error handling middleware
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (error, req, res, next) => {
    console.error('Server error:', error);
    
    // Handle specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
            error: 'File too large. Maximum size is 10MB.' 
        });
    }
    
    if (error.code === 'LIMIT_FIELD_SIZE') {
        return res.status(413).json({ 
            error: 'Request body too large. Maximum size is 50MB.' 
        });
    }
    
    // Default error response
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
};

module.exports = errorHandler; 