import { getDieEmoji, swapOrNot } from '../helpers/emojis/global.mjs';
import { MessageParser } from "./generic.mjs";

export class MessageParserCortexPrime extends MessageParser {

    constructor() {
        super();
        this._genericRolls = false;
    }

    async _getSystemSpecificCards(message) {
        if (this._isRollResultCard(message)) {
            return this._createRollResultEmbed(message);
        }
        return [];
    }

    _isRollResultCard(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;
        return doc.querySelector('.cortexprime.roll-result') !== null;
    }

    // Rolled dice carry their face count and result as data attributes rather than as text,
    // since the system renders die pips purely with CSS.
    _renderDie(dieElement) {
        const faces = Number(dieElement.getAttribute('data-die-rating'));
        const value = dieElement.getAttribute('data-value');
        const type = dieElement.getAttribute('data-type');
        const dieText = swapOrNot(`\`d${faces}: ${value}\``, getDieEmoji(faces, value));
        switch (type) {
            case 'chosen':
                return `**${dieText}**`;
            case 'effect':
                return `*${dieText}*`;
            case 'hitch':
                return `~~${dieText}~~`;
            default:
                return dieText;
        }
    }

    async _createRollResultEmbed(message) {
        const doc = document.createElement('div');
        doc.innerHTML = message.content;

        const title = message.flavor || "Cortex Prime Roll";
        let fields = [];

        // Dice pool composition, grouped by trait/asset/distinction source.
        const sources = doc.querySelectorAll('.source[data-source]');
        if (sources.length > 0) {
            let poolText = "";
            sources.forEach(source => {
                const sourceName = source.getAttribute('data-source');
                const tags = Array.from(source.querySelectorAll('.dice-tag')).map(tag => {
                    const label = tag.getAttribute('data-label');
                    const ratings = Array.from(tag.querySelectorAll('.die[data-die-rating]'))
                        .map(die => `d${die.getAttribute('data-die-rating')}`);
                    return label ? `${label} (${ratings.join(', ')})` : ratings.join(', ');
                }).filter(tag => tag.length > 0);
                if (tags.length > 0) {
                    poolText += `**${sourceName}:** ${tags.join(', ')}\n`;
                }
            });
            if (poolText) {
                fields.push({ name: "Dice Pool", value: poolText.trim(), inline: false });
            }
        }

        // Rolled dice: bold = chosen for the total, italic = effect die, strikethrough = hitch.
        const rolledDice = doc.querySelectorAll('.die[data-type]:not([data-type="die-rating"])');
        if (rolledDice.length > 0) {
            const rendered = Array.from(rolledDice).map(die => this._renderDie(die)).join(' ');
            fields.push({ name: "Rolled", value: rendered, inline: false });
        }

        const total = doc.querySelector('.section-primary-title-cpt')?.textContent.trim();
        if (total) {
            fields.push({ name: "Total", value: total, inline: true });
        }

        const effectDiceContainer = doc.querySelector('.effect-dice');
        if (effectDiceContainer) {
            const effectDiceText = Array.from(effectDiceContainer.querySelectorAll('.die'))
                .map(die => `d${die.getAttribute('data-die-rating')}`)
                .join(', ');
            if (effectDiceText) {
                fields.push({ name: "Effect Dice", value: effectDiceText, inline: true });
            }
        }

        return [{ title: title, fields: fields }];
    }

}
