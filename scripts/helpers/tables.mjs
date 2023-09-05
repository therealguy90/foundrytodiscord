export function fitTable(tableData, columnWidths, widthTotal, MAX_EMBED_CHARACTER_WIDTH) {
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
