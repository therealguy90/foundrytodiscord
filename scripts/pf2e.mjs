import * as generic from './generic.mjs';
import { anonEnabled, getThisModuleSetting } from './helpers/modulesettings.mjs';

const DAMAGE_EMOJI = {
    "bludgeoning": ':hammer:',
    "slashing": ':axe:',
    "piercing": ':bow_and_arrow:',
    "acid": ':test_tube:',
    "cold": ':snowflake:',
    "electricity": ':zap:',
    "fire": ':fire:',
    "sonic": ':loud_sound:',
    "chaotic": ':cyclone:',
    "evil": ':smiling_imp:',
    "good": ':angel:',
    "lawful": ':scales:',
    "mental": ':brain:',
    "poison": ':spider:',
    "bleed": ':drop_of_blood:',
    "precision": 'dart',
    "negative": ':skull:',
    "void": ':skull:',
    "positive": ':sparkling_heart:',
    "vitality": ':sparkling_heart:',
    "force": ':sparkles:',
    "precision": ':dart:',
    "persistent": ':hourglass:',
    "splash": ':boom:',
    "untyped": ":grey_question:"
}

const TEMPLATE_EMOJI = {
    "emanation": ":radio_button:",
    "burst": ":blue_circle:",
    "cone": ":mega:",
    "line": ":straight_ruler:"
}

const DamageRoll = CONFIG.Dice.rolls.find(r => r.name === "DamageRoll");

export async function messageParserPF2e(msg) {
    let constructedMessage = '';
    let embeds = [];
    if (PF2e_isActionCard(msg) && msg.rolls?.length < 1) {
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = PF2e_createActionCardEmbed(msg);
        }
    }
    else if (PF2e_isConditionCard(msg)) {
        embeds = PF2e_createConditionCard(msg);
    }
    else if (game.modules.get('monks-tokenbar')?.active && generic.tokenBar_isTokenBarCard(msg.content)) {
        embeds = generic.tokenBar_createTokenBarCard(msg);
    }
    else if (generic.isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = PF2e_createCardEmbed(msg);
        }
    }
    else if (!msg.isRoll || (msg.isRoll && msg.rolls.length < 1)) {
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * actor.system.traits.languages.value
        */
        if (game.modules.get("polyglot")?.active && getThisModuleSetting('enablePolyglot') && msg.flags?.polyglot?.language) {
            constructedMessage = generic.polyglotize(msg);
        }
        if (constructedMessage === '') {
            constructedMessage = msg.content;
        }
    }
    else {
        if ((msg.flavor !== null && msg.flavor.length > 0) || (msg.isDamageRoll && PF2e_containsDamageDieOnly(msg.rolls))) {
            embeds = PF2e_createRollEmbed(msg);
        }
        else {
            embeds = generic.createGenericRollEmbed(msg);
        }
    }
    // Document of origin is important in the PF2e parser, as some of the labels require it to be passed to scale correctly.
    // Removing this would break parity between foundry and discord, as some damage roll values will not stay the same without
    // an actor, especially scaling abilities and spells.
    let originDoc;
    if (msg.flags?.pf2e?.origin?.uuid) {
        originDoc = await fromUuid(msg.flags.pf2e.origin.uuid);
    }
    else if (msg.speaker?.actor) {
        originDoc = game.actors.get(msg.speaker.actor); //Fallback to speaker in case it's needed.
    }
    if (embeds && embeds.length > 0) {
        embeds[0].description = await PF2e_reformatMessage(embeds[0].description, originDoc);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === embeds[0].title) ? "" : msg.flavor;
        // use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        // we have to mimic this behavior here, since visibility is client-sided, and we are parsing raw message content.
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
    constructedMessage = await PF2e_reformatMessage(constructedMessage, originDoc);
    return generic.getRequestParams(msg, constructedMessage, embeds);
}

export async function PF2e_reformatMessage(text, originDoc = undefined) {
    let reformattedText = await generic.reformatMessage(text, PF2e_parseHTMLText);
    let rollData;
    switch (true) {
        case originDoc instanceof Actor:
            rollData = { actor: originDoc };
            break;
        case originDoc instanceof Item:
            rollData = { item: originDoc };
            break;
        default:
            rollData = {};
            break;
    }
    let options = { rollData: (rollData ? rollData : {}) };
    let match;
    let allMatches = [];
    let enricherRegex = /@Localize\[([^\]]+)\](?:{([^}]+)})?/g;
    while ((match = enricherRegex.exec(reformattedText)) !== null) {
        const [_match, identifier] = match;
        const replacement = await PF2e_reformatMessage(game.i18n.localize(identifier), originDoc);
        allMatches.push({
            original: _match,
            replacement: replacement
        });
    }
    for (const replacement of allMatches) {
        reformattedText = reformattedText.replace(replacement.original, replacement.replacement);
    }
    // Converts them to @Damage, so that the enricher can take care of parsing the roll.
    allMatches = [];
    // Trust me, even I don't know how this regex works.
    // matches [[/r or /br xxxx #flavor]]{label} for legacy rolls.
    enricherRegex = /\[\[\/b?r\s*((?:\d+d\d+(?:\[[^\[\]]*\])?|\d+(?:\[[^\[\]]*\])?)(?:\s*[-+]\s*\d+d\d+(?:\[[^\[\]]*\])?|\s*[-+]\s*\d+(?:\[[^\[\]]*\])?)*)(?:\s*#\s*([^{}\[\]]+))?[^{}]*?\]\](?:{([^{}]*)})?/g;

    while ((match = enricherRegex.exec(reformattedText)) !== null) {
        const [_match, params, flavor, label] = match;
        allMatches.push({
            original: _match,
            replacement: `@Damage[${params}]${label ? `{${label}}` : ""}`
        });
    }

    for (const replacement of allMatches) {
        reformattedText = reformattedText.replace(replacement.original, replacement.replacement);
    }

    allMatches = [];
    enricherRegex = /@(Check|Template)\[([^\]]+)\](?:{([^}]+)})?/g
    while ((match = enricherRegex.exec(reformattedText)) !== null) {
        if (match) {
            const inlineButton = await game.pf2e.TextEditor.enrichString(match, options);
            console.log(inlineButton);
            const dataSpan = inlineButton.querySelector("[data-visibility]");
            const visibility = dataSpan.getAttribute('data-visibility');
            if(visibility){
                switch(visibility){
                    case "gm":
                    case "none":
                    case "owner":
                        dataSpan.remove();
                        break;
                }
            }
            if (inlineButton) {
                let label = "";
                const [_match, inlineType, paramString, inlineLabel] = match;
                const params = PF2e_parseInlineString(paramString);
                label += `${TEMPLATE_EMOJI.hasOwnProperty(params.type) ? TEMPLATE_EMOJI[params.type] : ":game_die:"}\`${inlineButton.textContent.trim()}\``;
                allMatches.push({
                    original: _match,
                    replacement: label
                });
            }
        }
    }

    enricherRegex = /@(Damage)\[((?:[^[\]]*|\[[^[\]]*\])*)\](?:{([^}]+)})?/g
    while ((match = enricherRegex.exec(reformattedText)) !== null) {
        if (match) {
            const inlineButton = await game.pf2e.TextEditor.enrichString(match, options);
            if (inlineButton) {
                const _match = match[0];
                const label = `:game_die:\`${inlineButton.textContent}\``;
                allMatches.push({
                    original: _match,
                    replacement: label
                });
            }
        }
    }
    // Perform replacements after finding all matches
    for (const replacement of allMatches) {
        reformattedText = reformattedText.replace(replacement.original, replacement.replacement);
    }
    return reformattedText.trim();
}

function PF2e_parseHTMLText(htmlString) {
    let reformattedText = htmlString;
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;
    // Format various elements
    generic.formatTextBySelector('.inline-check, span[data-pf2-check]', text => `:game_die:\`${text}\``, htmldoc);
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
        actionGlyphElement.remove();
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
            if (getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !message.user.isGM))) {
                desc += `:game_die:**\`${roll.formula}\`**\n`
            }
            desc += `:game_die:**Result: __${roll.total}__**`;
            if (speakerActor?.hasPlayerOwner && roll.dice[0]?.faces === 20) {
                if (roll.result.startsWith('20 ')) {
                    desc += " __(Nat 20!)__";
                }
                else if (roll.result.startsWith('1 ')) {
                    desc += " __(Nat 1)__";
                }
                desc += `||(${roll.result})||`;
            }
            if (roll instanceof DamageRoll) {
                desc += PF2e_parseDamageTypes(roll);
            }
            else if (PF2e_parseDegree(roll.options?.degreeOfSuccess)) {
                desc += `\`(${PF2e_parseDegree(roll.options.degreeOfSuccess)})\``;
            }
            else if (PF2e_parseDegree(message.flags.pf2e?.context?.outcome)) {
                desc += `\`(${PF2e_parseDegree(message.flags.pf2e.context.outcome)})\``; // Assumes only one roll as normal
            }
            desc += "\n\n";
        });
    }
    else {
        if (getThisModuleSetting('showFormula') && (speakerActor?.hasPlayerOwner || (!speakerActor && !message.user.isGM))) {
            desc += `:game_die:**\`${roll.formula}\`**\n`
        }
        desc += `~~:game_die:Result: __${PF2e_getDiscardedRoll(message)}__~~\n`;
        desc += `:game_die:**Result: __${message.rolls[0].total}__**`;
        const speakerActor = game.actors.get(message.speaker.actor);
        if (speakerActor?.hasPlayerOwner && message.rolls[0].dice[0].faces === 20) {
            if (message.rolls[0].result.startsWith('20 ')) {
                desc += " __(Nat 20!)__";
            }
            else if (message.rolls[0].result.startsWith('1 ')) {
                desc += " __(Nat 1)__";
            }
            desc += `||(${message.rolls[0].result})||`;
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
    title = `${h4Element.querySelector("strong").textContent} ${actionDiv.querySelector(".subtitle") ? actionDiv.querySelector(".subtitle").textContent : ""}`;
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
            desc += game.actors.get(message.speaker.actor).items.get(message.flags.pf2e.context.item).system.description.value;
        }
        else {
            const actionContent = div.querySelector(".action-content");
            if (actionContent) {
                desc += actionContent.innerHTML;
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

function PF2e_parseInlineString(checkString) {
    let check = {};
    // Split the string into an array of key-value pairs
    let pairs = checkString.split("|");
    for (let i = 0; i < pairs.length; i++) {
        let [key, value] = pairs[i].split(":");
        check[key] = value === "true" ? true : value === "false" ? false : value;
    }
    return check;
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