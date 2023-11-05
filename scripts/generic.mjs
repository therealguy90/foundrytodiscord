import { htmlTo2DTable } from './helpers/tables.mjs';
import { parse2DTable } from './helpers/tables.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { splitEmbed } from './helpers/embeds.mjs';
import { hexToColor } from './helpers/embeds.mjs';

export function messageParserGeneric(msg) {
    let constructedMessage = '';
    let embeds = [];
    if (game.modules.get('monks-tokenbar')?.active && tokenBar_isTokenBarCard(msg.content)) {
        embeds = tokenBar_createTokenBarCard(msg);
    }
    else if (isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = createCardEmbed(msg);
        }
    }
    else if (!msg.isRoll) {
        if (hasDiceRolls(msg.content)) {
            embeds = createHTMLDiceRollEmbed(msg);
            const elements = document.createElement('div');
            elements.innerHTML = msg.content;
            const diceRolls = elements.querySelectorAll('.dice-roll');
            for (const div of diceRolls) {
                div.parentNode.removeChild(div);
            }
            msg.content = elements.innerHTML;
        }
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * for PF2e and DnD5e, this would be actor.system.traits.languages.value
        * the polyglotize() function should be edited for other systems
        */
        if (game.modules.get("polyglot")?.active && msg.flags?.polyglot?.language) {
            if (!getThisModuleSetting("commonLanguages").toLowerCase().includes(msg.flags.polyglot.language)) {
                if (getThisModuleSetting("includeOnly") == "") {
                    constructedMessage = polyglotize(msg);
                }
                else {
                    listLanguages = getThisModuleSetting("includeOnly").split(",").map(item => item.trim().toLowerCase());
                    if (!listLanguages == null) {
                        listLanguages = [];
                    }
                    try {
                        constructedMessage = polyglotize(msg, listLanguages);
                    }
                    catch (e) {
                        console.log(e);
                        console.log("foundrytodiscord | Your system \"" + game.system.id + "\" does not support Polyglot integration with this module due to a different actor structure.")
                    }
                }
            }
        }
        if (constructedMessage == '') {
            constructedMessage = msg.content;
        }
    }
    else if (msg.rolls.length === 0) {
        if (msg.flavor) {
            embeds = [{ title: msg.flavor, description: msg.content }];
        }
        else {
            constructedMessage = msg.content;
        }
    }
    else {
        console.log("foundrytodiscord | System \"" + game.system.id + "\" is not supported for special roll embeds.")
        embeds = createGenericRollEmbed(msg);
    }

    //Fix formatting before sending
    if (embeds != [] && embeds.length > 0) {
        embeds[0].description = reformatMessage(embeds[0].description);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === embeds[0].title) ? "" : msg.flavor;
        //use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        //sadly, the anonymous module does this right before the message is displayed in foundry, so we have to parse it here.
        if (anonEnabled()) {
            for (let i = 0; i < embeds.length; i++) {
                embeds[i] = anonymizeEmbed(msg, embeds[i]);
            }
        }
    }
    constructedMessage = reformatMessage(constructedMessage);
    if (constructedMessage !== "" || embeds.length > 0) { //avoid sending empty messages
        return getRequestParams(msg, constructedMessage, embeds);
    }
    else {
        return false;
    }
}

export function getRequestParams(message, msgText, embeds) {
    let imgurl = generateDiscordAvatar(message);
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

    return { hook: hook, params: generateRequestParams(message, msgText, embeds, imgurl) };
}

function generateRequestParams(message, msgText, embeds, imgurl) {
    let alias = message.alias;
    let speakerActor;
    if (anonEnabled()) {
        let anon = game.modules.get('anonymous').api;
        //First priority: Use speaker token name and check if actor's name is visible through anonymous
        if (message?.speaker?.token && message.speaker.token !== "") {
            const scene = game.scenes.get(message.speaker.scene);
            if (scene) {
                const speakerToken = scene.tokens.get(message.speaker.token);
                if (speakerToken?.actor) {
                    speakerActor = speakerToken.actor
                }
            }
        }
        else {
            speakerActor = game.actors.find(actor => actor.name === message.alias);
        }
        if (speakerActor) {
            if (!anon.playersSeeName(speakerActor) && speakerActor.type !== "character") {
                alias = anon.getName(speakerActor) + " (" + speakerActor.id + ")";
            }
        }
    }
    if (embeds[0]?.description?.length > 4000) {
        embeds = splitEmbed(embeds[0]);
    }
    // Add username to embed
    if (embeds[0] && message.user && message.alias !== message.user && getThisModuleSetting('showAuthor')) {
        embeds[0].author = {
            name: message.user.name,
            icon_url: generateimglink(message.user.avatar)
        }
    }
    embeds.forEach((embed) => {
        // Add color to all embeds
        if (message.user?.color) {
            embed.color = hexToColor(message.user.color);
        }
    })

    const params = {
        username: alias,
        avatar_url: imgurl,
        content: msgText,
        embeds: embeds
    };
    return params;
}

export function createGenericRollEmbed(message) {
    let desc = ""
    let title = ""
    if (message.flavor && message.flavor.length > 0) {
        title = message.flavor;
        if (desc !== "") {
            desc = desc + "\n";
        }
        for (let i = 0; i < message.rolls.length; i++) {
            desc = desc + "**:game_die:Result: **" + "__**" + message.rolls[i].total + "**__";
            desc = desc + "\n";
        }
    }
    else {
        title = message.alias + '\'s Rolls';
        message.rolls.forEach(roll => {
            desc = desc + 'Rolled ' + roll.formula + ', and got a ' + roll.result.replaceAll("+ 0", "") + " = **" + roll.total + "**\n";
        })
    }
    return [{ title: title, description: desc }];
}

export function createHTMLDiceRollEmbed(message) {
    const title = message.flavor;
    let desc = "";
    const elements = document.createElement('div');
    elements.innerHTML = message.content;
    const diceResults = elements.querySelectorAll('.dice-total');
    diceResults.forEach((total) => {
        if (Number(total.textContent)) {
            desc += ":game_die: **Result: __" + total.textContent + "__**\n";
        }
        else {
            desc += "**" + total.textContent + "**\n";
        }
    })
    return [{ title: title, description: desc }];
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

export function createCardEmbed(message) {
    let card = message.content;
    const parser = new DOMParser();
    let regex = /<[^>]*>[^<]*\n[^<]*<\/[^>]*>/g;
    card = card.replace(regex, (match) => match.replace(/\n/g, ''));
    card = card.replace(regex, "");
    let doc = parser.parseFromString(card, "text/html");
    // Find the <h3> element and extract its text content, since h3 works for most systems
    // if not, use the first line it finds
    const h3Element = doc.querySelector("h3");
    let title;
    if (h3Element?.textContent) {
        title = h3Element.textContent.trim();
    }
    else {
        //Use first line of plaintext to title the embed instead
        const strippedContent = card.replace(/<[^>]+>/g, ' ').trim(); // Replace HTML tags with spaces
        const lines = strippedContent.split('\n'); // Split by newline characters
        title = lines[0].trim(); // Get the first line of plain text
        const regex = new RegExp('\\b' + title + '\\b', 'i');
        card = card.replace(regex, "");

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
        if (anonEnabled() && !isOwnedByPlayer(speakerActor)) {
            descVisible = false;
        }
    }
    if (descVisible) {
        let descList = doc.querySelectorAll(".card-content");
        descList.forEach(function (paragraph) {
            let text = paragraph.innerHTML;
            desc += text + "\n\n";
        });
    }

    return [{ title: title, description: desc, footer: { text: getCardFooter(card) } }];
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

export function polyglotize(message, playerlanguages = []) {
    //get a list of all PCs
    if (playerlanguages == [] || playerlanguages.length == 0) {
        let characters = game.actors.filter(a => a.type === "character");
        let languages = new Set();
        for (let character of characters) {
            let characterLanguages = character.system.traits.languages.value;
            for (let language of characterLanguages) {
                languages.add(language);
            }
        }

        if (languages.has(message.flags.polyglot.language)) {
            return message.content;
        }
        else {
            return "*Unintelligible*"
        }
    }
    else {
        if (playerlanguages.includes(message.flags.polyglot.language)) {
            return message.content;
        }
        else {
            return "*Unintelligible*"
        }
    }
}

export function anonymizeEmbed(message, embed) {
    const anon = game.modules.get("anonymous").api;
    const curScene = game.scenes.get(message.speaker.scene);

    if (curScene) {
        const speakerToken = curScene.tokens.get(message.speaker.token);

        if (speakerToken && !anon.playersSeeName(speakerToken.actor)) {
            embed.title = anonymizeText(embed.title, speakerToken);
            embed.description = anonymizeText(embed.description, speakerToken);
        }
    }

    return embed;
}

function anonymizeText(text, speakerToken) {
    const anon = game.modules.get("anonymous").api;
    if (text) {
        return text
            .replace(new RegExp(speakerToken.name, 'gi'), anon.getName(speakerToken.actor))
            .replace(new RegExp(speakerToken.actor.name, 'gi'), anon.getName(speakerToken.actor));
    }
    return text;
}

export function tokenBar_createTokenBarCard(message) {
    // First, list token properties
    const parser = new DOMParser();
    let doc = parser.parseFromString(message.content, "text/html");
    let title = "";
    let desc = ""
    let cardheader;
    let actorData;
    let footer = {};
    switch (message.flags["monks-tokenbar"].what) {
        case 'contestedroll':
            cardheader = doc.querySelector('.card-header');
            title = cardheader.querySelector('h3').textContent;
            const requests = doc.querySelectorAll('.request-name');
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
            actorData = doc.querySelectorAll('li.item.flexrow');
            if (actorData.length > 0) {
                for (let i = 0; i < actorData.length; i++) {
                    const tokenID = actorData[i].getAttribute('data-item-id');
                    const tokenData = message.flags["monks-tokenbar"]["token" + tokenID]
                    switch (tokenData.passed) {
                        case 'waiting':
                            desc += ':game_die: ';
                            break;
                        case 'won':
                            desc += ":white_check_mark: ";
                            break;
                        case 'failed':
                            desc += ":negative_squared_cross_mark: ";
                            break;
                        default:
                            desc += ':game_die: ';
                            break;
                    }
                    desc += "**" + (tokenData.passed === 'won' ? "__" : "") + tokenData.name;
                    if (tokenData.total) {
                        if (message.flags["monks-tokenbar"].rollmode === 'roll') {
                            desc += "(" + (tokenData.passed === 'won' ? "" : "__") + tokenData.total + "__)**";
                        }
                        else {
                            let actor = game.actors.get(tokenData.actorid);
                            if (isOwnedByPlayer(actor)) {
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
            cardheader = doc.querySelector('.card-header');
            title = cardheader.querySelector('h3').textContent;
            actorData = doc.querySelectorAll('li.item.flexcol');
            if (actorData.length > 0) {
                for (let i = 0; i < actorData.length; i++) {
                    const tokenID = actorData[i].getAttribute('data-item-id');
                    const tokenData = message.flags["monks-tokenbar"]["token" + tokenID]
                    switch (tokenData.passed) {
                        case 'waiting':
                            desc += ':game_die: ';
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
                            desc += ':game_die: ';
                            break;
                    }
                    desc += "**" + tokenData.name;
                    if (tokenData.total || tokenData.total === 0) {
                        if (message.flags["monks-tokenbar"].rollmode === 'roll') {
                            desc += "(__" + tokenData.total + "__)**";
                        }
                        else {
                            let actor = game.actors.get(tokenData.actorid);
                            if (isOwnedByPlayer(actor)) {
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

export function tokenBar_isTokenBarCard(htmlString) {
    const htmldocElement = document.createElement('div');
    htmldocElement.innerHTML = htmlString;

    const divElement = htmldocElement.querySelector('.monks-tokenbar');
    if (divElement !== null) {
        return true;
    } else {
        return false;
    }
}

export function isOwnedByPlayer(actor) {
    let isOwned = false;
    game.users.filter(user => !user.isGM).forEach(player => {
        if(actor.testUserPermission(player, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)){
            isOwned = true;
            return;
        }
    });
    return isOwned;
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

export function parseHTMLText(htmlString, customHTMLParser = undefined) {
    let reformattedText = htmlString;

    // Cleanup newlines in raw text before parsing
    reformattedText = reformattedText.replace(/<[^>]*>[^<]*\n[^<]*<\/[^>]*>/g, match => match.replace(/\n/g, ''));

    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;

    // Remove elements with data-visibility attribute and hidden styles
    ['[data-visibility="gm"]', '[data-visibility="owner"]', '[style*="display:none"]'].forEach(selector => {
        const elements = htmldoc.querySelectorAll(selector);
        elements.forEach(element => element.parentNode.removeChild(element));
    });
    htmldoc.innerHTML = htmldoc.innerHTML.replace(/<table/g, '\n<table')
    const tables = htmldoc.querySelectorAll('table');
    tables.forEach((table) => {
        const newTable2D = htmlTo2DTable(table);
        table.outerHTML = parse2DTable(newTable2D);
    });

    // Remove <img> tags
    removeElementsBySelector('img', htmldoc);
    // Format various elements
    formatTextBySelector('.inline-roll', text => `:game_die:\`${text}\``, htmldoc);
    
    const dataLinks = htmldoc.querySelectorAll('a[data-uuid]');
    if(dataLinks.length > 0){
        dataLinks.forEach(link => {
            const newLink = link.cloneNode(true);
            const uuid = newLink.getAttribute('data-uuid');
            newLink.textContent = "@UUID[" + uuid + "]";
            link.parentNode.replaceChild(newLink, link);
        });
    }
    
    reformattedText = htmldoc.innerHTML;

    if (customHTMLParser) {
        reformattedText = customHTMLParser(reformattedText);
    }

    // Format everything else
    reformattedText = htmlCodeCleanup(reformattedText);

    return reformattedText;
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
    return htmltext.replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/g, '**$2**') // Format header tags
        .replace(/<(strong|b)>|<\/(strong|b)>/g, '**') // Format strong/bold tags
        .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*') // Format em/italic tags
        .replace(/<hr[^>]*>/g, '-----------------------') // Format hr tags
        .replace(/>\s+</g, '><') // Remove indentation and formatting
        .replace(/<li>/g, '- ') // Remove <li> tags
        .replace(/<\/li>/g, '\n') // Format line breaks after </li>
        .replace(/<input[^>]*>.*?<\/input>|<input[^>]*>/gi, '') // Remove <input> tags
        .replace(/<div>|<\/div>/g, '\n') // Remove <div> tags and format line breaks
        .replace(/<br\s*\/?>/gi, '\n') // Format <br> tags as line breaks
        .replace(/<p>|<\/p>/g, '\n\n') // Remove <p> tags and format line breaks
        .replace(/<[^>]*>?/gm, '') // Remove all remaining tags
        .replace(/\n\s+/g, '\n\n') // Clean up line breaks and whitespace
        .replace(/\n-+\n/g, '-----------------------') // Cleanup additional line breaks after horizontal lines
        .replace(/ {2,}/g, ' ') // Clean up excess whitespace
        .replaceAll(" ", ' '); //Cleanup table filler with real spaces
}


//reformatMessage makes text readable.
export function reformatMessage(text, customHTMLParser = undefined) {
    let reformattedText = replaceGenericAtTags(text);
    const isHtmlFormatted = /<[a-z][\s\S]*>/i.test(reformattedText);
    if (isHtmlFormatted) {
        reformattedText = parseHTMLText(reformattedText, customHTMLParser);
        reformattedText = replaceGenericAtTags(reformattedText); // call again, since <a> links are replaced with uuids
    }
    return reformattedText;
}

function replaceGenericAtTags(text) {
    const regexAtTags = /@([^]+?)\[([^]+?)\](?:\{([^]+?)\})?/g;
    let reformattedText = text.replace(regexAtTags, (match, atTagType, identifier, customText) => {
        let toReplace = "";
        let document;

        let isId = true;
        if (identifier.length !== 16) {
            isId = false;
        }
        let doctype = "";
        switch (atTagType) {
            case "Localize":
                toReplace = replaceGenericAtTags(game.i18n.localize(identifier));
                break;
            case "UUID":
                document = fromUuidSync(identifier);
                break;
            case "Compendium":
                document = fromUuidSync("Compendium." + identifier);
                break;
            case "Actor":
                doctype = "actors";
                break;
            case "Item":
                doctype = "items";
                break;
            case "Scene":
                doctype = "scenes";
                break;
            case "Macro":
                doctype = "macros";
                break;
            case "JournalEntry":
                doctype = "journals";
                break;
            case "RollTable":
                doctype = "tables";
                break;
            default:
                document = undefined;
                break;
        }
        if (doctype !== "") {
            if (isId) {
                document = game[doctype].get(identifier);
            }
            else {
                document = game[doctype].find(document => document.name === identifier);
            }
        }
        if (document) {
            switch (true) {
                case document instanceof Actor:
                    toReplace += ":bust_in_silhouette: ";
                    break;
                case document instanceof Scene:
                    toReplace += ":map: ";
                    break;
                case document instanceof Macro:
                    toReplace += ":link: ";
                    break;
                case document instanceof JournalEntry:
                    toReplace += ":book: ";
                    break;
                case document instanceof RollTable:
                    toReplace += ":page_facing_up: ";
                    break;
                case document instanceof Folder:
                    toReplace += ":file_folder: ";
                    break;
                default:
                    toReplace += ":baggage_claim: ";
                    break;
            }
        }
        if (toReplace !== "") {
            if (customText && customText !== "") {
                toReplace += "`" + customText + "`";
            }
            else if (document) {
                toReplace += "`" + document.name + "`";
            }
        }
        else {
            toReplace = match;
        }
        return toReplace;
    });
    return reformattedText;
}

function generateDiscordAvatar(message) {
    if (message.speaker?.scene && message.speaker.scene !== null && message.speaker.token) {
        const speakerToken = game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token);
        if (speakerToken.texture?.src && speakerToken.texture.src != "") {
            return generateimglink(speakerToken.texture.src);
        }
    }

    if (message.speaker?.actor && message.speaker.actor !== null) {
        const speakerActor = game.actors.get(message.speaker.actor);
        if (speakerActor?.prototypeToken?.texture?.src) {
            return generateimglink(speakerActor.prototypeToken.texture.src);
        }
    }

    const aliasMatchedActor = game.actors.find(actor => actor.name === message.alias);
    if (aliasMatchedActor?.prototypeToken?.texture?.src) {
        return generateimglink(aliasMatchedActor.prototypeToken.texture.src);
    }

    return generateimglink(message.user?.avatar);
}

export function generateimglink(img) {
    const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    let imgUrl;
    if (!img || (img && img === "")) {
        return getDefaultAvatarLink()
    }
    if (img.includes("http")) {
        imgUrl = img;
    } else {
        if (getThisModuleSetting('inviteURL') !== "http://") {
            imgUrl = (getThisModuleSetting('inviteURL') + img);
        }
        else {
            return "";
        }
    }
    const urlParts = imgUrl.split('.');
    let fileExtension = urlParts[urlParts.length - 1].toLowerCase();
    if (fileExtension.split('?').length > 1) {
        fileExtension = fileExtension.split('?')[0];
    }
    if (supportedFormats.includes(fileExtension)) {
        return imgUrl;
    }
    else {
        return getDefaultAvatarLink();
    }
}

export function getDefaultAvatarLink() {
    if (getThisModuleSetting('inviteURL') !== "http://") {
        return getThisModuleSetting('inviteURL') + "modules/foundrytodiscord/src/images/defaultavatar.png";
    }
    else {
        return "";
    }
}

