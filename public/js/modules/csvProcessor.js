/**
 * CSV Processor Module
 * Handles CSV data processing, combination, and validation
 */

const CSVProcessor = {
    combineResults(results) {
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length === 0) {
            throw new Error('No images were successfully processed');
        }
        
        let combinedRows = [];
        let referenceHeaders = null;
        
        successfulResults.forEach((result, index) => {
            // Clean CSV content
            const cleanCsv = result.csvContent.replace(/```csv\n?/g, '').replace(/```\n?/g, '').trim();
            const lines = cleanCsv.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) return;
            
            // Parse CSV lines
            const csvRows = lines.map(line => 
                line.split(',').map(cell => cell.trim().replace(/"/g, ''))
            );
            
            if (index === 0) {
                // Use first file's headers as reference
                referenceHeaders = csvRows[0];
                combinedRows.push(referenceHeaders);
                
                // Add data rows from first file
                if (csvRows.length > 1) {
                    combinedRows.push(...csvRows.slice(1));
                }
            } else {
                // For subsequent files, check if first row is headers
                let startIndex = 0;
                
                if (csvRows.length > 0) {
                    const firstRow = csvRows[0];
                    
                    // Check if first row looks like headers by comparing with reference
                    const isHeaderRow = this.isLikelyHeaderRow(firstRow, referenceHeaders, csvRows);
                    
                    if (isHeaderRow) {
                        // Skip the header row
                        startIndex = 1;
                        console.log(`Skipping header row in file ${index + 1}:`, firstRow);
                    } else {
                        // First row contains data, start from beginning
                        startIndex = 0;
                        console.log(`No header detected in file ${index + 1}, including all rows`);
                    }
                    
                    // Add data rows from current file
                    if (csvRows.length > startIndex) {
                        combinedRows.push(...csvRows.slice(startIndex));
                    }
                }
            }
        });
        
        // Convert back to CSV format
        return combinedRows.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    },

    isLikelyHeaderRow(row, referenceHeaders, allRows) {
        // If we don't have reference headers, assume first row is header
        if (!referenceHeaders || !Array.isArray(referenceHeaders)) {
            return true;
        }
        
        // If the row length doesn't match reference headers, it's probably not a header
        if (row.length !== referenceHeaders.length) {
            return false;
        }
        
        // Check for exact match with reference headers
        const exactMatch = row.every((cell, index) => {
            return cell.toLowerCase().trim() === referenceHeaders[index].toLowerCase().trim();
        });
        if (exactMatch) {
            return true;
        }
        
        // Check if this row contains mostly non-numeric values while subsequent rows are numeric
        if (allRows.length > 1) {
            const isFirstRowMostlyText = row.some(cell => isNaN(parseFloat(cell)) && cell.trim() !== '');
            const isSecondRowMostlyNumeric = allRows[1].some(cell => !isNaN(parseFloat(cell)));
            
            if (isFirstRowMostlyText && isSecondRowMostlyNumeric) {
                return true;
            }
        }
        
        // Check if the row contains typical header patterns
        const headerPatterns = /^(column|col|header|field|name|time|date|value|data|row|#)/i;
        const hasHeaderPattern = row.some(cell => headerPatterns.test(cell.toString()));
        
        if (hasHeaderPattern) {
            return true;
        }
        
        // Default to treating first row as header if we're unsure and it's reasonable
        if (allRows.length > 1) {
            return true;
        }
        
        return false;
    },

    /**
     * Parse CSV content into rows and columns
     * @param {string} csvContent - Raw CSV content
     * @returns {Array<Array<string>>} Parsed rows
     */
    parseCSV(csvContent) {
        if (!csvContent || typeof csvContent !== 'string') {
            return [];
        }
        
        const lines = csvContent.split('\n').filter(line => line.trim());
        return lines.map(line => 
            line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
        );
    },

    /**
     * Convert rows back to CSV format
     * @param {Array<Array<string>>} rows - Parsed rows
     * @returns {string} CSV content
     */
    rowsToCSV(rows) {
        return rows.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    },

    /**
     * Validate CSV data structure
     * @param {Array<Array<string>>} rows - Parsed rows
     * @returns {Object} Validation result
     */
    validateCSV(rows) {
        const issues = [];
        
        if (!rows || rows.length === 0) {
            return { isValid: false, issues: ['No data found'] };
        }
        
        const headerRow = rows[0];
        const expectedColumns = headerRow.length;
        
        // Check for consistent column count
        const inconsistentRows = [];
        rows.forEach((row, index) => {
            if (row.length !== expectedColumns) {
                inconsistentRows.push(index + 1);
            }
        });
        
        if (inconsistentRows.length > 0) {
            issues.push(`Rows with inconsistent column count: ${inconsistentRows.join(', ')}`);
        }
        
        // Check for empty headers
        const emptyHeaders = [];
        headerRow.forEach((header, index) => {
            if (!header || header.trim() === '') {
                emptyHeaders.push(index + 1);
            }
        });
        
        if (emptyHeaders.length > 0) {
            issues.push(`Empty headers in columns: ${emptyHeaders.join(', ')}`);
        }
        
        // Check for duplicate headers
        const headerCounts = {};
        headerRow.forEach(header => {
            const cleanHeader = header.trim().toLowerCase();
            headerCounts[cleanHeader] = (headerCounts[cleanHeader] || 0) + 1;
        });
        
        const duplicateHeaders = Object.entries(headerCounts)
            .filter(([header, count]) => count > 1)
            .map(([header]) => header);
            
        if (duplicateHeaders.length > 0) {
            issues.push(`Duplicate headers: ${duplicateHeaders.join(', ')}`);
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            rowCount: rows.length,
            columnCount: expectedColumns
        };
    }
};

// Export for use in other modules
window.CSVProcessor = CSVProcessor; 