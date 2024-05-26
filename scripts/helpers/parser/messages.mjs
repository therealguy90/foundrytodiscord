import { getThisModuleSetting } from "../modulesettings.mjs";
import { dataToBlob, generateimglink } from "./images.mjs";

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

export async function addEmbedsToRequests(allRequests, hook, username, imgurl, embeds, user) {
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
                    icon_url: await generateimglink(user.avatar)
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
    hex = hex.css || hex; /*Will be removed in v13*/
    // Remove the '#' character if it exists at the beginning of the hex string
    hex = hex.replace(/^#/, '');

    // Parse the hex string into a decimal number
    const decimalColor = parseInt(hex, 16);

    return decimalColor;
}

export function removeEmptyEmbeds(embeds) {
    return embeds.filter(embed => embed.title || embed.description || !embed.footer);
}

export function getPropertyByString(obj, propString) {
    let props = propString.split('.');
    let current = obj;

    for (let i = 0; i < props.length; i++) {
        if (current[props[i]] !== undefined) {
            current = current[props[i]];
        } else {
            return undefined;
        }
    }
    return current;
}


export function censorId(docid) {
    // Censors IDs for anonymized names
    const firstPart = docid.substring(0, 4);
    const censoredId = `${firstPart}****`;

    return censoredId;
}


export async function postParse(message, request, hookOverride = undefined) {
    if (request.params.avatar_url === "") {
        console.warn("foundrytodiscord | Your Invite URL is not set! Avatar images cannot be displayed on Discord.");
    }
    let formData = new FormData();
    if (game.modules.get("chat-media")?.active || game.modules.get("chatgifs")?.active) {
        const { formDataTemp, contentTemp } = getChatMediaAttachments(formData, request.params.content, message.content);
        if (formDataTemp !== formData) {
            formData = formDataTemp;
        }
        request.params.content = contentTemp;
    }
    if (message) {
        if (request.params.content === "" && request.params.embeds.length === 0 && !formData.get('files[0]')) {
            if (!message.content.includes('<img') && !message.content.includes('<video')) {
                console.error('foundrytodiscord | Failed to send message after parsing: parser returned empty result');
                return { waitHook: undefined, formData: {} };
            }
            else {
                request.params.content += await addMediaLinks(message);
            }
            if (request.params.content === "") {
                console.error('foundrytodiscord | Failed to send message after parsing: parser returned empty result');
                return { waitHook: undefined, formData: {} };
            }
        }
    }
    let waitHook;
    let hook;
    if (hookOverride) {
        hook = hookOverride;
    }
    else {
        hook = request.hook;
    }
    if (hook) {
        if (hook.includes("?")) {
            waitHook = hook + "&wait=true";
        }
        else {
            waitHook = hook + "?wait=true";
        }
    }
    else {
        waitHook = undefined;
    }
    formData.append('payload_json', JSON.stringify(request.params));
    return { waitHook: waitHook, formData: formData };
}

function getChatMediaAttachments(formData, msgText, content) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(content, "text/html");
    let mediaDivs = doc.querySelectorAll('.chat-media-image, .giphy-container');
    let filecount = 0;
    if (mediaDivs.length > 0) {
        mediaDivs.forEach((div) => {
            const imgElement = div.querySelector('img');
            const videoElement = div.querySelector('video');
            if (imgElement) {
                const dataSrc = imgElement.getAttribute('data-src');
                const src = imgElement.getAttribute('src');
                const altText = imgElement.getAttribute('alt');
                let srcToUse;
                if (dataSrc) {
                    srcToUse = dataSrc;
                }
                else if (src) {
                    srcToUse = src;
                }
                if (srcToUse) {
                    if (srcToUse.startsWith("data")) {
                        const blob = dataToBlob(srcToUse);
                        formData.append(`files[${filecount}]`, blob, altText);
                        filecount++;
                    }
                    else if (srcToUse.includes('http')) {
                        if (msgText !== "") {
                            msgText += "\n";
                        }
                        msgText += srcToUse;
                    }
                }
            }

            if (videoElement) {
                const src = videoElement.getAttribute('src');

                if (src) {
                    if (src.includes('http')) {
                        if (msgText !== "") {
                            msgText += "\n";
                        }
                        msgText += src;
                    }
                }
            }
        });
    }
    return { formDataTemp: formData, contentTemp: msgText };
}

async function addMediaLinks(message) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const images = doc.querySelectorAll('img');
    let links = "";
    for (const imgElement of images) {
        const src = imgElement.getAttribute('src');
        if (src.includes('http')) {
            if (links !== "") {
                links += "\n";
            }
            links += src;
        }
        else if (src) {
            links += await generateimglink(src, false);
        }
    }
    const videos = doc.querySelectorAll('video');
    for(videoElement of videos){
        const src = videoElement.getAttribute('src');
        if (src.includes('http')) {
            if (links !== "") {
                links += "\n";
            }
            links += src;
        }
    }
    if (links) {
        console.log(`foundrytodiscord | Links found. Adding media from following sources: ${links}`);
    }
    return links;
}

export async function getMessageInfo(webhook, messageID) {
    if (webhook.split('?').length > 1) {
        const querysplit = webhook.split('?');
        webhook = querysplit[0] + '/messages/' + messageID + '?' + querysplit[1];
    } else {
        webhook = webhook + '/messages/' + messageID;
    }
    const requestOptions = {
        method: "GET"
    };
    return await fetch(webhook, requestOptions)
        .catch(error => {
            console.error('foundrytodiscord | Error getting message information:', error);
        });
}