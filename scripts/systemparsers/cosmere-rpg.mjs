import { MessageParser } from './generic.mjs';
import { actionGlyphEmojis } from '../helpers/emojis/pf2e.mjs';
import { swapOrNot, dieIcon, getDieEmoji } from '../helpers/emojis/global.mjs';
import { getThisModuleSetting } from '../helpers/modulesettings.mjs';
import { parse2DTable } from '../helpers/parser/tables.mjs';

export class MessageParserCosmereRPG extends MessageParser {

    constructor() {
        super();
        this._polyglotPath = "system.languages";
        this._genericRolls = false;
    }

    _systemHTMLParser(htmlString) {
        let reformattedText = htmlString;
        const htmldoc = document.createElement('div');
        htmldoc.innerHTML = reformattedText;
        if (htmldoc.hasChildNodes()) {
            // Using PF2e symbols here for now...
            this._formatTextBySelector('.cosmere-icon.action1', () => `${swapOrNot('**`▶`**', actionGlyphEmojis['1'])}`, htmldoc);
            this._formatTextBySelector('.cosmere-icon.action2', () => `${swapOrNot('**`▶▶`**', actionGlyphEmojis['2'])}`, htmldoc);
            this._formatTextBySelector('.cosmere-icon.action3', () => `${swapOrNot('**`▶▶▶`**', actionGlyphEmojis['3'])}`, htmldoc);
            this._formatTextBySelector('.cosmere-icon.free', () => `${swapOrNot('**`▷`**', actionGlyphEmojis['f'])}`, htmldoc);
            this._formatTextBySelector('.cosmere-icon.reaction', () => `${swapOrNot('**`⮢`**', actionGlyphEmojis['r'])}`, htmldoc);
            this._formatTextBySelector('.cosmere-icon.special', () => `★`, htmldoc);
            this._formatTextBySelector('.cosmere-icon.passive', () => `∞`, htmldoc);
            // Special glyphs from the Cosmere Dingbats font
            const dingbatElements = htmldoc.querySelectorAll(".cosmere-icon, [style*='Cosmere Dingbats']");
            if (dingbatElements.length > 0) {
                dingbatElements.forEach(dingbat => {
                    let replacedText = "";
                    Array.from(dingbat.textContent.trim()).forEach(dingbatChar => {
                        switch (dingbatChar) {
                            case "1":
                                replacedText += swapOrNot('**`▶`**', actionGlyphEmojis['1']);
                                break;
                            case "2":
                                replacedText += swapOrNot('**`▶▶`**', actionGlyphEmojis['2']);
                                break;
                            case "3":
                                replacedText += swapOrNot('**`▶▶▶`**', actionGlyphEmojis['3']);
                                break;
                            case "0":
                                replacedText += swapOrNot('**`▷`**', actionGlyphEmojis['f']);
                                break;
                            case "r":
                                replacedText += swapOrNot('**`⮢`**', actionGlyphEmojis['r']);
                                break;
                            case "8":
                                replacedText += `∞`;
                                break;
                            case "c":
                                replacedText += `✹`;
                                break;
                            case "s":
                                replacedText += `✧`;
                                break;
                            case "o":
                                replacedText += `✪`;
                                break;
                            case "*":
                                replacedText += `★`;
                                break;
                            default:
                                replacedText += dingbatChar;
                                break;
                        }
                    });
                    dingbat.outerHTML = replacedText;
                });
            }
            reformattedText = htmldoc.innerHTML;
        }
        return reformattedText;
    }

    async _getSystemSpecificCards(message) {
        switch (true) {
            case await this._isCosmereRPGMergedRollCard(message):
                return await this._getCosmereRPGMergedRollCard(message);
                break;
            case await this._isCosmereRPGInjuryCard(message):
                return await this._getCosmereRPGInjuryCard(message);
                break;
            case await this._isCosmereRPGDamageTakenCard(message):
                return await this._getCosmereRPGDamageTakenCard(message);
                break;
            default:
                return [];
        }
    }

    async _getCosmereRPGMergedRollCard(message) {
        let embeds = [];
        let fields = [];
        let title = "";
        let description = "";
        const element = document.createElement('div');

        // Part 1: title + description (if any)
        element.innerHTML = message.flags?.['cosmere-rpg']?.message?.description || "";
        const headerElement = element.querySelector('header.summary');
        if (headerElement) {
            title = headerElement.querySelector('.title').textContent.trim();
            const actionSymbol = headerElement.querySelector('.icon.cosmere-icon');
            if (actionSymbol) {
                title = `${title} ${actionSymbol.outerHTML.trim()}`;
            }
        }
        if (element.querySelector('.details')) {
            description = element.querySelector('.details').innerHTML.trim();
        }
        const traitsElement = element.querySelector('.traits');
        if (traitsElement) {
            description = `${this._parseTraits(traitsElement)}\n\n${description}`;
        }
        if (description.length > 0 && message.rolls.length > 0) {
            description += "<hr>"
        }

        // Part 2: rolls
        const showDetails = getThisModuleSetting('forceShowRolls') || speakerActor?.hasPlayerOwner || (!speakerActor && !user?.isGM);
        message.rolls.forEach((roll) => {
            let inline = false;
            let fieldName = "";
            let fieldValue = "";
            if (roll.isDamage) {
                inline = true;
            }

            if (roll.options?.title) {
                fieldName = roll.options.title.trim();
                if (roll.options.attribute || roll.options.defaultAttribute) {
                    const attribute = roll.options.attribute || roll.options.defaultAttribute;
                    fieldName += ` (${attribute ? attribute.toUpperCase() : ''})`
                }
            }
            else if (roll.isDamage && roll.options?.damageType) {
                fieldName = game.i18n.localize(`COSMERE.DamageTypes.${roll.options.damageType.charAt(0).toUpperCase() + roll.options.damageType.slice(1).toLowerCase()}`)
            }

            let rollBreakdown = "";
            if (getThisModuleSetting('showFormula') && showDetails) {
                fieldValue += `${dieIcon()}**\`${roll.formula}\`**\n`;
                rollBreakdown = this._generateRollBreakdown(roll);
            }
            fieldValue += `${dieIcon()}**Result: __${roll.total}__**`;

            if (roll.complicationsCount > 0) {
                fieldValue += '✹'.repeat(roll.complicationsCount);
            }
            if (roll.opportunitiesCount > 0) {
                fieldValue += '✪'.repeat(roll.opportunitiesCount);
            }

            if (showDetails && roll.dice[0]?.faces === 20) {
                if (roll.result.startsWith('20 ')) {
                    fieldValue += ` (${swapOrNot("Nat 20", getDieEmoji(20, 20))}!)`;
                }
                else if (roll.result.startsWith('1 ')) {
                    fieldValue += ` (${swapOrNot("Nat 1", getDieEmoji(20, 1))})`;
                }
            }
            if (rollBreakdown && showDetails) {
                fieldValue += `||(${rollBreakdown})||`;
            }
            fields.push({ name: fieldName, value: fieldValue, inline: inline });

            if (roll.isDamage && roll.options?.graze) {
                fieldName = game.i18n.localize('DICE.Damage.Graze');
                fieldValue = "";
                const graze = roll.options.graze;
                let rollBreakdown = "";
                if (getThisModuleSetting('showFormula') && showDetails) {
                    fieldValue += `${dieIcon()}**\`${graze.formula}\`**\n`;
                    rollBreakdown = this._generateRollBreakdown(graze);
                }
                fieldValue += `${dieIcon()}**Result: __${graze.total}__**`;
                if (rollBreakdown && showDetails) {
                    fieldValue += `||(${rollBreakdown})||`;
                }
                fields.push({ name: fieldName, value: fieldValue, inline: inline });
            }
        });

        // Final correction, since on skill checks, the first field can just be the embed itself...
        if (title === "" && description === "") {
            if (fields.length > 0) {
                const firstField = fields.shift();
                title = firstField.name || "";
                description = firstField.value || "";
            }
        }

        embeds.push({ title: title, description: description, fields: fields });

        title = "";
        description = "";
        const d20Roll = message.rolls.find(r => r.dice[0]?._faces === 20);
        if (message.flags?.['cosmere-rpg']?.message?.targets?.length > 0 && d20Roll) {
            // Create 2d Table
            // Get longest target name length to base table width off of, this way names have a higher chance of not being cut off
            const longestNameLength = Math.max(...message.flags['cosmere-rpg'].message.targets.map(t => t.name.length), 1);
            // Row 1 for table headers
            let targetTable = [[" ".repeat(longestNameLength + 2), game.i18n.localize("COSMERE.AttributeGroup.Physical.short"), game.i18n.localize("COSMERE.AttributeGroup.Cognitive.short"), game.i18n.localize("COSMERE.AttributeGroup.Spiritual.short")]];
            // Table content
            message.flags['cosmere-rpg'].message.targets.forEach(target => {

                let phySuccessFail = "";
                let cogSuccessFail = "";
                let spiSuccessFail = "";

                if (d20Roll) {
                    phySuccessFail = target.def.phy <= d20Roll.total ? "✓" : "⨯";
                    cogSuccessFail = target.def.cog <= d20Roll.total ? "✓" : "⨯";
                    spiSuccessFail = target.def.spi <= d20Roll.total ? "✓" : "⨯";
                }

                let row = [target.name, `${target.def.phy}${phySuccessFail}`, `${target.def.cog}${cogSuccessFail}`, `${target.def.spi}${spiSuccessFail}`];
                targetTable.push(row);

                // Convert to discord readable table
                const dynamicTableLength = Math.min(longestNameLength + 24, 69);
                description = parse2DTable(targetTable, dynamicTableLength);
            });
            title = game.i18n.localize("COSMERE.ChatMessage.Trays.Targets")
            embeds.push({ title: title, description: description });
        }

        return embeds;
    }

    async _getCosmereRPGInjuryCard(message) {
        let embeds = [];
        let fields = [];
        let title = "";
        let description = "";

        if (message.flags?.['cosmere-rpg']?.injury?.details?.flags?.['cosmere-rpg']?.["injury-data"]?.type) {
            const injuryType = message.flags['cosmere-rpg'].injury.details.flags['cosmere-rpg']["injury-data"].type;
            switch (injuryType) {
                case "shallow_injury":
                case "flesh_wound":
                case "vicious_injury":
                    const injuryDays = message.rolls[0]?.total;
                    title = game.i18n.format("COSMERE.ChatMessage.InjuryDuration.Temporary", { actor: message.alias, days: injuryDays })
                    break;
                case "permanent_injury":
                    title = game.i18n.format("COSMERE.ChatMessage.InjuryDuration.Permanent", { actor: message.alias })
                    break;
                case "death":
                    title = game.i18n.format("COSMERE.ChatMessage.InjuryDuration.Dead", { actor: message.alias })
                    break;
                default:

                    break;

            }
            description = message.flags['cosmere-rpg'].injury.details.description;
        }

        if (description.length > 0 && message.flags?.['cosmere-rpg']?.injury?.roll > 0) {
            description += "<hr>"
        }

        const showDetails = getThisModuleSetting('forceShowRolls') || speakerActor?.hasPlayerOwner || (!speakerActor && !user?.isGM);
        if (message.flags?.['cosmere-rpg']?.injury?.roll) {
            const injuryRoll = message.flags['cosmere-rpg'].injury.roll;
            let fieldName = "";
            let fieldValue = "";

            fieldName = game.i18n.localize("COSMERE.ChatMessage.InjuryRoll");

            let rollBreakdown = "";
            if (getThisModuleSetting('showFormula') && showDetails) {
                fieldValue += `${dieIcon()}**\`${injuryRoll.formula}\`**\n`;
                rollBreakdown = this._generateRollBreakdown(injuryRoll);
            }
            fieldValue += `${dieIcon()}**Result: __${injuryRoll.total}__**`;
            if (rollBreakdown && showDetails) {
                fieldValue += `||(${rollBreakdown})||`;
            }
            fields.push({ name: fieldName, value: fieldValue });
        }
        embeds.push({ title: title, description: description, fields: fields })
        return embeds;
    }

    async _getCosmereRPGDamageTakenCard(message) {
        let description = "";
        const flags = message?.flags?.['cosmere-rpg']?.taken ?? {};
        const damageTaken = flags?.damageTaken;
        if (typeof damageTaken === 'number') {
            let amount = damageTaken;
            const isHealing = amount < 0;
            if (isHealing) amount = -amount;
            description = game.i18n.format(
                `COSMERE.ChatMessage.${isHealing ? "ApplyHealing" : "ApplyDamage"}`,
                { actor: message.alias, amount: amount },
            );

            if (flags?.undo === false) {
                const element = document.createElement('div');
                element.innerHTML = description;
                const undidDamage = element.querySelector('strong');
                if (undidDamage) {
                    undidDamage.textContent = `~~${undidDamage.textContent.trim()}~~`;
                    description = element.innerHTML;
                }
            }
        }

        // Build damage calculation string like the system does
        const damageDeflect = Number(flags?.damageDeflect ?? 0);
        const damageIgnore = Number(flags?.damageIgnore ?? 0);
        const damageImmune = Number(flags?.damageImmune ?? 0);
        const appliedImmunities = flags?.appliedImmunities ?? {};
        const targetUuid = flags?.target;

        let calculationText = "";
        try {
            // Use actor deflect value
            const actor = targetUuid ? await fromUuid(targetUuid) : null;

            let actorDeflectRaw =
                actor?.system?.statistics?.deflect ??
                actor?.system?.deflect ??
                actor?.deflect ??
                0;
            if (actorDeflectRaw && typeof actorDeflectRaw === "object") {
                if (typeof actorDeflectRaw.value === "number") actorDeflectRaw = actorDeflectRaw.value;
                else if (typeof actorDeflectRaw.current === "number") actorDeflectRaw = actorDeflectRaw.current;
                else if (typeof actorDeflectRaw.max === "number") actorDeflectRaw = actorDeflectRaw.max;
                else actorDeflectRaw = 0;
            }
            const actorDeflect = Number(actorDeflectRaw) || 0;

            // Grabbed this from the system. Unsure of how it works.
            const calculationDeflect =
                damageDeflect > 0
                    ? `${actorDeflect} (deflect)`
                    : undefined;
            const calculationIgnore =
                damageIgnore > 0
                    ? `${damageIgnore} (ignore)`
                    : undefined;
            const calculationImmune =
                damageImmune > 0
                    ? `${damageImmune} (immune)`
                    : undefined;

            const leftParts = [
                (damageDeflect + damageImmune) > 0 ? String(damageDeflect + damageImmune) : undefined,
                calculationDeflect,
                calculationImmune,
            ].filter(Boolean);
            const left = leftParts.length ? leftParts.join(' - ') : undefined;

            const allParts = [left, calculationIgnore].filter(Boolean);
            const composed = allParts.join(' + ');

            if (composed) {
                calculationText = game.i18n.format("COSMERE.ChatMessage.DamageCalculation", { calculation: composed });
                calculationText = calculationText.split('\n').map((l) => `-# ${l}`).join('\n');
            }


            const immEntries = Object.entries(appliedImmunities ?? {});
            if (immEntries.length) {
                immEntries.sort(([, a], [, b]) => b - a);
                const breakdown = immEntries.map(([dt, amt]) => `${dt}: ${amt}`).join(' | ');
                calculationText += `\n-# ${game.i18n.localize("COSMERE.Actor.Statistics.Immunities")}: ${breakdown}`;
            }

        } catch (err) {
            console.error(err);
        }

        description = `${description}\n${calculationText}`;

        return [{ title: "", description: description }];
    }

    async _isCosmereRPGMergedRollCard(message) {
        if (message.flags?.['cosmere-rpg']?.message?.type) {
            switch (message.flags['cosmere-rpg'].message.type) {
                case 'action':
                case 'skill':
                    return true;
                default:
                    return false;
            }
        }
        return false;
    }

    async _isCosmereRPGInjuryCard(message) {
        if (message.flags?.['cosmere-rpg']?.message?.type) {
            switch (message.flags['cosmere-rpg'].message.type) {
                case 'injury':
                    return true;
                default:
                    return false;
            }
        }
        return false;
    }

    async _isCosmereRPGDamageTakenCard(message) {
        if (message.flags?.['cosmere-rpg']?.message?.type) {
            switch (message.flags['cosmere-rpg'].message.type) {
                case 'taken':
                    return true;
                default:
                    return false;
            }
        }
        return false;
    }

    _parseTraits(element) {
        let traits = "";
        const traitArray = element.innerHTML.split(',');
        traitArray.forEach(trait => {
            if (trait.includes('<strong>')) {
                const expertTrait = document.createElement('div');
                expertTrait.innerHTML = trait;
                traits += `**\`${expertTrait.textContent.trim()}\`** `;
            }
            else {
                traits += `\`${trait.trim()}\` `;
            }
        });
        return traits.trim();
    }

    _getEnrichmentOptions(message) {
        return {};
    }

    // Used for roll breakdowns in this system, as some rolls have their class names registered as an attribute
    _isInstanceOfClass(term, className) {
        if (term.class) {
            let currentClass = term.class;
            const classesToCheck = [currentClass];

            try {
                let constructor = foundry.dice.terms[currentClass];
                while (constructor && constructor.prototype) {
                    const parent = Object.getPrototypeOf(constructor.prototype).constructor;
                    if (parent && parent.name && parent.name !== 'Object') {
                        classesToCheck.push(parent.name);
                        constructor = parent;
                    } else {
                        break;
                    }
                }
            } catch (e) {
            }

            return classesToCheck.includes(className);
        }
        if (foundry.dice?.terms?.[className]) {
            return term instanceof foundry.dice.terms[className];
        }

        return false;
    }

    _generateRollBreakdown(roll, nextTerm = false) {
        let rollBreakdown = ""
        let termcount = 1;

        roll.terms.forEach((term) => {
            let currentTermString = "";
            switch (true) {
                case this._isInstanceOfClass(term, "Die"):
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
                        if (tempTermString !== "" && ((notDieEmoji && i < term.results.length) || (nextTerm && (roll.terms[termcount] && ((foundry.dice && !roll.terms[termcount] instanceof foundry.dice.terms.OperatorTerm)))))) {
                            tempTermString += " +";
                        }
                        currentTermString += tempTermString;
                        i++;
                    });
                    if (notDieEmoji) {
                        currentTermString = ` \`${term.faces ? `d${term.faces}` : ""}[${currentTermString.trim()}]\``;
                    }
                    break;
                case this._isInstanceOfClass(term, "FunctionTerm"):
                    currentTermString += term.result;
                    break;
                case this._isInstanceOfClass(term, "PoolTerm") || term.hasOwnProperty("rolls"):
                    let poolRollCnt = 1;
                    term.rolls.forEach(poolRoll => {
                        currentTermString += ` ${this._generateRollBreakdown(poolRoll, true)}`;
                        if (poolRollCnt <= term.rolls.length) {
                            currentTermString += " +";
                        }
                        poolRollCnt++;
                    });
                    break;
                case this._isInstanceOfClass(term, "OperatorTerm"):
                    currentTermString += ` ${term.operator}`;
                    break;
                case this._isInstanceOfClass(term, "NumericTerm"):
                    currentTermString += ` ${term.number}`
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
                case typeof term === "string":
                    currentTermString += ` ${term}`;
                    break;
                default:
                    currentTermString += "error";
                    break;
            }
            rollBreakdown += currentTermString;
            termcount++;
        });
        if (!nextTerm && rollBreakdown.includes("error")) {
            console.error(localizeWithPrefix("foundrytodiscord.logs.couldNotParseDice"));
            return roll.result;
        }
        return rollBreakdown.trim();
    }

}