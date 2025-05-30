/**
 * Password Manager Module
 * Handles password protection for admin operations like delete and rename
 */

const PasswordManager = {
    // Global variables for password operations
    pendingOperation: null,
    pendingOperationData: null,

    /**
     * Show delete confirmation dialog with password protection
     * @param {string} resultId - ID of the result to delete
     */
    showDeleteDialog(resultId) {
        this.pendingOperation = 'delete';
        this.pendingOperationData = { resultId };
        
        document.getElementById('passwordModalTitle').textContent = '🗑️ Delete Result';
        document.getElementById('passwordModalMessage').textContent = 'Enter the admin password to delete this result:';
        
        this.showPasswordModal();
    },

    /**
     * Show rename dialog with password protection
     * @param {string} resultId - ID of the result to rename
     * @param {string} currentLabel - Current label of the result
     */
    showRenameDialog(resultId, currentLabel) {
        this.pendingOperation = 'rename';
        this.pendingOperationData = { resultId, currentLabel };
        
        document.getElementById('passwordModalTitle').textContent = '✏️ Rename Result';
        document.getElementById('passwordModalMessage').textContent = 'Enter the admin password to rename this result:';
        
        this.showPasswordModal();
    },

    /**
     * Show password modal
     */
    showPasswordModal() {
        const modal = document.getElementById('passwordModal');
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');
        
        // Clear previous input and errors
        passwordInput.value = '';
        passwordError.style.display = 'none';
        
        // Show modal
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('show');
            passwordInput.focus();
        }, 10);
        
        // Add Enter key listener
        passwordInput.addEventListener('keydown', this.handlePasswordEnterKey.bind(this));
    },

    /**
     * Close password modal
     */
    closePasswordModal() {
        const modal = document.getElementById('passwordModal');
        const passwordInput = document.getElementById('passwordInput');
        
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        
        // Remove Enter key listener
        passwordInput.removeEventListener('keydown', this.handlePasswordEnterKey);
        
        // Clear pending operation
        this.pendingOperation = null;
        this.pendingOperationData = null;
    },

    /**
     * Handle Enter key in password input
     * @param {KeyboardEvent} e - Keyboard event
     */
    handlePasswordEnterKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.submitPassword();
        }
    },

    /**
     * Submit password and execute pending operation
     */
    submitPassword() {
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');
        const password = passwordInput.value;
        
        console.log('Password submitted:', password === 'geomage' ? 'CORRECT' : 'INCORRECT');
        console.log('Pending operation:', this.pendingOperation);
        console.log('Pending operation data:', this.pendingOperationData);
        
        // Check password
        if (password === 'geomage') {
            // Store the pending operation data before closing modal
            const operationToExecute = this.pendingOperation;
            const operationData = this.pendingOperationData;
            
            // Password correct, close modal and execute operation
            this.closePasswordModal();
            
            // Execute operation immediately after modal closes with stored data
            setTimeout(() => {
                this.executeStoredOperation(operationToExecute, operationData);
            }, 50);
        } else {
            // Password incorrect, show error
            passwordError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
            
            // Shake animation for error
            passwordInput.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                passwordInput.style.animation = '';
            }, 500);
        }
    },

    /**
     * Execute stored operation with provided data
     */
    executeStoredOperation(operation, operationData) {
        console.log('Executing stored operation:', operation, operationData);
        
        if (!operation || !operationData) {
            console.error('No operation or data available');
            return;
        }
        
        try {
            switch (operation) {
                case 'delete':
                    console.log('Executing delete for:', operationData.resultId);
                    this.executeDelete(operationData.resultId);
                    break;
                case 'rename':
                    console.log('Executing rename for:', operationData.resultId);
                    this.executeRename(operationData.resultId, operationData.currentLabel);
                    break;
                default:
                    console.error('Unknown operation:', operation);
            }
        } catch (error) {
            console.error('Error executing operation:', error);
            showError('Failed to execute operation: ' + error.message);
        }
    },

    /**
     * Execute delete operation
     * @param {string} resultId - ID of the result to delete
     */
    executeDelete(resultId) {
        console.log('Delete function called for result:', resultId);
        
        if (confirm('Are you sure you want to delete this result? This action cannot be undone.')) {
            console.log('User confirmed deletion, calling ResultManager.deleteResult');
            try {
                ResultManager.deleteResult(resultId);
            } catch (error) {
                console.error('Error in deleteResult:', error);
                showError('Failed to delete result: ' + error.message);
            }
        } else {
            console.log('User cancelled deletion');
        }
    },

    /**
     * Execute rename operation
     * @param {string} resultId - ID of the result to rename
     * @param {string} currentLabel - Current label of the result
     */
    executeRename(resultId, currentLabel) {
        console.log('Rename function called for result:', resultId, 'current label:', currentLabel);
        
        // Decode HTML entities
        const decodedLabel = currentLabel.replace(/&#39;/g, "'");
        const newLabel = prompt('Enter new name for this result:', decodedLabel);
        
        console.log('User entered new label:', newLabel);
        
        if (newLabel !== null && newLabel.trim() !== '') {
            if (newLabel.trim() !== decodedLabel) {
                console.log('Label changed, calling ResultManager.renameResult');
                try {
                    ResultManager.renameResult(resultId, newLabel.trim());
                } catch (error) {
                    console.error('Error in renameResult:', error);
                    showError('Failed to rename result: ' + error.message);
                }
            } else {
                console.log('Label unchanged, no action needed');
            }
        } else {
            console.log('User cancelled or entered empty label');
        }
    }
};

// Make password functions globally available for onclick handlers
window.showDeleteDialog = function(resultId) {
    PasswordManager.showDeleteDialog(resultId);
};

window.showRenameDialog = function(resultId, currentLabel) {
    PasswordManager.showRenameDialog(resultId, currentLabel);
};

window.closePasswordModal = function() {
    PasswordManager.closePasswordModal();
};

window.submitPassword = function() {
    PasswordManager.submitPassword();
};

// Export for use in other modules
window.PasswordManager = PasswordManager; 