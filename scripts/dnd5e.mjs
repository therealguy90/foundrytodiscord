import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { parse2DTable } from './helpers/tables.mjs';
import * as generic from './generic.mjs';
import { newEnrichedMessage, toHTML } from './helpers/enrich.mjs';
import { swapOrNot, getDieEmoji, dieIcon } from './helpers/emojis/global.mjs';

export async function messageParserDnD5e(msg) {
    const enrichedMsg = await newEnrichedMessage(msg, await DnD5e_getEnrichmentOptions(msg));
    let constructedMessage = '';
    let embeds = [];
    if (game.modules.get('midi-qol')?.active && midiqol_isMergeCard(enrichedMsg.content)) {
        embeds = await midiqol_createMergeCard(enrichedMsg);
    }
    else if (game.modules.get('midi-qol')?.active && enrichedMsg.flags?.midiqol?.undoDamage && midiqol_isDamageTable(enrichedMsg.content)) {
        embeds = await midiqol_createDamageTable(enrichedMsg);
    }
    else if (game.modules.get('midi-qol')?.active && midiqol_isSingleHitCard(enrichedMsg.content)) {
        embeds = await midiqol_createSingleHitCard(enrichedMsg);
    }
    else if (game.modules.get('midi-qol')?.active && midiqol_isSavesDisplayCard(enrichedMsg.content)) {
        embeds = await midiqol_createSavesDisplayCard(enrichedMsg);
    }
    else if (game.modules.get('monks-tokenbar')?.active && generic.tokenBar_isTokenBarCard(enrichedMsg.content)) {
        embeds = generic.tokenBar_createTokenBarCard(enrichedMsg);
    }
    else if (generic.isCard(enrichedMsg.content) && enrichedMsg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = DnD5e_createCardEmbed(enrichedMsg);
        }
    }
    else if (!enrichedMsg.isRoll) {
        if (generic.hasDiceRolls(enrichedMsg.content)) {
            embeds = generic.createHTMLDiceRollEmbed(enrichedMsg);
            const elements = document.createElement('div');
            elements.innerHTML = enrichedMsg.content;
            const diceRolls = elements.querySelectorAll('.dice-roll');
            for (const div of diceRolls) {
                div.parentNode.removeChild(div);
            }
            enrichedMsg.content = elements.innerHTML;
        }
        if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && enrichedMsg.flags?.polyglot?.language) {
            constructedMessage = generic.polyglotize(enrichedMsg);
        }
        if (constructedMessage === '') {
            constructedMessage = enrichedMsg.content;
        }
    }
    else {
        embeds = generic.createGenericRollEmbed(enrichedMsg);
    }
    if (embeds.length === 0 && generic.willAutoUUIDEmbed(enrichedMsg.content)) {
        embeds = await generic.generateAutoUUIDEmbeds(enrichedMsg);
    }
    if (embeds && embeds.length > 0) {
        for (let embed of embeds) {
            embed.description = await DnD5e_reformatMessage(await toHTML(embed.description, await DnD5e_getEnrichmentOptions(msg)));
        }
        if (!generic.willAutoUUIDEmbed(enrichedMsg.content)) {
            constructedMessage = (/<[a-z][\s\S]*>/i.test(enrichedMsg.flavor) || enrichedMsg.flavor === embeds[0].title) ? "" : enrichedMsg.flavor;
        }
        // use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        // we have to mimic this behavior here, since visibility is client-sided, and we are parsing raw message content.
        if (anonEnabled()) {
            for (let i = 0; i < embeds.length; i++) {
                embeds[i].title = generic.anonymizeText(embeds[i].title, enrichedMsg);
                embeds[i].description = generic.anonymizeText(embeds[i].description, enrichedMsg);
            }
        }
    }
    if (anonEnabled()) {
        constructedMessage = generic.anonymizeText(constructedMessage, enrichedMsg);
    }
    constructedMessage = await DnD5e_reformatMessage(constructedMessage);
    return generic.getRequestParams(enrichedMsg, constructedMessage, embeds);
}

function DnD5e_createCardEmbed(message) {
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
    }

    return [{ title: title, description: desc, footer: { text: generic.getCardFooter(message.content) } }];
}

export async function DnD5e_reformatMessage(text) {
    let reformattedText = await generic.reformatMessage(text, DnD5e_parseHTMLText);
    return reformattedText;
}

async function DnD5e_parseHTMLText(htmlString) {
    let reformattedText = htmlString;
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;
    // Format various elements
    generic.formatTextBySelector('a.roll-link', text => `${dieIcon()}\`${text}\``, htmldoc);
    reformattedText = htmldoc.innerHTML;

    return reformattedText;
}

// midi might as well be part of the system at this point.
async function midiqol_createMergeCard(message) {
    let embeds = DnD5e_createCardEmbed(message);
    const divs = document.createElement('div');
    divs.innerHTML = message.content;
    let attackTitle = "";
    let damageTitle = "";
    let element = divs.querySelector('.midi-qol-attack-roll');
    let fields = [];
    if (element) {
        attackTitle = element.querySelector('div').textContent;
        if (attackTitle && attackTitle !== "") {
            const total = element.querySelector('h4.dice-total');
            let result = total.textContent;
            let rollValue = "";
            if (result) {
                switch (game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails) {
                    case 'none':
                        const rollFormula = element.querySelector(".dice-formula");
                        if (getThisModuleSetting('showFormula')) {
                            rollValue = `${dieIcon()}**\`${rollFormula.textContent}\`**\n${dieIcon()}**Result: __${result}__`;
                        }
                        else {
                            rollValue = `${dieIcon()}**Result: __${result}__`;
                        }
                        break;
                    case 'detailsDSN':
                    case 'details':
                        if (result !== "") {
                            rollValue = `${dieIcon()}**Result: __${result}__`;
                        }
                        break;
                    case 'd20Only':
                    case 'd20AttackOnly':
                        rollValue = `${dieIcon()}**(d20) __${getDieEmoji(20, message.flags['midi-qol'].d20AttackRoll)}__`;
                        break;
                    case 'hitDamage':
                    case 'hitCriticalDamage':
                        if (message.flags['midi-qol'].isHit) {
                            rollValue = "**__Hits__"
                        }
                        else {
                            rollValue = "**__Misses__"
                        }
                        break;
                    case 'all':
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
                fields.push({ name: attackTitle, value: rollValue, inline: true })
            }
        }
    }
    element = divs.querySelector('.midi-qol-damage-roll');
    if (element) {
        damageTitle = element.querySelector('div').textContent;
        if (damageTitle && damageTitle !== "") {
            let rollValue = "";
            rollValue = element.querySelector('h4.dice-total').textContent;
            if (rollValue !== "" && ['all', 'd20AttackOnly'].includes(game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails)) {
                rollValue = `${dieIcon()}**Rolled**`;
            }
            else {
                if (getThisModuleSetting('showFormula') && game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails === 'none') {
                    const rollFormula = element.querySelector(".dice-formula");
                    rollValue = `${dieIcon()}**\`${rollFormula.textContent}\`**\n${dieIcon()}**Result: __${rollValue}__**`;
                }
                else {
                    rollValue = `${dieIcon()}**Result: __${rollValue}__**`;
                }
            }
            fields.push({ name: damageTitle, value: rollValue, inline: true })
        }
    }
    embeds = [{
        title: embeds[0].title,
        description: embeds[0].description,
        fields: fields,
        footer: embeds[0].footer
    }];
    divs.innerHTML = message.content.replace(/>\s+</g, '><');
    element = divs.querySelector('.midi-qol-saves-display');
    let title = "";
    let desc = "";
    if (element && element.textContent) {
        embeds = embeds.concat(await midiqol_createSavesDisplayCard(message));
        return embeds;
    }
    element = divs.querySelector('.midi-qol-hits-display');
    if (element && game.settings.get('midi-qol', 'ConfigSettings').autoCheckHit === 'all') {
        element.querySelectorAll('.midi-qol-flex-container').forEach(container => {
            let parsedTarget = "";
            const result = container.querySelector('strong');
            if (result) {
                parsedTarget += `**${result.textContent}** `;
            }
            const target = container.querySelector('.midi-qol-target-npc-Player.midi-qol-target-name');
            if (target) {
                parsedTarget += `${target.textContent} `;
            }
            parsedTarget = parsedTarget.replace(/\s+/g, ' ').trim();
            desc += parsedTarget + "\n";
        });
        if (title) {
            embeds.push({ title: title ? generic.parseHTMLText(title.innerHTML) : "", description: desc });
        }
        else if (desc !== "") {
            embeds.push({ description: desc })
        }
        return embeds;
    }
    return embeds;
}

async function midiqol_createDamageTable(message) {
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

async function midiqol_createSingleHitCard(message) {
    const divs = document.createElement('div');
    divs.innerHTML = message.content;
    let element = divs.querySelector('.midi-qol-single-hit-card');
    let desc = "";
    const title = element.querySelector('div').textContent;
    element.querySelectorAll('.midi-qol-flex-container').forEach(container => {
        let parsedTarget = "";
        const result = container.querySelector('strong');
        if (result) {
            parsedTarget += `**${result.textContent}** `;
        }
        const target = container.querySelector('.midi-qol-target-npc-Player.midi-qol-target-name');
        if (target) {
            parsedTarget += `${target.textContent} `;
        }
        parsedTarget = parsedTarget.replace(/\s+/g, ' ').trim();
        desc += parsedTarget + "\n";
    });
    return [{ title: title, description: desc }];
}

async function midiqol_createSavesDisplayCard(message) {
    const divs = document.createElement('div');
    divs.innerHTML = message.content;
    let element = divs.querySelector('.midi-qol-saves-display');
    let title = "";
    let desc = "";
    if (element.textContent !== "" && game.settings.get('midi-qol', 'ConfigSettings').displaySaveDC) {
        title = element.querySelector(".midi-qol-nobox.midi-qol-bigger-text");
        if ((!title || title === "" || !title.innerHTML) && message.flavor !== "") {
            title = message.flavor;
        }
        else {
            title = title.innerHTML;
        }
    }
    if (game.settings.get('midi-qol', 'ConfigSettings').autoCheckSaves !== 'whisper') {
        element.querySelectorAll('.midi-qol-flex-container').forEach(container => {
            let parsedTarget = "";
            const target = container.querySelector('.midi-qol-target-npc-Player.midi-qol-target-name');
            if (target) {
                parsedTarget += `${target.textContent} `;
            }
            const label = container.querySelector('label')?.textContent;
            if (label) {
                parsedTarget += `${label} `;
            }
            if (game.settings.get('midi-qol', 'ConfigSettings').autoCheckSaves !== 'allNoRoll') {
                const savetotal = container.querySelector('.midi-qol-tooltip.midi-qol-save-total')
                if (savetotal) {
                    parsedTarget += `: ${dieIcon()} **__${savetotal.firstChild.textContent.split(" ")[1]}__**`;
                }
            }
            parsedTarget = parsedTarget.replace(/\s+/g, ' ').trim();
            desc += parsedTarget + "\n";
        });
        if (title) {
            return [{ title: title ? await generic.parseHTMLText(title) : "", description: desc }];
        }
        else if (desc !== "") {
            return [{ description: desc }];
        }
    }
    return [];
}

function midiqol_isMergeCard(htmlString) {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlString;
    const midiQOLItemCard = tempElement.querySelector('.midi-qol-item-card');
    if (midiQOLItemCard) {
        return true;
    } else {
        return false;
    }
}

function midiqol_isDamageTable(htmlString) {
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

function midiqol_isSingleHitCard(htmlString) {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlString;
    const midiQOLSingleHitCard = tempElement.querySelector('.midi-qol-single-hit-card');
    if (midiQOLSingleHitCard) {
        return true;
    } else {
        return false;
    }
}

function midiqol_isSavesDisplayCard(htmlString) {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlString;
    const midiQOLSavesCard = tempElement.querySelector('.midi-qol-saves-display');
    if (midiQOLSavesCard) {
        return true;
    } else {
        return false;
    }
}

async function DnD5e_getEnrichmentOptions(message) {
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