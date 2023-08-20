import * as generic from './generic.mjs';

const damageEmoji = {
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

export function messageParserPF2e(msg) {
    let constructedMessage = '';
    let hookEmbed = [];
    if (generic.isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            hookEmbed = PF2e_createCardEmbed(msg);
        }
    }
    else if (!msg.isRoll) {
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * for PF2e and DnD5e, this would be actor.system.traits.languages.value
        */
        if (game.modules.get("polyglot")?.active && generic.propertyExists(msg, "flags.polyglot.language")) {
            if (!getThisModuleSetting("commonLanguages").toLowerCase().includes(msg.flags.polyglot.language)) {
                if (getThisModuleSetting('includeOnly') == "") {
                    constructedMessage = generic.polyglotize(msg);
                }
                else {
                    listLanguages = getThisModuleSetting('includeOnly').split(",").map(item => item.trim().toLowerCase());
                    if (!listLanguages == null) {
                        listLanguages = [];
                    }
                }
            }
        }
        if (constructedMessage == '') {
            constructedMessage = msg.content;
        }
    }
    else {
        if (msg.flavor != null && msg.flavor.length > 0) {
            hookEmbed = PF2e_createRollEmbed(msg);
        }
        else {
            hookEmbed = generic.createGenericRollEmbed(msg);
        }
    }

    if (hookEmbed != [] && hookEmbed.length > 0) {
        hookEmbed[0].description = PF2e_reformatMessage(hookEmbed[0].description);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === hookEmbed[0].title) ? "" : msg.flavor;
        //use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        //sadly, the anonymous module does this right before the message is displayed in foundry, so we have to parse it here.
        if (game.modules.get("anonymous")?.active) {
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
    constructedMessage = PF2e_reformatMessage(constructedMessage);
    if (constructedMessage !== "" || hookEmbed.length > 0) { //avoid sending empty messages
        return generic.getRequestParams(msg, constructedMessage, hookEmbed);
    }
    else{
        return false;
    }
}


function PF2e_createRollEmbed(message) {
    let embed = []
    //Build Title
    const str = message.flavor;
    let regex = /<h4 class="action">(.*?)<\/h4>/g;
    let m;
    let title = "";
    while ((m = regex.exec(str)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        if (m[1] != null) {
            title = m[1];
        }
    }

    if (title == "") {
        regex = /<strong>(.*?)<\/strong>/g;
        while ((m = regex.exec(str)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            if (m[1] != null) {
                title = m[1];
            }
        }
    }

    if (game.modules.get("anonymous")?.active) {
        var anon = game.modules.get('anonymous').api; //optional implementation for "anonymous" module
    }

    let desc = "";

    //Build Description
    //Add targets to embed:
    if (game.modules.get("pf2e-target-damage")?.active) { //optional implementation for "pf2e-target-damage" module
        if (message.flags['pf2e-target-damage'].targets.length === 1) {
            desc = desc + "**:dart:Target: **";
        }
        else if (message.flags['pf2e-target-damage'].targets.length > 1) {
            desc = desc + "**:dart:Targets: **";
        }

        message.flags['pf2e-target-damage'].targets.forEach(target => {
            const curScene = game.scenes.get(message.speaker.scene);
            const curToken = curScene.tokens.get(target.id);
            if (game.modules.get("anonymous")?.active) {
                if (!anon.playersSeeName(curToken.actor)) {
                    desc = desc + "`" + anon.getName(curToken.actor) + "` ";
                }
                else {
                    desc = desc + "`" + curToken.name + "` ";
                }
            }
            else {
                desc = desc + "`" + curToken.name + "` ";
            }
        });
    }
    else {
        if (generic.propertyExists(message, "flags.pf2e.context.target.token")) {
            desc = desc + "**:dart:Target: **";
            targetTokenId = message.flags.pf2e.context.target.token.split(".")[3];
            targetToken = game.scenes.get(message.speaker.scene).tokens.get(targetTokenId);
            if (targetToken) {
                if (game.modules.get("anonymous")?.active) {
                    if (!anon.playersSeeName(targetToken.targetToken.actor)) {
                        desc = desc + "`" + anon.getName(targetToken.actor) + "` ";
                    }
                    else {
                        desc = desc + "`" + targetToken.name + "` ";
                    }
                }
                else {
                    desc = desc + "`" + targetToken.name + "` ";
                }
            }
        }
    }
    desc = desc + "\n";

    //Add roll information to embed:
    for (let i = 0; i < message.rolls.length; i++) {
        desc = desc + "**:game_die:Result: **" + "__**" + message.rolls[i].total + "**__";
        if (generic.propertyExists(message, "flags.pf2e.context.type") && message.flags.pf2e.context.type == "damage-roll") {
            desc = desc + PF2e_parseDamageTypes(message.rolls[i]);
        }
        else if (PF2e_parseDegree(message.rolls[i].options.degreeOfSuccess) != "Invalid") {
            desc = desc + " `(" + PF2e_parseDegree(message.rolls[i].options.degreeOfSuccess) + ")`";
        }
        desc = desc + "\n";
    }
    embed = [{ title: title, description: desc }];
    return embed;
}

function PF2e_parseDamageTypes(baserolls) {
    let damages = ""
    if (!baserolls.options.splashOnly) {
        baserolls.terms.forEach((term, i) => {
            term.rolls.forEach((roll, j) => {
                let precision = false;
                let splash = false;
                roll.terms.forEach((typeterm, k) => {
                    if (generic.propertyExists(typeterm, "term.options.flavor")) {
                        precision = typeterm.term.options.flavor == "precision";
                        splash = typeterm.term.options.flavor == "splash";
                    }

                });
                if (!roll.persistent) {
                    damages = damages + roll._total.toString();

                }
                else {
                    let persFormula = roll.formula;
                    const regex = /[^\d+d\d+\s*+-]/g;
                    persFormula = persFormula.replace(regex, '');
                    damages = damages + persFormula.trim();
                }
                damages = damages + (roll.persistent ? damageEmoji["persistent"] : "") + (precision ? damageEmoji["precision"] : "") + (splash ? damageEmoji["splash"] : "");
                if (!damageEmoji[roll.type]) {
                    damages = damages + "[" + roll.type + "]";
                }
                else {
                    damages = damages + damageEmoji[roll.type];
                }
                if (j != term.rolls.length - 1) {
                    damages = damages + " + ";
                }
            });
        });
    }
    else {
        baserolls.terms.forEach((term, i) => {
            term.rolls.forEach((roll, j) => {
                damages = damages + roll.total + damageEmoji["splash"];
                if (damageEmoji[roll.type]) {
                    damages = damages + damageEmoji[roll.type];
                }
                else {
                    damages = damages + "[" + roll.type + "]";
                }
            });
        });
    }
    return " ||**(" + damages + ")**||";
}

function PF2e_parseDegree(degree) {
    switch (degree) {
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

function PF2e_getNameFromCheck(checkString) {
    return ":game_die:" + (function () {
        const check = generic.parseCheckString(checkString);
        let tempcheck = "`";
        if (check.showDC) {
            if (check.showDC === "all") {
                tempcheck = tempcheck + "DC " + check.dc + " ";
            }
        }
        if (check.type) {
            if (check.type === "flat") {
                return tempcheck + "Flat Check`";
            }
            skillcheck = check.type.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
            if (check.basic) {
                return tempcheck + "Basic " + skillcheck + "`";
            }
            else {
                return tempcheck + skillcheck + "`";
            }
        }
    })();
}

function PF2e_replaceDamageFormat(damagestring) {
    const regex = /@Damage\[(\d+d\d+\[[^\]]+\](?:, ?)?)+\]/g;
    return damagestring.replace(regex, (match) => {
        const diceParts = match.match(/\d+d\d+\[[^\]]+\]/g);
        const formattedDice = diceParts.map(part => {
            const [dice, desc] = part.match(/(\d+d\d+)\[([^\]]+)\]/).slice(1);
            return `${dice} ${desc}`;
        }).join(' + ');
        return `\`:game_die: ${formattedDice}\` `;
    });
}

function PF2e_parseTraits(message) {
    let displayTraits = true;
    //check if anonymous allows traits to be displayed
    if (game.modules.get("anonymous")?.active) {
        if (game.settings.get("anonymous", "pf2e.traits")) {
            if (game.settings.get("anonymous", "pf2e.traits") !== "never") {
                displayTraits = false;
            }
        }
    }
    let traits = "";
    if (displayTraits) {
        const card = message.content;
        const parser = new DOMParser();
        let doc = parser.parseFromString(card, "text/html");
        let tags;
        let tagsSection = doc.querySelector(".item-properties.tags");
        try {
            tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
        }
        catch (error) {
            try {
                tagsSection = doc.querySelector('.tags');
                tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
            }
            catch (error) {
            }
        }
        if (generic.propertyExists(tags, "length")) {

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

function PF2e_createCardEmbed(message) {
    let card = message.content;
    const parser = new DOMParser();
    //replace horizontal line tags with paragraphs so they can be parsed later
    card = card.replace(/<hr[^>]*>/g, "<p>-----------------------</p>");
    let doc = parser.parseFromString(card, "text/html");
    // Find the <h3> element and extract its text content, since h3 works for most systems
    const h3Element = doc.querySelector("h3");

    let title = h3Element.textContent.trim();
    let desc = "";
    let speakerActor = undefined;
    if (generic.propertyExists(message, "speaker.actor")) {
        speakerActor = game.actors.get(message.speaker.actor);
    }

    desc = PF2e_parseTraits(message);

    //parse card description if source is from a character or actor is owned by a player
    //this is to limit metagame information and is recommended for most systems.
    //adding a setting to enable this would be an option, but is not a priority.
    let descVisible = true;

    if (speakerActor) {
        if (game.modules.get("anonymous")?.active && !generic.isOwnedByPlayer(speakerActor)) {
            descVisible = false;
        }
    }
    if (descVisible) {
        let descList = doc.querySelectorAll(".card-content");
        descList.forEach(function (paragraph) {
            let text = paragraph.innerHTML
                .replace(/<strong>(.*?)<\/strong>/g, '**$1**')  // Replace <strong> tags with markdown bold
                .trim();  // Trim any leading/trailing whitespace
            desc += text + "\n\n";
        });
    }

    const embed = [{ title: title, description: desc, footer: { text: generic.getCardFooter(card) } }];
    return embed;
}

function PF2e_reformatMessage(text) {
    let reformattedText = ""
    //First check if the text is formatted in HTML to use a different function
    //parse Localize first, since it will have html elements
    let regex = /@Localize\[(.*?)\]/g;
    reformattedText = text.replace(regex, (_, text) => generic.getLocalizedText(text));
    const isHtmlFormatted = /<[a-z][\s\S]*>/i.test(reformattedText);
    if (isHtmlFormatted) {
        reformattedText = generic.parseHTMLText(reformattedText);
        reformattedText = PF2e_reformatMessage(reformattedText); //call this function again as a failsafe for @ tags
    }
    else {
        //replace UUIDs to be consistent with Foundry
        regex = /@UUID\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':baggage_claim: `$1`');

        //replace compendium links
        regex = /@Compendium\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':baggage_claim: `$1`');

        //replace @Damage appropriately (for PF2e)
        reformattedText = PF2e_replaceDamageFormat(reformattedText);

        //replace UUID if custom name is not present (redundancy)
        regex = /@UUID\[(.*?)\]/g;
        reformattedText = reformattedText.replace(regex, (_, text) => generic.getNameFromItem(text));

        //replace Checks
        regex = /@Check\[[^\]]+\]{([^}]+)}/g;
        reformattedText = reformattedText.replace(regex, ':game_die: `$1`');

        //replace checks without name labels, different arguments on every system for @Check(if it exists), so pf2e gets a different one
        regex = /@Check\[(.*?)\]/g;
        reformattedText = reformattedText.replace(regex, (_, text) => PF2e_getNameFromCheck(text));
    }

    return reformattedText;
}

function getThisModuleSetting(settingName) {
    return game.settings.get('foundrytodiscord', settingName);
}