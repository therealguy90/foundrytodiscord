import { getThisModuleSetting } from "./modulesettings.mjs";
import { generateimglink } from "./images.mjs";

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

export function addEmbedsToRequests(allRequests, hook, username, imgurl, embeds, user) {
    let embedSizeCharCount = 0;
    let discordSizeLimitedEmbeds = [];
    for (const embed of embeds) {
        let descriptionLength = 0;
        if (embed.description) {
            descriptionLength = embed.description.length;
        }
        if (embed.title) {
            embedSizeCharCount += embed.title.length;
        }
        embedSizeCharCount += descriptionLength;
        if (descriptionLength > 3500) {
            discordSizeLimitedEmbeds.push(...splitEmbed(embed, 3500));
        } else {
            discordSizeLimitedEmbeds.push(embed);
        }
    }
    let embedGroups = [];
    if (embedSizeCharCount > 4000) {
        let tempCharCount = 0;
        let j = 0;
        for (let i = 0; i < discordSizeLimitedEmbeds.length; i++) {
            tempCharCount += discordSizeLimitedEmbeds[i].description.length;
            if (tempCharCount < 4000) {
                if (!embedGroups[j]) {
                    embedGroups[j] = [];
                }
                embedGroups[j].push(discordSizeLimitedEmbeds[i]);
            }
            else {
                const splitEmbeds = splitFirstEmbed(discordSizeLimitedEmbeds[i], tempCharCount - 4000);
                embedGroups[j].push(splitEmbeds[0]);
                discordSizeLimitedEmbeds[i] = splitEmbeds[1];
                i--;
                j++;
                tempCharCount = 0;
            }
        }
    }
    else {
        embedGroups.push(...[embeds]);
    }
    let firstEmbedGroup = true;
    for (const embedGroup of embedGroups) {
        embedGroup.forEach((embed) => {
            // Add color to all embeds
            if (user?.color) {
                embed.color = hexToColor(user.color);
            }
        });
        if (firstEmbedGroup) {
            if (!embedGroup[0]?.author && getThisModuleSetting('showAuthor') && user && username !== user.name) {
                embedGroup[0]["author"] = {
                    name: user.name,
                    icon_url: generateimglink(user.avatar)
                }
            }
            allRequests[allRequests.length - 1].params.embeds = embedGroup;
            firstEmbedGroup = false;
        }
        else {
            allRequests.push({
                hook: hook,
                params: {
                    username: username,
                    avatar_url: imgurl,
                    content: "",
                    embeds: embedGroup
                }
            });
        }
    }
    return allRequests;
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