import { htmlTo2DTable } from './helpers/tables.mjs';
import { parse2DTable } from './helpers/tables.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { splitEmbed } from './helpers/embeds.mjs';
import { hexToColor } from './helpers/embeds.mjs';

export function messageParserGeneric(msg) {
    let constructedMessage = '';
    let hookEmbed = [];
    if (game.modules.get('monks-tokenbar')?.active && tokenBar_isTokenBarCard(msg.content)) {
        hookEmbed = tokenBar_createTokenBarCard(msg);
    }
    else if (isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            hookEmbed = createCardEmbed(msg);
        }
    }
    else if (!msg.isRoll) {
        if (hasDiceRolls(msg.content)) {
            hookEmbed = createHTMLDiceRollEmbed(msg);
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
        if (game.modules.get("polyglot")?.active && propertyExists(msg, "flags.polyglot.language")) {
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
    else {
        console.log("foundrytodiscord | System \"" + game.system.id + "\" is not supported for special roll embeds.")
        hookEmbed = createGenericRollEmbed(msg);

    }

    //Fix formatting before sending
    if (hookEmbed != [] && hookEmbed.length > 0) {
        hookEmbed[0].description = reformatMessage(hookEmbed[0].description);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === hookEmbed[0].title) ? "" : msg.flavor;
        //use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        //sadly, the anonymous module does this right before the message is displayed in foundry, so we have to parse it here.
        if (anonEnabled()) {
            let anon = game.modules.get("anonymous").api;
            let curScene = game.scenes.get(msg.speaker.scene);
            if (curScene) {
                let speakerToken = curScene.tokens.get(msg.speaker.token);
                if (speakerToken) {
                    if (!anon.playersSeeName(speakerToken.actor)) {
                        hookEmbed[0].title = hookEmbed[0].title.replaceAll(speakerToken.name, anon.getName(speakerToken.actor))
                            .replaceAll(speakerToken.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase())
                            .replaceAll(speakerToken.actor.name, anon.getName(speakerToken.actor))
                            .replaceAll(speakerToken.actor.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase());
                        hookEmbed[0].description = hookEmbed[0].description.replaceAll(speakerToken.name, anon.getName(speakerToken.actor))
                            .replaceAll(speakerToken.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase())
                            .replaceAll(speakerToken.actor.name, anon.getName(speakerToken.actor))
                            .replaceAll(speakerToken.actor.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase());
                    }
                }
            }
        }
    }
    constructedMessage = reformatMessage(constructedMessage);
    if (constructedMessage !== "" || hookEmbed.length > 0) { //avoid sending empty messages
        return getRequestParams(msg, constructedMessage, hookEmbed);
    }
    else {
        return false;
    }
}

export function getRequestParams(message, msgText, hookEmbed) {
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

    return { hook: hook, params: generateRequestParams(message, msgText, hookEmbed, imgurl) };
}

function generateRequestParams(message, msgText, hookEmbed, imgurl) {
    let alias = message.alias;
    let speakerActor;
    if (anonEnabled()) {
        let anon = game.modules.get('anonymous').api;
        //First priority: Use speaker token name and check if actor's name is visible through anonymous
        if (propertyExists(message, "speaker.token")) {
            if (message.speaker.token !== "") {
                const scene = game.scenes.get(message.speaker.scene);
                if (scene) {
                    const speakerToken = scene.tokens.get(message.speaker.token);
                    if (speakerToken) {
                        if (propertyExists(speakerToken, "actor")) {
                            speakerActor = speakerToken.actor
                        }
                    }
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
    if (hookEmbed[0]?.description?.length > 4000) {
        hookEmbed = splitEmbed(hookEmbed[0]);
    }
    // Add username to embed
    if (hookEmbed[0] && message.user && message.alias !== message.user && getThisModuleSetting('showAuthor')) {
        hookEmbed[0].author = {
            name: message.user.name,
            icon_url: generateimglink(message.user.avatar)
        }
    }
    hookEmbed.forEach((embed) => {
        // Add color to all embeds
        if (message.user?.color) {
            embed.color = hexToColor(message.user.color);
        }
    })

    const params = {
        username: alias,
        avatar_url: imgurl,
        content: msgText,
        embeds: hookEmbed
    };
    return params;
}

export function createGenericRollEmbed(message) {
    let desc = ""
    let title = ""
    let anon;
    if (anonEnabled()) {
        anon = game.modules.get("anonymous").api;
    }
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
            desc = desc + 'Rolled ' + roll.formula + ', and got a ' + roll.result + " = **" + roll.total + "**\n";
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

export function getLocalizedText(localizationKey) {
    return game.i18n.localize(localizationKey);
}

export function getNameFromItem(itempath) {
    let itemID = ""
    let itemName = ""
    const parts = (itempath).split('.');
    if (parts.length > 1) {
        itemID = parts[parts.length - 1];
    }
    switch (parts[0]) {
        case "Actor":
            let actorID = parts[1];
            let actor = game.actors.get(actorID);
            let item = actor.items.get(itemID);
            itemName = item ? item.name : undefined;
            break;
        case "Macro":
            let macroID = parts[1];
            let macro = game.macros.get(actorID);
            itemName = macro ? macro.name : undefined;
            break;
        case "Compendium":
            let compendiumName = ""
            for (let i = 1; i < parts.length - 2; i++) {
                compendiumName = compendiumName + parts[i];
                if (i < parts.length - 3) {
                    compendiumName = compendiumName + ".";
                }
            }
            itemName = game.packs.get(compendiumName).get(itemID).name;
            break;
        default:
            if (itemID == "") {
                itemID = (itempath);
            }
            itemName = ":baggage_claim: `" + game.items.get(itemID).name + "`";
            return itemName;
            break;
    }

    if (itemName) {
        return ":baggage_claim: `" + itemName + "`";
    }
    else { //Failsafe just in case.
        return ":baggage_claim: `undefined`";
    }
}

//Separates @Check arguments into individual objects, might be used in some systems
export function parseCheckString(checkString) {
    let check = {};

    // Split the string into an array of key-value pairs
    let pairs = checkString.split("|");

    // Loop through the pairs and add them to the check object
    for (let i = 0; i < pairs.length; i++) {
        let [key, value] = pairs[i].split(":");
        check[key] = value === "true" ? true : value === "false" ? false : value;
    }

    return check;
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
    //replace horizontal line tags with paragraphs so they can be parsed later
    card = card.replace(/<hr[^>]*>/g, "<p>-----------------------</p>");
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
    if (propertyExists(message, "speaker.actor")) {
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
    let anon = game.modules.get("anonymous").api;
    let curScene = game.scenes.get(message.speaker.scene);
    if (curScene) {
        let speakerToken = curScene.tokens.get(message.speaker.token);
        if (speakerToken) {
            if (!anon.playersSeeName(speakerToken.actor)) {
                if (embed.title) {
                    embed.title = embed.title !== "" ? embed.title.replaceAll(speakerToken.name, anon.getName(speakerToken.actor))
                        .replaceAll(speakerToken.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase())
                        .replaceAll(speakerToken.actor.name, anon.getName(speakerToken.actor))
                        .replaceAll(speakerToken.actor.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase()) : "";
                }
                if (embed.description) {
                    embed.description = embed.description !== "" ? embed.description.replaceAll(speakerToken.name, anon.getName(speakerToken.actor))
                        .replaceAll(speakerToken.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase())
                        .replaceAll(speakerToken.actor.name, anon.getName(speakerToken.actor))
                        .replaceAll(speakerToken.actor.name.toLowerCase(), anon.getName(speakerToken.actor).toLowerCase()) : "";
                }
            }
        }
    }
    return embed;
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
    let playerIDs = game.users.filter((user) => user.isGM === false).map((player => player.id));
    if (actor.ownership.default === 3) {
        isOwned = true;
    }
    playerIDs.forEach(id => {
        if (propertyExists(actor, "ownership." + id)) {
            if (actor.ownership[id] === 3) {
                isOwned = true;
            }
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

export function parseHTMLText(htmlString) {
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
        table.innerHTML = parse2DTable(newTable2D);
    });

    // Remove <img> tags
    removeElementsBySelector('img', htmldoc);

    // Format various elements
    formatTextBySelector('.inline-roll, .inline-check', text => `:game_die:\`${text}\``, htmldoc);
    reformattedText = htmldoc.innerHTML;

    // Format everything else
    reformattedText = htmlCodeCleanup(reformattedText);

    return reformattedText;
}

export function htmlCodeCleanup(htmltext) {
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
        .replace(/\n-+\n/g, '-----------------------') // Redo horizontal lines after cleaning up line breaks
        .replace(/ {2,}/g, ' ') // Clean up excess whitespace
        .replaceAll(" ", ' '); //Cleanup table filler with real spaces
}


/* reformatMessage does all the HTML parsing and etc, and should only be called before
*  the message is sent to the webhook. Copy this function to your parser to allow for
*  more complex reformatting, such as @Check, @Damage for PF2e. This is to place all the HTML parsing in one place.
*  parseHTMLText is generally universal.
*/
export function reformatMessage(text) {
    let reformattedText = ""
    //First check if the text is formatted in HTML to use a different function
    //parse Localize first, since it will have html elements
    let regex = /@Localize\[(.*?)\]/g;
    reformattedText = text.replace(regex, (_, text) => getLocalizedText(text));
    const isHtmlFormatted = /<[a-z][\s\S]*>/i.test(reformattedText);
    if (isHtmlFormatted) {
        reformattedText = parseHTMLText(reformattedText);
        reformattedText = reformatMessage(reformattedText); //call this function again as a failsafe for @ tags
    }
    else {
        //replace UUIDs to be consistent with Foundry
        regex = /@UUID\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':baggage_claim: `$1`');

        //replace Actor
        regex = /@Actor\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':bust_in_silhouette: `$1`');

        //replace compendium links
        regex = /@Compendium\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':baggage_claim: `$1`');

        //replace UUID if custom name is not present (redundancy)
        regex = /@UUID\[(.*?)\]/g;
        reformattedText = reformattedText.replace(regex, (_, text) => getNameFromItem(text));

        //replace Actor if custom name is not present (redundancy)
        regex = /@Actor\[(.*?)\]/g;
        reformattedText = reformattedText.replace(regex, (_, text) => {
            return ':bust_in_silhouette: `' + game.actors.get(text).name + '`';
        });

        //replace Checks
        regex = /@Check\[[^\]]+\]{([^}]+)}/g;
        reformattedText = reformattedText.replace(regex, ':game_die: `$1`');
    }

    return reformattedText;
}

function generateDiscordAvatar(message) {
    if (propertyExists(message, "speaker.scene") && message.speaker.scene !== null) {
        if (message.speaker.token) {
            const speakerToken = game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token);
            if (propertyExists(speakerToken, "texture.src")) {
                if (speakerToken.texture.src != "") {
                    return generateimglink(speakerToken.texture.src);
                }
            }
        }
    }

    if (propertyExists(message, "speaker.actor") && message.speaker.actor !== null) {
        const speakerActor = game.actors.get(message.speaker.actor);
        if (speakerActor) {
            if (propertyExists(speakerActor, "prototypeToken.texture.src")) {
                return generateimglink(speakerActor.prototypeToken.texture.src);
            }
        }
    }

    const aliasMatchedActor = game.actors.find(actor => actor.name === message.alias);
    if (propertyExists(aliasMatchedActor, "prototypeToken.texture.src")) {
        return generateimglink(aliasMatchedActor.prototypeToken.texture.src);
    }

    return generateimglink(message.user.avatar);
}

function generateimglink(img) {
    const supportedFormats = ['jpg', 'jpeg', 'png', 'webp'];
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
        else{
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

//function to crawl through several objects and check if the last one exists or until one is undefined
//example usage: propertyExists(msg, "speaker.token");
export function propertyExists(jsonObj, propertyPath) {
    const properties = propertyPath.split('.');
    let currentObj = jsonObj;

    for (const property of properties) {
        if (currentObj && typeof currentObj === 'object' && property in currentObj) {
            currentObj = currentObj[property];
        } else {
            return false;
        }
    }

    return true;
}

export function getDefaultAvatarLink() {
    if (getThisModuleSetting('inviteURL') !== "http://") {
        return getThisModuleSetting('inviteURL') + "modules/foundrytodiscord/src/images/defaultavatar.png";
    }
    else {
        return "";
    }
}

