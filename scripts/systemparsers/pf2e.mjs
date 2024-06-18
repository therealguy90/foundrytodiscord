import { dieIcon, getDieEmoji, swapOrNot } from '../helpers/emojis/global.mjs';
import { actionGlyphEmojis, damageEmojis, targetEmoji, templateEmojis } from '../helpers/emojis/pf2e.mjs';
import { toHTML } from '../helpers/parser/enrich.mjs';
import { anonEnabled, getThisModuleSetting } from '../helpers/modulesettings.mjs';
import { MessageParser } from './generic.mjs';

const DamageRoll = CONFIG.Dice.rolls.find(r => r.name === "DamageRoll");

export class MessageParserPF2e extends MessageParser {

    constructor() {
        super();
        this._polyglotPath = "system.details.languages.value";
        this._genericRolls = false;
    }

    _systemHTMLParser(htmlString) {
        let reformattedText = htmlString;
        const htmldoc = document.createElement('div');
        htmldoc.innerHTML = reformattedText;
        if (htmldoc.hasChildNodes()) {
            // Format various elements
            this._removeElementsBySelector('[data-visibility="gm"], [data-visibility="owner"],[data-visibility="none"]', htmldoc);
            this._formatTextBySelector('.inline-check, span[data-pf2-check]', text => `${dieIcon(20)}\`${text}\``, htmldoc);
            this._formatTextBySelector('.action-glyph', text => `${text.replace(/1|2|3|4|5|a|d|t|f|r/g, match => swapOrNot(match.toLowerCase(), actionGlyphEmojis[match.toLowerCase()]))}`, htmldoc);
            this._formatTextBySelector('.statements.reverted', text => `~~${text}~~`, htmldoc);
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
                this._removeElementsBySelector('.dice-total.statuseffect-message ul', tempdivs);
                reformattedText = tempdivs.innerHTML;
            }
        }

        return reformattedText;
    }

    async _getSystemSpecificCards(message) {
        if (this._isActionCard(message) && message.rolls?.length < 1) {
            if (getThisModuleSetting('sendEmbeds')) {
                return await this._createActionCardEmbed(message);
            }
        }
        else if (this._isConditionCard(message)) {
            return this._createConditionCardEmbed(message);
        }
        return [];
    }

    async _createActionCardEmbed(message) {
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
            title += actionGlyph.textContent.toLowerCase().replace(/1|2|3|f|r/g, match => actionGlyphEmojis[match])
        }
        desc = `${this._parseTraits(message.flavor)}\n`;
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
                const item = game.actors.get(message.speaker.actor).items.get(message.flags.pf2e.context.item);
                const itemDesc = item.description;
                const actionCardDesc = div.querySelector(".description, .action-content");
                actionCardDesc.outerHTML = itemDesc;
                desc += await toHTML(div.innerHTML, this._generateEnrichmentOptionsUsingOrigin(item));
            }
            else {
                const actionDesc = div.querySelector(".description, .action-content");
                if (actionDesc) {
                    desc += actionDesc.innerHTML;
                }
            }
        }
        return [{ title: title, description: desc, footer: { text: this._getCardFooter(div.innerHTML) } }];
    }

    _createConditionCardEmbed(message) {
        let title = ""
        let desc = ""
        const parser = new DOMParser();
        const doc = parser.parseFromString(message.content, "text/html");
        const participantConditions = doc.querySelector(".participant-conditions");
        const currentConditionTitle = participantConditions.querySelector("h4");
        if (currentConditionTitle?.textContent) {
            title = currentConditionTitle.textContent;
        }
        const conditions = participantConditions.querySelectorAll("span");
        conditions.forEach(condition => {
            desc += "**" + condition.textContent + "**\n";
        });
        return [{ title: title, description: desc.trim() }];
    }

    _parseTraits(text, isRoll = false) {
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

    _getDiscardedRoll(message) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(message.content, "text/html");
        const rerollDiscardDiv = doc.querySelector(".pf2e-reroll-discard .dice-total, .reroll-discard .dice-total");
        return rerollDiscardDiv.textContent;
    }

    _parseDamageTypes(baserolls) {
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

    _parseDegree(degree) {
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

    _createCardEmbed(message) {
        const div = document.createElement('div');
        div.innerHTML = message.content;
        let desc = "";
        let title;
        // Find the <h3> element as title
        //generic card

        const h3Element = div.querySelector("h3");
        if (h3Element) {
            const actionGlyphElement = h3Element.querySelector(".action-glyph");
            if (actionGlyphElement) {
                if (getThisModuleSetting('prettierEmojis')) {
                    actionGlyphElement.innerHTML = actionGlyphElement.textContent.toLowerCase().replace(/1|2|3|f|r/g, match => actionGlyphEmojis[match]);
                }
                else {
                    actionGlyphElement.remove();
                }
            }
            title = h3Element.textContent.trim();
        }
        desc = this._parseTraits(message.content);
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

        return [{ title: title, description: desc, footer: { text: this._getCardFooter(div.innerHTML) } }];
    }

    _createRollEmbed(message) {
        if ((message.flavor !== null && message.flavor.length > 0) || (message.isDamageRoll && this._containsDamageDie(message.rolls))) {
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
            desc = this._parseTraits(message.flavor, true);

            //Build description
            if (anonEnabled()) {
                var anon = game.modules.get('anonymous').api; //optional implementation for "anonymous" module
            }

            //Add targets to embed:
            let targetPlayerTokens = [];
            if (game.modules.get("pf2e-toolbelt")?.active && message.flags["pf2e-toolbelt"]?.targetHelper?.targets?.length > 0) {
                const targets = message.flags["pf2e-toolbelt"].targetHelper.targets;
                let targetString = "";
                console.log(targets);
                targets.forEach(target => {
                    const targetToken = fromUuidSync(target);
                    if(!targetToken){
                        return;
                    }
                    const targetActor = targetToken.actor;
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
            const speakerActor = game.actors.get(message.speaker.actor);
            const user = message.author || message.user;
            const showDetails = getThisModuleSetting('forceShowRolls') || speakerActor?.hasPlayerOwner || (!speakerActor && !user?.isGM);
            if (!message.isReroll) {
                //Add roll information to embed:
                message.rolls.forEach(roll => {
                    let rollBreakdown = "";
                    if (getThisModuleSetting('showFormula') && showDetails) {
                        desc += `${dieIcon()}**\`${roll.formula}\`**\n`;
                        rollBreakdown = this._generateRollBreakdown(roll);
                    }
                    desc += `${dieIcon()}**Result: __${roll.total}__**`;
                    if (showDetails && roll.dice[0]?.faces === 20) {
                        if (roll.result.startsWith('20 ')) {
                            desc += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
                        }
                        else if (roll.result.startsWith('1 ')) {
                            desc += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
                        }
                    }
                    if (roll instanceof DamageRoll) {
                        desc += this._parseDamageTypes(roll);
                        if (rollBreakdown && showDetails) {
                            desc += `\n||(${rollBreakdown})||`;
                        }
                    }
                    else {
                        if (this._parseDegree(roll.options?.degreeOfSuccess)) {
                            desc += `\`(${this._parseDegree(roll.options.degreeOfSuccess)})\``;
                        }
                        else if (this._parseDegree(message.flags.pf2e?.context?.outcome)) {
                            desc += `\`(${this._parseDegree(message.flags.pf2e.context.outcome)})\``;
                        }
                        if (rollBreakdown && showDetails) {
                            desc += `||(${rollBreakdown})||`;
                        }
                    }
                    desc += "\n\n";
                });
            }
            else { // isReroll typically only consists of one Roll object.
                if (getThisModuleSetting('showFormula') && showDetails) {
                    desc += `${dieIcon()}**\`${message.rolls[0].formula}\`**\n`
                }
                desc += `~~${dieIcon()}Result: __${this._getDiscardedRoll(message)}__~~\n`;
                desc += `${dieIcon()}**Result: __${message.rolls[0].total}__**`;
                if (showDetails && message.rolls[0].dice[0].faces === 20) {
                    if (message.rolls[0].result.startsWith('20 ')) {
                        desc += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
                    }
                    else if (message.rolls[0].result.startsWith('1 ')) {
                        desc += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
                    }
                }
                if (this._parseDegree(message.flags.pf2e.context.outcome)) {
                    desc += `\`(${this._parseDegree(message.flags.pf2e.context.outcome)})\``;
                }
                if (showDetails) {
                    desc += `||(${this._generateRollBreakdown(message.rolls[0])})||`;
                }
                desc += "\n";
            }
            let rollEmbeds = [{ title: title, description: desc }]
            if (message.isDamageRoll && game.modules.get("pf2e-toolbelt")?.active && message.flags["pf2e-toolbelt"]?.targetHelper?.saves && targetPlayerTokens) {
                rollEmbeds = rollEmbeds.concat(this._createToolbeltSavesEmbed(message, targetPlayerTokens));
            }

            return rollEmbeds;
        }
        else {
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
            const user = message.author || message.user;
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
    }

    async _getEnrichmentOptions(message) {
        let originDoc;

        if (message.flags?.pf2e?.origin?.uuid) {
            originDoc = await fromUuid(message.flags.pf2e.origin.uuid);
        }
        else if (message.speaker?.actor) {
            originDoc = game.actors.get(message.speaker.actor); //Fallback to speaker in case it's needed.
        }
        return this._generateEnrichmentOptionsUsingOrigin(originDoc);
    }

    _generateEnrichmentOptionsUsingOrigin(originDoc) {
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

    async _generateAutoUUIDEmbeds(message) {
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
                    desc += await toHTML(originDoc.description, this._generateEnrichmentOptionsUsingOrigin(originDoc));
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
                    let journalEmbeds = await this._embedsFromJournalPages(pages);
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

    _generateRollBreakdown(roll, nextTerm = false) {
        let rollBreakdown = ""
        let termcount = 1;

        roll.terms.forEach((term) => {
            let currentTermString = "";
            switch (true) {
                case (foundry.dice && term instanceof foundry.dice.terms.DiceTerm) || term instanceof DiceTerm:
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
                    }
                    else {
                        currentTermString += `\`${term.expression}\``;
                        if (nextTerm && (roll.terms[termcount] && ((foundry.dice && !roll.terms[termcount] instanceof foundry.dice.terms.OperatorTerm) ||!roll.terms[termcount] instanceof OperatorTerm))) {
                            currentTermString += " +";
                        }
                    }
                    break;
                case ((foundry.dice && term instanceof foundry.dice.terms.PoolTerm) || term instanceof PoolTerm) || term.hasOwnProperty("rolls"):
                    let poolRollCnt = 1;
                    term.rolls.forEach(poolRoll => {
                        currentTermString += ` ${this._generateRollBreakdown(poolRoll, true)}`;
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
                case term.hasOwnProperty("operands"):
                    const terms = term.operands;
                    const newTerms = [];
                    let j = 1;
                    terms.forEach(operand => {
                        newTerms.push(operand);
                        // To be removed in update
                        const OpTerm = foundry.dice ? foundry.dice.terms.OperatorTerm : OperatorTerm;
                        if (j < terms.length) {
                            j++;
                            newTerms.push(new OpTerm({ operator: term.operator }));
                        }
                    })
                    currentTermString += ` ${this._generateRollBreakdown({ terms: newTerms }, true)}`;
                    break;
                case term.hasOwnProperty("term"):
                    currentTermString += ` (${this._generateRollBreakdown({ terms: [term.term] }, true)})`;
                    break;
                case term.hasOwnProperty("roll"):
                    currentTermString += ` ${this._generateRollBreakdown(term.roll, true)}`;
                    break;
                case term.hasOwnProperty("terms"):
                    term.terms.forEach(termTerm => {
                        if (termTerm.rolls) {
                            termTerm.rolls.forEach(termTermRoll => {
                                currentTermString += ` ${this._generateRollBreakdown(termTermRoll, true)}`;
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

    _createToolbeltSavesEmbed(message, tokens) {
        if (!tokens) {
            return [];
        }
        const title = function () {
            const save = message.flags["pf2e-toolbelt"].targetHelper.save;
            const savecheck = game.i18n.localize(CONFIG.PF2E.saves[save.statistic]);
            return `${save.basic ? game.i18n.format("PF2E.InlineCheck.BasicWithSave", { save: savecheck }) : savecheck} Save (Players)`;
        }();
        let desc = "";
        const saves = message.flags["pf2e-toolbelt"].targetHelper.saves
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
            desc += `\`(${this._parseDegree(tokenSave.success)})\`\n`;
        })
        return [{ title: title, description: desc }];
    }

    _isActionCard(message) {
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

    _isConditionCard(message) {
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

    _containsDamageDie(rolls) {
        return rolls.every(roll => /(d4|d6|d8|d10|d12)(?![0-9])/.test(roll.formula));
    }

}

