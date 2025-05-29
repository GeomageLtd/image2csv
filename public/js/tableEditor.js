// Table Editor Module
// Implements interactive table editing and validation functionality

// Global table editing state
let selectedCell = null;
let selectedRow = -1;
let selectedCol = -1;
let editedCells = new Set();
let isEditing = false;

/**
 * Display CSV table with interactive editing and validation capabilities
 * @param {string} csvContent - CSV content to display
 */
function displayCSVTableWithValidation(csvContent) {
    const container = document.getElementById('csvTableContainer');
    
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        container.innerHTML = '<p>No data to display</p>';
        return;
    }
    
    const rows = lines.map(line => {
        return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });
    
    // Calculate optimal column widths
    const columnWidths = calculateOptimalColumnWidths(rows, rows[0]?.length || 0);
    
    // Create table with editing capabilities
    let tableHTML = '<div class="table-container"><table class="csv-table editable-table" id="csvTable"><thead>';
    
    // Header row
    if (rows.length > 0) {
        tableHTML += '<tr class="header-row">';
        rows[0].forEach((cell, colIndex) => {
            const width = columnWidths[colIndex] || 'auto';
            tableHTML += `<th style="width: ${width}px">${cell}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        // Data rows
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
            tableHTML += `<tr data-row="${rowIndex}">`;
            rows[rowIndex].forEach((cell, colIndex) => {
                tableHTML += `<td data-row="${rowIndex}" data-col="${colIndex}" tabindex="0">${cell}</td>`;
            });
            tableHTML += '</tr>';
        }
    }
    
    tableHTML += '</tbody></table></div>';
    
    // Add table controls
    const controlsHTML = createTableControls();
    
    container.innerHTML = controlsHTML + tableHTML;
    
    // Add event listeners
    const table = document.getElementById('csvTable');
    addCellEditListeners(table);
    addKeyboardNavigation(table);
    
    // Add validation button
    addValidationButton();
    
    // Store original data for comparison
    AppState.originalTableData = rows;
    AppState.currentTableData = JSON.parse(JSON.stringify(rows));
}

/**
 * Calculate optimal column widths for table display
 * @param {Array} data - Table data
 * @param {number} columnCount - Number of columns
 * @returns {Array} Array of column widths
 */
function calculateOptimalColumnWidths(data, columnCount) {
    if (!data || data.length === 0 || columnCount === 0) return [];
    
    const widths = new Array(columnCount).fill(100); // Minimum width
    const maxWidth = 300; // Maximum width
    const avgCharWidth = 8; // Approximate character width in pixels
    
    // Calculate based on content length
    data.forEach(row => {
        row.forEach((cell, colIndex) => {
            if (colIndex < columnCount) {
                const cellText = cell?.toString() || '';
                const estimatedWidth = Math.min(cellText.length * avgCharWidth + 20, maxWidth);
                widths[colIndex] = Math.max(widths[colIndex], estimatedWidth);
            }
        });
    });
    
    return widths;
}

/**
 * Create table control buttons
 * @returns {string} HTML for table controls
 */
function createTableControls() {
    return `
        <div class="table-controls">
            <div class="control-section">
                <button class="control-btn" id="addRowBtn" onclick="addNewRow()" title="Add new row">
                    ➕ Add Row
                </button>
                <button class="control-btn" id="addColBtn" onclick="addNewColumn()" title="Add new column">
                    ➕ Add Column
                </button>
            </div>
            <div class="control-section">
                <button class="control-btn danger" id="deleteRowBtn" onclick="deleteSelectedRow()" 
                        title="Delete selected row" disabled>
                    🗑️ Delete Row
                </button>
                <button class="control-btn danger" id="deleteColBtn" onclick="deleteSelectedColumn()" 
                        title="Delete selected column" disabled>
                    🗑️ Delete Column
                </button>
            </div>
            <div class="control-section">
                <button class="control-btn" id="validateBtn" onclick="validateTableData()" title="Validate data">
                    ✓ Validate
                </button>
                <button class="control-btn primary" id="saveChangesBtn" onclick="saveTableChanges()" 
                        title="Save changes" disabled>
                    💾 Save Changes
                </button>
                <button class="control-btn" id="exportBtn" onclick="exportUpdatedCSV()" title="Export CSV">
                    📥 Export
                </button>
            </div>
            <div class="edit-status" id="editStatus">
                <span class="status-text">Ready</span>
            </div>
        </div>
    `;
}

/**
 * Add cell editing event listeners
 * @param {HTMLTableElement} table - Table element
 */
function addCellEditListeners(table) {
    const cells = table.querySelectorAll('tbody td');
    
    cells.forEach(cell => {
        // Double-click to edit
        cell.addEventListener('dblclick', function() {
            startCellEdit(this);
        });
        
        // Single click to select
        cell.addEventListener('click', function() {
            selectCell(this);
        });
        
        // Enter key to edit
        cell.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !isEditing) {
                e.preventDefault();
                startCellEdit(this);
            } else if (e.key === 'Escape' && isEditing) {
                const input = this.querySelector('input, textarea');
                if (input) {
                    cancelCellEdit(this, input.dataset.originalValue);
                }
            }
        });
    });
}

/**
 * Start editing a cell
 * @param {HTMLElement} cell - Cell to edit
 */
function startCellEdit(cell) {
    if (isEditing) return;
    
    isEditing = true;
    const originalValue = cell.textContent;
    const cellRect = cell.getBoundingClientRect();
    
    // Determine if we need a textarea (for long content) or input
    const isLongContent = originalValue.length > 50 || originalValue.includes('\n');
    const inputElement = document.createElement(isLongContent ? 'textarea' : 'input');
    
    inputElement.value = originalValue;
    inputElement.dataset.originalValue = originalValue;
    inputElement.className = 'cell-editor';
    
    if (isLongContent) {
        inputElement.rows = Math.min(Math.max(2, Math.ceil(originalValue.length / 50)), 5);
        inputElement.addEventListener('input', () => autoResizeTextarea(inputElement));
    }
    
    // Style the input
    inputElement.style.cssText = `
        width: 100%;
        height: 100%;
        border: 2px solid #007bff;
        padding: 4px;
        font-family: inherit;
        font-size: inherit;
        background: #fff;
        resize: none;
        outline: none;
    `;
    
    // Replace cell content
    cell.innerHTML = '';
    cell.appendChild(inputElement);
    inputElement.focus();
    inputElement.select();
    
    // Event listeners for finishing edit
    const finishEdit = () => finishCellEdit(cell);
    const cancelEdit = () => cancelCellEdit(cell, originalValue);
    
    inputElement.addEventListener('blur', finishEdit);
    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (!isLongContent || e.ctrlKey)) {
            e.preventDefault();
            finishEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
    
    updateEditStatus('Editing cell...');
}

/**
 * Finish editing a cell
 * @param {HTMLElement} cell - Cell being edited
 */
function finishCellEdit(cell) {
    const input = cell.querySelector('input, textarea');
    if (!input) return;
    
    const newValue = input.value;
    const originalValue = input.dataset.originalValue;
    
    // Update cell content
    cell.textContent = newValue;
    
    // Mark as edited if value changed
    if (newValue !== originalValue) {
        cell.classList.add('edited-cell');
        editedCells.add(`${cell.dataset.row}-${cell.dataset.col}`);
        
        // Update data in memory
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (AppState.currentTableData && AppState.currentTableData[row]) {
            AppState.currentTableData[row][col] = newValue;
        }
        
        updateControlButtons(selectedRow, selectedCol);
        updateEditStatus(`${editedCells.size} cell(s) modified`);
    }
    
    isEditing = false;
}

/**
 * Cancel cell edit
 * @param {HTMLElement} cell - Cell being edited
 * @param {string} originalValue - Original cell value
 */
function cancelCellEdit(cell, originalValue) {
    cell.textContent = originalValue;
    isEditing = false;
    updateEditStatus('Edit cancelled');
}

/**
 * Auto-resize textarea based on content
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

/**
 * Select a cell
 * @param {HTMLElement} cell - Cell to select
 */
function selectCell(cell) {
    // Remove previous selection
    const prevSelected = document.querySelector('.selected-cell');
    if (prevSelected) {
        prevSelected.classList.remove('selected-cell');
    }
    
    // Select new cell
    cell.classList.add('selected-cell');
    selectedCell = cell;
    selectedRow = parseInt(cell.dataset.row);
    selectedCol = parseInt(cell.dataset.col);
    
    // Focus the cell for keyboard navigation
    cell.focus();
    
    // Update control buttons
    updateControlButtons(selectedRow, selectedCol);
}

/**
 * Update control button states
 * @param {number} row - Selected row
 * @param {number} col - Selected column
 */
function updateControlButtons(row, col) {
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    const deleteColBtn = document.getElementById('deleteColBtn');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    
    // Enable/disable delete buttons
    if (deleteRowBtn) deleteRowBtn.disabled = row < 1; // Can't delete header
    if (deleteColBtn) deleteColBtn.disabled = col < 0;
    
    // Enable save button if there are changes
    if (saveChangesBtn) saveChangesBtn.disabled = editedCells.size === 0;
}

/**
 * Add new row to table
 */
function addNewRow() {
    const table = document.getElementById('csvTable');
    const tbody = table.querySelector('tbody');
    const headerCells = table.querySelectorAll('thead th');
    const columnCount = headerCells.length;
    
    const newRowIndex = tbody.children.length + 1;
    const newRow = document.createElement('tr');
    newRow.dataset.row = newRowIndex;
    
    for (let col = 0; col < columnCount; col++) {
        const cell = document.createElement('td');
        cell.dataset.row = newRowIndex;
        cell.dataset.col = col;
        cell.tabIndex = 0;
        cell.textContent = '';
        newRow.appendChild(cell);
    }
    
    tbody.appendChild(newRow);
    
    // Add event listeners to new cells
    addCellEditListeners(table);
    
    // Update data structure
    if (AppState.currentTableData) {
        AppState.currentTableData.push(new Array(columnCount).fill(''));
    }
    
    updateEditStatus('Row added');
}

/**
 * Add new column to table
 */
function addNewColumn() {
    const table = document.getElementById('csvTable');
    const header = table.querySelector('thead tr');
    const rows = table.querySelectorAll('tbody tr');
    
    // Add header cell
    const newHeaderCell = document.createElement('th');
    newHeaderCell.textContent = `Column ${header.children.length + 1}`;
    header.appendChild(newHeaderCell);
    
    // Add data cells to each row
    rows.forEach((row, rowIndex) => {
        const cell = document.createElement('td');
        cell.dataset.row = rowIndex + 1;
        cell.dataset.col = header.children.length - 1;
        cell.tabIndex = 0;
        cell.textContent = '';
        row.appendChild(cell);
    });
    
    // Update data structure
    if (AppState.currentTableData) {
        AppState.currentTableData.forEach(row => row.push(''));
    }
    
    // Re-add event listeners
    addCellEditListeners(table);
    
    updateEditStatus('Column added');
}

/**
 * Delete selected row
 */
function deleteSelectedRow() {
    if (selectedRow < 1) return; // Can't delete header
    
    const table = document.getElementById('csvTable');
    const rowToDelete = table.querySelector(`tbody tr[data-row="${selectedRow}"]`);
    
    if (rowToDelete && confirm('Delete this row?')) {
        rowToDelete.remove();
        
        // Update data structure
        if (AppState.currentTableData && AppState.currentTableData[selectedRow]) {
            AppState.currentTableData.splice(selectedRow, 1);
        }
        
        // Re-index remaining rows
        const remainingRows = table.querySelectorAll('tbody tr');
        remainingRows.forEach((row, index) => {
            const newRowIndex = index + 1;
            row.dataset.row = newRowIndex;
            row.querySelectorAll('td').forEach(cell => {
                cell.dataset.row = newRowIndex;
            });
        });
        
        // Clear selection
        selectedRow = -1;
        selectedCol = -1;
        selectedCell = null;
        updateControlButtons(-1, -1);
        
        updateEditStatus('Row deleted');
    }
}

/**
 * Delete selected column
 */
function deleteSelectedColumn() {
    if (selectedCol < 0) return;
    
    const table = document.getElementById('csvTable');
    const headerCells = table.querySelectorAll('thead th');
    const rows = table.querySelectorAll('tbody tr');
    
    if (headerCells.length <= 1) {
        alert('Cannot delete the last column');
        return;
    }
    
    if (confirm('Delete this column?')) {
        // Remove header cell
        if (headerCells[selectedCol]) {
            headerCells[selectedCol].remove();
        }
        
        // Remove cells from each row
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells[selectedCol]) {
                cells[selectedCol].remove();
            }
        });
        
        // Update data structure
        if (AppState.currentTableData) {
            AppState.currentTableData.forEach(row => {
                if (row.length > selectedCol) {
                    row.splice(selectedCol, 1);
                }
            });
        }
        
        // Re-index remaining columns
        table.querySelectorAll('tbody tr').forEach(row => {
            row.querySelectorAll('td').forEach((cell, index) => {
                cell.dataset.col = index;
            });
        });
        
        // Clear selection
        selectedRow = -1;
        selectedCol = -1;
        selectedCell = null;
        updateControlButtons(-1, -1);
        
        updateEditStatus('Column deleted');
    }
}

/**
 * Update CSV data from current table state
 */
function updateCSVData() {
    const table = document.getElementById('csvTable');
    if (!table) return '';
    
    const rows = [];
    
    // Get header row
    const headerCells = table.querySelectorAll('thead th');
    if (headerCells.length > 0) {
        const headerRow = Array.from(headerCells).map(cell => `"${cell.textContent}"`);
        rows.push(headerRow.join(','));
    }
    
    // Get data rows
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => `"${cell.textContent}"`);
        rows.push(rowData.join(','));
    });
    
    return rows.join('\n');
}

/**
 * Save table changes
 */
async function saveTableChanges() {
    try {
        updateEditStatus('Saving changes...');
        
        // Update CSV data
        const newCsvData = updateCSVData();
        AppState.csvData = newCsvData;
        
        // Save to server if we have a result ID
        if (AppState.currentResultId) {
            await updateResultOnServer();
        }
        
        // Clear edit tracking
        editedCells.clear();
        document.querySelectorAll('.edited-cell').forEach(cell => {
            cell.classList.remove('edited-cell');
        });
        
        updateControlButtons(selectedRow, selectedCol);
        updateEditStatus('Changes saved successfully');
        
    } catch (error) {
        console.error('Error saving changes:', error);
        updateEditStatus('Error saving changes');
        showError('Failed to save changes: ' + error.message);
    }
}

/**
 * Update result on server
 */
async function updateResultOnServer() {
    if (!AppState.currentResultId || !AppState.csvData) return;
    
    const response = await fetch(`/api/update-result/${AppState.currentResultId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            csvData: AppState.csvData
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to update result on server');
    }
    
    return await response.json();
}

/**
 * Export updated CSV
 */
function exportUpdatedCSV() {
    const csvData = updateCSVData();
    downloadFile(csvData, 'edited_data.csv', 'text/csv');
    updateEditStatus('CSV exported');
}

/**
 * Update edit status display
 * @param {string} status - Status message
 */
function updateEditStatus(status = null) {
    const statusElement = document.getElementById('editStatus');
    if (statusElement) {
        const statusText = statusElement.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = status || 'Ready';
        }
    }
}

/**
 * Add keyboard navigation to table
 * @param {HTMLTableElement} table - Table element
 */
function addKeyboardNavigation(table) {
    const cells = table.querySelectorAll('tbody td');
    
    cells.forEach(cell => {
        cell.addEventListener('keydown', function(e) {
            if (isEditing) return;
            
            let targetCell = null;
            
            switch(e.key) {
                case 'ArrowUp':
                    targetCell = getPreviousCell(this, 'vertical');
                    break;
                case 'ArrowDown':
                    targetCell = getNextCell(this, 'vertical');
                    break;
                case 'ArrowLeft':
                    targetCell = getPreviousCell(this, 'horizontal');
                    break;
                case 'ArrowRight':
                    targetCell = getNextCell(this, 'horizontal');
                    break;
                case 'Tab':
                    e.preventDefault();
                    targetCell = e.shiftKey ? getPreviousCell(this) : getNextCell(this);
                    break;
            }
            
            if (targetCell) {
                e.preventDefault();
                selectCell(targetCell);
            }
        });
    });
}

/**
 * Get next cell for navigation
 * @param {HTMLElement} cell - Current cell
 * @param {string} direction - Navigation direction
 * @returns {HTMLElement|null} Next cell
 */
function getNextCell(cell, direction = 'tab') {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const table = document.getElementById('csvTable');
    
    if (direction === 'vertical') {
        return table.querySelector(`td[data-row="${row + 1}"][data-col="${col}"]`);
    } else if (direction === 'horizontal') {
        return table.querySelector(`td[data-row="${row}"][data-col="${col + 1}"]`);
    } else {
        // Tab navigation - next cell in reading order
        let nextCell = table.querySelector(`td[data-row="${row}"][data-col="${col + 1}"]`);
        if (!nextCell) {
            nextCell = table.querySelector(`td[data-row="${row + 1}"][data-col="0"]`);
        }
        return nextCell;
    }
}

/**
 * Get previous cell for navigation
 * @param {HTMLElement} cell - Current cell
 * @param {string} direction - Navigation direction
 * @returns {HTMLElement|null} Previous cell
 */
function getPreviousCell(cell, direction = 'tab') {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const table = document.getElementById('csvTable');
    
    if (direction === 'vertical') {
        return table.querySelector(`td[data-row="${row - 1}"][data-col="${col}"]`);
    } else if (direction === 'horizontal') {
        return table.querySelector(`td[data-row="${row}"][data-col="${col - 1}"]`);
    } else {
        // Tab navigation - previous cell in reading order
        let prevCell = table.querySelector(`td[data-row="${row}"][data-col="${col - 1}"]`);
        if (!prevCell && row > 1) {
            const prevRow = table.querySelector(`tbody tr[data-row="${row - 1}"]`);
            if (prevRow) {
                const cells = prevRow.querySelectorAll('td');
                prevCell = cells[cells.length - 1];
            }
        }
        return prevCell;
    }
}

/**
 * Validate table data
 */
function validateTableData() {
    const table = document.getElementById('csvTable');
    if (!table) return;
    
    updateEditStatus('Validating data...');
    clearValidationHighlights();
    
    // Get current table data
    const tableData = getCurrentTableData();
    
    if (!tableData || tableData.length < 3) {
        updateEditStatus('✅ Insufficient data for validation');
        showValidationSummary([]);
        return [];
    }
    
    const issues = [];
    const columnCount = tableData[0].length;
    
    // Check each column for consistency
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        const columnIssues = validateColumn(colIndex, tableData);
        issues.push(...columnIssues);
    }
    
    if (issues.length === 0) {
        updateEditStatus('✅ Validation passed - no issues found');
        showValidationSummary([]);
    } else {
        updateEditStatus(`⚠️ ${issues.length} validation issue(s) found`);
        highlightIssues(issues);
        showValidationSummary(issues);
    }
    
    return issues;
}

/**
 * Get current table data from DOM
 * @returns {Array} 2D array of table data
 */
function getCurrentTableData() {
    const table = document.getElementById('csvTable');
    if (!table) return null;
    
    const tableData = [];
    
    // Get header row
    const headerCells = table.querySelectorAll('thead th');
    if (headerCells.length > 0) {
        const headerRow = Array.from(headerCells).map(cell => cell.textContent.trim());
        tableData.push(headerRow);
    }
    
    // Get data rows
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => cell.textContent.trim());
        tableData.push(rowData);
    });
    
    return tableData;
}

/**
 * Validate a specific column for sequential delta consistency (matches original)
 * @param {number} colIndex - Column index to validate
 * @param {Array} tableData - Current table data
 * @returns {Array} Array of validation issues
 */
function validateColumn(colIndex, tableData) {
    const issues = [];
    const columnData = [];
    
    // Extract numerical data from the column - start from row 0 (including header area)
    for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
        const cellValue = tableData[rowIndex][colIndex];
        const numValue = parseFloat(cellValue);
        
        if (!isNaN(numValue) && cellValue !== '') {
            columnData.push({
                value: numValue,
                row: rowIndex,
                col: colIndex,
                originalValue: cellValue
            });
        }
    }
    
    // Need at least 3 numerical values to calculate deltas
    if (columnData.length < 3) {
        return issues;
    }
    
    // Calculate deltas between consecutive values
    const deltas = [];
    for (let i = 0; i < columnData.length - 1; i++) {
        const delta = columnData[i + 1].value - columnData[i].value;
        deltas.push({
            delta: delta,
            fromRow: columnData[i].row,
            toRow: columnData[i + 1].row,
            fromValue: columnData[i].value,
            toValue: columnData[i + 1].value
        });
    }
    
    if (deltas.length === 0) return issues;
    
    // Calculate median delta
    const sortedDeltas = deltas.map(d => d.delta).sort((a, b) => a - b);
    const medianDelta = calculateMedian(sortedDeltas);
    
    // Use tolerance of 0 for exact consistency (matches original)
    const finalTolerance = 0;
    
    // Find outlier deltas
    deltas.forEach(deltaInfo => {
        const deviation = deltaInfo.delta - medianDelta;
        
        if (Math.abs(deviation) > finalTolerance) {
            issues.push({
                type: 'inconsistent_delta',
                row: deltaInfo.toRow,
                col: colIndex,
                expectedDelta: medianDelta,
                actualDelta: deltaInfo.delta,
                deviation: deviation,
                tolerance: finalTolerance,
                fromValue: deltaInfo.fromValue,
                toValue: deltaInfo.toValue,
                suggestion: calculateSuggestedValue(deltaInfo.fromValue, medianDelta),
                message: `Inconsistent value: expected ~${(deltaInfo.fromValue + medianDelta).toFixed(0)}, got ${deltaInfo.toValue}`
            });
        }
    });
    
    return issues;
}

/**
 * Calculate suggested value based on previous value and median delta (matches original)
 * @param {number} fromValue - Previous value
 * @param {number} medianDelta - Median delta
 * @returns {number} Suggested value
 */
function calculateSuggestedValue(fromValue, medianDelta) {
    return fromValue + medianDelta;
}

/**
 * Calculate median of an array
 * @param {Array} values - Array of numbers
 * @returns {number} Median value
 */
function calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        return sorted[mid];
    }
}

/**
 * Clear validation highlights
 */
function clearValidationHighlights() {
    document.querySelectorAll('.validation-error, .validation-warning').forEach(cell => {
        cell.classList.remove('validation-error', 'validation-warning');
        cell.removeAttribute('title');
    });
}

/**
 * Highlight validation issues (matches original)
 * @param {Array} issues - Array of validation issues
 */
function highlightIssues(issues) {
    issues.forEach(issue => {
        const table = document.getElementById('csvTable');
        const cell = table.querySelector(`td[data-row="${issue.row}"][data-col="${issue.col}"]`);
        if (cell) {
            // Add validation error class
            cell.classList.add('validation-error');
            
            // Create tooltip text like original
            const tooltipText = `Inconsistent value detected!\n` +
                `Expected delta: ~${issue.expectedDelta.toFixed(0)}\n` +
                `Actual delta: ${issue.actualDelta.toFixed(0)}\n` +
                `Deviation: ${issue.deviation.toFixed(0)}\n` +
                `Suggested value: ${issue.suggestion.toFixed(0)}\n` +
                `From: ${issue.fromValue} → To: ${issue.toValue}`;
            
            cell.title = tooltipText;
        }
    });
}

/**
 * Show validation summary
 * @param {Array} issues - Array of validation issues
 */
function showValidationSummary(issues) {
    // Remove existing summary
    const existingSummary = document.getElementById('validationSummary');
    if (existingSummary) {
        existingSummary.remove();
    }
    
    const container = document.getElementById('csvTableContainer');
    if (!container) return;
    
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'validationSummary';
    summaryDiv.className = 'validation-summary';
    
    if (issues.length === 0) {
        summaryDiv.innerHTML = `
            <div class="validation-success">
                ✅ <strong>Data Validation Complete</strong>
                <p>No consistency issues found in the data.</p>
            </div>
        `;
    } else {
        const issuesByColumn = groupIssuesByColumn(issues);
        
        summaryDiv.innerHTML = `
            <div class="validation-issues">
                <h4>⚠️ Data Validation Issues Found (${issues.length})</h4>
                ${Object.entries(issuesByColumn).map(([colIndex, colIssues]) => `
                    <div class="column-issues">
                        <strong>Column ${parseInt(colIndex) + 1}:</strong>
                        <ul>
                            ${colIssues.map(issue => `
                                <li>
                                    Row ${issue.row + 1}: Value ${issue.toValue} 
                                    (expected ~${issue.suggestion.toFixed(0)})
                                    <button class="fix-btn" onclick="applyQuickFix(${issue.row}, ${issue.col}, ${issue.suggestion})">
                                        Quick Fix
                                    </button>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('')}
                <div class="validation-actions">
                    <button class="control-btn secondary" onclick="clearValidationHighlights()">
                        Clear Highlights
                    </button>
                    <button class="control-btn" onclick="validateTableData()">
                        Re-validate
                    </button>
                </div>
            </div>
        `;
    }
    
    // Append at the end of the container (after the table)
    container.appendChild(summaryDiv);
}

/**
 * Group validation issues by column
 * @param {Array} issues - Array of validation issues
 * @returns {Object} Issues grouped by column
 */
function groupIssuesByColumn(issues) {
    return issues.reduce((groups, issue) => {
        const col = issue.col;
        if (!groups[col]) {
            groups[col] = [];
        }
        groups[col].push(issue);
        return groups;
    }, {});
}

/**
 * Apply quick fix for validation issue
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} suggestedValue - Suggested value
 */
function applyQuickFix(row, col, suggestedValue) {
    if (confirm(`Replace value in Row ${row + 1}, Column ${col + 1} with ${suggestedValue.toFixed(0)}?`)) {
        // Find the cell and update it
        const table = document.getElementById('csvTable');
        const cell = table.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        
        if (cell) {
            // Update cell display
            cell.textContent = suggestedValue.toFixed(0);
            cell.classList.add('edited-cell');
            editedCells.add(`${row}-${col}`);
            
            // Update data in memory
            if (AppState.currentTableData && AppState.currentTableData[row]) {
                AppState.currentTableData[row][col] = suggestedValue.toFixed(0);
            }
            
            updateControlButtons(selectedRow, selectedCol);
            updateEditStatus(`Quick fix applied to cell ${row + 1},${col + 1}`);
            
            // Re-validate to update highlights after a short delay
            setTimeout(() => validateTableData(), 100);
        }
    }
}

/**
 * Add validation button to controls
 */
function addValidationButton() {
    // Already included in createTableControls()
}

// Make functions globally available
window.displayCSVTableWithValidation = displayCSVTableWithValidation;
window.addNewRow = addNewRow;
window.addNewColumn = addNewColumn;
window.deleteSelectedRow = deleteSelectedRow;
window.deleteSelectedColumn = deleteSelectedColumn;
window.saveTableChanges = saveTableChanges;
window.exportUpdatedCSV = exportUpdatedCSV;
window.validateTableData = validateTableData;
window.applyQuickFix = applyQuickFix;

// Export module
window.TableEditor = {
    displayCSVTableWithValidation,
    validateTableData,
    saveTableChanges,
    exportUpdatedCSV,
    addNewRow,
    addNewColumn,
    deleteSelectedRow,
    deleteSelectedColumn
}; 