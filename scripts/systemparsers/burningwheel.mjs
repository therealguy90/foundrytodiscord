import { getDieEmoji, swapOrNot } from '../helpers/emojis/global.mjs';
import { MessageParser } from "./generic.mjs";

export class MessageParserBurningWheel extends MessageParser {

    constructor() {
        super();
        this._genericRolls = false;
    }

    async _getSystemSpecificCards(message) {
        switch (true) {
            case this._isRollMessage(message):
                return this._createRollEmbed(message);
            case this._isRerollMessage(message):
                return this._createRerollEmbed(message);
            case this._isBroadcastMessage(message):
                return this._createBroadcastEmbed(message);
        }
        return [];
    }

    _isRollMessage(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        return doc.querySelector('.roll-with-buttons') !== null;
    }

    _isRerollMessage(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        return doc.querySelector('.roll-with-buttons') === null && doc.querySelector('.roll-dice') !== null;
    }

    _isBroadcastMessage(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        return doc.querySelector('.roll-dice') === null && doc.querySelector('.message-title') !== null;
    }

    // A '.roll-dice' container holds one or two pools of '.roll-die' elements separated by a
    // '.vertical-divider' (e.g. base pool vs. wild dice, or kept dice vs. newly rerolled dice).
    _renderDicePools(diceContainer) {
        const pools = [[]];
        for (const child of diceContainer.children) {
            if (child.classList.contains('vertical-divider')) {
                pools.push([]);
                continue;
            }
            if (!child.classList.contains('roll-die')) {
                continue;
            }
            const result = child.textContent.trim();
            const success = child.getAttribute('data-success') === 'true';
            const dieText = swapOrNot(result, getDieEmoji(6, result));
            pools[pools.length - 1].push(success ? `**${dieText}**` : `~~${dieText}~~`);
        }
        return pools.map(pool => pool.join(' ')).filter(pool => pool.length > 0).join('  |  ');
    }

    _renderResultBanner(doc) {
        const resultElement = doc.querySelector('.roll-result');
        if (!resultElement) {
            return "";
        }
        const success = resultElement.classList.contains('roll-success');
        return `${success ? ':white_check_mark:' : ':x:'} ${resultElement.textContent.trim()}`;
    }

    async _createRollEmbed(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;

        const title = doc.querySelector('.message-title')?.textContent.trim() || message.flavor || "Roll";

        let description = "";
        const summaryLines = Array.from(doc.querySelectorAll('.roll-half-width'))
            .map(block => block.textContent.replace(/\s+/g, ' ').trim())
            .filter(text => text.length > 0);
        if (summaryLines.length > 0) {
            description += `${summaryLines.join('\n')}\n\n`;
        }

        const diceContainer = doc.querySelector('.roll-dice');
        if (diceContainer) {
            description += `${this._renderDicePools(diceContainer)}\n\n`;
        }

        const banner = this._renderResultBanner(doc);
        if (banner) {
            description += `${banner}\n`;
        }

        const extraInfo = doc.querySelector('.roll-extra-info');
        if (extraInfo) {
            description += `\n${extraInfo.innerHTML.trim()}`;
        }

        return [{ title: title, description: description.trim() }];
    }

    async _createRerollEmbed(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        const title = doc.querySelector('.message-title')?.textContent.trim() || message.flavor || "Reroll";

        let description = "";
        doc.querySelectorAll('.roll-dice').forEach(container => {
            description += `${this._renderDicePools(container)}\n\n`;
        });

        const banner = this._renderResultBanner(doc);
        if (banner) {
            description += `${banner}\n\n`;
        }

        const secondaryPool = doc.querySelector('.secondary-pool');
        if (secondaryPool) {
            const label = secondaryPool.previousElementSibling?.textContent.trim() || "Secondary Pool";
            description += `**${label}:** ${secondaryPool.textContent.trim()}\n`;
        }

        return [{ title: title, description: description.trim() }];
    }

    async _createBroadcastEmbed(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        const title = doc.querySelector('.message-title')?.textContent.trim() || message.flavor || "";
        const mainText = doc.querySelector('.whitespace-pre')?.innerHTML.trim() || "";

        let description = mainText;
        const extraTitles = doc.querySelectorAll('.roll-title');
        const extraTexts = doc.querySelectorAll('.roll-extra-info');
        for (let i = 0; i < Math.max(extraTitles.length, extraTexts.length); i++) {
            if (extraTitles[i]) {
                description += `\n\n**${extraTitles[i].innerHTML.trim()}**`;
            }
            if (extraTexts[i]) {
                description += `\n${extraTexts[i].innerHTML.trim()}`;
            }
        }

        return [{ title: title, description: description.trim() }];
    }

}
