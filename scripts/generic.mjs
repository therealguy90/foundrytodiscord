import { htmlTo2DTable, parse2DTable } from './helpers/tables.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { splitEmbed, hexToColor } from './helpers/embeds.mjs';
import { generateimglink } from './helpers/images.mjs';

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
        if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && msg.flags?.polyglot?.language) {
            constructedMessage = polyglotize(msg);
        }
        if (constructedMessage === '') {
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
                embeds[i].title = anonymizeText(embeds[i].title);
                embeds[i].description = anonymizeText(embeds[i].description);
            }
        }
    }
    if (anonEnabled()) {
        constructedMessage = anonymizeText(constructedMessage, msg)
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
    const speakerToken = (message.speaker?.token && message.speaker?.scene)
        ? game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token)
        : undefined;
    let speakerActor = message.speaker?.actor
        ? game.actors.get(message.speaker.actor)
        : speakerToken?.actor ? speakerToken.actor : undefined;
    // Get both speakerToken and speakerActor, since we want many fallbacks,
    // in case a token is declared in the message but not its actor. Good for macros or other modules/systems that don't
    // rely on a token being on the canvas to create a message.
    if (anonEnabled() && (speakerToken?.actor || speakerActor)) {
        const anon = game.modules.get('anonymous').api
        // First: Check if token has an actor and use Anonymous if it does. 
        // This uses a fallback for the message actor in case it is needed.
        if (speakerToken.actor && speakerActor !== speakerToken.actor) {
            // Fallback possibly not needed? Will keep it in for redundancy.
            speakerActor = speakerToken.actor;
        }
        if (!speakerActor) {
            speakerActor = game.actors.find(actor => actor.name === message.alias);
        }
        if (speakerActor && !anon.playersSeeName(speakerActor)) {
            alias = `${anon.getName(speakerActor)} (${censorId(speakerToken ? speakerToken.id : speakerActor.id)})`;
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
                if (!speakerActor.hasPlayerOwner) {
                    alias = "Unknown" + " (" + censorId(speakerToken.id) + ")";
                }
                break;
            default:
                break;
        }
    }
    if (embeds[0]?.description?.length > 4000) {
        embeds = splitEmbed(embeds[0]);
    }
    // Add username to embed
    if (embeds[0] && message.user && message.alias !== message.user.name && getThisModuleSetting('showAuthor')) {
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
    }
    else {
        title = message.alias + "\'s Rolls";
    }
    const speakerActor = game.actors.get(message.speaker.actor);
    message.rolls.forEach(roll => {
        if(getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !message.user.isGM))){
            desc += `:game_die:**\`${roll.formula}\`**\n`
        }
        desc += `**:game_die:Result: __${roll.total}__**\n\n`;
    });
    return [{ title: title, description: desc.trim() }];
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

export function polyglotize(message) {
    const getReplacementString = function (languages = []) {
        if (languages.length === 0) {
            //get a list of all PCs and player-controlled actors
            let playerActors = game.actors.filter(a => a.hasPlayerOwner);
            let languages = new Set();
            for (let actor of playerActors) {
                let characterLanguages = actor.system.traits.languages.value;
                for (let language of characterLanguages) {
                    languages.add(language);
                }
            }
        }
        if (languages.includes(message.flags.polyglot.language)) {
            return message.content;
        }
        else {
            return "*Unintelligible*"
        }
    };
    let listLanguages = [];
    if (!getThisModuleSetting("commonLanguages").toLowerCase().includes(message.flags.polyglot.language)) {
        if (getThisModuleSetting("includeOnly") === "") {
            return getReplacementString();
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
                console.log(e);
                console.log("foundrytodiscord | Your system \"" + game.system.id + "\" does not support Polyglot integration with this module due to a different actor structure.")
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
    if (curScene) {
        const speakerToken = curScene.tokens.get(message.speaker.token);
        if (text && speakerToken && speakerToken.actor && !anon.playersSeeName(speakerToken.actor)) {
            return text
                .replace(new RegExp(`\\b${speakerToken.name}\\b`, 'gi'), anon.getName(speakerToken.actor))
                .replace(new RegExp(`\\b${speakerToken.actor.name}\\b`, 'gi'), anon.getName(speakerToken.actor));
        }
    }
    return text;
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
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;

    // Remove elements with data-visibility attribute and hidden styles
    ['[data-visibility="gm"]', '[data-visibility="owner"]', '[style*="display:none"]'].forEach(selector => {
        const elements = htmldoc.querySelectorAll(selector);
        elements.forEach(element => element.parentNode.removeChild(element));
    });
    const tables = htmldoc.querySelectorAll('table');
    tables.forEach((table) => {
        const newTable2D = htmlTo2DTable(table);
        table.outerHTML = `\n${parse2DTable(newTable2D)}`;
    });

    // Remove <img> tags
    removeElementsBySelector('img', htmldoc);
    // Format various elements
    formatTextBySelector('.inline-roll', text => `:game_die:\`${text}\``, htmldoc);

    reformattedText = htmldoc.innerHTML;
    if (customHTMLParser) {
        reformattedText = customHTMLParser(reformattedText);
    }
    htmldoc.innerHTML = reformattedText;

    const dataLinks = htmldoc.querySelectorAll('a[data-uuid]');
    if (dataLinks.length > 0) {
        dataLinks.forEach(link => {
            const newLink = link.cloneNode(true);
            const uuid = newLink.getAttribute('data-uuid');
            newLink.textContent = "@UUID[" + uuid + "]" + "{" + newLink.textContent + "}"; // Can be formatted later
            link.parentNode.replaceChild(newLink, link);
        });
    }
    reformattedText = htmldoc.innerHTML;

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
    const doc = document.createElement('div');
    doc.innerHTML = htmltext;
    const selectorsAndReplacers = [
        { selector: "h1, h2",       replacer: ["# ", "\n"]                  },
        { selector: "h3, h4",       replacer: ["## ", "\n"]                 },
        { selector: "h5, h6",       replacer: ["### ", "\n"]                },
        { selector: "strong, b",    replacer: ["**", "**"]                  },
        { selector: "em, i",        replacer: ["*", "*"]                    },
        { selector: "hr",           replacer: ["-----------------------"]   },
        { selector: "li",           replacer: ["- ", "\n"]                  },
        { selector: "input",        replacer: [""]                          },
        { selector: "div",          replacer: ["", "\n"]                    },
        { selector: "br",           replacer: ["\n"]                        },
        { selector: "p",            replacer: ["", "\n\n"]                  }
    ]
    selectorsAndReplacers.forEach(({ selector, replacer }) => {
        doc.querySelectorAll(selector).forEach(element => {
            if (replacer.length === 2) {
                element.outerHTML = `${replacer[0]}${element.innerHTML}${replacer[1]}`;
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


//reformatMessage makes text readable.
export function reformatMessage(text, customHTMLParser = undefined) {
    let reformattedText = text;
    const isHtmlFormatted = /<[a-z][\s\S]*>/i.test(reformattedText);
    if (isHtmlFormatted) {
        reformattedText = parseHTMLText(reformattedText, customHTMLParser);
    }
    reformattedText = replaceGenericAtTags(reformattedText);
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
                    toReplace += ":bust_in_silhouette:";
                    break;
                case document instanceof Scene:
                    toReplace += ":map:";
                    break;
                case document instanceof Macro:
                    toReplace += ":link:";
                    break;
                case document instanceof JournalEntry:
                    toReplace += ":book:";
                    break;
                case document instanceof RollTable:
                    toReplace += ":page_facing_up:";
                    break;
                case document instanceof Folder:
                    toReplace += ":file_folder:";
                    break;
                default:
                    toReplace += ":baggage_claim:";
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

    return generateimglink(message.user?.avatar);
}

function censorId(docid) {
    // Censors IDs for anonymized names
    const firstPart = docid.substring(0, 4);
    const censoredId = `${firstPart}****`;

    return censoredId;
}