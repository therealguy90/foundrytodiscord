import { htmlTo2DTable, parse2DTable } from './helpers/tables.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { splitEmbed, hexToColor, removeEmptyEmbeds, splitText, splitFirstEmbed } from './helpers/messages.mjs';
import { generateimglink } from './helpers/images.mjs';
import { newEnrichedMessage, toHTML } from './helpers/enrich.mjs';
import { getDieEmoji, getDocumentEmoji, swapOrNot, dieIcon } from './helpers/emojis/global.mjs';

export async function messageParserGeneric(msg) {
    // Make a new ChatMessage object with the content enriched using the TextEditor.
    // This makes it so that parsing is consistently using HTML instead of using regex for enrichers.
    // Most messages do not need EnrichmentOptions, but pass it anyways for parity. Spare the effort.
    const enrichedMsg = await newEnrichedMessage(msg, await getEnrichmentOptions(msg));
    let constructedMessage = '';
    let embeds = [];
    if (game.modules.get('monks-tokenbar')?.active && tokenBar_isTokenBarCard(enrichedMsg.content)) {
        embeds = tokenBar_createTokenBarCard(enrichedMsg);
    }
    else if (isCard(enrichedMsg.content) && enrichedMsg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = createCardEmbed(enrichedMsg);
        }
    }
    else if (!enrichedMsg.isRoll) {
        if (hasDiceRolls(enrichedMsg.content)) {
            embeds = createHTMLDiceRollEmbed(enrichedMsg);
            const elements = document.createElement('div');
            elements.innerHTML = enrichedMsg.content;
            const diceRolls = elements.querySelectorAll('.dice-roll');
            for (const div of diceRolls) {
                div.parentNode.removeChild(div);
            }
            enrichedMsg.content = elements.innerHTML;
        }
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * for PF2e and DnD5e, this would be actor.system.traits.languages.value
        * the polyglotize() function should be edited for other systems
        */
        if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && enrichedMsg.flags?.polyglot?.language) {
            constructedMessage = polyglotize(enrichedMsg);
        }
        if (constructedMessage === '') {
            constructedMessage = enrichedMsg.content;
        }
    }
    else if (enrichedMsg.rolls.length === 0) {
        if (enrichedMsg.flavor) {
            embeds = [{ title: enrichedMsg.flavor, description: enrichedMsg.content }];
        }
        else {
            constructedMessage = enrichedMsg.content;
        }
    }
    else {
        console.log(`foundrytodiscord | System "${game.system.id}" is not supported for special roll embeds.`)
        embeds = createGenericRollEmbed(enrichedMsg);
    }
    if (embeds.length === 0 && willAutoUUIDEmbed(enrichedMsg.content)) {
        embeds = await generateAutoUUIDEmbeds(enrichedMsg);
    }
    //Fix formatting before sending
    if (embeds && embeds.length > 0) {
        for (let embed of embeds) {
            embed.description = await reformatMessage(embed.description);
        }
        if (!willAutoUUIDEmbed(enrichedMsg.content)) {
            constructedMessage = (/<[a-z][\s\S]*>/i.test(enrichedMsg.flavor) || enrichedMsg.flavor === embeds[0].title) ? "" : enrichedMsg.flavor;
        }
        // use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        // we have to mimic this behavior here, since visibility is client-sided, and we are parsing raw message content.
        if (anonEnabled()) {
            for (let i = 0; i < embeds.length; i++) {
                embeds[i].title = anonymizeText(embeds[i].title);
                embeds[i].description = anonymizeText(embeds[i].description);
            }
        }
    }
    if (anonEnabled()) {
        constructedMessage = anonymizeText(constructedMessage, enrichedMsg)
    }
    constructedMessage = await reformatMessage(constructedMessage);
    return getRequestParams(enrichedMsg, constructedMessage, embeds);
}

// Used for enrichHTML. Using actor as default in the generic parser.
export async function getEnrichmentOptions(message) {
    const speakerActor = function () {
        if (message.speaker?.actor) {
            return game.actors.get(message.speaker.actor);
        }
        else return undefined;
    }();
    return {
        rollData: {
            actor: speakerActor
        },
        relativeTo: speakerActor
    };
}

export function getRequestParams(message, msgText, embeds) {
    const imgurl = generateDiscordAvatar(message);
    let hook = "";
    if (message.isRoll && (!isCard(message.content) && message.rolls.length > 0)) {
        if (getThisModuleSetting("threadedChatMap").hasOwnProperty(message.user.viewedScene)) {
            hook = getThisModuleSetting("rollWebHookURL").split('?')[0] + "?thread_id=" + getThisModuleSetting('threadedChatMap')[message.user.viewedScene].rollThreadId;
        }
        else {
            hook = getThisModuleSetting("rollWebHookURL");
        }
    } else {
        if (getThisModuleSetting("threadedChatMap").hasOwnProperty(message.user.viewedScene)) {
            hook = getThisModuleSetting("webHookURL").split('?')[0] + "?thread_id=" + getThisModuleSetting('threadedChatMap')[message.user.viewedScene].chatThreadId;
        }
        else {
            hook = getThisModuleSetting("webHookURL");
        }
    }
    embeds = removeEmptyEmbeds(embeds);
    const username = generateDiscordUsername(message);
    const textArray = splitText(msgText, 2000);
    let allRequests = [];
    for (const text of textArray) {
        allRequests.push({
            hook: hook,
            params: {
                username: username,
                avatar_url: imgurl,
                content: text,
                embeds: []
            }
        });
    }
    if (embeds && embeds.length > 0) {
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
        let firstEmbedMessageIndex = undefined;
        let embedMessagesNum = 0;
        for (const embedGroup of embedGroups) {
            embedGroup.forEach((embed) => {
                // Add color to all embeds
                if (message.user?.color) {
                    embed.color = hexToColor(message.user.color);
                }
            });
            if (firstEmbedGroup) {
                if (!embedGroup[0]?.author && getThisModuleSetting('showAuthor') && message.user && message.alias !== message.user.name) {
                    embedGroup[0]["author"] = {
                        name: message.user.name,
                        icon_url: generateimglink(message.user.avatar)
                    }
                }
                allRequests[allRequests.length - 1].params.embeds = embedGroup;
                firstEmbedGroup = false;
                firstEmbedMessageIndex = allRequests.length - 1;
                embedMessagesNum++;
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
                embedMessagesNum++;
            }
        }
    }
    // For edit requests, we will trim the amount of requests if and only if there are more requests than
    // linked messages for the edit. This makes it so that we don't need to make new messages to accommodate
    // for a longer message than what is originally there.
    // For requests that are shorter than the original number of linked messages, only the needed amount of messages
    // will be accommodated, and the rest of the messages will be edited to a ".".

    // Grab the messageList object.
    let messageList;
    if (game.user.isGM) {
        messageList = getThisModuleSetting('messageList');
    }
    else {
        messageList = getThisModuleSetting('clientMessageList');
    }
    if (messageList.hasOwnProperty(message.id) && messageList[message.id][0]) {
        let shortestLinkedLength = Infinity;
        for (const linkedMessageIndex in messageList) {
            if (shortestLinkedLength > Object.keys(messageList[linkedMessageIndex]).length) {
                shortestLinkedLength = Object.keys(messageList[linkedMessageIndex]).length;
            }
        }
        if (allRequests.length > shortestLinkedLength) {
            //Incomplete method to edit only the number of messages that are linked to the message itself and not add any more.
            /*
            let lastTextMessageIndex = 0;
            for (let i = allRequests.length - 1; i <= 0; i--) {
                if (allRequests[i].params.content === "") {
                    continue;
                }
                else {
                    lastTextMessageIndex = i;
                }
            }
            if (firstEmbedMessageIndex) {
                if (shortestLinkedLength < firstEmbedMessageIndex + embedMessagesNum) {
                    let toMove = firstEmbedMessageIndex + embedMessagesNum - shortestLinkedLength;
                    if (toMove > shortestLinkedLength) {

                    }
                }
                // trim embeds if there are too much
                if (firstEmbedMessageIndex === 0) {
                    allRequests.splice(-((firstEmbedMessageIndex + embedMessagesNum) - shortestLinkedLength));
                }
            }
            else if (lastTextMessageIndex > shortestLinkedLength - 1) {
                allRequests.splice(-(lastTextMessageIndex - (shortestLinkedLength - 1)));
            }*/
            // For now, fail the edit.
            ui.notifications.warn("foundrytodiscord | Foundry to Discord tried to edit a message, but the resulting edit is longer than the amount of discord messages that were linked to the message.");
            return undefined;
        }
        else if (allRequests.length < shortestLinkedLength) {
            while (allRequests.length < shortestLinkedLength) {
                allRequests.push({
                    hook: hook,
                    params: {
                        username: username,
                        avatar_url: imgurl,
                        content: ".",
                        embeds: []
                    }
                });
            }
        }
    }
    return allRequests;
}

function generateDiscordAvatar(message) {
    // Prioritize chat-portrait for parity
    if (game.modules.get("chat-portrait")?.active && message.flags["chat-portrait"]?.src) {
        return generateimglink(message.flags["chat-portrait"].src);
    }

    if (message.speaker?.scene && message.speaker.token) {
        const speakerToken = game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token);
        if (speakerToken.texture?.src && speakerToken.texture.src !== "") {
            return generateimglink(speakerToken.texture.src);
        }
    }

    if (message.speaker?.actor) {
        const speakerActor = game.actors.get(message.speaker.actor);
        if (speakerActor?.prototypeToken?.texture?.src) {
            return generateimglink(speakerActor.prototypeToken.texture.src);
        }
    }

    // Probably need to remove this, honestly. Doesn't do anything in practice.
    const aliasMatchedActor = game.actors.find(actor => actor.name === message.alias);
    if (aliasMatchedActor?.prototypeToken?.texture?.src) {
        return generateimglink(aliasMatchedActor.prototypeToken.texture.src);
    }

    return generateimglink(message.user.avatar);
}

function generateDiscordUsername(message) {
    let username = message.alias;
    if (getThisModuleSetting("forceShowNames")) {
        return username;
    }
    const speakerToken = (message.speaker?.token && message.speaker?.scene)
        ? game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token)
        : undefined;
    let speakerActor = message.speaker?.actor
        ? game.actors.get(message.speaker.actor)
        : speakerToken?.actor ? speakerToken.actor : undefined; // This is longer than it should be, but I still like this.

    // POST-PARSE ALIAS VISIBILITY CHECK

    // Get both speakerToken and speakerActor, since we want many fallbacks,
    // in case a token is declared in the message but not its actor. Good for macros or other modules/systems that don't
    // rely on a token being on the canvas to create a message.
    if (anonEnabled() && (speakerToken?.actor || speakerActor)) {
        const anon = game.modules.get('anonymous').api
        // First: Check if token has an actor and use Anonymous if it does. 
        // This uses a fallback for the message actor in case it is needed.
        if (speakerToken?.actor && speakerActor !== speakerToken.actor) {
            // Fallback possibly not needed? Will keep it in for redundancy.
            speakerActor = speakerToken.actor;
        }
        if (!speakerActor) {
            // More redundancy. I take metagame visibility seriously.
            speakerActor = game.actors.find(actor => actor.name === message.alias);
        }
        if (speakerActor && !anon.playersSeeName(speakerActor)) {
            username = `${anon.getName(speakerActor)} (${censorId(speakerToken ? speakerToken.id : speakerActor.id)})`;
        }
    }
    else if (speakerToken) {
        // If user doesn't have anonymous, this defaults to the visibility of the token name on the board.
        // This is similar to the PF2e implementation of token name visibility.
        switch (speakerToken.displayName) {
            case CONST.TOKEN_DISPLAY_MODES.NONE:
            case CONST.TOKEN_DISPLAY_MODES.OWNER:
            case CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER:
            case CONST.TOKEN_DISPLAY_MODES.CONTROL:
                if (!speakerActor?.hasPlayerOwner || !speakerToken.hasPlayerOwner) {
                    username = "Unknown" + " (" + censorId(speakerToken.id) + ")";
                }
                break;
            default:
                break;
        }
    }
    return username;
}

export function createGenericRollEmbed(message) {
    let desc = ""
    let title = ""
    if (message.flavor && message.flavor.length > 0) {
        title = message.flavor;
    }
    else {
        const elements = document.createElement('div');
        elements.innerHTML = message.content;
        const flavor = elements.querySelector(".flavor-text");
        if (flavor) {
            title = flavor.textContent;
        }
        else {
            title = message.alias + "\'s Rolls";
        }
    }
    const speakerActor = game.actors.get(message.speaker.actor);
    message.rolls.forEach(roll => {
        if (getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !message.user.isGM))) {
            desc += `${dieIcon()}**\`${roll.formula}\`**\n`
            desc += `**${dieIcon()}Result: __${roll.total}__**`;
            let rollBreakdown = generateRollBreakdown(roll);
            if (rollBreakdown) {
                desc += `||(${rollBreakdown})||`;
            }
        }
        else {
            desc += `**${dieIcon()}Result: __${roll.total}__**\n\n`;
        }
    });
    return [{ title: title, description: desc.trim() }];
}

export function createCardEmbed(message) {
    const div = document.createElement("div");
    div.innerHTML = message.content;
    // Find the <h3> element and extract its text content, since h3 works for most systems
    // if not, use the first line it finds
    const h3Element = div.querySelector("h3");
    let title;
    if (h3Element?.textContent) {
        title = h3Element.textContent.trim();
    }
    else {
        //Use first line of plaintext to title the embed instead
        const lines = div.textContent.split('\n'); // Split by newline characters
        title = lines[0].trim(); // Get the first line of plain text
        const regex = new RegExp('\\b' + title + '\\b', 'i');
        div.innerHTML = div.innerHTML.replace(regex, "");

    }
    let desc = "";
    let speakerActor = undefined;
    if (message.speaker?.actor) {
        speakerActor = game.actors.get(message.speaker.actor);
    }

    //parse card description if source is from a character or actor is owned by a player
    //this is to limit metagame information and is recommended for most systems.
    //adding a setting to enable this would be an option, but is not a priority.
    let descVisible = true;

    if (speakerActor) {
        if (anonEnabled() && !game.modules.get('anonymous').api.playersSeeName(speakerActor)) {
            descVisible = false;
        }
    }
    if (descVisible) {
        let descList = div.querySelectorAll(".card-content");
        descList.forEach(function (paragraph) {
            let text = paragraph.innerHTML;
            desc += text + "\n\n";
        });
    }

    return [{ title: title, description: desc, footer: { text: getCardFooter(message.content) } }];
}

export function getCardFooter(card) {
    let displayFooter = true;
    if (anonEnabled()) {
        //true = hide, false = show
        if (game.settings.get('anonymous', "footer")) {
            displayFooter = false;
        }
    }
    if (displayFooter) {
        // Create a temporary div element to parse the HTML string
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = card;

        // Select the footer element
        const footerElement = tempDiv.querySelector('.card-footer');
        if (!footerElement) {
            return ''; // Return an empty string if no footer element is found
        }

        // Extract all <span> elements within the footer
        const spanElements = footerElement.querySelectorAll('span');

        // Create an array to store the text content of <span> elements
        const spanTexts = [];
        spanElements.forEach(span => {
            spanTexts.push(span.textContent);
        });

        // Create the "footer" string 
        const footer = spanTexts.join(' | ');

        return footer;
    }
    else {
        return "";
    }
}

export async function generateAutoUUIDEmbeds(message) {
    let embeds = [];
    const div = document.createElement('div');
    div.innerHTML = message.content;
    const links = div.querySelectorAll("a[data-uuid]");
    for (const link of links) {
        if (link) {
            const uuid = link.getAttribute('data-uuid');
            const originDoc = await fromUuid(uuid);
            if (originDoc) {
                if (originDoc instanceof Item) {
                    let title = "";
                    let desc = "";
                    title += `${originDoc.name} `;
                    desc += `\n<hr>\n`;
                    desc += await toHTML(originDoc.system.description.value, await getEnrichmentOptions(message));
                    embeds.push({ title: title, description: desc });
                }
                else if (originDoc instanceof JournalEntry || originDoc instanceof JournalEntryPage) {
                    let pages;
                    if (originDoc instanceof JournalEntry) {
                        pages = originDoc.pages;
                    }
                    else if (originDoc instanceof JournalEntryPage) {
                        pages = [originDoc];
                    }
                    let journalEmbeds = await embedsFromJournalPages(pages, reformatMessage);
                    if (journalEmbeds.length > 0) {
                        journalEmbeds[0].author = { name: "From Journal " + originDoc.name }
                    }
                    embeds.push(...journalEmbeds);
                }
            }
        }
        else {
            console.warn("foundrytodiscord | Could not generate Auto UUID Embed due to reason: Item does not exist.");
        }
        if (embeds.length > 9) {
            break;
        }
    }
    return embeds;
}


/* All text being parsed eventually goes through reformatMessage. This is the backbone of the module, and is what allows
*  HTML to be parsed into readable text. The structure of the module is a little weird, I must admit, but this is
*  the best solution I can think of.  
*/
export async function reformatMessage(text, customHTMLParser = undefined) {
    let reformattedText = text;
    reformattedText = await parseHTMLText(reformattedText, customHTMLParser);
    return reformattedText;
}

export async function parseHTMLText(htmlString, customHTMLParser = undefined) {
    let reformattedText = htmlString;
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;
    removeElementsBySelector('[style*="display:none"]', htmldoc); //remove all display:none
    // Format tables using the table parser first
    const tables = htmldoc.querySelectorAll('table');
    tables.forEach((table) => {
        const newTable2D = htmlTo2DTable(table);
        table.outerHTML = `\n${parse2DTable(newTable2D)}`;
    });


    // Remove <img> tags
    removeElementsBySelector('img', htmldoc);
    // Format inline-request-roll for Monk's TokenBar
    formatTextBySelector('.inline-roll, .inline-request-roll', text => `${dieIcon()}\`${text}\``, htmldoc);


    reformattedText = htmldoc.innerHTML;
    if (customHTMLParser) {
        reformattedText = await customHTMLParser(reformattedText);
    }
    htmldoc.innerHTML = reformattedText;

    const dataLinks = htmldoc.querySelectorAll('a[data-uuid]');
    if (dataLinks.length > 0) {
        for (const link of dataLinks) {
            const newLink = link.cloneNode(true);
            const uuid = newLink.getAttribute('data-uuid');
            const document = await fromUuid(uuid);
            let emoji = "";
            if (document) {
                switch (true) {
                    case document instanceof Actor:
                        emoji = swapOrNot(":bust_in_silhouette:", getDocumentEmoji("actor"));
                        break;
                    case document instanceof Scene:
                        emoji = swapOrNot(":map:", getDocumentEmoji("scene"));
                        break;
                    case document instanceof Macro:
                        emoji = swapOrNot(":link:", getDocumentEmoji("macro"));
                        break;
                    case document instanceof JournalEntry:
                        emoji = swapOrNot(":book:", getDocumentEmoji("journal"));
                        break;
                    case document instanceof RollTable:
                        emoji = swapOrNot(":page_facing_up:", getDocumentEmoji("rolltable"));
                        break;
                    case document instanceof Folder:
                        emoji = swapOrNot(":file_folder:", getDocumentEmoji("folder"));
                        break;
                    default:
                        emoji = swapOrNot(":baggage_claim:", getDocumentEmoji("item"));
                        break;
                }
            }
            else {
                emoji = swapOrNot(":x:", getDocumentEmoji("broken"));
            }
            newLink.innerHTML = `${emoji}\`${newLink.textContent}\``;
            link.parentNode.replaceChild(newLink, link);
        }
    }
    reformattedText = htmldoc.innerHTML;

    // Format everything else
    reformattedText = htmlCodeCleanup(reformattedText);

    return reformattedText;
}

export function removeElementsBySelector(selector, root) {
    const elements = (root || document).querySelectorAll(selector);
    elements.forEach(element => element.remove());
}

export function formatTextBySelector(selector, formatter, root) {
    const elements = (root || document).querySelectorAll(selector);
    elements.forEach(element => {
        const formattedText = formatter(element.textContent.trim());
        element.replaceWith(formattedText);
    });
}

export function htmlCodeCleanup(htmltext) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&nbsp;': ' ',
        '&quot;': '"'
    };
    for (const entity in entities) {
        const character = entities[entity];
        htmltext = htmltext.replace(new RegExp(entity, 'g'), character);
    }
    const doc = document.createElement('div');
    doc.innerHTML = htmltext;
    const selectorsAndReplacers = [
        { selector: "h1, h2", replacer: ["# ", "\n"] },
        { selector: "h3, h4", replacer: ["## ", "\n"] },
        { selector: "h5, h6", replacer: ["### ", "\n"] },
        { selector: "strong, b", replacer: ["**", "**"] },
        { selector: "em, i", replacer: ["*", "*"] },
        { selector: "s", replacer: ["~~", "~~"] },
        { selector: "code", replacer: ["`", "`"] },
        { selector: "hr", replacer: ["-----------------------"] },
        { selector: "li", replacer: ["- ", "\n"] },
        { selector: "input", replacer: [""] },
        { selector: "div", replacer: ["", "\n"] },
        { selector: "br", replacer: ["\n"] },
        { selector: "p", replacer: ["", "\n\n"] },
        { selector: "button", replacer: [""] }
    ]
    selectorsAndReplacers.forEach(({ selector, replacer }) => {
        doc.querySelectorAll(selector).forEach(element => {
            if (replacer.length === 2) {
                element.outerHTML = `${element.textContent.trim() !== "" ? `${replacer[0]}${element.innerHTML}${replacer[1]}` : ""}`;
            } else if (replacer.length === 1) {
                element.outerHTML = `${replacer[0]}`;
            }
        });
    });
    return doc.textContent
        .replace(/\n\s+/g, '\n\n') // Clean up line breaks and whitespace
        .replace(/\n*----+\n*/g, '\n-----------------------\n') // Cleanup line breaks before and after horizontal lines
        .replace(/ {2,}/g, ' ') // Clean up excess whitespace
        .replaceAll(" ", ' ').trim(); // Remove placeholder table filler
}

export function polyglotize(message, langPath = "system.traits.languages.value") {
    const getReplacementString = function (listLanguages = []) {
        if (listLanguages.length === 0) {
            let languages = new Set();
            //get a list of all PCs and player-controlled actors
            let playerActors = game.actors.filter(a => a.hasPlayerOwner);
            for (let actor of playerActors) {
                let characterLanguages = getPropertyByString(actor, langPath);;
                if (!characterLanguages) {
                    characterLanguages = getPropertyByString(actor, "system.traits.languages.value");
                    if (!characterLanguages) {
                        console.log(`foundrytodiscord | Your system "${game.system.id}" does not support Polyglot integration with this module due to a different actor structure.`)
                        return message.content;
                    }
                }
                for (let language of characterLanguages) {
                    languages.add(language);
                }
            }
            if (languages.has(message.flags.polyglot.language)) {
                return message.content;
            }
            else {
                return "*Unintelligible*";
            }
        }
        else {
            if (listLanguages.includes(message.flags.polyglot.language)) {
                return message.content;
            }
            else {
                return "*Unintelligible*";
            }
        }
    };
    let listLanguages = [];
    const defaultLanguage = game.polyglot.languageProvider.defaultLanguage;
    const messageLanguage = message.flags.polyglot.language;
    if (!(defaultLanguage === messageLanguage || game.polyglot.isLanguageUnderstood(messageLanguage))) {
        if (getThisModuleSetting("includeOnly") === "") {
            try {
                return getReplacementString();
            }
            catch (e) {
                console.log(`foundrytodiscord | Your system "${game.system.id}" does not support Polyglot integration with this module due to a different actor structure.`)
                return message.content;
            }
        }
        else {
            listLanguages = getThisModuleSetting("includeOnly").split(",").map(item => item.trim().toLowerCase());
            if (!listLanguages === null) {
                listLanguages = [];
            }
            try {
                return getReplacementString(listLanguages);
            }
            catch (e) {
                console.log(`foundrytodiscord | Your system "${game.system.id}" does not support Polyglot integration with this module due to a different actor structure.`);
                return message.content;
            }
        }
    }
    else {
        return message.content;
    }
}

export function anonymizeText(text, message) {
    const anon = game.modules.get("anonymous").api;
    const curScene = game.scenes.get(message.speaker.scene);
    const speakerActor = message.actor;
    let anonymizedText = text;
    if (curScene) {
        const speakerToken = curScene.tokens.get(message.speaker.token);
        if (text && speakerToken?.actor && !anon.playersSeeName(speakerToken.actor)) {
            anonymizedText = anonymizedText
                .replace(new RegExp(`\\b${speakerToken.name}\\b`, 'gi'), anon.getName(speakerToken.actor));
        }
    }
    else if (speakerActor && !anon.playersSeeName(speakerActor)) {
        anonymizedText = anonymizedText.replace(new RegExp(`\\b${speakerActor.name}\\b`, 'gi'), anon.getName(speakerActor));
    }
    return anonymizedText;
}

export async function embedsFromJournalPages(pages) {
    let embeds = []
    let oneOrMoreUnsupported = false;
    for (const pageData of pages) {
        switch (pageData.type) {
            case "text":
                const textEmbed = {
                    title: pageData.name,
                    description: pageData.text.content
                };
                embeds.push(textEmbed)
                break;
            case "image":
                embeds.push({
                    title: pageData.name,
                    image: {
                        url: generateimglink(pageData.src)
                    },
                    footer: {
                        text: pageData.image.caption
                    }
                });
                break;
            default:
                oneOrMoreUnsupported = true;
                break;
        }
        if (embeds.length > 9) {
            console.warn("foundrytodiscord: Limiting to 10 pages...");
            break;
        }
    }
    if (oneOrMoreUnsupported) {
        ui.notifications.warn("foundrytodiscord: One or more journal pages are not supported to send to Discord automatically. Only text and images are supported.");
    }
    return embeds;
}

export function tokenBar_createTokenBarCard(message) {
    // First, list token properties
    const div = document.createElement('div');
    div.innerHTML = message.content;
    let title = "";
    let desc = ""
    let cardheader;
    let actorData;
    let footer = {};
    switch (message.flags["monks-tokenbar"].what) {
        case 'contestedroll':
            cardheader = div.querySelector('.card-header');
            title = cardheader.querySelector('h3').textContent;
            const requests = div.querySelectorAll('.request-name');
            if (requests.length > 0) {
                desc += "**__";
                for (let i = 0; i < requests.length; i++) {
                    desc += requests[i].textContent;
                    if (i < requests.length - 1) {
                        desc += " vs. ";
                    }
                }
                desc += "__**";
            }
            if (desc !== "") {
                desc += "\n\n";
            }
            actorData = div.querySelectorAll('li.item.flexrow');
            if (actorData.length > 0) {
                for (let i = 0; i < actorData.length; i++) {
                    const tokenID = actorData[i].getAttribute('data-item-id');
                    const tokenData = message.flags["monks-tokenbar"]["token" + tokenID]
                    switch (tokenData.passed) {
                        case 'waiting':
                            desc += `${dieIcon()} `;
                            break;
                        case 'won':
                            desc += ":white_check_mark: ";
                            break;
                        case 'failed':
                            desc += ":negative_squared_cross_mark: ";
                            break;
                        default:
                            desc += `${dieIcon()} `;
                            break;
                    }
                    desc += "**" + (tokenData.passed === 'won' ? "__" : "") + tokenData.name;
                    if (tokenData.total) {
                        if (message.flags["monks-tokenbar"].rollmode === 'roll') {
                            desc += "(" + (tokenData.passed === 'won' ? "" : "__") + tokenData.total + "__)**";
                        }
                        else {
                            let actor = game.actors.get(tokenData.actorid);
                            if (actor.hasPlayerOwner) {
                                desc += "(" + (tokenData.passed === 'won' ? "" : "__") + tokenData.total + "__)**";
                            }
                            else {
                                desc += "(Rolled)" + (tokenData.passed === 'won' ? "__" : "") + "**";
                            }
                        }
                    }
                    else {
                        desc += "**";
                    }
                    desc += "\n\n";
                }
            }
            break;
        case 'savingthrow':
            cardheader = div.querySelector('.card-header');
            title = cardheader.querySelector('h3').textContent;
            actorData = div.querySelectorAll('li.item.flexcol');
            if (actorData.length > 0) {
                for (let i = 0; i < actorData.length; i++) {
                    const tokenID = actorData[i].getAttribute('data-item-id');
                    const tokenData = message.flags["monks-tokenbar"]["token" + tokenID];
                    if (message.flags["monks-tokenbar"].rollmode !== "gmroll") {
                        switch (tokenData.passed) {
                            case 'waiting':
                                desc += `${dieIcon()} `;
                                break;
                            case true:
                                desc += ":white_check_mark: ";
                                break;
                            case false:
                                desc += ":negative_squared_cross_mark: ";
                                break;
                            case 'success':
                                desc += ":white_check_mark::white_check_mark: ";
                                break;
                            case 'failed':
                                desc += ":no_entry_sign: ";
                                break;
                            default:
                                desc += `${dieIcon()} `;
                                break;
                        }
                    }
                    else {
                        desc += `${dieIcon()} `;
                    }
                    desc += "**" + tokenData.name;
                    if (tokenData.total || tokenData.total === 0) {
                        if (message.flags["monks-tokenbar"].rollmode === 'roll') {
                            desc += "(__" + tokenData.total + "__)**";
                        }
                        else {
                            let actor = game.actors.get(tokenData.actorid);
                            if (actor.hasPlayerOwner) {
                                desc += "(__" + tokenData.total + "__)**";
                            }
                            else {
                                desc += "(Rolled)" + (tokenData.passed === 'won' ? "__" : "") + "**";
                            }
                        }
                    }
                    else {
                        desc += "**";
                    }
                    desc += "\n\n";
                }
            }
            break;
        default: //"what" doesn't exist in an experience card. Not the cleanest solution. There's only three anyways.
            title = "Experience: " + message.flags["monks-tokenbar"].xp;
            if (message.flags["monks-tokenbar"].actors.length > 0) {
                message.flags["monks-tokenbar"].actors.forEach(actor => {
                    desc += "**" + actor.name + " (" + actor.xp + ")**";
                    if (actor.assigned) {
                        desc += ":white_check_mark:";
                    }
                    desc += "\n\n";
                });
            }
            footer = { text: message.flags["monks-tokenbar"].reason };
            break;
    }
    return [{ title: title, description: desc.trim(), footer: footer }];
}

export function createHTMLDiceRollEmbed(message) {
    const title = message.flavor;
    let desc = "";
    const elements = document.createElement('div');
    elements.innerHTML = message.content;
    const diceResults = elements.querySelectorAll('.dice-total');
    diceResults.forEach((total) => {
        if (Number(total.textContent)) {
            desc += `${dieIcon()} **Result: __${total.textContent}__**\n`;
        }
        else {
            desc += "**" + total.textContent + "**\n";
        }
    })
    return [{ title: title, description: desc }];
}

//Complex recursion to find die terms and add them all together in one breakdown
export function generateRollBreakdown(roll, nextTerm = false) {
    let rollBreakdown = ""
    let termcount = 1;
    roll.terms.forEach((term) => {
        let currentTermString = "";
        switch (true) {
            case term instanceof DiceTerm:
                let i = 1;
                const notDieEmoji = function () {
                    if (term.faces && getDieEmoji(term.faces)) {
                        return false;
                    } else {
                        return true;
                    }
                }();
                currentTermString += " ";
                term.results.forEach(dieResult => {
                    if (dieResult.active) {
                        currentTermString += `${swapOrNot(` ${dieResult.result}`, getDieEmoji(term.faces, dieResult.result))}`;
                        if ((notDieEmoji && i < term.results.length) || (nextTerm && (roll.terms[termcount] && (!roll.terms[termcount] instanceof OperatorTerm)))) {
                            currentTermString += " +";
                        }
                    }
                    i++;
                });
                if (notDieEmoji) {
                    currentTermString = ` \`${term.faces ? `d${term.faces}` : ""}[${currentTermString.trim()}]\``;
                }
                break;
            case term instanceof PoolTerm || term.hasOwnProperty("rolls"):
                let poolRollCnt = 1;
                term.rolls.forEach(poolRoll => {
                    currentTermString += ` ${generateRollBreakdown(poolRoll, true)}`;
                    if (poolRollCnt <= term.rolls.length) {
                        currentTermString += " +";
                    }
                    poolRollCnt++;
                });
                break;
            case term instanceof OperatorTerm:
                currentTermString += ` ${term.operator}`;
                break;
            case term instanceof NumericTerm:
                currentTermString += ` ${term.number}`
                break;
            case term.hasOwnProperty("term"):
                currentTermString += ` (${generateRollBreakdown({ terms: [term.term] }, true)})`;
                break;
            case term.hasOwnProperty("roll"):
                currentTermString += ` ${generateRollBreakdown(term.roll, true)}`;
                break;
            case term.hasOwnProperty("terms"):
                term.terms.forEach(termTerm => {
                    if (termTerm.rolls) {
                        termTerm.rolls.forEach(termTermRoll => {
                            currentTermString += ` ${generateRollBreakdown(termTermRoll, true)}`;
                        })
                    }
                });
                break;
            default:
                currentTermString += "error";
                break;
        }
        rollBreakdown += currentTermString;
        termcount++;
    });
    if (!nextTerm && rollBreakdown.includes("error")) {
        console.error("foundrytodiscord | Could not parse dice emojis due to a unique roll structure.");
        return roll.result;
    }
    return rollBreakdown.trim();
}

export function isCard(htmlString) {
    const htmldocElement = document.createElement('div');
    htmldocElement.innerHTML = htmlString;
    const divElement = htmldocElement.querySelector('.chat-card');
    if (divElement !== null) {
        return true;
    } else {
        return false;
    }
}

export function hasDiceRolls(htmlString) {
    const elements = document.createElement('div');
    elements.innerHTML = htmlString;
    const diceRolls = elements.querySelectorAll('.dice-roll');
    if (diceRolls.length > 0) {
        return true;
    }
    else {
        return false;
    }
}

export function willAutoUUIDEmbed(htmlString) {
    if (!getThisModuleSetting("autoUuidEmbed")) {
        return false;
    }
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const links = div.querySelectorAll("a[data-uuid]");
    if (links.length > 0) {
        links.forEach(link => link.remove());
        if (div.textContent.trim() === "") {
            div.innerHTML = htmlString;
            return true;
        }
    }
    div.innerHTML = htmlString;
    return false;
}

export function tokenBar_isTokenBarCard(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    const divElement = div.querySelector('.monks-tokenbar');
    if (divElement !== null) {
        return true;
    } else {
        return false;
    }
}

function getPropertyByString(obj, propString) {
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


function censorId(docid) {
    // Censors IDs for anonymized names
    const firstPart = docid.substring(0, 4);
    const censoredId = `${firstPart}****`;

    return censoredId;
}