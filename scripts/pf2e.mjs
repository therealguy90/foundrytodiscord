import * as generic from './generic.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';
import { newEnrichedMessage, toHTML } from './helpers/enrich.mjs';
import { swapOrNot, getDieEmoji } from './helpers/emojis/global.mjs';
import { ACTIONGLYPH_EMOJIS, DAMAGE_EMOJI, TEMPLATE_EMOJI } from './helpers/emojis/pf2e.mjs';

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
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * actor.system.traits.languages.value
        */
        if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && enrichedMsg.flags?.polyglot?.language) {
            constructedMessage = generic.polyglotize(enrichedMsg);
        }
        if (constructedMessage === '') {
            constructedMessage = enrichedMsg.content;
        }
    }
    else {
        if ((enrichedMsg.flavor !== null && enrichedMsg.flavor.length > 0) || (enrichedMsg.isDamageRoll && PF2e_containsDamageDieOnly(enrichedMsg.rolls))) {
            embeds = PF2e_createRollEmbed(enrichedMsg);
        }
        else {
            embeds = generic.createGenericRollEmbed(enrichedMsg);
        }
    }
    // Document of origin is important in the PF2e parser, as some of the labels require it to be passed to scale correctly.
    // Removing this would break parity between foundry and discord, as some damage roll values will not stay the same without
    // an actor, especially scaling abilities and spells.
    if (embeds && embeds.length > 0) {
        embeds[0].description = await PF2e_reformatMessage(await toHTML(embeds[0].description, await PF2e_getEnrichmentOptions(msg)));
        constructedMessage = (/<[a-z][\s\S]*>/i.test(enrichedMsg.flavor) || enrichedMsg.flavor === embeds[0].title) ? "" : enrichedMsg.flavor;
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
    generic.formatTextBySelector('.inline-check, span[data-pf2-check]', text => `:game_die:\`${text}\``, htmldoc);
    generic.formatTextBySelector('.action-glyph', text => `${ACTIONGLYPH_EMOJIS[text.toLowerCase().trim()] ? ACTIONGLYPH_EMOJIS[text.toLowerCase().trim()] : ""}`, htmldoc);
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
            if (TEMPLATE_EMOJI.hasOwnProperty(type)) {
                tempTemplate += TEMPLATE_EMOJI[type];
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
        if (getThisModuleSetting('prettierEmojis') && ACTIONGLYPH_EMOJIS[actionGlyphElement.textContent.toLowerCase().trim()]) {
            actionGlyphElement.innerHTML = ACTIONGLYPH_EMOJIS[actionGlyphElement.textContent.toLowerCase().trim()];
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
    else if (message.flavor) {
        title = message.flavor;
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
    if (game.modules.get("pf2e-target-damage")?.active) { //optional implementation for "pf2e-target-damage" module
        if (message.flags['pf2e-target-damage'].targets.length === 1) {
            desc += "**:dart:Target: **";
        }
        else if (message.flags['pf2e-target-damage'].targets.length > 1) {
            desc += "**:dart:Targets: **";
        }

        message.flags['pf2e-target-damage'].targets.forEach(target => {
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
        if (message.flags['pf2e-target-damage'].targets.length >= 1) {
            desc += "\n";
        }
    }
    else {
        if (message.flags?.pf2e?.context?.target?.token) {
            desc += "**:dart:Target: **";
            const targetTokenId = message.flags.pf2e.context.target.token.split(".")[3];
            const targetToken = game.scenes.get(message.speaker.scene).tokens.get(targetTokenId);
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
                desc += `:game_die:**\`${roll.formula}\`**\n`
                rollBreakdown = PF2e_generateRollBreakdown(roll);
            }
            desc += `:game_die:**Result: __${roll.total}__**`;
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
            desc += `:game_die:**\`${message.rolls[0].formula}\`**\n`
        }
        desc += `~~:game_die:Result: __${PF2e_getDiscardedRoll(message)}__~~\n`;
        desc += `:game_die:**Result: __${message.rolls[0].total}__**`;
        if (speakerActor?.hasPlayerOwner && message.rolls[0].dice[0].faces === 20) {
            if (message.rolls[0].result.startsWith('20 ')) {
                desc += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
            }
            else if (message.rolls[0].result.startsWith('1 ')) {
                desc += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
            }
            desc += `||(${PF2e_generateRollBreakdown(message.rolls[0])})||`;
        }
        if (PF2e_parseDegree(message.flags.pf2e.context.outcome)) {
            desc += `\`(${PF2e_parseDegree(message.flags.pf2e.context.outcome)})\``;
        }
        desc += "\n";
    }

    return [{ title: title, description: desc }];

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
    title = `${h4Element.querySelector("strong").textContent} ${subtitle ? subtitle.textContent : ""}`;
    if (getThisModuleSetting("prettierEmojis") && title && actionGlyph && ACTIONGLYPH_EMOJIS.hasOwnProperty(actionGlyph.textContent.trim().toLowerCase())) {
        title += ACTIONGLYPH_EMOJIS[actionGlyph.textContent.trim().toLowerCase()];
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
    const rerollDiscardDiv = doc.querySelector(".pf2e-reroll-discard .dice-total");
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
                if (!roll.persistent) {
                    damages += roll._total.toString();

                }
                else {
                    let persFormula = roll.formula;
                    const regex = /[^\d+d\d+\s*+-]/g;
                    persFormula = persFormula.replace(regex, '');
                    damages += persFormula.trim();
                }
                damages += `${(roll.persistent ? DAMAGE_EMOJI["persistent"] : "")}${(precision ? DAMAGE_EMOJI["precision"] : "")}${(splash ? DAMAGE_EMOJI["splash"] : "")}`;
                if (!DAMAGE_EMOJI[roll.type]) {
                    damages += `[${roll.type}]`;
                }
                else {
                    damages += DAMAGE_EMOJI[roll.type];
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
                damages += roll.total + DAMAGE_EMOJI["splash"];
                if (DAMAGE_EMOJI[roll.type]) {
                    damages += DAMAGE_EMOJI[roll.type];
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

function PF2e_containsDamageDieOnly(rolls) {
    return rolls.every(roll => !/(d20|d2|dc)/.test(roll.formula));
}

async function PF2e_getEnrichmentOptions(message) {
    let originDoc;
    if (message.flags?.pf2e?.origin?.uuid) {
        originDoc = await fromUuid(message.flags.pf2e.origin.uuid);
    }
    else if (message.speaker?.actor) {
        originDoc = game.actors.get(message.speaker.actor); //Fallback to speaker in case it's needed.
    }
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

// Complex recursion to find die terms and add them all together in one breakdown
// This is probably unique to PF2e because of the complex roll structures.
function PF2e_generateRollBreakdown(roll, add = false) {
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
                            if ((notDieEmoji && i < term.results.length) || (add && (roll.terms[termcount] && (!roll.terms[termcount] instanceof OperatorTerm)))) {
                                currentTermString += " +";
                            }
                        }
                        i++;
                    });
                    if (notDieEmoji) {
                        currentTermString = ` \`${term.faces ? `d${term.faces}`: ""}[${currentTermString.trim()}]\``;
                    }
                }
                else {
                    currentTermString += term.expression;
                    if (add) {
                        currentTermString += " +";
                    }
                }
                break;
            case term instanceof PoolTerm:
                term.rolls.forEach(poolRoll => {
                    currentTermString += ` ${PF2e_generateRollBreakdown(poolRoll, true)}`;
                })
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
    if (!add && rollBreakdown.endsWith(" +")) {
        rollBreakdown = rollBreakdown.substring(0, rollBreakdown.length - 2);
    }
    return rollBreakdown.trim();
}
