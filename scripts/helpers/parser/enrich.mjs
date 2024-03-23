export async function newEnrichedMessage(message, options = {}) {
    const enrichedMessage = message;
    enrichedMessage.content = await toHTML(enrichedMessage.content, options);
    return enrichedMessage;
}

export async function toHTML(content, options = {}) {
    return (await TextEditor.enrichHTML(content, options)).replaceAll("\n", "");
}