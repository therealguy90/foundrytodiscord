import * as generic from './generic.mjs';

export function messageParserDnD5e(msg) {
    let constructedMessage = '';
    let hookEmbed = [];
    // isCard detects class ".chat-cards" and will work with most chat-cards.
    // Adding a parser for specific 5e system .chat-cards class should be processed here.
    // Note that this only parses chat-cards with rolls not present in the message object,
    // as isRoll is not perfect, and sometimes detects cards as rolls even when the rolls array is empty.
    // for chat-cards *with* rolls accompanying them, there should be a custom parser, or, since this is
    // system-specific, just edit this next part.
    if (generic.isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            hookEmbed = DnD5e_createCardEmbed(msg);
        }
    }
    else if (!msg.isRoll) {
        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * for PF2e and DnD5e, this would be actor.system.traits.languages.value
        * polyglotize() can be edited for other systems.
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
                    constructedMessage = generic.polyglotize(msg, listLanguages);
                }
            }
        }
        if (constructedMessage == '') {
            constructedMessage = msg.content;
        }
    }
    else {
        if (msg.flavor != null && msg.flavor.length > 0) {
            hookEmbed = DnD5e_createRollEmbed(msg);
        }
        else {
            hookEmbed = generic.createGenericRollEmbed(msg);
        }
    }

    if (hookEmbed != [] && hookEmbed.length > 0) {
        hookEmbed[0].description = DnD5e_reformatMessage(hookEmbed[0].description);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === hookEmbed[0].title) ? "" : msg.flavor;
        //use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        //sadly, the anonymous module does this right before the message is displayed in foundry, so we have to parse it here.
        if (game.modules.get("anonymous")?.active) {
            for (let i = 0; i < hookEmbed.length; i++) {
                hookEmbed[i] = generic.anonymizeEmbed(msg, hookEmbed[i]);
            }
        }
    }
    constructedMessage = DnD5e_reformatMessage(constructedMessage);
    if (constructedMessage !== "" || hookEmbed.length > 0) { //avoid sending empty messages
        return generic.getRequestParams(msg, constructedMessage, hookEmbed);
    }
    else {
        return false;
    }
}
// TODO: DnD5e card parser... DO NOT support midi mergecards if you want to keep your sanity
function DnD5e_createCardEmbed(message) {
    let card = message.content;
    const parser = new DOMParser();
    //replace horizontal line tags with paragraphs so they can be parsed later when DnD5e_reformatMessage is called
    card = card.replace(/<hr[^>]*>/g, "<p>-----------------------</p>");
    let regex = /<[^>]*>[^<]*\n[^<]*<\/[^>]*>/g; //html cleanup, removing unnecessary blank spaces and newlines
    card = card.replace(regex, (match) => match.replace(/\n/g, ''));
    let doc = parser.parseFromString(card, "text/html");
    // Find the <h3> element and extract its text content, since h3 works for most systems
    // if not, use the first line it finds. Not the cleanest solution.
    const h3Element = doc.querySelector("h3");
    let title;
    if (h3Element?.textContent) {
        title = h3Element.textContent.trim();
    }
    else {
        //Use first line of plaintext to title the embed instead
        const strippedContent = card.replace(/<[^>]+>/g, ' ').trim(); // Replace HTML tags with spaces
        const lines = strippedContent.split('\n'); // Split by newline characters
        title = lines[0].trim(); // Get the first line of plain text
        const regex = new RegExp('\\b' + title + '\\b', 'i');
        card = card.replace(regex, "");

    }
    let desc = "";
    let speakerActor = undefined;
    if (propertyExists(message, "speaker.actor")) {
        speakerActor = game.actors.get(message.speaker.actor);
    }

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
            let text = paragraph.outerHTML;
            desc += text + "\n\n";
        });
    }

    return [{ title: title, description: desc, footer: { text: generic.getCardFooter(card) } }];
}

function DnD5e_createRollEmbed(message) {
    // FUNCTION USED FOR "special" roll embeds
    // should be separate from chat-cards, which are done in DnD5e_createCardEmbed
    // THIS SHOULD RETURN AN OBJECT IN THIS FORMAT:
    //return [{ title: title, description: desc }];
}

function getThisModuleSetting(settingName) {
    return game.settings.get('foundrytodiscord', settingName);
}

function DnD5e_reformatMessage(text){
    let reformattedText = ""
    //First check if the text is formatted in HTML to use a different function
    //parse Localize first, since it will have html elements
    let regex = /@Localize\[(.*?)\]/g;
    reformattedText = text.replace(regex, (_, text) => generic.getLocalizedText(text));
    const isHtmlFormatted = /<[a-z][\s\S]*>/i.test(reformattedText);
    if (isHtmlFormatted) {
        reformattedText = generic.parseHTMLText(reformattedText);
        reformattedText = DnD5e_reformatMessage(reformattedText); //call this function again as a failsafe for @ tags
    }
    else {
        /*//replace UUIDs to be consistent with Foundry
        regex = /@UUID\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':baggage_claim: `$1`');

        //replace compendium links
        regex = /@Compendium\[[^\]]+\]\{([^}]+)\}/g;
        reformattedText = reformattedText.replace(regex, ':baggage_claim: `$1`');

        //replace UUID if custom name "{}" is not present (redundancy)
        regex = /@UUID\[(.*?)\]/g;
        reformattedText = reformattedText.replace(regex, (_, text) => getNameFromItem(text));

        //replace Checks
        regex = /@Check\[[^\]]+\]{([^}]+)}/g;
        reformattedText = reformattedText.replace(regex, ':game_die: `$1`');*/

        /*  FOR DND: USE SAME METHOD AS ABOVE FOR REPLACING @ TAGS, such as @Actor[]{}, etc.
        *   Not sure what 5e uses.
        */
    }

    return reformattedText;
}