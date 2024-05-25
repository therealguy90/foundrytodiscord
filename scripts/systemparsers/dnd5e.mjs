import { anonEnabled, getThisModuleSetting } from '../helpers/modulesettings.mjs';
import { parse2DTable } from '../helpers/parser/tables.mjs';
import { MessageParser } from './generic.mjs';
import { toHTML } from '../helpers/parser/enrich.mjs';
import { swapOrNot, getDieEmoji, dieIcon, checkFails } from '../helpers/emojis/global.mjs';
import { shieldEmoji } from '../helpers/emojis/dnd5e.mjs';

export class MessageParserDnD5e extends MessageParser {

    constructor() {
        super()
        this._polyglotPath = "system.traits.languages.value";
        this._genericRolls = false;
    }

    _systemHTMLParser(htmlString) {
        let reformattedText = htmlString;
        const htmldoc = document.createElement('div');
        htmldoc.innerHTML = reformattedText;
        if (htmldoc.hasChildNodes()) {
            // Format various elements
            this._formatTextBySelector('a.roll-link', text => `${dieIcon()}\`${text}\``, htmldoc);
            reformattedText = htmldoc.innerHTML;
        }
        return reformattedText;
    }

    async _getSystemSpecificCards(message) {
        if (game.modules.get('midi-qol')?.active && this._isMidiMergeCard(message.content)) {
            return await this._createMidiMergeCard(message);
        }
        else if (game.modules.get('midi-qol')?.active && message.flags?.midiqol?.undoDamage && this._isMidiDamageTable(message.content)) {
            return await this._createMidiDamageTable(message);
        }
        else if (game.modules.get('midi-qol')?.active && this._isMidiSingleHitCard(message.content)) {
            return await this._createMidiSingleHitCard(message);
        }
        else if (game.modules.get('midi-qol')?.active && this._isMidiSavesDisplayCard(message.content)) {
            return await this._createMidiSavesDisplayCard(message);
        }
        return [];
    }

    _createCardEmbed(message) {
        const div = document.createElement("div");
        div.innerHTML = message.content;
        // Find the <h3> element and extract its text content, since h3 works for most systems
        // if not, use the first line it finds
        let title;
        const titleElement = div.querySelector("span.title");
        const h3Element = div.querySelector("h3");
        if (titleElement?.textContent) {
            title = titleElement.textContent.trim();
        }
        else if (h3Element?.textContent) {
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
            let supplement = div.querySelector('p.supplement');
            if (supplement && supplement.textContent) {
                const supplementTitle = supplement.querySelector('strong');
                if (supplementTitle) {
                    supplement.querySelector('strong').textContent += " ";
                }
                desc += supplement.innerHTML;
            }
        }

        return [{ title: title, description: desc, footer: { text: this._getCardFooter(message.content) } }];
    }

    async _generateAutoUUIDEmbeds(message) {
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
                        if (!originDoc.system.identified) {
                            desc += await toHTML(originDoc.system.description.value);
                        }
                        else {
                            desc += await toHTML(originDoc.system.description.unidentified);
                        }
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

    async _createMidiMergeCard(message) {
        let embeds = this._createCardEmbed(message);
        const divs = document.createElement('div');
        divs.innerHTML = message.content;
        let element = divs.querySelector('.midi-qol-attack-roll');
        let fields = [];
        if (element) {
            const attackTitle = element.querySelector('div').textContent;
            if (attackTitle && attackTitle !== "") {
                const total = element.querySelector('h4.dice-total');
                let result = total.textContent;
                let rollValue = "";
                let rollFormula = undefined;
                if (result) {
                    const hide = game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails;
                    switch (true) {
                        case getThisModuleSetting('forceShowRolls') || this._midiMessageHasPlayerOwner(message) || hide === 'none':
                            rollFormula = element.querySelector(".dice-formula");
                            if (getThisModuleSetting('showFormula')) {
                                rollValue = `${dieIcon()}**\`${rollFormula.textContent}\`**\n${dieIcon()}**Result: __${result}__`;
                            }
                            else {
                                rollValue = `${dieIcon()}**Result: __${result}__`;
                            }
                            break;
                        case hide === 'detailsDSN':
                        case hide === 'details':
                            if (result !== "") {
                                rollValue = `${dieIcon()}**Result: __${result}__`;
                            }
                            break;
                        case hide === 'd20Only':
                        case hide === 'd20AttackOnly':
                            rollValue = `${dieIcon()}**(d20) __${getDieEmoji(20, message.flags['midi-qol'].d20AttackRoll)}__`;
                            break;
                        case hide === 'hitDamage':
                        case hide === 'hitCriticalDamage':
                            if (message.flags['midi-qol'].isHit) {
                                rollValue = "**__Hits__"
                            }
                            else {
                                rollValue = "**__Misses__"
                            }
                            break;
                        case hide === 'all':
                            rollValue = `${dieIcon()}**Rolled`;
                            break;
                    }
                    if (['none', 'detailsDSN', 'details', 'hitCriticalDamage'].includes(game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails)) {
                        if (message.flags['midi-qol'].isCritical) {
                            rollValue += ` (${swapOrNot("Critical!", getDieEmoji(20, message.flags["midi-qol"].d20AttackRoll))})**`;
                        }
                        else if (message.flags['midi-qol'].isFumble) {
                            rollValue += ` (${swapOrNot("Fumble!", getDieEmoji(20, message.flags["midi-qol"].d20AttackRoll))})**`;
                        }
                        else {
                            rollValue += "**";
                        }
                    }
                    else if (['d20Only', 'd20AttackOnly'].includes(game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails)) {
                        if (message.flags['midi-qol'].isCritical) {
                            rollValue += " (Critical!)**";
                        }
                        else if (message.flags['midi-qol'].isFumble) {
                            rollValue += " (Fumble!)**";
                        }
                    }
                    else {
                        rollValue += "**";
                    }
                    if (rollFormula) {
                        const roll = message.rolls.find(roll => roll.formula === rollFormula.textContent);
                        rollValue += `||(${this._generateRollBreakdown(roll)})||`;
                    }
                    fields.push({ name: attackTitle, value: rollValue, inline: true })
                }
            }
        }
        element = divs.querySelector('.midi-qol-damage-roll');
        if (element && element.textContent) {
            const damageTitle = element.querySelector('div').textContent;
            if (damageTitle && damageTitle !== "") {
                const rollValue = this._midiParseDamageRollFromDisplay(element, message);
                fields.push({ name: damageTitle, value: rollValue, inline: true })
            }
        }
        divs.innerHTML = message.content.replace(/>\s+</g, '><');
        element = divs.querySelector('.midi-qol-hits-display');
        if (element && game.settings.get('midi-qol', 'ConfigSettings').autoCheckHit === 'all') {
            const hitValues = this._midiParseTargetsFromDisplay(element);
            if (hitValues && hitValues !== "") {
                fields.push({ name: "Results", value: hitValues });
            }
        }
        element = divs.querySelector('.midi-qol-other-damage-roll');
        if (element && element.textContent) {
            const damageTitle = element.querySelector('div').cloneNode(true).firstChild.textContent;
            if (damageTitle && damageTitle !== "") {
                const rollValue = this._midiParseDamageRollFromDisplay(element, message);
                fields.push({ name: damageTitle, value: rollValue })
            }
        }
        element = divs.querySelector('.midi-qol-bonus-damage-roll');
        if (element && element.textContent) {
            const damageTitle = element.querySelector('div').cloneNode(true).firstChild.textContent;
            if (damageTitle && damageTitle !== "") {
                const rollValue = this._midiParseDamageRollFromDisplay(element, message);
                fields.push({ name: damageTitle, value: rollValue })
            }
        }
        element = divs.querySelector('.midi-qol-saves-display');
        if (element && element.textContent && game.settings.get("midi-qol", "ConfigSettings").autoCheckSaves !== "whisper") {
            const saveTitle = await this._getMidiSaveDisplayTitle(message, element);
            const saveValues = this._midiParseTargetsFromDisplay(element);
            fields.push({ name: saveTitle, value: saveValues });
        }
        embeds = [{
            title: embeds[0].title,
            description: embeds[0].description,
            fields: fields,
            footer: embeds[0].footer
        }];
        return embeds;
    }

    async _createMidiDamageTable(message) {
        const divs = document.createElement('div');
        divs.innerHTML = message.content;
        // Instead of parsing from the table itself, create a card with a table using flags
        const damages = message.flags.midiqol.undoDamage;
        let damageArray = [["Actor", "Old HP", "Damage Taken", "New HP"], ["", "", "", ""]];
        damages.forEach(damage => {
            let damageItem = damage.damageItem;
            let damageRow = [];
            const scene = damageItem.sceneId;
            const token = game.scenes.get(scene).tokens.get(damageItem.tokenId);
            if (anonEnabled()) {
                const anon = game.modules.get("anonymous").api;
                if (token.actor && !anon.playersSeeName(token.actor)) {
                    damageRow.push(anon.getName(token.actor));
                }
                else {
                    damageRow.push(token.name);
                }
            }
            else {
                damageRow.push(token.name);
            }
            let oldHP = String(damageItem.oldHP);
            if (damageItem.oldTempHP > 0) {
                oldHP += `(Temp: ${damageItem.oldTempHP})`;
            }
            damageRow.push(oldHP);
            let damageBreakdown = `${damageItem.appliedDamage}(`;
            for (let i = 0; i < damageItem.damageDetail.length; i++) {
                if (damageItem.damageDetail[i] !== null) {
                    if (i > 0) {
                        damageBreakdown += ", ";
                    }
                    let cnt = 0;
                    damageItem.damageDetail[i].forEach(breakdown => {
                        if (cnt > 0) {
                            damageBreakdown += ", ";
                        }
                        damageBreakdown += `${breakdown.damage} ${breakdown.type}`;
                        cnt++;
                    });
                }
            }
            damageBreakdown += ")";
            damageRow.push(damageBreakdown);
            let newHP = String(damageItem.newHP);
            if (damageItem.newTempHP > 0) {
                newHP += "(Temp: " + damageItem.newTempHP + ")";
            }
            damageRow.push(newHP);
            damageArray.push(damageRow);
        });
        if (damageArray.length > 1) {
            return [{ title: "HP Updates", description: parse2DTable(damageArray) }];
        }
        else {
            return [{ title: "HP Updates", description: "" }];
        }
    }

    async _createMidiSingleHitCard(message) {
        const divs = document.createElement('div');
        divs.innerHTML = message.content;
        let element = divs.querySelector('.midi-qol-single-hit-card');
        let desc = "";
        const title = element.querySelector('div').textContent;
        desc = this._midiParseTargetsFromDisplay(element);
        return [{ title: title, description: desc }];
    }


    _midiParseTargetsFromDisplay(element) {
        let parsedText = ""
        element.querySelectorAll('.midi-qol-flex-container, .target').forEach(targetContainer => {
            let parsedTarget = "";
            const result = targetContainer.querySelector('strong');
            if (result) {
                parsedTarget += `**${result.textContent}** `;
            }
            const target = targetContainer.querySelector('.midi-qol-target-npc-Player.midi-qol-target-name, .midi-qol-playerTokenName');
            if (target) {
                const icon = targetContainer.querySelector(".midi-qol-target-name").querySelector("i");
                if (icon) {
                    switch (icon.className) {
                        case "fas fa-times":
                            parsedTarget += swapOrNot(":negative_squared_cross_mark:", checkFails["xmark"]);
                            break;
                        case "fas fa-check":
                            parsedTarget += swapOrNot(":white_check_mark:", checkFails["check"]);
                            break;
                        case "fas fa-check-double":
                            parsedTarget += swapOrNot(":white_check_mark::white_check_mark:", checkFails["doublecheck"]);
                            break;
                    }
                }
                parsedTarget += `**${target.textContent.trim()}**`;
                // For attack hits:
                let ac = targetContainer.querySelector("i.fas.fa-shield-halved");
                if (ac && game.settings.get('midi-qol', 'ConfigSettings').displayHitResultNumeric) {
                    ac = ac.parentNode;
                    parsedTarget += ` (${swapOrNot(":shield:", shieldEmoji)}**__${ac.textContent}__**)`;
                }
                // For spell saves:
                const save = targetContainer.querySelector(".midi-qol-save-total");
                if (save && game.settings.get("midi-qol", "ConfigSettings").autoCheckSaves !== "allNoRoll") {
                    parsedTarget += `: ${dieIcon(20)}**__${save.textContent}__**`;
                }
            }
            parsedTarget = parsedTarget.replace(/\s+/g, ' ').trim();
            parsedText += `${parsedTarget}\n`;
        });
        return parsedText;
    }

    _midiParseDamageRollFromDisplay(element, message) {
        let hide = game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails;
        switch (true) {
            case !this._midiMessageHasPlayerOwner(message) && !getThisModuleSetting('forceShowRolls') && hide === "all" || hide === "d20AttackOnly":
                return `${dieIcon()}**Rolled**`;
                break;
            default:
                const allDamageRolls = element.querySelectorAll(".midi-damage-roll");
                let rollResults = "";
                const messageRolls = message.rolls.slice();
                for (const damageRoll of allDamageRolls) {
                    const rollValue = damageRoll.querySelector('h4.dice-total').textContent.trim();
                    if (getThisModuleSetting('showFormula') && this._midiMessageHasPlayerOwner(message) || game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails === 'none') {
                        const rollFormula = damageRoll.querySelector(".dice-formula");
                        let rollBreakdown = "";
                        if (message && rollFormula) {
                            const rollIndex = messageRolls.findIndex(roll => roll && roll.formula === rollFormula.textContent && roll.total === Number(rollValue));
                            if (rollIndex) {
                                rollBreakdown = this._generateRollBreakdown(messageRolls[rollIndex]);
                                messageRolls.splice(rollIndex, 1);
                            }
                        }
                        rollResults += `${dieIcon()}**\`${rollFormula.textContent}\`**\n${dieIcon()}**Result: __${rollValue}__**||(${rollBreakdown})||\n\n`;
                    }
                    else {
                        rollResults += `${dieIcon()}**Result: __${rollValue}__**\n\n`;
                    }
                }
                return rollResults.trim();
                break;
        }
    }

    async _createMidiSavesDisplayCard(message) {
        const element = document.createElement('div');
        element.innerHTML = message.content;
        let title = "";
        let desc = "";
        if (element && element.textContent !== "") {
            title = await this._getMidiSaveDisplayTitle(message, element);
        }
        if (game.settings.get('midi-qol', 'ConfigSettings').autoCheckSaves !== 'whisper') {
            desc = this._midiParseTargetsFromDisplay(element);
            if (title) {
                return [{ title: title ? title : "", description: desc }];
            }
            else if (desc !== "") {
                return [{ description: desc }];
            }
        }
        return [];
    }

    async _getMidiSaveDisplayTitle(message, element) {
        let title = "";
        const strongTitle = element.querySelector("strong");
        if ((!strongTitle || !strongTitle.textContent) && message.flavor !== "") {
            title = await this.formatText(message.flavor);
        }
        else {
            if (!game.settings.get('midi-qol', 'ConfigSettings').displaySaveDC) {
                const saveDC = strongTitle.querySelector(".midi-qol-saveDC");
                if (saveDC) {
                    saveDC.remove();
                }
            }
            title = await this.formatText(strongTitle.innerHTML);
            if (element.textContent.includes("Base ½")) {
                title += " (Base ½)";
            }
        }
        return title;
    }

    _isMidiMergeCard(htmlString) {
        const tempElement = document.createElement('div');
        tempElement.innerHTML = htmlString;
        const midiQOLItemCard = tempElement.querySelector('.midi-qol-item-card, .midi-chat-card.item-card');
        if (midiQOLItemCard) {
            return true;
        } else {
            return false;
        }
    }

    _isMidiDamageTable(htmlString) {
        const tempElement = document.createElement('div');
        tempElement.innerHTML = htmlString;
        const midiQOLFlexContainer = tempElement.querySelector('.xmidi-qol-flex-container');
        const midiQOLDamageTable = midiQOLFlexContainer.querySelector('table');
        if (midiQOLDamageTable) {
            return true;
        } else {
            return false;
        }
    }

    _isMidiSingleHitCard(htmlString) {
        const tempElement = document.createElement('div');
        tempElement.innerHTML = htmlString;
        const midiQOLSingleHitCard = tempElement.querySelector('.midi-qol-single-hit-card');
        if (midiQOLSingleHitCard) {
            return true;
        } else {
            return false;
        }
    }

    _isMidiSavesDisplayCard(htmlString) {
        const tempElement = document.createElement('div');
        tempElement.innerHTML = htmlString;
        const midiQOLSavesCard = tempElement.querySelector('div label.midi-qol-saveDC, div .midi-qol-save-tooltip');
        if (midiQOLSavesCard) {
            return true;
        } else {
            return false;
        }
    }

    _midiMessageHasPlayerOwner(message) {
        const user = message.author || message.user;
        if (!user) {
            return false;
        }
        return user.hasPlayerOwner;
    }

    async _getEnrichmentOptions(message) {
        let originActor;
        if (message.flags?.dnd5e?.use?.itemUuid) {
            originActor = await fromUuid(message.flags.dnd5e.use.itemUuid).actor;
        }
        else if (game.modules.get('midi-qol')?.active && (message.flags["midi-qol"]?.itemUuid || message.flags["midi-qol"]?.actorUuid)) {
            if (message.flags["midi-qol"]?.itemUuid) {
                originActor = await fromUuid(message.flags["midi-qol"].itemUuid).actor;
            }
            else if (message.flags["midi-qol"]?.actorUuid) {
                originActor = await fromUuid(message.flags["midi-qol"].actorUuid);
            }
        }
        else if (message.speaker?.actor) {
            originActor = game.actors.get(message.speaker.actor); //Fallback to speaker in case it's needed.
        }
        return {
            rollData: originActor ? originActor.system : {},
            relativeTo: originActor
        }
    }
}