/*import * as generic from './generic.mjs';
import { anonEnabled, getThisModuleSetting }  from './helpers/modulesettings.mjs';*/
//MOVE YOUR PARSER TO THE SCRIPTS FOLDER

/*  CUSTOM SYSTEM PARSER CREATION GUIDE:
*   Please hide metadata that should be hidden to players.
*
*   My programming style may not work for you. Notice how everything is done functionally.
*   If this is too complicated for you, shoot me a DM on Discord (@loki123) and we can talk about it.
*   If you use a different programming style for message parsing, I may not be able to maintain it when issues arise.
*   You can commission me on making a custom parser for other systems, or if many people request the system, 
*   I'll do it pretty much for free, given help and testers.
*
*   The format of a custom system parser is as follows:
*   1. a messageParserSystem(msg) (i.e. messageParserDnD5e) function
*       - requirements: must return generic.getRequestParams(msg, constructedMessage, embeds);
*           where msg is the ChatMessage passed to the parser, constructedMessage is the raw text content of the message,
*           and embeds is the list of (up to) 10 embeds.
*       - Add this parser to initParser in modulesettings.mjs.
*       - Do not worry about parsing HTML text in chat card parsers. Keep the raw HTML formatting until reformatMessage is called.
*         All HTML parsing is already handled, unless it's system-specific, in which case, 
*         it must be added to a custom parseHTMLText.
*       - If you want to format a table from text that isn't exactly a table, parse2DTable exists, which does most of the work.
*         HTML tables are already handled. Do not worry.
*         Simply provide parse2DTable with a 2D array of your custom table. 
*         First row of the array should be the table headers.
*       - Make sure your code abides with the module settings!
*
*   2. a System_reformatMessage (i.e. DnD5e_reformatMessage) function
*       - Custom @ tags and etc must be formatted here.
*       - Look at other parsers to find out how this works.
*/

export function messageParserSystem(msg){
    let constructedMessage = '';
    let embeds = [];
    //make detectors for custom system chatcards here, or embeds in general. See the other parsers to know how to do it.
    if (game.modules.get('monks-tokenbar')?.active && generic.tokenBar_isTokenBarCard(msg.content)) {
        embeds = generic.tokenBar_createTokenBarCard(msg);
    }
    else if (generic.isCard(msg.content) && msg.rolls?.length < 1) {
        constructedMessage = "";
        if (getThisModuleSetting('sendEmbeds')) {
            embeds = generic.createCardEmbed(msg); //Replace this with your own custom card parser if you like
        }
    }
    else if (!msg.isRoll) {
        if (generic.hasDiceRolls(msg.content)) {
            embeds = generic.createHTMLDiceRollEmbed(msg);
            const elements = document.createElement('div');
            elements.innerHTML = msg.content;
            const diceRolls = elements.querySelectorAll('.dice-roll');
            for (const div of diceRolls) {
                div.parentNode.removeChild(div);
            }
            msg.content = elements.innerHTML;
        }
        //Above snippet can be removed safely.

        /*Attempt polyglot support. This will ONLY work if the structure is similar:
        * for PF2e and DnD5e, this would be actor.system.traits.languages.value
        * polyglotize() can be edited for other systems. Make a new function in this file, copying polyglotize() from generic.mjs.
        */
        if (game.modules.get("polyglot")?.active && msg.flags?.polyglot?.language) {
            if (!getThisModuleSetting("commonLanguages").toLowerCase().includes(msg.flags.polyglot.language)) {
                if (getThisModuleSetting('includeOnly') === "") {
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
        // Custom roll parsers go here, just assign them to the embeds variable and/or constructedMessage.
        embeds = generic.createGenericRollEmbed(msg); // foundry /r command or other rolls not covered by your parser.
    }

    if (embeds != [] && embeds.length > 0) {
        embeds[0].description = System_reformatMessage(embeds[0].description);
        constructedMessage = (/<[a-z][\s\S]*>/i.test(msg.flavor) || msg.flavor === embeds[0].title) ? "" : msg.flavor;
        // use anonymous behavior and replace instances of the token/actor's name in titles and descriptions
        // sadly, the anonymous module doesn't do this as css styling, so this needs to be done here.
        if (anonEnabled()) {
            for (let i = 0; i < embeds.length; i++) {
                embeds[i] = generic.anonymizeEmbed(msg, embeds[i]);
            }
        }
    }
    constructedMessage = System_reformatMessage(constructedMessage);
    return generic.getRequestParams(msg, constructedMessage, embeds); //ALWAYS keep this as the return.
}


export function System_reformatMessage(text){
    let reformattedText = generic.reformatMessage(text/*, System_parseHTMLText*/);
    // Add more message reformatting here. For example, PF2e has @Damage[] and @Check[], 
    // so there's a custom reformatter for that.
    return reformattedText.trim();
}

/*
    // OPTIONAL: a System_parseHTMLText() function, for formatting system-specific HTML styling.
    // pass this to generic.reformatMessage(text, customHTMLParser)

function System_parseHTMLText(htmlString){
    // Do HTML parsing here. Here's a starter.
    let reformattedText = htmlString;
    const htmldoc = document.createElement('div');
    htmldoc.innerHTML = reformattedText;
    // Do edits to innerHTML here. Good luck with HTML parsing.


    reformattedText = htmldoc.innerHTML;
    // Note that this is merely an example. You can do whatever you want as long as you think it works.
    return reformattedText;
}
*/