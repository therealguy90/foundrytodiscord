export function parseTable(table) {
    const rows = table.querySelectorAll('tr');
    let tableData = [];

    // Remove unnecessary whitespaces and newlines and extract table data into a 2D array
    rows.forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        let rowData = [];
        cells.forEach((cell) => {
            rowData.push(cell.textContent.trim().replace(/\s+/g, ' '));
        });
        tableData.push(rowData);
    });
    let columnWidths = []
    // Output the 2D array containing the table data
    // Initialize columnWidths with zeros
    for (let i = 0; i < tableData[0].length; i++) {
        columnWidths.push(0);
    }

    // Iterate through the rows, starting from the second row (index 1)
    for (let rowIdx = 1; rowIdx < tableData.length; rowIdx++) {
        const row = tableData[rowIdx];

        // Iterate through each column
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cell = row[colIdx];

            // Calculate the character count for the cell
            const cellCharacterCount = cell.length;

            // Update the maximum character count for the column if needed
            if (cellCharacterCount > columnWidths[colIdx]) {
                columnWidths[colIdx] = cellCharacterCount;
            }
        }
    }
    for (let i = 0; i < columnWidths.length; i++) {
        if (columnWidths[i] < 7) {
            columnWidths[i] = 7;
        }
    }
    let widthTotal = 0;
    for (let i = 0; i < columnWidths.length; i++) {
        if (i < columnWidths.length - 1) {
            columnWidths[i] += 2;
        }
        widthTotal += columnWidths[i];
    }
    const MAX_EMBED_CHARACTER_WIDTH = 75;
    if (widthTotal <= MAX_EMBED_CHARACTER_WIDTH) {
        let headerWidths = [];
        let totalHeaderWidths = 0;
        for (let i = 0; i < tableData[0].length; i++) {
            headerWidths.push(tableData[0].length + (i < tableData[0].length - 1) ? 2 : 0);
        }
        for (let i = 0; i < headerWidths.length; i++) {
            totalHeaderWidths += headerWidths[i].length;
        }
        if (totalHeaderWidths > MAX_EMBED_CHARACTER_WIDTH) {
            return fitTable(tableData, headerWidths, totalHeaderWidths, MAX_EMBED_CHARACTER_WIDTH)
        }
        else {
            let i = 0;
            while (widthTotal < MAX_EMBED_CHARACTER_WIDTH) {
                columnWidths[i]++;
                widthTotal++;
                i++;
                if (i >= columnWidths.length) {
                    i = 0;
                }
            }
            return fitTable(tableData, columnWidths, widthTotal, MAX_EMBED_CHARACTER_WIDTH);
        }
    }
    else {
        return fitTable(tableData, columnWidths, widthTotal, MAX_EMBED_CHARACTER_WIDTH);
    }
}


function fitTable(tableData, columnWidths, widthTotal, MAX_EMBED_CHARACTER_WIDTH) {
    let toRemove = widthTotal - MAX_EMBED_CHARACTER_WIDTH;
    while (toRemove > 0) {
        let largestWidth = 0;
        let largestWidthIndex;
        for (let i = 0; i < columnWidths.length; i++) {
            if (columnWidths[i] > largestWidth) {
                largestWidthIndex = i;
                largestWidth = columnWidths[i];
            }
        }
        toRemove--;
        columnWidths[largestWidthIndex]--;
    }
    const rowsNeeded = [];
    for (let i = 0; i < tableData.length; i++) {
        const row = tableData[i];
        let maxNumber = -Infinity;
        for (let j = 0; j < row.length; j++) {
            const result = Math.ceil(row[j].length / (columnWidths[j] - 1));
            if (result > maxNumber) {
                maxNumber = result;
            }
        }
        rowsNeeded.push(maxNumber - 1);
    }
    let compileNewRows = [];
    for (let i = 0; i < tableData.length; i++) {
        let newRows = [];
        for (let j = 0; j < rowsNeeded[i]; j++) {
            newRows.push([]);
        }
        for (let j = 0; j < tableData[i].length; j++) {
            let split = splitStringByLength(tableData[i][j], (columnWidths[j] - 1));
            tableData[i][j] = split[0];
            for (let k = 1; k <= newRows.length; k++) {
                if (k < split.length) {
                    newRows[k - 1].push(split[k]);
                }
                else {
                    newRows[k - 1].push("");
                }
            }
        }
        compileNewRows.push(newRows);
    }
    const combinedArray = [];
    for (let i = 0; i < tableData.length; i++) {
        const row = tableData[i];
        const additionalRows = compileNewRows[i];

        combinedArray.push(row);

        for (let j = 0; j < additionalRows.length; j++) {
            const additionalRow = additionalRows[j];
            const newRow = row.map((cell, index) => additionalRow[index]);
            combinedArray.push(newRow);
        }
    }
    return formatTable(combinedArray, columnWidths);
}

function formatTable(tableData, columnWidths) {
    const paddedTable = [];
    for (let row = 0; row < tableData.length; row++) {
        const rowData = tableData[row];
        const paddedRow = [];
        for (let col = 0; col < rowData.length; col++) {
            const cell = rowData[col];
            const width = columnWidths[col];
            const paddedCell = padRight(cell, width);
            paddedRow.push(paddedCell);
        }
        paddedTable.push(paddedRow);
    }
    const combinedRows = [];
    for (let row = 0; row < paddedTable.length; row++) {
        const rowData = paddedTable[row];
        const combinedRow = rowData.join(''); // Join columns without spaces
        combinedRows.push(combinedRow);
    }
    let fullFormattedTable = "";
    combinedRows.forEach(row => {
        fullFormattedTable += '`' + row + '`\n';
    });
    return fullFormattedTable.replaceAll(" ", " ") + "\n";
}

function splitStringByLength(inputString, chunkLength) {
    if (chunkLength <= 0) {
        return [inputString];
    }

    const result = [];
    let startIndex = 0;

    while (startIndex < inputString.length) {
        const chunk = inputString.substr(startIndex, chunkLength);
        result.push(chunk);
        startIndex += chunkLength;
    }

    return result;
}

function padRight(str, width) {
    if (str.length < width) {
        return str + ' '.repeat(width - str.length);
    } else {
        return str;
    }
}
