const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Additional static file serving for common paths
app.use('/styles.css', express.static(path.join(__dirname, 'public', 'styles.css')));
app.use('/script.js', express.static(path.join(__dirname, 'public', 'script.js')));

// Create directories if they don't exist
const createDirectories = async () => {
    try {
        await fs.mkdir('data', { recursive: true });
        await fs.mkdir('data/images', { recursive: true });
        await fs.mkdir('data/csv', { recursive: true });
        await fs.mkdir('public', { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
};

// Initialize directories
createDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data/images/');
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// In-memory storage for results (in production, use a database)
let resultsStorage = {};

// Load existing results on startup
const loadResults = async () => {
    try {
        const data = await fs.readFile('data/results.json', 'utf8');
        resultsStorage = JSON.parse(data);
        console.log('Loaded existing results from file');
    } catch (error) {
        console.log('No existing results file found, starting fresh');
        resultsStorage = {};
    }
};

// Save results to file
const saveResults = async () => {
    try {
        await fs.writeFile('data/results.json', JSON.stringify(resultsStorage, null, 2));
    } catch (error) {
        console.error('Error saving results:', error);
    }
};

// Load results on startup
loadResults();

// Routes

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Save processing result
app.post('/api/save-result', async (req, res) => {
    try {
        const { imageData, csvData, prompt, label, timestamp } = req.body;
        
        if (!imageData || !csvData) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        const resultId = uuidv4();
        
        // Save image data (base64)
        const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
        const imageExtension = imageData.split(';')[0].split('/')[1];
        const imagePath = `data/images/${resultId}.${imageExtension}`;
        await fs.writeFile(imagePath, imageBuffer);
        
        // Save CSV data
        const csvPath = `data/csv/${resultId}.csv`;
        await fs.writeFile(csvPath, csvData);
        
        // Store metadata
        resultsStorage[resultId] = {
            id: resultId,
            timestamp: timestamp || new Date().toISOString(),
            prompt: prompt,
            label: label,
            imagePath: imagePath,
            csvPath: csvPath,
            imageExtension: imageExtension
        };
        
        // Save to file
        await saveResults();
        
        res.json({ 
            success: true, 
            resultId: resultId,
            shareUrl: `/result/${resultId}`
        });
    } catch (error) {
        console.error('Error saving result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// Get saved result
app.get('/api/result/:id', async (req, res) => {
    try {
        const resultId = req.params.id;
        const result = resultsStorage[resultId];
        
        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }
        
        // Read image file
        const imageBuffer = await fs.readFile(result.imagePath);
        const imageBase64 = `data:image/${result.imageExtension};base64,${imageBuffer.toString('base64')}`;
        
        // Read CSV file
        const csvData = await fs.readFile(result.csvPath, 'utf8');
        
        res.json({
            id: result.id,
            timestamp: result.timestamp,
            prompt: result.prompt,
            label: result.label,
            imageData: imageBase64,
            csvData: csvData
        });
    } catch (error) {
        console.error('Error retrieving result:', error);
        res.status(500).json({ error: 'Failed to retrieve result' });
    }
});

// Get all saved results (metadata only)
app.get('/api/results', (req, res) => {
    try {
        const results = Object.values(resultsStorage).map(result => ({
            id: result.id,
            timestamp: result.timestamp,
            label: result.label || 'Untitled'
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(results);
    } catch (error) {
        console.error('Error getting results list:', error);
        res.status(500).json({ error: 'Failed to get results' });
    }
});

// Serve individual result page
app.get('/result/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'result.html'));
});

// Delete a result
app.delete('/api/result/:id', async (req, res) => {
    try {
        const resultId = req.params.id;
        const result = resultsStorage[resultId];
        
        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }
        
        // Delete files
        try {
            await fs.unlink(result.imagePath);
            await fs.unlink(result.csvPath);
        } catch (fileError) {
            console.error('Error deleting files:', fileError);
        }
        
        // Remove from storage
        delete resultsStorage[resultId];
        await saveResults();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting result:', error);
        res.status(500).json({ error: 'Failed to delete result' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Results will be saved to the 'data' directory`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await saveResults();
    process.exit(0);
});