const express = require('express');
const resultService = require('../services/resultService');

const router = express.Router();

// Save processing result
router.post('/save-result', async (req, res) => {
    try {
        const result = await resultService.saveResult(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error saving result:', error.message);
        res.status(500).json({ error: 'Failed to save result: ' + error.message });
    }
});

// Get saved result
router.get('/result/:id', async (req, res) => {
    try {
        const result = await resultService.getResult(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error retrieving result:', error);
        if (error.message === 'Result not found') {
            return res.status(404).json({ error: 'Result not found' });
        }
        res.status(500).json({ error: 'Failed to retrieve result' });
    }
});

// Get all saved results (metadata only)
router.get('/results', (req, res) => {
    try {
        const results = resultService.getAllResults();
        res.json(results);
    } catch (error) {
        console.error('Error getting results list:', error);
        res.status(500).json({ error: 'Failed to get results' });
    }
});

// Update an existing result's CSV data
router.put('/update-result/:id', async (req, res) => {
    try {
        const { csvData } = req.body;
        const result = await resultService.updateResult(req.params.id, csvData);
        res.json(result);
    } catch (error) {
        console.error('Error updating result:', error);
        if (error.message === 'Result not found') {
            return res.status(404).json({ error: 'Result not found' });
        }
        if (error.message === 'CSV data is required') {
            return res.status(400).json({ error: 'CSV data is required' });
        }
        res.status(500).json({ error: 'Failed to update result' });
    }
});

// Delete a result
router.delete('/result/:id', async (req, res) => {
    try {
        const result = await resultService.deleteResult(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error deleting result:', error);
        if (error.message === 'Result not found') {
            return res.status(404).json({ error: 'Result not found' });
        }
        res.status(500).json({ error: 'Failed to delete result' });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router; 