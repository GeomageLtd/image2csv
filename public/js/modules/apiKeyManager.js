/**
 * API Key Manager Module
 * Handles API key loading and management
 */

const ApiKeyManager = {
    /**
     * Initialize API key management
     */
    async initialize() {
        console.log('🔑 Initializing API Key Manager...');
        await this.loadDefaultApiKey();
        console.log('✅ API Key Manager initialized');
    },

    /**
     * Load default API key from server
     */
    async loadDefaultApiKey() {
        try {
            const response = await fetch('/api/default-api-key');
            if (response.ok) {
                const data = await response.json();
                if (data.apiKey) {
                    const apiKeyInput = document.getElementById('apiKey');
                    if (apiKeyInput && !apiKeyInput.value.trim()) {
                        apiKeyInput.value = data.apiKey;
                        console.log('✅ Default API key loaded successfully');
                        
                        // Add visual indicator that default key is loaded
                        this.showApiKeyStatus('Default API key loaded', 'success');
                    }
                }
            } else {
                console.warn('⚠️ Could not load default API key:', response.statusText);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load default API key:', error.message);
        }
    },

    /**
     * Show API key status message
     */
    showApiKeyStatus(message, type = 'info') {
        const apiKeyInput = document.getElementById('apiKey');
        if (!apiKeyInput) return;

        // Create or get existing status element
        let statusElement = document.getElementById('apiKeyStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'apiKeyStatus';
            statusElement.className = 'api-key-status';
            apiKeyInput.parentNode.appendChild(statusElement);
        }

        // Set status message and style
        statusElement.textContent = message;
        statusElement.className = `api-key-status ${type}`;
        statusElement.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (statusElement) {
                statusElement.style.display = 'none';
            }
        }, 3000);
    },

    /**
     * Get current API key value
     */
    getCurrentApiKey() {
        const apiKeyInput = document.getElementById('apiKey');
        return apiKeyInput ? apiKeyInput.value.trim() : '';
    },

    /**
     * Set API key value
     */
    setApiKey(apiKey) {
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            apiKeyInput.value = apiKey;
        }
    },

    /**
     * Clear API key
     */
    clearApiKey() {
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            apiKeyInput.value = '';
        }
    }
};

// Make globally available
window.ApiKeyManager = ApiKeyManager; 