import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { parse2DTable } from './helpers/tables.mjs';
import * as generic from './generic.mjs';

export function messageParserDnD5e(msg) {
    let constructedMessage = '';
    let embeds = [];
    if (game.modules.get('midi-qol')?.active && midiqol_isMergeCard(msg.content)) {
        embeds = midiqol_createMergeCard(msg);
    }
    else if (game.modules.get('midi-qol')?.active && msg.flags?.midiqol?.undoDamage && midiqol_isDamageTable(msg.content)) {
        embeds = midiqol_createDamageTable(msg);
    }
    else if (game.modules.get('midi-qol')?.active && midiqol_isSingleHitCard(msg.content)) {
        embeds = midiqol_createSingleHitCard(msg);
    }
    else if (game.modules.get('midi-qol')?.active && midiqol_isSavesDisplayCard(msg.content)) {
        embeds = midiqol_createSavesDisplayCard(msg);
    }
    else if (game.modules.get('monks-tokenbar')?.active && generic.tokenBar_isTokenBarCard(msg.content)) {
        embeds = generic.tokenBar_createTokenBarCard(msg);
    }
    else if (generic.isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = generic.createCardEmbed(msg);
        }
    }
    else if (!msg.isRoll) {
        if (generic.hasDiceRolls(msg.content)) {
            embeds = generic.createHTMLDiceRollEmbed(msg);
            const elements = document.createElement('div');
            elements.innerHTML = msg.content;
            const diceRolls = elements.querySelectorAll('.dice-roll');
            for (const div of diceRolls) {
                div.parentNode.removeChild(div);
            }
            msg.content = elements.innerHTML;
        }
        if (game.modules.get("polyglot")?.active && msg.flags?.polyglot?.language) {
            constructedMessage = generic.polyglotize(msg);
        }
        if (constructedMessage === '') {
            constructedMessage = msg.content;
        }
    }
    else {
        embeds = generic.createGenericRollEmbed(msg);
    }

    if (embeds != [] && embeds.length > 0) {
        embeds[0].description = DnD5e_reformatMessage(embeds[0].description);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === embeds[0].title) ? "" : msg.flavor;
        //use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        //sadly, the anonymous module does this right before the message is displayed in foundry, so we have to parse it here.
        if (anonEnabled()) {
            for (let i = 0; i < embeds.length; i++) {
                embeds[i].title = generic.anonymizeText(embeds[i].title, msg);
                embeds[i].description = generic.anonymizeText(embeds[i].description, msg);
            }
        }
    }
    if (anonEnabled()) {
        constructedMessage = generic.anonymizeText(constructedMessage, msg);
    }
    constructedMessage = DnD5e_reformatMessage(constructedMessage);
    return generic.getRequestParams(msg, constructedMessage, embeds);
}

export function DnD5e_reformatMessage(text) {
    let reformattedText = generic.reformatMessage(text);
    //replace Inline Roll Commands
    let regex = /\[\[[^\]]+\]\]\{([^}]+)\}/g;
    reformattedText = reformattedText.replace(regex, ':game_die:`$1`');
    regex = /\[\[\/(.*?) (.*?)\]\]/g;
    reformattedText = reformattedText.replace(regex, ':game_die:`$2`');
    return reformattedText;
}

// midi might as well be part of the system at this point.
function midiqol_createMergeCard(message) {
    let embeds = generic.createCardEmbed(message);
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
                        rollValue = `:game_die:**\`${rollFormula.textContent}\`**\n:game_die:**(d20) __${message.flags['midi-qol'].d20AttackRoll}__`;
                        }
                        else{
                            rollValue = `\`:game_die:**Result: __${result}__\``;
                        }
                        break;
                    case 'detailsDSN':
                    case 'details':
                        if (result !== "") {
                            rollValue = ":game_die:**Result: __" + result + "__";
                        }
                        break;
                    case 'd20Only':
                    case 'd20AttackOnly':
                        rollValue = `:game_die:**(d20) __${message.flags['midi-qol'].d20AttackRoll}__`;
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
                        rollValue = ':game_die:**Rolled';
                        break;
                }
                if (['none', 'detailsDSN', 'details', 'hitCriticalDamage', 'd20Only', 'd20AttackOnly'].includes(game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails)) {
                    if (message.flags['midi-qol'].isCritical) {
                        rollValue += " (Critical!)**";
                    }
                    else if (message.flags['midi-qol'].isFumble) {
                        rollValue += " (Fumble!)**";
                    }
                    else {
                        rollValue += "**";
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
                rollValue = ":game_die:**Rolled**";
            }
            else {
                if (getThisModuleSetting('showFormula') && game.settings.get('midi-qol', 'ConfigSettings').hideRollDetails === 'none') {
                    const rollFormula = element.querySelector(".dice-formula");
                    rollValue = `:game_die:**\`${rollFormula.textContent}\`**\n:game_die:**Result: __${rollValue}__**`;
                }
                else {
                    rollValue = `:game_die:**Result: __${rollValue}__**`;
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
        embeds = embeds.concat(midiqol_createSavesDisplayCard(message));
        return embeds;
    }
    element = divs.querySelector('.midi-qol-hits-display');
    if (element && game.settings.get('midi-qol', 'ConfigSettings').autoCheckHit === 'all') {
        element.querySelectorAll('.midi-qol-flex-container').forEach(container => {
            let parsedTarget = "";
            const result = container.querySelector('strong');
            if (result) {
                parsedTarget += "**" + result.textContent + "** ";
            }
            const target = container.querySelector('.midi-qol-target-npc-Player.midi-qol-target-name');
            if (target) {
                parsedTarget += target.textContent + " ";
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

function midiqol_createDamageTable(message) {
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
            oldHP += "(Temp: " + damageItem.oldTempHP + ")";
        }
        damageRow.push(oldHP);
        let damageBreakdown = damageItem.appliedDamage + "(";
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
                    damageBreakdown += breakdown.damage + " " + breakdown.type;
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

function midiqol_createSingleHitCard(message) {
    const divs = document.createElement('div');
    divs.innerHTML = message.content;
    let element = divs.querySelector('.midi-qol-single-hit-card');
    let desc = "";
    const title = element.querySelector('div').textContent;
    element.querySelectorAll('.midi-qol-flex-container').forEach(container => {
        let parsedTarget = "";
        const result = container.querySelector('strong');
        if (result) {
            parsedTarget += "**" + result.textContent + "** ";
        }
        const target = container.querySelector('.midi-qol-target-npc-Player.midi-qol-target-name');
        if (target) {
            parsedTarget += target.textContent + " ";
        }
        parsedTarget = parsedTarget.replace(/\s+/g, ' ').trim();
        desc += parsedTarget + "\n";
    });
    return [{ title: title, description: desc }];
}

function midiqol_createSavesDisplayCard(message) {
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
                parsedTarget += target.textContent + " ";
            }
            const label = container.querySelector('label')?.textContent;
            if (label) {
                parsedTarget += label + " ";
            }
            if (game.settings.get('midi-qol', 'ConfigSettings').autoCheckSaves !== 'allNoRoll') {
                const savetotal = container.querySelector('.midi-qol-tooltip.midi-qol-save-total')
                if (savetotal) {
                    parsedTarget += ": " + ":game_die: **__" + savetotal.firstChild.textContent.split(" ")[1] + "__**";
                }
            }
            parsedTarget = parsedTarget.replace(/\s+/g, ' ').trim();
            desc += parsedTarget + "\n";
        });
        if (title) {
            return [{ title: title ? generic.parseHTMLText(title) : "", description: desc }];
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

