import { getDieEmoji, swapOrNot, dieIcon } from '../helpers/emojis/global.mjs';
import { MessageParser } from "./generic.mjs";

export class MessageParserPF1 extends MessageParser {

    constructor() {
        super();
        this._polyglotPath = "system.traits.languages.standard";
        this._genericRolls = false;
    }

    _systemHTMLParser(htmlString) {
        let reformattedText = htmlString;
        const htmldoc = document.createElement('div');
        htmldoc.innerHTML = reformattedText;
        if (htmldoc.hasChildNodes()) {
            this._formatTextBySelector('i.fa-arrow-right', text => `→`, htmldoc);
            this._formatTextBySelector('.level-new', text => `**${text}**`, htmldoc);
            reformattedText = htmldoc.innerHTML;
        }

        return reformattedText;
    }

    async _getSystemSpecificCards(message) {
        switch (true) {
            case await this._isItemCard(message):
                return this._createItemCard(message);
                break;
            case await this._isLevelUpCard(message):
                return this._createLevelUpEmbed(message);
                break;
        }
        return [];
    }

    async _createItemCard(message) {
        const div = document.createElement('div');
        div.innerHTML = message.content;
        let desc = "";
        let fields = [];
        const title = div.querySelector(".item-name").textContent;
        const cardContentElement = div.querySelector(".card-content");

        desc += cardContentElement?.innerHTML.trim() ?? ""; // Card Body
        for (const attackElement of div.querySelectorAll(".chat-attack")) {
            const rollIndex = Number(attackElement.getAttribute("data-index") ?? "-1");

            //Attack Roll
            const attackTitleElement = attackElement.querySelector(`.attack-flavor.alt, .attack-flavor[colspan="2"]`);
            const attack = message.systemRolls.attacks[rollIndex];
            console.log(attack.attack);
            const attackRoll = attack.attack;
            if (attackRoll) {
                let attackFieldValue = `\`${attackRoll.formula}\`\n${dieIcon(20)}**\`${attackRoll.total}\`**||(${this._generateRollBreakdown(attackRoll)})||\n`
                const critConfirmElement = attackElement.querySelector(`.attack-flavor.crit-confirm`);
                if (critConfirmElement) {
                    const critConfirm = attack.critConfirm;
                    attackFieldValue += `\n**${critConfirmElement.textContent}**\n\`${critConfirm.formula}\`\n${dieIcon(20)}**\`${critConfirm.total}\`**||(${this._generateRollBreakdown(critConfirm)})||`;
                }
                fields.push({ name: attackTitleElement ? attackTitleElement.textContent : "", value: attackFieldValue, inline: true });
            }
            //Damage Roll
            let damageElement = attackElement.querySelector(`.attack-damage, .damage`);
            if (damageElement) {
                const normalDamage = damageElement.querySelector(`[data-damage-type="normal"]`);
                damageElement = normalDamage ? normalDamage : damageElement;
                const damageRolls = attack.damage;
                let title = "";
                let damageFieldValue = "";
                if (damageElement) {
                    const damageTotal = damageElement.querySelector(".fake-inline-roll").textContent.trim().replace(/\s+/g, ' ');
                    for (const a of damageElement.querySelectorAll("a")) {
                        a.remove();
                    }
                    title = `${damageElement.textContent} (${damageTotal})`;

                }
                if (damageRolls) {
                    const damageTableBody = attackElement.querySelector("tbody");
                    if (damageTableBody) {
                        const normalDamageCells = damageTableBody.querySelectorAll("td.roll.damage.normal");
                        const normalTypeCells = damageTableBody.querySelectorAll("td.damage-types");
                        for (let i = 0; i < normalDamageCells.length && i < damageRolls.length; i++) {
                            const roll = damageRolls[i];
                            let typeText = "";
                            if (normalTypeCells[i]) {
                                const types = Array.from(normalTypeCells[i].querySelectorAll(".damage-type .name"))
                                    .map(e => e.textContent.trim())
                                    .join(", ");
                                if (types) typeText = ` ${types}`;
                            }
                            damageFieldValue += `\`${roll.formula}\`\n${dieIcon()}**\`${roll.total}${typeText}\`**||(${this._generateRollBreakdown(roll)})||\n`;
                        }
                    }
                }
                damageElement = attackElement.querySelector(`.attack-damage, .damage`);
                const critDamageRolls = attack.critDamage;
                if (critDamageRolls) {
                    const damageTableBody = attackElement.querySelector("tbody");
                    if (damageTableBody) {
                        const critDamageCells = damageTableBody.querySelectorAll("td.roll.damage.critical");
                        const critTypeCells = damageTableBody.querySelectorAll("td.damage-type");
                        for (let i = 0; i < critDamageCells.length && i < critDamageRolls.length; i++) {
                            const roll = critDamageRolls[i];
                            let typeText = "";
                            if (critTypeCells[i]) {
                                const types = Array.from(critTypeCells[i].querySelectorAll(".damage-type .name"))
                                    .map(e => e.textContent.trim())
                                    .join(", ");
                                if (types) typeText = ` ${types}`;
                            }
                            damageFieldValue += `\n**Critical Damage**\n\`${roll.formula}\`\n${dieIcon()}**\`${roll.total}${typeText}\`**||(${this._generateRollBreakdown(roll)})||\n`;
                        }
                    }
                }
                title = await this.formatText(title);
                fields.push({ name: title, value: damageFieldValue, inline: true });
            }
            fields.push({ name: "\u200b", value: "\u200b" }); //Spacer field
        }
        if (fields[fields.length - 1]?.name === "\u200b") {
            fields.pop(); //Remove last spacer field for cleanup
        }
        return [{ title: title, description: desc, fields: fields }];
    }

    async _createLevelUpEmbed(message) {
        let doc = document.createElement('div');
        doc.innerHTML = message.content;
        const titleElement = doc.querySelector('h1');
        const title = titleElement?.textContent;
        titleElement.remove();
        const description = doc.innerHTML;
        return [{ title: title, description: description }];
    }

    async _isItemCard(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        return (doc.querySelector('.item-card') !== null);
    }

    async _isLevelUpCard(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        return (doc.querySelector('.level-up') !== null);
    }


    /* These methods can be overriden. Refer to other parsers as to how this is done.
    * 
    * _systemHTMLParser is used to parse custom css tags and text that your system uses.
    * 
    * _systemHTMLParser(htmlString) {
    *     return htmlString;
    * }
    * 
    * _getSystemSpecificCards is used for system- or module-specific chat cards that need special parsing.
    * Note that "message" is already enriched.
    * This will return an array of embeds. Refer to the Discord Webhook docs.
    * async _getSystemSpecificCards(message) {
    *     return [];
    * }
    * 
    * 
    * _getEnrichmentOptions is used for enriching system-specific text or links. Check your system's enricher.
    * This should return an Object containing the enrichment options.
    * _getEnrichmentOptions(message){
    *     return {};
    * }
    * 
    * 
    * 
    * 
    * 
    */
}