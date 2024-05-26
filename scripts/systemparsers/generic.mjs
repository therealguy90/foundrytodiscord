import { htmlTo2DTable, parse2DTable } from '../helpers/parser/tables.mjs';
import { anonEnabled, getThisModuleSetting } from '../helpers/modulesettings.mjs';
import { getPropertyByString, censorId, removeEmptyEmbeds, splitText, addEmbedsToRequests } from '../helpers/parser/messages.mjs';
import { generateimglink } from '../helpers/parser/images.mjs';
import { newEnrichedMessage, toHTML } from '../helpers/parser/enrich.mjs';
import { getDieEmoji, getDocumentEmoji, swapOrNot, dieIcon, checkFails } from '../helpers/emojis/global.mjs';
import { SeededRandom } from '../helpers/rng.mjs';

export class MessageParser {

    constructor() {
        this._polyglotPath = "system.traits.languages.value";
        this._genericRolls = true; // signifies the use of special roll cards, such as those from PF2e with trait tags slapped onto them.
    }

    async parseMessage(message, edit = false) {
        /* Enriching the message contents will ensure that all text we parse is in a proper HTML format, since
        *  message objects stored from game.messages aren't enriched until they are rendered. While, yes, it's possible
        *  to use the client-sided version of the ChatMessage object and bypass enrichment altogether, using 
        *  the full ChatMessage object makes it consistent for everyone, considering this module can send messages
        *  from either Player or GM clients. Rarely are custom enrichment options needed, since most systems don't use them,
        *  and only the more developed systems really use enrichment like this. Mostly, this is needed to make content links
        *  (such as UUID tags) consistent throughout all ChatMessages.
        */
        const enrichedMsg = await newEnrichedMessage(message, await this._getEnrichmentOptions(message));
        let constructedMessage = "";
        let embeds = await this._getSystemSpecificCards(enrichedMsg);
        embeds = embeds.length !== 0 ? embeds : await this._getSystemAgnosticCards(enrichedMsg);
        if (!embeds) {
            embeds = [];
        }
        if (!constructedMessage || embeds.length === 0) {
            // This may be moved to _getSystemAgnosticCards, but this is for detecting Foundry's native .chat-card styling.
            if (this.isCard(message.content) && message.rolls?.length < 1 && embeds.length === 0) {
                constructedMessage = "";
                if (getThisModuleSetting('sendEmbeds')) {
                    embeds = this._createCardEmbed(message);
                }
            }
            else if (!enrichedMsg.isRoll) {
                if (this._hasDiceRolls(enrichedMsg.content) && embeds.length === 0) {
                    embeds = this._createHTMLDiceRollEmbed(enrichedMsg);
                    const elements = document.createElement('div');
                    elements.innerHTML = enrichedMsg.content;
                    const diceRolls = elements.querySelectorAll('.dice-roll');
                    for (const div of diceRolls) {
                        div.parentNode.removeChild(div);
                    }
                    enrichedMsg.content = elements.innerHTML;
                }
                /*Attempt polyglot support. This will ONLY work if the structure is similar:
                * for DnD5e, this would be actor.system.traits.languages.value
                * When inheriting MessageParser, _polyglotPath must be modified if this is different.
                */
                if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && enrichedMsg.flags?.polyglot?.language) {
                    constructedMessage = await this._polyglotize(enrichedMsg);
                }
                if (constructedMessage === '') {
                    constructedMessage = enrichedMsg.content;
                }
            }
            else if (enrichedMsg.rolls.length === 0 && embeds.length === 0) {
                if (enrichedMsg.flavor) {
                    embeds = [{ title: enrichedMsg.flavor, description: enrichedMsg.content }];
                }
                else {
                    constructedMessage = enrichedMsg.content;
                }
            }
            else {
                if (this._genericRolls) {
                    console.log(`foundrytodiscord | System "${game.system.id}" is not supported for special roll embeds.`)
                }
                if (embeds.length === 0) {
                    embeds = this._createRollEmbed(enrichedMsg);
                }
            }
        }

        if (embeds.length === 0 && this._willAutoUUIDEmbed(enrichedMsg.content)) {
            embeds = await this._generateAutoUUIDEmbeds(enrichedMsg);
        }

        //Fix formatting before sending
        if (embeds && embeds.length > 0) {
            for (let embed of embeds) {
                if (embed.title) {
                    embed.title = await this.formatText(embed.title);
                }
                if (embed.description) {
                    embed.description = await this.formatText(embed.description);
                }
            }
            if (!this._willAutoUUIDEmbed(enrichedMsg.content)) {
                constructedMessage = (/<[a-z][\s\S]*>/i.test(enrichedMsg.flavor) || enrichedMsg.flavor === embeds[0].title) ? "" : enrichedMsg.flavor;
            }
            // use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
            // we have to mimic this behavior here, since visibility is client-sided, and we are parsing raw message content.
            if (anonEnabled()) {
                for (let i = 0; i < embeds.length; i++) {
                    embeds[i].title = this._anonymizeText(embeds[i].title, enrichedMsg);
                    embeds[i].description = this._anonymizeText(embeds[i].description, enrichedMsg);
                }
            }
        }

        if (anonEnabled()) {
            constructedMessage = this._anonymizeText(constructedMessage, enrichedMsg)
        }
        constructedMessage = await this.formatText(constructedMessage);
        return await this._getRequestParams(enrichedMsg, constructedMessage, embeds, edit);
    }

    // To be overriden.
    _systemHTMLParser(htmlString) {
        return htmlString;
    }

    // To be overriden.
    async _getSystemSpecificCards(message) {
        return [];
    }

    async formatText(text) {
        let reformattedText = text;
        reformattedText = await this._parseHTMLText(reformattedText);
        // Add Auto Pings
        const autoPingMap = getThisModuleSetting("autoPingMap");
        const pattern = new RegExp(`(?:^|\\W)@(${Object.keys(autoPingMap).join('|')})(?=\\W|$)`, 'gi');

        reformattedText = reformattedText.replace(pattern, (match, keyword) => {
            if (autoPingMap[keyword]) {
                if (autoPingMap[keyword].type === "User") {
                    return `<@${autoPingMap[keyword].ID}>`;
                }
                else if (autoPingMap[keyword].type === "Role") {
                    return `<@&${autoPingMap[keyword].ID}>`
                }
                else return match;
            }
        });
        return reformattedText;
    }

    async _parseHTMLText(htmlString) {
        let reformattedText = htmlString;
        const htmldoc = document.createElement('div');
        htmldoc.innerHTML = reformattedText;
        if (htmldoc.hasChildNodes()) {
            this._removeElementsBySelector('[style*="display:none"]', htmldoc); //remove all display:none
            // Format tables using the table parser first
            const tables = htmldoc.querySelectorAll('table');
            tables.forEach((table) => {
                const newTable2D = htmlTo2DTable(table);
                table.outerHTML = `\n${parse2DTable(newTable2D)}`;
            });

            // Remove <img> tags
            this._removeElementsBySelector('img', htmldoc);
            // Format inline-request-roll for Monk's TokenBar
            this._formatTextBySelector('.inline-roll, .inline-request-roll', text => `${dieIcon()}\`${text}\``, htmldoc);


            reformattedText = htmldoc.innerHTML;
            reformattedText = await this._systemHTMLParser(reformattedText);
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
            reformattedText = this._htmlCodeCleanup(reformattedText);
        }
        return reformattedText;
    }

    _htmlCodeCleanup(htmltext) {
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
            { selector: "h1, h2", replacer: ["\n# ", "\n"] },
            { selector: "h3, h4", replacer: ["\n## ", "\n"] },
            { selector: "h5, h6", replacer: ["\n### ", "\n"] },
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

    _removeElementsBySelector(selector, root) {
        const elements = (root || document).querySelectorAll(selector);
        elements.forEach(element => element.remove());
    }

    _formatTextBySelector(selector, formatter, root) {
        const elements = (root || document).querySelectorAll(selector);
        elements.forEach(element => {
            const formattedText = formatter(element.textContent.trim());
            element.replaceWith(formattedText);
        });
    }

    async _getSystemAgnosticCards(message) {
        if (game.modules.get('monks-tokenbar')?.active && this._isTokenBarCard(message.content)) {
            return this._createTokenBarCard(message);
        }
        else if (this._isRollTableCard(message)) {
            return await this._createRollTableEmbed(message);
        }
        return [];
    }

    _createCardEmbed(message) {
        const div = document.createElement("div");
        div.innerHTML = message.content;
        // Find the <h3> element and extract its text content, since h3 works for most systems
        const h3Element = div.querySelector("h3");
        let title;
        if (h3Element?.textContent) {
            title = h3Element.textContent.trim();
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
            descList.forEach(paragraph => {
                desc += `${paragraph.innerHTML}\n\n`;
            });
        }

        return [{ title: title, description: desc, footer: { text: this._getCardFooter(message.content) } }];
    }

    _getCardFooter(card) {
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

    _createRollEmbed(message) {
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
        const user = message.author || message.user; /*Will be removed in v13*/
        message.rolls.forEach(roll => {
            if (getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !user.isGM))) {
                desc += `${dieIcon()}**\`${roll.formula}\`**\n`
                desc += `**${dieIcon()}Result: __${roll.total}__**`;
                let rollBreakdown = this._generateRollBreakdown(roll);
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

    async _createRollTableEmbed(message) {
        const embeds = this._createRollEmbed(message);
        const div = document.createElement('div');
        div.innerHTML = message.content;
        const resultElement = div.querySelector(".result-text");
        if (resultElement && resultElement.textContent) {
            embeds[0].description += `\n${await this.formatText(resultElement.innerHTML)}`;
        }
        return embeds;
    }

    _isRollTableCard(htmlString) {
        const div = document.createElement('div');
        div.innerHTML = htmlString;
        const divElement = div.querySelector('.table-draw');
        if (divElement !== null) {
            return true;
        } else {
            return false;
        }
    }

    _createTokenBarCard(message) {
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
                                desc += `${dieIcon(20)} `;
                                break;
                            case 'won':
                                desc += `${swapOrNot(":white_check_mark:", checkFails["check"])} `;
                                break;
                            case 'failed':
                                desc += `${swapOrNot(":negative_squared_cross_mark:", checkFails["xmark"])} `;
                                break;
                            default:
                                desc += `${dieIcon(20)} `;
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
                            if (tokenData.hasOwnProperty("passed")) {
                                switch (tokenData.passed) {
                                    case 'waiting':
                                        desc += `${dieIcon(20)} `;
                                        break;
                                    case true:
                                        desc += `${swapOrNot(":white_check_mark:", checkFails["check"])} `;
                                        break;
                                    case false:
                                        desc += `${swapOrNot(":negative_squared_cross_mark:", checkFails["xmark"])} `;
                                        break;
                                    case 'success':
                                        desc += `${swapOrNot(":white_check_mark::white_check_mark:", checkFails["doublecheck"])} `;
                                        break;
                                    case 'failed':
                                        desc += `${swapOrNot(":no_entry_sign:", checkFails["wrong"])} `;
                                        break;
                                    default:
                                        desc += `${dieIcon(20)} `;
                                        break;
                                }
                            }
                            else {
                                desc += `${dieIcon(20)} `;
                            }
                        }
                        else {
                            desc += `${dieIcon(20)} `;
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
                            desc += `${swapOrNot(":white_check_mark:", checkFails["check"])} `;
                        }
                        desc += "\n\n";
                    });
                }
                footer = { text: message.flags["monks-tokenbar"].reason };
                break;
        }
        return [{ title: title, description: desc.trim(), footer: footer }];
    }

    _isTokenBarCard(htmlString) {
        const div = document.createElement('div');
        div.innerHTML = htmlString;

        const divElement = div.querySelector('.monks-tokenbar');
        if (divElement !== null) {
            return true;
        } else {
            return false;
        }
    }

    async _generateAutoUUIDEmbeds(message, enrichmentOptions = {}) {
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
                        desc += await toHTML(originDoc.system.description.value, enrichmentOptions);
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
                        let journalEmbeds = await this._embedsFromJournalPages(pages, reformatMessage);
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

    _createHTMLDiceRollEmbed(message) {
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

    _hasDiceRolls(htmlString) {
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

    async _polyglotize(message) {
        let listLanguages = [];
        if (getThisModuleSetting("includeOnly").trim() !== "") {
            listLanguages.push(...getThisModuleSetting("includeOnly").split(",").map(item => item.trim().toLowerCase()));
        }
        try {
            const languages = new Set();
            const playerActors = game.actors.filter(a => a.hasPlayerOwner && (getPropertyByString(a, this._polyglotPath) || getPropertyByString(a, "system.traits.languages.value")));
            const messageLanguage = message.flags.polyglot.language;

            if (listLanguages.length === 0) {
                if (!playerActors && playerActors.length === 0) {
                    console.log(`foundrytodiscord | Failed to find player-owned actors with specified language path "${this._polyglotPath}" for Polyglot integration.`);
                    return message.content;
                }
                for (const actor of playerActors) {
                    const characterLanguages = getPropertyByString(actor, this._polyglotPath) || getPropertyByString(actor, "system.traits.languages.value");
                    characterLanguages.forEach(languages.add, languages);
                }
            }
            let constructedMessage = "";

            if (getThisModuleSetting("includeLanguage")) {
                constructedMessage = `\`Language:\`||\`(${game.polyglot.languages[messageLanguage].label})\`||\n`;
            }
            const allUnderstand = (game.polyglot.languageProvider.defaultLanguage === messageLanguage && listLanguages.length === 0) || listLanguages.includes(game.polyglot.languageProvider.defaultLanguage);
            if (allUnderstand) {
                return message.content;
            }
            const oneUnderstands = (listLanguages.length === 0 && languages.has(messageLanguage)) || listLanguages.includes(messageLanguage);
            switch (getThisModuleSetting("polyglotShowMode")) {
                case "showOriginal":
                    if (oneUnderstands) {
                        constructedMessage += message.content;
                    }
                    else {
                        constructedMessage += await this._polyglotScrambleMessage(message);
                    }
                    break;
                case "showIfOne":
                    constructedMessage += `${await this._polyglotScrambleMessage(message)}\n`;
                    if (oneUnderstands) {
                        constructedMessage += `<hr/>\n||${message.content.trim()}||`;
                    }
                    break;
                case "showAll":
                    constructedMessage += `${await this._polyglotScrambleMessage(message)}\n<hr/>\n||${message.content.trim()}||`;
                    break;
                default:
                    break;
            }
            return constructedMessage;
        }
        catch (e) {
            console.log(`foundrytodiscord | Polyglot integration failed due to an error: ${e}`);
            return message.content;
        }
    }

    async _polyglotScrambleMessage(message) {
        const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
        const timestamp = message.timestamp ? message.timestamp : Date.now();
        const rng = new SeededRandom(timestamp);
        let scrambledMessage = "";
        const parsedParagraphs = (await this.formatText(message.content)).split("\n");
        for (const paragraph of parsedParagraphs) {
            let scrambledParagraph = "";
            for (let i = 0; i < paragraph.length; i++) {
                const letterIndex = rng.nextRange(0, 26);
                if (paragraph[i] !== " ") {
                    scrambledParagraph += letters[letterIndex];
                }
                else {
                    scrambledParagraph += paragraph[i];
                }
            }
            scrambledMessage += `${scrambledParagraph}\n`;
        }
        return `${scrambledMessage.trim()}`;
    }

    _anonymizeText(text, message) {
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

    async _embedsFromJournalPages(pages) {
        let embeds = []
        let oneOrMoreUnsupported = false;
        for (const pageData of pages) {
            switch (pageData.type) {
                case "text":
                    const textEmbed = {
                        title: pageData.name,
                        description: await toHTML(pageData.text.content)
                    };
                    embeds.push(textEmbed)
                    break;
                case "image":
                    embeds.push({
                        title: pageData.name,
                        image: {
                            url: await generateimglink(pageData.src)
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

    async _getEnrichmentOptions(message) {
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

    _willAutoUUIDEmbed(htmlString) {
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

    _generateRollBreakdown(roll, nextTerm = false) {
        let rollBreakdown = ""
        let termcount = 1;

        roll.terms.forEach((term) => {
            let currentTermString = "";
            switch (true) {
                case (foundry.dice && term instanceof foundry.dice.terms.DiceTerm) || term instanceof DiceTerm:
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
                        let tempTermString = "";
                        if (dieResult.active) {
                            tempTermString += `${swapOrNot(` ${dieResult.result}`, getDieEmoji(term.faces, dieResult.result))}`;
                        } else if (dieResult.discarded || dieResult.rerolled) {
                            tempTermString += `${swapOrNot(` ${dieResult.result}ˣ`, `[${getDieEmoji(term.faces, dieResult.result)}ˣ]`)}`;
                        }
                        if (tempTermString !== "" && ((notDieEmoji && i < term.results.length) || (nextTerm && (roll.terms[termcount] && ((foundry.dice && !roll.terms[termcount] instanceof foundry.dice.terms.OperatorTerm) || !roll.terms[termcount] instanceof OperatorTerm))))) {
                            tempTermString += " +";
                        }
                        currentTermString += tempTermString;
                        i++;
                    });
                    if (notDieEmoji) {
                        currentTermString = ` \`${term.faces ? `d${term.faces}` : ""}[${currentTermString.trim()}]\``;
                    }
                    break;
                case ((foundry.dice && term instanceof foundry.dice.terms.PoolTerm) || term instanceof PoolTerm) || term.hasOwnProperty("rolls"):
                    let poolRollCnt = 1;
                    term.rolls.forEach(poolRoll => {
                        currentTermString += ` ${generateRollBreakdown(poolRoll, true)}`;
                        if (poolRollCnt <= term.rolls.length) {
                            currentTermString += " +";
                        }
                        poolRollCnt++;
                    });
                    break;
                case (foundry.dice && term instanceof foundry.dice.terms.OperatorTerm) || term instanceof OperatorTerm:
                    currentTermString += ` ${term.operator}`;
                    break;
                case (foundry.dice && term instanceof foundry.dice.terms.NumericTerm) || term instanceof NumericTerm:
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

    async _getRequestParams(message, msgText, embeds, editMode = false) {
        const imgurl = await this._generateDiscordAvatar(message);
        const user = message.author || message.user; /*Will be removed in v13*/
        let hook = "";
        if (message.isRoll && (!this.isCard(message.content) && message.rolls.length > 0)) {

            if (getThisModuleSetting("threadedChatMap").hasOwnProperty(user.viewedScene)) {
                hook = getThisModuleSetting("rollWebHookURL").split('?')[0] + "?thread_id=" + getThisModuleSetting('threadedChatMap')[user.viewedScene].rollThreadId;
            }
            else {
                hook = getThisModuleSetting("rollWebHookURL");
            }
        } else {
            if (getThisModuleSetting("threadedChatMap").hasOwnProperty(user.viewedScene)) {
                hook = getThisModuleSetting("webHookURL").split('?')[0] + "?thread_id=" + getThisModuleSetting('threadedChatMap')[user.viewedScene].chatThreadId;
            }
            else {
                hook = getThisModuleSetting("webHookURL");
            }
        }
        embeds = removeEmptyEmbeds(embeds);
        const username = this._generateDiscordUsername(message);
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
            const user = message.author || message.user; /*Will be removed in v13*/
            allRequests = await addEmbedsToRequests(allRequests, hook, username, imgurl, embeds, user);
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
        if (editMode && messageList.hasOwnProperty(message.id) && messageList[message.id][0]) {
            let shortestLinkedLength = Infinity;
            for (const linkedMessageIndex in messageList[message.id]) {
                if (shortestLinkedLength > (Object.keys(messageList[message.id][linkedMessageIndex])).length) {
                    shortestLinkedLength = (Object.keys(messageList[message.id][linkedMessageIndex])).length;
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

    async _generateDiscordAvatar(message) {
        // Prioritize chat-portrait for parity
        if (game.modules.get("chat-portrait")?.active && message.flags["chat-portrait"]?.src) {
            return await generateimglink(message.flags["chat-portrait"].src);
        }

        if (message.speaker?.scene && message.speaker.token) {
            const speakerToken = game.scenes.get(message.speaker.scene).tokens.get(message.speaker.token);
            if (speakerToken?.texture?.src && speakerToken?.texture.src !== "") {
                return await generateimglink(speakerToken.texture.src);
            }
        }

        if (message.speaker?.actor) {
            const speakerActor = game.actors.get(message.speaker.actor);
            if (speakerActor?.prototypeToken?.texture?.src) {
                return await generateimglink(speakerActor.prototypeToken.texture.src);
            }
        }

        // Probably need to remove this, honestly. Doesn't do anything in practice.
        const aliasMatchedActor = game.actors.find(actor => actor.name === message.alias);
        if (aliasMatchedActor?.prototypeToken?.texture?.src) {
            return await generateimglink(aliasMatchedActor.prototypeToken.texture.src);
        }

        const user = message.author || message.user /*Will be removed in v13*/
        return await generateimglink(user.avatar);
    }

    _generateDiscordUsername(message) {
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

    isCard(htmlString) {
        const htmldocElement = document.createElement('div');
        htmldocElement.innerHTML = htmlString;
        const divElement = htmldocElement.querySelector('.chat-card');
        if (divElement !== null) {
            return true;
        } else {
            return false;
        }
    }

}