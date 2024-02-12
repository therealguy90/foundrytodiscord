export function splitEmbed(embed, MAX_LENGTH = 4000) {
    let description = embed.description;
    const parts = [];

    let isFirstEmbed = true;

    while (description.length > MAX_LENGTH) {
        let splitIndex = MAX_LENGTH;

        // Find the nearest newline character before the maxLength
        while (splitIndex >= 0 && description[splitIndex] !== "\n") {
            splitIndex--;
        }

        // If no newline character is found, find the nearest whitespace character
        if (splitIndex < 0) {
            splitIndex = MAX_LENGTH;
            while (splitIndex >= 0 && description[splitIndex] !== " ") {
                splitIndex--;
            }
        }

        // If no whitespace character is found, split at the maxLength
        if (splitIndex < 0) {
            splitIndex = MAX_LENGTH;
        }

        // Split the description and create a new embed
        const partDescription = description.substring(0, splitIndex);
        const partEmbed = { ...embed, description: partDescription };

        // Remove the title from subsequent embeds
        if (!isFirstEmbed) {
            delete partEmbed.title;
            delete partEmbed.author;
        }

        // Add the part embed to the array
        parts.push(partEmbed);

        // Remove the processed part from the original description
        description = description.substring(splitIndex);

        isFirstEmbed = false;
    }

    // Create the final embed with the remaining description
    const finalEmbed = { ...embed, description };

    // Remove the title from the final embed
    delete finalEmbed.title;
    delete finalEmbed.author;
    // Add the final embed to the array
    parts.push(finalEmbed);

    return parts;
}

export function splitFirstEmbed(embed, MAX_LENGTH) {
    let description = embed.description;
    const parts = [];

    let isFirstEmbed = true;

    // Split only the first embed
    if (description.length > MAX_LENGTH) {
        let splitIndex = MAX_LENGTH;

        // Find the nearest newline character before the maxLength
        while (splitIndex >= 0 && description[splitIndex] !== "\n") {
            splitIndex--;
        }

        // If no newline character is found, find the nearest whitespace character
        if (splitIndex < 0) {
            splitIndex = MAX_LENGTH;
            while (splitIndex >= 0 && description[splitIndex] !== " ") {
                splitIndex--;
            }
        }

        // If no whitespace character is found, split at the maxLength
        if (splitIndex < 0) {
            splitIndex = MAX_LENGTH;
        }

        // Split the description and create a new embed
        const partDescription = description.substring(0, splitIndex);
        const partEmbed = { ...embed, description: partDescription };

        // Remove the title from subsequent embeds
        if (!isFirstEmbed) {
            delete partEmbed.title;
            delete partEmbed.author;
        }

        // Add the part embed to the array
        parts.push(partEmbed);

        // Remove the processed part from the original description
        description = description.substring(splitIndex);

        isFirstEmbed = false;
    }

    // For the second embed, use the remainder of the first embed
    if (!isFirstEmbed && description.length > 0) {
        const partEmbed = { ...embed, description };

        // Remove the title from subsequent embeds
        delete partEmbed.title;
        delete partEmbed.author;

        // Add the part embed to the array
        parts.push(partEmbed);
    }

    return parts;
}



export function splitText(text, MAX_LENGTH) {
    let textArray = [];
    if (text.length < MAX_LENGTH) {
        return [text];
    }
    else {
        let curText = text;
        while (curText.length > MAX_LENGTH) {
            let splitIndex = MAX_LENGTH;

            // Find the nearest newline character before the maxLength
            while (splitIndex >= 0 && curText[splitIndex] !== "\n") {
                splitIndex--;
            }
            // If no newline character is found, find the nearest whitespace character
            if (splitIndex < 0) {
                splitIndex = MAX_LENGTH;
                while (splitIndex >= 0 && curText[splitIndex] !== " ") {
                    splitIndex--;
                }
            }
            // If no whitespace character is found, split at the maxLength
            if (splitIndex < 0) {
                splitIndex = MAX_LENGTH;
            }
            textArray.push(curText.substring(0, splitIndex));
            curText = curText.substring(splitIndex);
        }
        textArray.push(curText);
    }
    return textArray;
}

export function hexToColor(hex) {
    // Remove the '#' character if it exists at the beginning of the hex string
    hex = hex.replace(/^#/, '');

    // Parse the hex string into a decimal number
    const decimalColor = parseInt(hex, 16);

    return decimalColor;
}

export function removeEmptyEmbeds(embeds) {
    return embeds.filter(embed => embed.title || embed.description || !embed.footer);
}