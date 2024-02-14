import * as generic from './generic.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { newEnrichedMessage, toHTML } from './helpers/enrich.mjs';
import { swapOrNot, getDieEmoji, dieIcon } from './helpers/emojis/global.mjs';
import { actionGlyphEmojis, damageEmojis, templateEmojis, targetEmoji } from './helpers/emojis/pf2e.mjs';

const DamageRoll = CONFIG.Dice.rolls.find(r => r.name === "DamageRoll");

export async function messageParserPF2e(msg) {
    const enrichedMsg = await newEnrichedMessage(msg, await PF2e_getEnrichmentOptions(msg));
    let constructedMessage = '';
    let embeds = [];
    if (PF2e_isActionCard(enrichedMsg) && enrichedMsg.rolls?.length < 1) {
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = PF2e_createActionCardEmbed(enrichedMsg);
        }
    }
    else if (PF2e_isConditionCard(enrichedMsg)) {
        embeds = PF2e_createConditionCard(enrichedMsg);
    }
    else if (game.modules.get('monks-tokenbar')?.active && generic.tokenBar_isTokenBarCard(enrichedMsg.content)) {
        embeds = generic.tokenBar_createTokenBarCard(enrichedMsg);
    }
    else if (generic.isCard(enrichedMsg.content) && enrichedMsg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = PF2e_createCardEmbed(enrichedMsg);
        }
    }
    else if (!enrichedMsg.isRoll || (enrichedMsg.isRoll && enrichedMsg.rolls.length < 1)) {

        if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && enrichedMsg.flags?.polyglot?.language) {
            constructedMessage = generic.polyglotize(enrichedMsg, "system.details.languages.value");
        }

        if (constructedMessage === '') {
            constructedMessage = enrichedMsg.content;
        }
    }
    else {
        if ((enrichedMsg.flavor !== null && enrichedMsg.flavor.length > 0) || (enrichedMsg.isDamageRoll && PF2e_containsDamageDie(enrichedMsg.rolls))) {
            embeds = PF2e_createRollEmbed(enrichedMsg);
        }
        else {
            embeds = generic.createGenericRollEmbed(enrichedMsg);
        }
    }
    if (embeds.length === 0 && generic.willAutoUUIDEmbed(enrichedMsg.content)) {
        embeds = await PF2e_generateAutoUUIDEmbeds(enrichedMsg);
    }

    if (embeds && embeds.length > 0) {
        for (let embed of embeds) {
            embed.description = await PF2e_reformatMessage(embed.description);
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
    constructedMessage = await PF2e_reformatMessage(constructedMessage);
    return generic.getRequestParams(enrichedMsg, constructedMessage, embeds);
}

export async function PF2e_reformatMessage(text) {
    let reformattedText = await generic.reformatMessage(text, PF2e_parseHTMLText);
    return reformattedText.trim();
}

async function PF2e_parseHTMLText(htmlString) {
    let reformattedText = htmlString;
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;
    // Format various elements
    generic.removeElementsBySelector('[data-visibility="gm"], [data-visibility="owner"],[data-visibility="none"]', htmldoc);
    generic.formatTextBySelector('.inline-check, span[data-pf2-check]', text => `${dieIcon(20)}\`${text}\``, htmldoc);
    generic.formatTextBySelector('.action-glyph', text => `${actionGlyphEmojis[text.toLowerCase().trim()] ? actionGlyphEmojis[text.toLowerCase().trim()] : ""}`, htmldoc);
    generic.formatTextBySelector('.statements.reverted', text => `~~${text}~~`, htmldoc);
    reformattedText = htmldoc.innerHTML;
    htmldoc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(header => {
        header.querySelectorAll('span[style="float:right"]').forEach(floatright => {
            if (header.textContent.trim() !== floatright.textContent.trim()) {
                floatright.textContent = ` - ${floatright.textContent}`;
            }
        });
    });
    const templateButtons = htmldoc.querySelectorAll('span[data-pf2-effect-area]');
    if (templateButtons.length > 0) {
        templateButtons.forEach(template => {
            const type = template.getAttribute('data-pf2-effect-area');
            let tempTemplate = ""
            if (templateEmojis.hasOwnProperty(type)) {
                tempTemplate += templateEmojis[type];
            }
            tempTemplate += "`" + template.textContent + "`";
            template.outerHTML = tempTemplate;
        })
    }
    reformattedText = htmldoc.innerHTML;

    //Old format for status effects. Kept this in for now, but will be removed later on.
    const statuseffectlist = htmldoc.querySelectorAll('.statuseffect-rules');
    if (statuseffectlist.length !== 0) {
        let statfx = '';
        statuseffectlist.forEach(effect => {
            statfx += effect.innerHTML.replace(/<p>.*?<\/p>/g, '') + '\n';
        });
        const tempdivs = document.createElement('div');
        tempdivs.innerHTML = reformattedText;
        const targetdiv = tempdivs.querySelector('.dice-total.statuseffect-message');
        if (targetdiv) {
            targetdiv.innerHTML = statfx;
        }
        generic.removeElementsBySelector('.dice-total.statuseffect-message ul', tempdivs);
        reformattedText = tempdivs.innerHTML;
    }

    return reformattedText;
}

function PF2e_createCardEmbed(message) {
    const div = document.createElement('div');
    div.innerHTML = message.content;
    let desc = "";
    let title;
    // Find the <h3> element as title
    //generic card

    const h3Element = div.querySelector("h3");
    const actionGlyphElement = h3Element.querySelector(".action-glyph");
    if (actionGlyphElement) {
        const glyphCharacter = actionGlyphElement.textContent.toLowerCase().trim();
        if (getThisModuleSetting('prettierEmojis') && actionGlyphEmojis[glyphCharacter]) {
            actionGlyphElement.innerHTML = actionGlyphEmojis[glyphCharacter];
        }
        else {
            actionGlyphElement.remove();
        }
    }
    title = h3Element.textContent.trim();
    desc = PF2e_parseTraits(message.content);
    let speakerActor;
    if (message.speaker?.actor) {
        speakerActor = game.actors.get(message.speaker.actor);
    }

    //parse card description if actor is owned by a player
    //this is to limit metagame information
    let descVisible = getThisModuleSetting('showDescription');

    if (speakerActor) {
        if (anonEnabled() && !speakerActor.hasPlayerOwner) {
            descVisible = false;
        }
    }
    if (descVisible) {
        let descList = div.querySelectorAll(".card-content");
        descList.forEach(function (paragraph) {
            let text = paragraph.innerHTML
            desc += text + "\n\n";
        });
    }

    return [{ title: title, description: desc, footer: { text: generic.getCardFooter(div.innerHTML) } }];
}

function PF2e_createRollEmbed(message) {
    const div = document.createElement('div');
    div.innerHTML = message.flavor;
    let title = "";
    let desc = "";
    //Build Title
    const actionTitle = div.querySelector("h4.action");
    if (actionTitle) {
        const strongtitle = actionTitle.querySelector("strong").textContent;
        const subtitle = actionTitle.querySelector(".subtitle");
        if (strongtitle || subtitle) {
            title = `${strongtitle} ${(subtitle ? subtitle.textContent : "")}`;
        }
        else {
            if (message.isDamageRoll) {
                title = "Damage Roll";
            }
        }
    }
    else if (div.textContent) {
        const strong = div.querySelector("strong");
        if (strong) {
            title = strong.textContent
        }
        else {
            title = div.textContent;
        }
    }
    else if (message.isDamageRoll) {
        title = "Damage Roll";
    }
    desc = PF2e_parseTraits(message.flavor, true);

    //Build description
    if (anonEnabled()) {
        var anon = game.modules.get('anonymous').api; //optional implementation for "anonymous" module
    }

    //Add targets to embed:
    let targetPlayerTokens = [];
    if (game.modules.get("pf2e-toolbelt")?.active && message.flags["pf2e-toolbelt"]?.target?.targets?.length > 0) {
        const targets = message.flags["pf2e-toolbelt"].target.targets;
        let targetString = "";
        targets.forEach(target => {
            const targetActor = fromUuidSync(target.actor);
            const targetToken = fromUuidSync(target.token);
            if (targetToken.hidden === true) {
                return;
            }
            if (targetToken.hasPlayerOwner) {
                targetString += `\`${targetToken.name}\` `;
                targetPlayerTokens.push({ name: targetToken.name, id: targetToken.id });
            }
            else {
                if (targetActor) {
                    if (anonEnabled()) {
                        if (!anon.playersSeeName(targetActor)) {
                            targetString += `\`${anon.getName(targetActor)}\` `;
                        }
                        else {
                            targetString += `\`${targetToken.name}\` `;
                        }
                    }
                    else {
                        targetString += `\`${targetToken.name}\` `;
                    }
                }
                else {
                    if (targetToken.displayName === CONST.TOKEN_DISPLAY_MODES.ALWAYS ||
                        targetToken.displayName === CONST.TOKEN_DISPLAY_MODES.HOVER) {
                        targetString += `\`${targetToken.name}\` `;
                    }
                    else {
                        targetString += "`Unknown` ";
                    }
                }
            }
        });

        if (targetString) {
            desc += `**${swapOrNot(":dart:", targetEmoji)}Target${targets.length > 1 ? "s" : ""}: **${targetString}\n`;
        }
    }
    else if (game.modules.get("pf2e-target-damage")?.active && message.flags['pf2e-target-damage']?.targets?.length > 0) { //optional implementation for "pf2e-target-damage" module
        const targets = message.flags['pf2e-target-damage'].targets;
        desc += `**${swapOrNot(":dart:", targetEmoji)}Target${targets.length > 1 ? "s" : ""}: **`;
        targets.forEach(target => {
            const curScene = game.scenes.get(message.speaker.scene);
            const curToken = curScene.tokens.get(target.id);
            if (anonEnabled()) {
                if (!anon.playersSeeName(curToken.actor)) {
                    desc += `\`${anon.getName(curToken.actor)}\` `;
                }
                else {
                    desc += `\`${curToken.name}\` `;
                }
            }
            else {
                desc += `\`${curToken.name}\` `;
            }
        });
        if (targets.length >= 1) {
            desc += "\n";
        }
    }
    else {
        if (message.flags?.pf2e?.context?.target?.token) {
            desc += `**${swapOrNot(":dart:", targetEmoji)}Target: **`;
            const targetToken = fromUuidSync(message.flags.pf2e.context.target.token);
            if (targetToken) {
                if (anonEnabled()) {
                    if (!anon.playersSeeName(targetToken.actor)) {
                        desc += `\`${anon.getName(targetToken.actor)}\` `;
                    }
                    else {
                        desc += `\`${targetToken.name}\` `;
                    }
                }
                else {
                    desc += `\`${targetToken.name}\` `;
                }
            }
            desc += "\n";
        }
    }
    desc += "\n";

    if (!message.isReroll) {
        //Add roll information to embed:
        const speakerActor = game.actors.get(message.speaker.actor);
        message.rolls.forEach(roll => {
            let rollBreakdown = ""
            if (getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !message.user.isGM))) {
                desc += `${dieIcon()}**\`${roll.formula}\`**\n`
                rollBreakdown = PF2e_generateRollBreakdown(roll);
            }
            desc += `${dieIcon()}**Result: __${roll.total}__**`;
            if (speakerActor?.hasPlayerOwner && roll.dice[0]?.faces === 20) {
                if (roll.result.startsWith('20 ')) {
                    desc += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
                }
                else if (roll.result.startsWith('1 ')) {
                    desc += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
                }
            }
            if (roll instanceof DamageRoll) {
                desc += PF2e_parseDamageTypes(roll);
                if (rollBreakdown && speakerActor?.hasPlayerOwner) {
                    desc += `\n||(${rollBreakdown})||`;
                }
            }
            else {
                if (PF2e_parseDegree(roll.options?.degreeOfSuccess)) {
                    desc += `\`(${PF2e_parseDegree(roll.options.degreeOfSuccess)})\``;
                }
                else if (PF2e_parseDegree(message.flags.pf2e?.context?.outcome)) {
                    desc += `\`(${PF2e_parseDegree(message.flags.pf2e.context.outcome)})\``;
                }
                if (rollBreakdown && speakerActor?.hasPlayerOwner) {
                    desc += `||(${rollBreakdown})||`;
                }
            }
            desc += "\n\n";
        });
    }
    else { // isReroll typically only consists of one Roll object.
        const speakerActor = game.actors.get(message.speaker.actor);
        if (getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !message.user.isGM))) {
            desc += `${dieIcon()}**\`${message.rolls[0].formula}\`**\n`
        }
        desc += `~~${dieIcon()}Result: __${PF2e_getDiscardedRoll(message)}__~~\n`;
        desc += `${dieIcon()}**Result: __${message.rolls[0].total}__**`;
        if (speakerActor?.hasPlayerOwner && message.rolls[0].dice[0].faces === 20) {
            if (message.rolls[0].result.startsWith('20 ')) {
                desc += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
            }
            else if (message.rolls[0].result.startsWith('1 ')) {
                desc += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
            }
        }
        if (PF2e_parseDegree(message.flags.pf2e.context.outcome)) {
            desc += `\`(${PF2e_parseDegree(message.flags.pf2e.context.outcome)})\``;
        }
        if (speakerActor?.hasPlayerOwner) {
            desc += `||(${PF2e_generateRollBreakdown(message.rolls[0])})||`;
        }
        desc += "\n";
    }
    let rollEmbeds = [{ title: title, description: desc }]
    if (message.isDamageRoll && game.modules.get("pf2e-toolbelt")?.active && message.flags["pf2e-toolbelt"]?.target?.saves && targetPlayerTokens) {
        rollEmbeds = rollEmbeds.concat(PF2e_createToolbeltSavesEmbed(message, targetPlayerTokens));
    }

    return rollEmbeds;

}

function PF2e_createActionCardEmbed(message) {
    const div = document.createElement('div');
    div.innerHTML = message.content;
    let desc = "";
    let title;
    const actionDiv = document.createElement('div');
    actionDiv.innerHTML = message.flavor;
    const h4Element = actionDiv.querySelector("h4.action");
    const subtitle = actionDiv.querySelector(".subtitle");
    const actionGlyph = actionDiv.querySelector(".action-glyph");
    title = `${h4Element ? h4Element.querySelector("strong") ? h4Element.querySelector("strong").textContent : h4Element.textContent : ""} ${subtitle ? subtitle.textContent : ""}`;
    if (getThisModuleSetting("prettierEmojis") && title && actionGlyph && actionGlyphEmojis.hasOwnProperty(actionGlyph.textContent.trim().toLowerCase())) {
        title += actionGlyphEmojis[actionGlyph.textContent.trim().toLowerCase()];
    }
    desc = `${PF2e_parseTraits(message.flavor)}\n`;
    let speakerActor;
    if (message.speaker?.actor) {
        speakerActor = game.actors.get(message.speaker.actor);
    }
    let descVisible = getThisModuleSetting('showDescription');
    if (speakerActor) {
        if (anonEnabled() && !speakerActor.hasPlayerOwner) {
            descVisible = false;
        }
    }
    if (descVisible) {
        if (message.flags?.pf2e?.context?.item) {
            const itemDesc = game.actors.get(message.speaker.actor).items.get(message.flags.pf2e.context.item).system.description.value;
            const actionCardDesc = div.querySelector(".description, .action-content");
            actionCardDesc.outerHTML = itemDesc;
            desc += div.innerHTML;
        }
        else {
            const actionDesc = div.querySelector(".description, .action-content");
            if (actionDesc) {
                desc += actionDesc.innerHTML;
            }
        }
    }
    return [{ title: title, description: desc, footer: { text: generic.getCardFooter(div.innerHTML) } }];
}

function PF2e_createConditionCard(message) {
    let desc = ""
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const participantConditions = doc.querySelector(".participant-conditions");
    const conditions = participantConditions.querySelectorAll("span");
    conditions.forEach(condition => {
        desc += "**" + condition.textContent + "**\n";
    });
    return [{ description: desc.trim() }];
}

function PF2e_parseTraits(text, isRoll = false) {
    let displayTraits = true;
    //check if anonymous allows traits to be displayed
    if (anonEnabled()) {
        if (game.settings.get("anonymous", "pf2e.traits")) {
            if (isRoll && game.settings.get("anonymous", "pf2e.traits") === "rolls") {
                displayTraits = false;
            }
            else if (game.settings.get("anonymous", "pf2e.traits") === "always") {
                displayTraits = false;
            }
        }
    }
    let traits = "";
    if (displayTraits) {
        const card = text;
        const parser = new DOMParser();
        let doc = parser.parseFromString(card, "text/html");
        let tags;
        let tagsSection = doc.querySelector(".item-properties.tags:not(.modifiers)");
        try {
            tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
        }
        catch (error) {
            try {
                tagsSection = doc.querySelector('.tags:not(.modifiers)');
                tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
            }
            catch (error) {
            }
        }
        if (tags?.length) {
            for (let i = 0; i < tags.length; i++) {
                traits += `[${tags[i]}] `;
            }
        }
    }
    if (traits.trim() !== "") {
        return `\`${traits.trim()}\`\n`;
    }
    else {
        return "";
    }
}

function PF2e_getDiscardedRoll(message) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const rerollDiscardDiv = doc.querySelector(".pf2e-reroll-discard .dice-total, .reroll-discard .dice-total");
    return rerollDiscardDiv.textContent;
}

function PF2e_parseDamageTypes(baserolls) {
    let damages = ""
    if (!baserolls.options.splashOnly) {
        baserolls.terms.forEach((term, i) => {
            term.rolls.forEach((roll, j) => {
                let precision = false;
                let splash = false;
                roll.terms.forEach((typeterm, k) => {
                    if (typeterm.term?.options?.flavor) {
                        precision = typeterm.term.options.flavor === "precision";
                        splash = typeterm.term.options.flavor === "splash";
                    }

                });
                if (!roll.persistent || baserolls.options?.evaluatePersistent) {
                    damages += roll._total.toString();
                }
                else {
                    let persFormula = roll._formula;
                    const regex = /\[([^\]]*)\]/g;
                    persFormula = persFormula.replace(regex, '');
                    damages += persFormula.trim();
                }
                damages += `${(roll.persistent ? damageEmojis["persistent"] : "")}${(precision ? damageEmojis["precision"] : "")}${(splash ? damageEmojis["splash"] : "")}`;
                if (!damageEmojis[roll.type]) {
                    damages += `[${roll.type}]`;
                }
                else {
                    damages += damageEmojis[roll.type];
                }
                if (j != term.rolls.length - 1) {
                    damages += " + ";
                }
            });
        });
    }
    else {
        baserolls.terms.forEach((term, i) => {
            term.rolls.forEach((roll, j) => {
                damages += roll.total + damageEmojis["splash"];
                if (damageEmojis[roll.type]) {
                    damages += damageEmojis[roll.type];
                }
                else {
                    damages += `[${roll.type}]`;
                }
            });
        });
    }
    return ` ||**(${damages})**||`;
}

function PF2e_parseDegree(degree) {
    let convertedDegree;
    switch (degree) {
        case "criticalFailure":
            convertedDegree = 0;
            break;
        case "failure":
            convertedDegree = 1;
            break;
        case "success":
            convertedDegree = 2;
            break;
        case "criticalSuccess":
            convertedDegree = 3;
            break;
        default:
            break;
    }
    switch (convertedDegree) {
        case 0:
            return "Critical Failure";
        case 1:
            return "Failure";
        case 2:
            return "Success";
        case 3:
            return "Critical Success";
        default:
            return undefined;
    }
}

async function PF2e_generateAutoUUIDEmbeds(message) {
    let embeds = [];
    const div = document.createElement('div');
    div.innerHTML = message.content;
    const links = div.querySelectorAll("a[data-uuid]");
    for (const link of links) {
        if (link) {
            const uuid = link.getAttribute('data-uuid');
            const originDoc = await fromUuid(uuid);
            if (originDoc instanceof Item && originDoc.isIdentified !== false) {
                const itemTraits = originDoc.system.traits;
                const itemType = originDoc.type;
                let title = "";
                let desc = "";
                title += `${originDoc.name} `;
                if (itemTraits.rarity && itemTraits.rarity !== "common") {
                    desc += `[${game.i18n.localize(CONFIG.PF2E.rarityTraits[itemTraits.rarity])}] `;
                }
                itemTraits.value.forEach(itemTrait => {
                    desc += `[${game.i18n.localize(CONFIG.PF2E[`${itemType}Traits`][itemTrait])}] `;
                });
                if (desc.length > 0) {
                    desc = `\`${desc.trim()}\`\n\n`;
                }
                let glyph = undefined;
                if (itemType === "spell") {
                    if (itemTraits.traditions.length > 0) {
                        desc += "**Traditions** ";
                        for (const [i, tradition] of itemTraits.traditions.entries()) {
                            desc += game.i18n.localize(CONFIG.PF2E.magicTraditions[tradition]).toLowerCase();
                            if (i < itemTraits.traditions.length - 1) {
                                desc += ", ";
                            }
                        }
                        desc += "\n\n";
                    }
                    if (getThisModuleSetting('prettierEmojis') && originDoc.actionGlyph) {
                        glyph = originDoc.actionGlyph.toLowerCase();
                    }
                    if (!originDoc.actionGlyph && originDoc.system.time?.value) {
                        desc += `**Cast** ${originDoc.system.time.value}\n\n`;
                    }
                    if (originDoc.system.range?.value) {
                        desc += `**Range** ${originDoc.system.range.value}`;
                        if (originDoc.system.area?.value || originDoc.system.target?.value) {
                            desc += "; ";
                        }
                    }
                    if (originDoc.system.area?.value) {
                        desc += `**Area** ${originDoc.area.label} `;
                    }
                    if (originDoc.system.target?.value) {
                        desc += `**Targets** ${originDoc.system.target.value} `;
                    }
                    desc += "\n\n";
                    if (originDoc.defense) {
                        desc += `**Defense** ${originDoc.defense.label} `;
                    }
                    desc += "\n<hr/>\n"
                }
                else {
                    if (getThisModuleSetting('prettierEmojis') && originDoc.system.actionType) {
                        switch (originDoc.actionCost.type) {
                            case "action":
                                glyph = originDoc.actionCost.value;
                                break;
                            case "reaction":
                                glyph = "r";
                                break;
                            case "free":
                                glyph = "f";
                                break;
                            default:
                                glyph = undefined;
                                break;
                        }
                    }
                }
                if (glyph) {
                    let newGlyph = glyph.replace(/1|2|3|f|r/g, match => actionGlyphEmojis[match]);
                    title += newGlyph;
                }
                desc += `\n\n`;
                desc += await toHTML(originDoc.description, PF2e_generateEnrichmentOptionsUsingOrigin(originDoc));
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
                let journalEmbeds = await generic.embedsFromJournalPages(pages, PF2e_reformatMessage);
                if (journalEmbeds.length > 0) {
                    journalEmbeds[0].author = { name: "From Journal " + originDoc.name }
                }
                embeds.push(...journalEmbeds);
            }
        }
        if (embeds.length > 9) {
            break;
        }
    }
    return embeds;
}

function PF2e_isActionCard(message) {
    const flavor = message.flavor;
    const parser = new DOMParser();
    const doc = parser.parseFromString(flavor, "text/html");
    const action = doc.querySelectorAll("h4.action");
    if (action.length > 0 /*&& message.flags?.pf2e?.context?.item*/) {
        return true;
    }
    else {
        return false;
    }
}

function PF2e_isConditionCard(message) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const conditionCard = doc.querySelectorAll(".participant-conditions");
    if (conditionCard.length > 0) {
        return true;
    }
    else {
        return false;
    }
}

function PF2e_containsDamageDie(rolls) {
    return rolls.every(roll => /(d4|d6|d8|d10|d12)(?![0-9])/.test(roll.formula));
}

async function PF2e_getEnrichmentOptions(message) {
    let originDoc;

    if (message.flags?.pf2e?.origin?.uuid) {
        originDoc = await fromUuid(message.flags.pf2e.origin.uuid);
    }
    else if (message.speaker?.actor) {
        originDoc = game.actors.get(message.speaker.actor); //Fallback to speaker in case it's needed.
    }
    return PF2e_generateEnrichmentOptionsUsingOrigin(originDoc);
}

function PF2e_generateEnrichmentOptionsUsingOrigin(originDoc) {
    switch (true) {
        case originDoc instanceof Item:
            return {
                rollData: {
                    actor: originDoc.actor ? originDoc.actor : undefined,
                    item: originDoc
                },
                relativeTo: originDoc.actor
            };
            break;
        case originDoc instanceof Actor:
            return {
                rollData: {
                    actor: originDoc
                },
                relativeTo: originDoc
            };
            break;
        default:
            return {};
            break;
    }
}

function PF2e_createToolbeltSavesEmbed(message, tokens) {
    if (!tokens) {
        return [];
    }
    const title = function () {
        const save = message.flags["pf2e-toolbelt"].target.save;
        const savecheck = game.i18n.localize(CONFIG.PF2E.saves[save.statistic]);
        return `${save.basic ? game.i18n.format("PF2E.InlineCheck.BasicWithSave", { save: savecheck }) : savecheck} Save (Players)`;
    }();
    let desc = "";
    const saves = message.flags["pf2e-toolbelt"].target.saves
    tokens.forEach(token => {
        if (!saves[token.id]) {
            return;
        }
        const tokenSave = saves[token.id];
        desc += `${dieIcon(20)}**${token.name}: __${tokenSave.value}__**`;
        if (tokenSave.die === 20) {
            desc += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
        }
        else if (tokenSave.die === 1) {
            desc += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
        }
        desc += `\`(${PF2e_parseDegree(tokenSave.success)})\``;
    })
    return [{ title: title, description: desc }];
}

// Complex recursion to find die terms and add them all together in one breakdown
// A custom one is needed for pf2e because of the unique roll structure, as well as persistent damage existing.
// To generate a proper roll breakdown with emojis, we have to find each DiceTerm.
function PF2e_generateRollBreakdown(roll, nextTerm = false) {
    let rollBreakdown = ""
    let termcount = 1;
    roll.terms.forEach((term) => {
        let currentTermString = "";
        switch (true) {
            case term instanceof DiceTerm:
                let i = 1;
                if (!term.flavor.includes("persistent")) {
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
                }
                else {
                    currentTermString += `\`${term.expression}\``;
                    if (nextTerm && (roll.terms[termcount] && (!roll.terms[termcount] instanceof OperatorTerm))) {
                        currentTermString += " +";
                    }
                }
                break;
            case term instanceof PoolTerm || term.hasOwnProperty("rolls"):
                let poolRollCnt = 1;
                term.rolls.forEach(poolRoll => {
                    currentTermString += ` ${PF2e_generateRollBreakdown(poolRoll, true)}`;
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
            case term.hasOwnProperty("operands"):
                const terms = term.operands;
                const newTerms = [];
                let j = 1;
                terms.forEach(operand => {
                    newTerms.push(operand);
                    if (j < terms.length) {
                        j++;
                        newTerms.push(new OperatorTerm({ operator: term.operator }));
                    }
                })
                currentTermString += ` ${PF2e_generateRollBreakdown({ terms: newTerms }, true)}`;
                break;
            case term.hasOwnProperty("term"):
                currentTermString += ` (${PF2e_generateRollBreakdown({ terms: [term.term] }, true)})`;
                break;
            case term.hasOwnProperty("roll"):
                currentTermString += ` ${PF2e_generateRollBreakdown(term.roll, true)}`;
                break;
            case term.hasOwnProperty("terms"):
                term.terms.forEach(termTerm => {
                    if (termTerm.rolls) {
                        termTerm.rolls.forEach(termTermRoll => {
                            currentTermString += ` ${PF2e_generateRollBreakdown(termTermRoll, true)}`;
                        })
                    }
                });
                break;
        }
        rollBreakdown += currentTermString;
        termcount++;
    });
    if (!nextTerm && rollBreakdown.endsWith(" +")) {
        rollBreakdown = rollBreakdown.substring(0, rollBreakdown.length - 2);
    }
    return rollBreakdown.trim();
}
