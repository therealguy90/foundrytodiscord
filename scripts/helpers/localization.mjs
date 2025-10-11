//helper function for localization, mostly for logging messages
export function localizeWithPrefix(key, data = {}, withPrefix = null) {
    if (withPrefix === null) {
        withPrefix = key.includes('.logs.') || key.includes('.server.');
    }
    
    let localizedText;
    if (Object.keys(data).length > 0) {
        localizedText = game.i18n.format(key, data);
    } else {
        localizedText = game.i18n.localize(key);
    }
    
    if (withPrefix) {
        const modulePrefix = game.i18n.localize("foundrytodiscord.modulePrefix");
        return `${modulePrefix} | ${localizedText}`;
    }
    return localizedText;
}