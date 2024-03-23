import { MessageParser } from "./scripts/systemparsers/generic.mjs"; // Change this import.

export class MessageParserSystemID extends MessageParser{

    constructor(){
        super();
        this._polyglotPath = "system.traits.languages.value"; // Change this to fir  
        this._genericRolls = false;
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