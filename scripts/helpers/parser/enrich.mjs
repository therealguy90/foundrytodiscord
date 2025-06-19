export async function newEnrichedMessage(message, options = {}) {
    const enrichedMessage = message;
    enrichedMessage.content = await toHTML(enrichedMessage.content, options);
    return enrichedMessage;
}

export async function toHTML(content, options = {}) {
    const TextEditorImplementation = foundry.applications.ux.TextEditor.implementation || TextEditor; //v12 backwards compatibility, removed in v14
    return (await TextEditorImplementation.enrichHTML(content, options)).replaceAll("\n", "");
}