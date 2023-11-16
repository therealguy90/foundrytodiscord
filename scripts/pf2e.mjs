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
    "poison": ':biohazard:',
    "bleed": ':drop_of_blood:',
    "precision": 'dart',
    "negative": ':skull:',
    "void": ':skull:',
    "positive": ':sparkling_heart:',
    "vitality": ':sparkling_heart:',
    "force": ':sparkles:',
    "precision": ':dart:',
    "persistent": ':hourglass:',
    "splash": ':boom:'
}

const TEMPLATE_EMOJI = {
    "emanation": ":radio_button:",
    "burst": ":blue_circle:",
    "cone": ":mega:",
    "line": ":straight_ruler:"
}

const SAVE_TYPES = ["fortitude", "reflex", "will"]

export function messageParserPF2e(msg) {
    let constructedMessage = '';
    let embeds = [];
    let cardType = 0;
    if ((generic.isCard(msg.content) && msg.rolls?.length < 1)) {
        cardType = 1;
    }
    else if (PF2e_isActionCard(msg) && msg.rolls?.length < 1) {
        cardType = 2;
    }

    if (PF2e_isConditionCard(msg)) {
        embeds = PF2e_createConditionCard(msg);
    }
    else if (game.modules.get('monks-tokenbar')?.active && generic.tokenBar_isTokenBarCard(msg.content)) {
        cardType = 0;
        embeds = generic.tokenBar_createTokenBarCard(msg);
    }
    else if (cardType !== 0) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = PF2e_createCardEmbed(msg, cardType);
        }
    }
    else if (!msg.isRoll || (msg.isRoll && msg.rolls.length < 1)) {
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * actor.system.traits.languages.value
        */
        if (game.modules.get("polyglot")?.active && msg.flags?.polyglot?.language) {
                    constructedMessage = generic.polyglotize(msg);
        }
        if (constructedMessage === '') {
            constructedMessage = msg.content;
        }
    }
    else {
        if (msg.flavor != null && msg.flavor.length > 0) {
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
    if(msg.flags?.pf2e?.origin?.uuid){
        originDoc = fromUuidSync(msg.flags.pf2e.origin.uuid);
    }
    else if(msg.speaker?.actor){
        originDoc = game.actors.get(msg.speaker.actor); //Fallback to speaker in case it's needed.
    }
    if (embeds != [] && embeds.length > 0) {
        if (/<[a-z][\s\S]*>/i.test(embeds[0].title)) {
            embeds[0].title = PF2e_reformatMessage(embeds[0].title);
        }
        embeds[0].description = PF2e_reformatMessage(embeds[0].description, originDoc);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === embeds[0].title) ? "" : msg.flavor;
        //use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        //sadly, the anonymous module does this right before the message is displayed in foundry, so we have to parse it here.
        if (anonEnabled()) {
            for (let i = 0; i < embeds.length; i++) {
                embeds[i] = generic.anonymizeEmbed(msg, embeds[i]);
            }
        }
    }
    constructedMessage = PF2e_reformatMessage(constructedMessage, originDoc);
    return generic.getRequestParams(msg, constructedMessage, embeds);
}

function PF2e_createCardEmbed(message, cardType) {
    let card = message.content;
    const parser = new DOMParser();
    let doc = parser.parseFromString(card, "text/html");
    let desc = "";
    let title;
    // Find the <h3> element and extract its text content, since h3 works for most systems
    //generic card
    if (cardType === 1) {
        const h3Element = doc.querySelector("h3");
        const actionGlyphElement = h3Element.querySelector(".action-glyph");
        if (actionGlyphElement) {
            actionGlyphElement.remove();
        }
        title = h3Element.textContent.trim();
        desc = PF2e_parseTraits(message.content);
    }
    //pf2e action card, introduced in v5.4.0
    else if (cardType === 2) {
        const actionCardParser = new DOMParser();
        const actionDoc = actionCardParser.parseFromString(message.flavor, "text/html");
        const h4Element = actionDoc.querySelector("h4.action");
        title = h4Element.querySelector("strong").textContent;
        desc = PF2e_parseTraits(message.flavor);
    }
    let speakerActor = undefined;
    if (message.speaker?.actor) {
        speakerActor = game.actors.get(message.speaker.actor);
    }

    //parse card description if source is from a character or actor is owned by a player
    //this is to limit metagame information
    let descVisible = getThisModuleSetting('showDescription');

    if (speakerActor) {
        if (anonEnabled() && !game.modules.get('anonymous').api.playersSeeName(speakerActor)) {
            descVisible = false;
        }
    }
    if (descVisible) {
        if (cardType === 1) {
            let descList = doc.querySelectorAll(".card-content");
            descList.forEach(function (paragraph) {
                let text = paragraph.innerHTML
                desc += text + "\n\n";
            });
        }
        else if (cardType === 2) {
            if (message.flags?.pf2e?.context?.item) {
                desc += game.actors.get(message.speaker.actor).items.get(message.flags.pf2e.context.item).system.description.value;
            }
            else {
                const actionContent = doc.querySelector(".action-content");
                if (actionContent) {
                    desc += actionContent.innerHTML;
                }
            }
        }
    }

    return [{ title: title, description: desc, footer: { text: generic.getCardFooter(card) } }];
}


function PF2e_createRollEmbed(message) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(message.flavor, "text/html");
    let title = "";
    let desc = "";
    //Build Title
    const actionTitle = doc.querySelector("h4.action")
    if (actionTitle) {
        title = actionTitle.querySelector("strong").textContent +
            " " + (actionTitle.querySelector(".subtitle") ? actionTitle.querySelector(".subtitle").textContent : "");
    }
    else {
        title = message.flavor;
    }
    desc += PF2e_parseTraits(message.flavor, true);

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
                    desc += "`" + anon.getName(curToken.actor) + "` ";
                }
                else {
                    desc += "`" + curToken.name + "` ";
                }
            }
            else {
                desc += "`" + curToken.name + "` ";
            }
        });
    }
    else {
        if (message.flags?.pf2e?.context?.target?.token) {
            desc += "**:dart:Target: **";
            const targetTokenId = message.flags.pf2e.context.target.token.split(".")[3];
            const targetToken = game.scenes.get(message.speaker.scene).tokens.get(targetTokenId);
            if (targetToken) {
                if (anonEnabled()) {
                    if (!anon.playersSeeName(targetToken.actor)) {
                        desc += "`" + anon.getName(targetToken.actor) + "` ";
                    }
                    else {
                        desc += "`" + targetToken.name + "` ";
                    }
                }
                else {
                    desc += "`" + targetToken.name + "` ";
                }
            }
        }
    }
    desc += "\n";

    if (!message.isReroll) {
        //Add roll information to embed:
        for (let i = 0; i < message.rolls.length; i++) {
            desc += "**:game_die:Result: **" + "__**" + message.rolls[i].total + "**__";
            const speakerActor = game.actors.get(message.speaker.actor);
            if (speakerActor?.hasPlayerOwner && message.rolls[i].dice[0].faces === 20) {
                if (message.rolls[i].result.startsWith('20 ')) {
                    desc += " __(Nat 20!)__";
                }
                else if (message.rolls[i].result.startsWith('1 ')) {
                    desc += " __(Nat 1)__";
                }
                desc += "||(" + message.rolls[i].result + ")||";
            }
            if ((message.isDamageRoll)) {
                desc += PF2e_parseDamageTypes(message.rolls[i]);
            }
            else if (PF2e_parseDegree(message.rolls[i].options?.degreeOfSuccess) != "Invalid") {
                desc += "`(" + PF2e_parseDegree(message.rolls[i].options.degreeOfSuccess) + ")`";
            }
            else if (PF2e_parseDegree(message.flags.pf2e?.context?.outcome) != "Invalid") {
                desc += "`(" + PF2e_parseDegree(message.flags.pf2e.context.outcome) + ")`";
            }
            desc += "\n";
        }
    }
    else {
        desc += "~~:game_die:Result: " + "__" + PF2e_getDiscardedRoll(message) + "__~~\n";
        desc += "**:game_die:Result: **" + "__**" + message.rolls[0].total + "**__";
        const speakerActor = game.actors.get(message.speaker.actor);
        if (speakerActor?.hasPlayerOwner && message.rolls[i].dice[0].faces === 20) {
            if (message.rolls[i].result.startsWith('20 ')) {
                desc += " __(Nat 20!)__";
            }
            else if (message.rolls[i].result.startsWith('1 ')) {
                desc += " __(Nat 1)__";
            }
            desc += "||(" + message.rolls[i].result + ")||";
        }
        if (PF2e_parseDegree(message.flags.pf2e.context.outcome) != "Invalid") {
            desc += "`(" + PF2e_parseDegree(message.flags.pf2e.context.outcome) + ")`";
        }
        desc += "\n";
    }

    return [{ title: title, description: desc }];

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
                        precision = typeterm.term.options.flavor == "precision";
                        splash = typeterm.term.options.flavor == "splash";
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
                damages += (roll.persistent ? DAMAGE_EMOJI["persistent"] : "") + (precision ? DAMAGE_EMOJI["precision"] : "") + (splash ? DAMAGE_EMOJI["splash"] : "");
                if (!DAMAGE_EMOJI[roll.type]) {
                    damages += "[" + roll.type + "]";
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
                    damages += "[" + roll.type + "]";
                }
            });
        });
    }
    return " ||**(" + damages + ")**||";
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
            return "Invalid";
    }
}

function PF2e_getNameFromCheck(match, checkString, customText) {
    if (customText) {
        return ":game_die:`" + customText + "`";
    }
    else {
        return ":game_die:" + (function () {
            const check = PF2e_parseInlineString(checkString);
            let tempcheck = "`";
            if (check.showDC) {
                if (check.showDC === "all" || check.showdc === "all") {
                    tempcheck += "DC " + check.dc + " ";
                }
            }
            if (check.type) {
                if (check.type === "flat") {
                    return tempcheck + game.i18n.localize("PF2E.FlatCheck") + "`";
                }
                let skillcheck = check.type;
                if (SAVE_TYPES.includes(check.type)) {
                    skillcheck = game.i18n.localize(CONFIG.PF2E.saves[skillcheck]);
                    return tempcheck + (check.basic ? game.i18n.format("PF2E.InlineCheck.BasicWithSave", { save: skillcheck }) : skillcheck) + "`";
                }
                const locStringForm = (() => {
                    if (CONFIG.PF2E.skills.hasOwnProperty(skillcheck)) {
                        return CONFIG.PF2E.skills[skillcheck];
                    }
                    else if(CONFIG.PF2E.skillList.hasOwnProperty(skillcheck)){
                        return CONFIG.PF2E.skillList[skillcheck];
                    }
                })();
                return tempcheck + (locStringForm 
                    ? game.i18n.localize(locStringForm)
                    : skillcheck
                        .split("-")
                        .map((word) => {
                            return word.slice(0, 1).toUpperCase() + word.slice(1);
                        })
                        .join(" ")) + "`";
            }
        })();
    }
}

function PF2e_getNameFromTemplate(match, templateString, label) {
    return (() => {
        const template = PF2e_parseInlineString(templateString);
        let templateLabel = "";
        if(TEMPLATE_EMOJI.hasOwnProperty(template.type)){
            templateLabel += TEMPLATE_EMOJI[template.type];
        }
        if (label) {
            templateLabel += "`" + label + "`";
        }
        else {
            templateLabel += "`" + game.i18n.format("PF2E.TemplateLabel", {
                size: template.distance,
                unit: game.i18n.localize("PF2E.Foot"),
                shape: game.i18n.localize(CONFIG.PF2E.areaTypes[template.type])
            }) + "`";
        }
        return templateLabel;
    })();
}

function PF2e_replaceDamageFormat(damagestring, originDoc) {
    const DamageRoll = CONFIG.Dice.rolls.find( r => r.name === "DamageRoll" );
    const damageIndexes = [];
    const regex = /@Damage\[/g;

    let match;
    while ((match = regex.exec(damagestring)) !== null) {
        damageIndexes.push(match.index);
    }
    const extractedDamageStrings = [];

    for (let i = 0; i < damageIndexes.length; i++) {
        const startIndex = damageIndexes[i];
        let bracketCount = 0;

        // Search for the matching closing bracket
        for (let j = startIndex + 7; j < damagestring.length; j++) {
            if (damagestring[j] === '[') {
                bracketCount++;
            } else if (damagestring[j] === ']') {
                if (bracketCount === 1) {
                    if (j < damagestring.length - 1) {
                        if (damagestring[j + 1] == "{") {
                            const tempJ = j;
                            for (j; j < damagestring.length; j++) {
                                if (j === damagestring.length - 1 && damagestring[j] !== "}") {
                                    j = tempJ;
                                    break;
                                }
                                if (damagestring[j] === "}") {
                                    break;
                                }
                            }
                        }
                    }
                    extractedDamageStrings.push(damagestring.substring(startIndex, j + 1));
                    break;
                }
                bracketCount--;
            }
        }
    }

    extractedDamageStrings.forEach(inlinedamage => {
        let tempdamage = ":game_die:`";
        damagestring = damagestring.replace(inlinedamage, () => {
            const regex = /\{([^}]+)\}/;
            const match = inlinedamage.match(regex);
            if (match) {
                return tempdamage += match[1].trim() + "`";
            }
            else {
                const damageArgs = inlinedamage.trim().substr(8, inlinedamage.length - 9).split(/,(?![^[]*])/);
                const rollParams = (() => {
                    switch(true){
                        //Oddly enough, just putting the document in "actor" already works... but this is to really make sure.
                        case originDoc instanceof Actor:
                            console.log(originDoc);
                            return {actor: originDoc};
                            break;
                        case originDoc instanceof Item:
                            console.log(originDoc);
                            return {item: originDoc};
                            break;
                        default:
                            return {};
                            break;
                    }
                })();
                damageArgs.forEach(damageArg => {
                    const droll = new DamageRoll(damageArg, rollParams, {});
                    const formula = droll.formula;
                    tempdamage += formula;
                });
                return tempdamage.trim() + "`";
            }
        })
    });
    return damagestring;
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
                traits = traits + "[" + tags[i] + "] ";
            }
        }
    }
    if (traits.trim() !== "") {
        return "`" + traits.trim() + "`\n";
    }
    else {
        return "";
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


export function PF2e_reformatMessage(text, actor) {
    let reformattedText = generic.reformatMessage(text, PF2e_parseHTMLText);
    //replace @Damage appropriately
    reformattedText = PF2e_replaceDamageFormat(reformattedText, actor);
    //replace Checks
    let regex = /@Check\[(.*?)](?:{([^}]+)})?/g;
    reformattedText = reformattedText.replace(regex, (match, checkString, label) => PF2e_getNameFromCheck(match, checkString, label));
    regex = /@Template\[(.*?)](?:{([^}]+)})?/g;
    reformattedText = reformattedText.replace(regex, (match, checkString, label) => PF2e_getNameFromTemplate(match, checkString, label));

    regex = /\[\[[^\]]+\]\]\{([^}]+)\}/g;
    reformattedText = reformattedText.replace(regex, ':game_die:`$1`');
    regex = /\[\[\/(.*?) (.*?)\]\]/g;
    reformattedText = reformattedText.replace(regex, ':game_die:`$2`');

    return reformattedText.trim();
}

function PF2e_parseHTMLText(htmlString) {
    let reformattedText = htmlString;
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;
    // Format various elements
    generic.formatTextBySelector('.inline-check, span[data-pf2-check]', text => `:game_die:\`${text}\``, htmldoc);
    reformattedText = htmldoc.innerHTML;

    const templateButtons = htmldoc.querySelectorAll('span[data-pf2-effect-area]');
    if(templateButtons.length > 0){
        templateButtons.forEach(template => {
            const type = template.getAttribute('data-pf2-effect-area');
            let tempTemplate = ""
            if(TEMPLATE_EMOJI.hasOwnProperty(type)){
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

function PF2e_getDiscardedRoll(message) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const rerollDiscardDiv = doc.querySelector(".pf2e-reroll-discard .dice-total");
    return rerollDiscardDiv.textContent;
}
