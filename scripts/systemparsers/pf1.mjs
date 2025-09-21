import { getDieEmoji, swapOrNot, dieIcon } from '../helpers/emojis/global.mjs';
import { MessageParser } from "./generic.mjs";

export class MessageParserPF1 extends MessageParser {

    constructor() {
        super();
        this._polyglotPath = "system.traits.languages.value"; // Change this to your system's language path (must be an array, otherwise you might need to override _getPolyglotLanguages)
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
        /*
        //case of Spell item
        const spellDescElement = div.querySelector(".spell-description");
        if (spellDescElement) {
            for (const breakElement of spellDescElement.querySelectorAll("br")) {
                breakElement.remove();
            }
            //desc += spellDescElement.innerHTML.trim();
        }
        const itemDescHeaderElement = div.querySelector(".description-header");
        if (itemDescHeaderElement) {
            //desc += itemDescHeaderElement.outerHTML;
        }
        const itemDescBodyElement = div.querySelector(".description-body");
        if(itemDescBodyElement){
            //desc += itemDescBodyElement.innerHTML.trim();
        }*/
        desc += cardContentElement?.innerHTML.trim() ?? ""; // Card Body
        for (const attackElement of div.querySelectorAll(".chat-attack")) {
            const rollIndex = Number(attackElement.getAttribute("data-index") ?? "-1");

            //Attack Roll
            const attackTitleElement = attackElement.querySelector(`.attack-flavor.alt, .attack-flavor[colspan="2"]`);
            const attack = message.systemRolls.attacks[rollIndex];
            const attackRoll = attack.attack;
            let attackFieldValue = `\`${attackRoll.formula}\`\n${dieIcon(20)}**\`${attackRoll.total}\`**||(${this._generateRollBreakdown(attackRoll)})||`
            const critConfirmElement = attackElement.querySelector(`.attack-flavor.crit-confirm`);
            console.log(message.systemRolls.attacks[rollIndex]);
            if (critConfirmElement) {
                const critConfirm = attack.critConfirm;
                attackFieldValue += `\n**${critConfirmElement.textContent}**\n\`${critConfirm.formula}\`\n${dieIcon(20)}**\`${critConfirm.total}\`**||(${this._generateRollBreakdown(critConfirm)})||`;
            }
            fields.push({ name: attackTitleElement ? attackTitleElement.textContent : "", value: attackFieldValue, inline: true });

            console.log(message);

            //Damage Roll
            const damageElement = attackElement.querySelector(`.attack-damage, .damage`);
            if (damageElement) {
                const normalDamage = damageElement.querySelector(`[data-damage-type="normal"]`);
                const damageRolls = attack.damage;
                let title = "";
                let damageFieldValue = "";
                if (normalDamage) {
                    const damageTotal = normalDamage.querySelector(".fake-inline-roll").textContent.trim().replace(/\s+/g, ' ');
                    for (const a of normalDamage.querySelectorAll("a")) {
                        a.remove();
                    }
                    title = `${normalDamage.textContent} (${damageTotal})`;

                }
                if (damageRolls) {
                    for (const damage of damageRolls) {
                        damageFieldValue += `\`${damage.formula}\`\n${dieIcon()}**\`${damage.total}\`**||(${this._generateRollBreakdown(damage)})||\n`;
                    }
                }
                const critDamageRolls = attack.critDamage;
                if (critDamageRolls) {
                    const critDamage = damageElement.querySelector(`[data-damage-type="critical"]`);
                    if (critDamage) {
                        const damageTotal = normalDamage.querySelector(".fake-inline-roll").textContent.trim().replace(/\s+/g, ' ');
                        for (const a of critDamage.querySelectorAll("a")) {
                            a.remove();
                        }
                        damageFieldValue += `\n**${critDamage.textContent} (${damageTotal})\n**`;
                        for (const damage of critDamageRolls) {
                            damageFieldValue += `\`${damage.formula}\`\n${dieIcon()}**\`${damage.total}\`**||(${this._generateRollBreakdown(damage)})||\n`;
                        }
                    }
                }
                fields.push({ name: title, value: damageFieldValue, inline: true });
            }
            console.log(attack);


            fields.push({ name: "\u200b", value: "\u200b" });
        }
        if (fields[fields.length - 1]?.name === "\u200b") {
            fields.pop();
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