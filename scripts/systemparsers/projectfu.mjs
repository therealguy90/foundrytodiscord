import { dieIcon } from "../helpers/emojis/global.mjs";
import { centerTextInWidth } from "../helpers/parser/messages.mjs";
import { parse2DTable } from "../helpers/parser/tables.mjs";
import { MessageParser } from "./generic.mjs"; // Change this import.

export class MessageParserProjectFU extends MessageParser {

    constructor() {
        super();
        //this._polyglotPath = "system.traits.languages.value"; // Change this to your system's language path (must be an array, otherwise you might need to override _getPolyglotLanguages)
        this._genericRolls = false;
    }
    _systemHTMLParser(htmlString) {
        let reformattedText = htmlString;
        const htmldoc = document.createElement('div');
        htmldoc.innerHTML = reformattedText;
        if (htmldoc.hasChildNodes()) {
            this._removeElementsBySelector('span.button', htmldoc);
            this._formatTextBySelector('summary', text => `**${text}**\n`, htmldoc);
            reformattedText = htmldoc.innerHTML;
        }
        reformattedText = reformattedText.replace(/【(.*?)】/g, "[$1]");
        return reformattedText;
    }

    async _getSystemSpecificCards(message) {
        switch (true) {
            case await this._isPFUCard(message):
                return await this._createPFUEmbed(message);
                break;
        }
        return [];
    }

    async _createPFUEmbed(message) {
        let fields = [];
        // Title
        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = message.flavor;

        const descriptionDiv = document.createElement('div');
        descriptionDiv.innerHTML = message.content;

        let description = "";
        let chatDescription = "";
        let detailDescription = "";

        // Tags (if any)
        let tagText = "";
        for (const tag of descriptionDiv.querySelectorAll('[data-tooltip=""].fu-tag')) {
            if (!tag.textContent) continue;
            tagText += `[${tag.textContent.trim()}] `;
            tag.remove();
        }
        if (tagText.trim() !== "") {
            chatDescription += `\`${tagText.trim()}\`\n`;
        }

        // Clock (if any)

        const clockElement = descriptionDiv.querySelector('.unique-clock');
        if (clockElement) {
            chatDescription += "\n";
            const currentElement = clockElement.querySelector('.stat-current');
            const maxElement = clockElement.querySelector('.stat-max');
            const current = currentElement ? Number(currentElement.textContent.trim()) : -1;
            const max = maxElement ? Number(maxElement.textContent.trim()) : -1;
            if (current >= 0 && max >= 0) {
                const progressLabel = clockElement.querySelector('.progress');
                if (progressLabel) {
                    chatDescription += `**${progressLabel.getAttribute('data-tooltip')}: ** `
                }
                for (let i = 0; i < current; i++) {
                    //chatDescription += ":white_large_square:";
                    chatDescription += ":white_square_button:";
                }
                for (let i = 0; i < max - current; i++) {
                    //chatDescription += ":white_square_button:";
                    chatDescription += ":white_large_square:";
                }
                const divider = clockElement.querySelector('.stat-divider').textContent.trim();
                chatDescription += ` (${current} ${divider} ${max})`;
                chatDescription = chatDescription.trim() + "\n";
            }
        }

        for (const chatDesc of descriptionDiv.querySelectorAll('div.chat-desc')) {
            chatDescription += chatDesc.innerHTML + "\n";
        }

        for (const descBlock of descriptionDiv.querySelectorAll(`div.detail-desc:not([id="results"]):not(.difficulty)`)) {
            if (descBlock.querySelector('label.total, label.title, label.detail, label.damageType, .spin2win, .group-check-supporters')) continue; // Skip any unnecessary text
            detailDescription += descBlock.innerHTML + "\n";
        }

        const parseFieldsFromCheckElement = (attrCheckElement) => {
            let fields = [];
            for (const attrPart of attrCheckElement.querySelectorAll('div')) {
                const title = attrPart.querySelector('label.title').textContent.trim();
                const value = `${dieIcon()}__**\`${attrPart.querySelector('label.detail').textContent.trim()}\`**__`;
                fields.push({ name: title, value: value, inline: true })
            }
            return fields;
        }

        // Type 1: Attribute Check

        const attrCheckElement = descriptionDiv.querySelector('[id="results"]');
        if (attrCheckElement) {
            const attrCheckContainer = attrCheckElement.parentNode;
            let vsDiff = "";
            const vsContainer = attrCheckContainer.querySelector('.vs-container');
            const difficulty = attrCheckContainer.querySelector('.difficulty');
            let line = "";

            if (vsContainer) {
                line += vsContainer.textContent.trim() + " ";
            }

            if (difficulty) {
                const diffTitle = difficulty.querySelector('label.title');
                if (diffTitle) {
                    line += diffTitle.textContent.trim() + ":";
                }
                if (line.trim() !== "") {
                    vsDiff += `**${await centerTextInWidth(line)}**\n`;
                }
                const diffDetail = difficulty.querySelector('label.detail');
                if (diffDetail) {
                    vsDiff += `**\`${await centerTextInWidth(diffDetail.textContent.trim())}\`**\n`;
                }
            } else if (line.trim() !== "") {
                vsDiff += `**${await centerTextInWidth(line)}**\n`;
            }

            detailDescription += vsDiff;
            if (message.rolls.length === 1) {
                detailDescription += `\n${dieIcon()}**\`${message.rolls[0].formula}\`**`
            }
            fields.push(...parseFieldsFromCheckElement(attrCheckElement))
            const resultElement = descriptionDiv.querySelector('.total');
            if (resultElement) {
                const result = resultElement.querySelector(".endcap");
                const resultText = result.textContent.trim();
                result.remove();
                let value = `\`\`\`🎲 ${resultElement.textContent.trim()}`;
                if (resultText.length > 0) {
                    value += ` (${resultText})`;
                }
                value += `\`\`\``;

                fields.push({ name: "\u200b", value: value });

            }
        }

        // Type 2: Accuracy + Damage check

        const accDmgElement = descriptionDiv.querySelector('.combineAccDmg');

        if (accDmgElement) {
            const accuracyElement = accDmgElement.querySelector('.accuracy-check');
            const damageElement = accDmgElement.querySelector('.damage-check');
            let title = "\u200b";
            let value = "\u200b";
            // Part 1: Accuracy
            if (accuracyElement) {
                const accTitleElement = accuracyElement.querySelector('h2');
                if (accTitleElement) {
                    title = accTitleElement.textContent.trim();
                }
            }

            const resultElement = accuracyElement.querySelector('.total');
            if (resultElement) {
                value = `${dieIcon()}\`${resultElement.textContent.trim()}\``;
            }
            fields.push({ name: title, value: value, inline: true });

            // Part 2: Damage
            title = "\u200b";
            value = "\u200b";
            if (damageElement) {
                const damTitleElement = damageElement.querySelector('h2');
                if (damTitleElement) {
                    title = damTitleElement.textContent.trim();
                }
                const damTotalElement = damageElement.querySelector('.damageType');
                if (damTotalElement) {
                    value = `${dieIcon()}\`${damTotalElement.textContent.trim()} (${damTotalElement.querySelector('.endcap').getAttribute('data-tooltip')})\``
                }
            }
            fields.push({ name: title, value: value, inline: true });

            // Part 3: Breakdowns
            title = "\u200b";
            value = "\u200b";

            if (accuracyElement) {
                const accTitleElement = accuracyElement.querySelector('h2');
                if (accTitleElement) {
                    value = `__**${accTitleElement.textContent.trim()}**__`;
                    if (message.rolls.length === 1) {
                        value += `\n${dieIcon()}**\`${message.rolls[0].formula}\`**`
                    }
                }
            }
            fields.push({ name: title, value: value });

            if (accuracyElement) {
                const accCheckResultElement = accuracyElement.querySelector('.accuracy-check-results');
                if (accCheckResultElement) {
                    const attrCheckElement = accCheckResultElement.querySelector('.detail-desc');
                    fields.push(...parseFieldsFromCheckElement(attrCheckElement));

                }
            }

            title = "\u200b";
            value = "\u200b";

            if (damageElement) {
                const damTitleElement = damageElement.querySelector('h2');
                if (damTitleElement) {
                    value = `__**${damTitleElement.textContent.trim()}**__`;
                }
            }
            fields.push({ name: title, value: value });

            if (damageElement) {
                const damageResultElement = damageElement.querySelector('.accuracy-check-results');
                if (damageResultElement) {
                    const damCheckElement = damageResultElement.querySelector('.detail-desc');
                    fields.push(...parseFieldsFromCheckElement(damCheckElement));

                }
            }
        }

        // Type 3: Group Check

        const groupCheckAttribs = descriptionDiv.querySelectorAll('.spin2win')
        if (groupCheckAttribs) {
            let title = "\u200b";
            let value = "\u200b";
            for (const attribElement of groupCheckAttribs) {
                title = `${dieIcon()}${attribElement.textContent.trim()}`;
                fields.push({ name: title, value: value, inline: true });
            }
            title = "\u200b";
            value = "\u200b";
            const supporterTableElement = descriptionDiv.querySelector('.group-check-supporters');
            let supporterTable = [];
            if (supporterTableElement) {
                let row = [];
                for (const supporterTableHeaderCell of supporterTableElement.querySelector('.group-check-supporters-title').querySelectorAll('div')) {
                    if (supporterTableHeaderCell.textContent) {
                        row.push(supporterTableHeaderCell.textContent.trim());
                    }
                }
                if (row.length > 0) {
                    supporterTable.push(row);
                }
                row = [];
                for (const supporterTableContentCell of supporterTableElement.querySelector('.group-check-supporters-supporter').querySelectorAll('div')) {
                    if (supporterTableContentCell.textContent) {
                        row.push(supporterTableContentCell.textContent.trim());
                    }
                }
                if (row.length > 0) {
                    supporterTable.push(row);
                }
                const reformattedTable = parse2DTable(supporterTable);
                value = `${reformattedTable}`;
                if (fields.length > 0) {
                    fields.push({ name: title, value: value });
                }
            }
        }

        description += chatDescription;
        if (detailDescription) {
            if (description.trim() !== "") {
                description += "<hr>"
            }
            description += `\n${detailDescription}`;
        }

        return [{ title: titleDiv.textContent, description: description, fields: fields }];
    }

    async _isPFUCard(message) {
        const div = document.createElement('div');
        div.innerHTML = message.flavor;
        return (div.querySelector("header.title-desc") !== null);
    }

}