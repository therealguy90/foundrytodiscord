import { MessageParser } from '../systemparsers/generic.mjs';
import { MessageParserPF2e } from '../systemparsers/pf2e.mjs';
import { MessageParserDnD5e } from '../systemparsers/dnd5e.mjs';
import { MessageParserPF1 } from '../systemparsers/pf1.mjs';
import { MessageParserProjectFU } from '../systemparsers/projectfu.mjs';
import { MessageParserCosmereRPG } from '../systemparsers/cosmere-rpg.mjs';
import { ThreadedChatConfig } from '../../src/forms/threadedchatconfig.mjs'
import { AutoPingConfig } from '../../src/forms/autopingconfig.mjs';
import { updateServerStatus } from './monitor/serverstatus.mjs';
import { localizeWithPrefix } from './localization.mjs';
let SYSTEM_ID;

export function initModuleSettings() {
    SYSTEM_ID = game.system.id;
    game.settings.register('foundrytodiscord', 'inviteURL', {
        name: game.i18n.localize("foundrytodiscord.settings.inviteURL.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.inviteURL.hint"),
        scope: "world",
        config: true,
        default: "http://",
        requiresReload: true,
        type: String
    });
    game.settings.register('foundrytodiscord', 'webHookURL', {
        name: game.i18n.localize("foundrytodiscord.settings.webHookURL.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.webHookURL.hint"),
        scope: "world",
        config: true,
        default: "",
        requiresReload: true,
        type: String
    });
    game.settings.register('foundrytodiscord', 'rollWebHookURL', {
        name: game.i18n.localize("foundrytodiscord.settings.rollWebHookURL.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.rollWebHookURL.hint"),
        scope: "world",
        config: true,
        default: "",
        requiresReload: true,
        type: String
    });
    game.settings.register('foundrytodiscord', 'threadedChatMap', {
        scope: "world",
        config: false,
        default: {},
        type: Object
    });
    game.settings.register('foundrytodiscord', 'autoPingMap', {
        scope: "world",
        config: false,
        default: {},
        type: Object
    });
    game.settings.register('foundrytodiscord', 'messageList', {
        // messageList is a list of the past 100 messages that have been sent to discord through Chat Mirroring.
        // It has a URL and a discord Message object for each entry with a key of the FoundryVTT message ID.
        // This allows for real-time tracking of messages.
        config: false,
        scope: "world",
        default: {},
        type: Object
    });
    game.settings.register('foundrytodiscord', 'clientMessageList', {
        // clientMessageList is a list of the past 100 messages that the client has sent to discord.
        // This has the same functionality as messageList, but is used only when there is no GM in the world to allow for PBP-style games.
        config: false,
        scope: "client",
        default: {},
        type: Object
    });
    game.settings.registerMenu('foundrytodiscord', 'threadedChatConfig', {
        name: game.i18n.localize("foundrytodiscord.threadedchat.title"),
        label: 'Edit Scene-Thread Map',
        hint: game.i18n.localize("foundrytodiscord.threadedchat.description"),
        scope: "world",
        icon: 'fas fa-cogs',
        type: ThreadedChatConfig,
        restricted: true
    });
    game.settings.registerMenu('foundrytodiscord', 'autoPingConfig', {
        name: game.i18n.localize("foundrytodiscord.autoping.title"),
        label: 'Edit Auto Ping Mapping',
        hint: game.i18n.localize("foundrytodiscord.autoping.description"),
        scope: "world",
        icon: 'fas fa-cogs',
        type: AutoPingConfig,
        restricted: true
    });
    game.settings.register('foundrytodiscord', 'serverStatusMessage', {
        name: game.i18n.localize("foundrytodiscord.settings.serverStatusMessage.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.serverStatusMessage.hint"),
        scope: "world",
        config: true,
        type: Boolean,
        requiresReload: true,
        default: false
    });
    if (getThisModuleSetting('serverStatusMessage')) {
        game.settings.register('foundrytodiscord', 'messageID', {
            name: game.i18n.localize("foundrytodiscord.settings.messageID.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.messageID.hint"),
            scope: "world",
            config: true,
            type: String,
            requiresReload: true,
            default: ""
        });
        game.settings.register('foundrytodiscord', 'showInvite', {
            name: game.i18n.localize("foundrytodiscord.settings.showInvite.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.showInvite.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            requiresReload: true,
            default: true
        });
    }
    game.settings.register('foundrytodiscord', 'userMonitor', {
        name: game.i18n.localize("foundrytodiscord.settings.userMonitor.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.userMonitor.hint"),
        scope: "world",
        config: true,
        requiresReload: true,
        type: Boolean,
        default: false
    });
    game.settings.register('foundrytodiscord', 'prettierEmojis', {
        name: game.i18n.localize("foundrytodiscord.settings.prettierEmojis.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.prettierEmojis.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'ignoreWhispers', {
        name: game.i18n.localize("foundrytodiscord.settings.ignoreWhispers.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.ignoreWhispers.hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'allowNoGM', {
        name: game.i18n.localize("foundrytodiscord.settings.allowNoGM.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.allowNoGM.hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'allowPlayerSend', {
        name: game.i18n.localize("foundrytodiscord.settings.allowPlayerSend.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.allowPlayerSend.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'notesWebHookURL', {
        name: game.i18n.localize("foundrytodiscord.settings.notesWebHookURL.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.notesWebHookURL.hint"),
        scope: "world",
        config: true,
        default: "",
        requiresReload: true,
        type: String
    })
    game.settings.register('foundrytodiscord', 'showDescription', {
        name: game.i18n.localize("foundrytodiscord.settings.showDescription.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.showDescription.hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'sendEmbeds', {
        name: game.i18n.localize("foundrytodiscord.settings.sendEmbeds.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.sendEmbeds.hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'showFormula', {
        name: game.i18n.localize("foundrytodiscord.settings.showFormula.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.showFormula.hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    if (game.modules.get("polyglot")?.active) {
        game.settings.register('foundrytodiscord', "enablePolyglot", {
            name: game.i18n.localize("foundrytodiscord.settings.enablePolyglot.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.enablePolyglot.hint"),
            scope: "world",
            config: true,
            default: true,
            type: Boolean
        });
        game.settings.register('foundrytodiscord', 'includeOnly', {
            name: game.i18n.localize("foundrytodiscord.settings.includeOnly.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.includeOnly.hint"),
            scope: "world",
            config: true,
            default: "",
            type: String
        });
        game.settings.register('foundrytodiscord', 'includeLanguage', {
            name: game.i18n.localize("foundrytodiscord.settings.includeLanguage.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.includeLanguage.hint"),
            scope: "world",
            config: true,
            default: false,
            type: Boolean
        });
        game.settings.register('foundrytodiscord', 'polyglotShowMode', {
            name: game.i18n.localize("foundrytodiscord.settings.polyglotShowMode.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.polyglotShowMode.hint"),
            scope: "world",
            config: true,
            default: "showOriginal",
            type: String,
            choices: {
                "showOriginal": game.i18n.localize("foundrytodiscord.settings.polyglotShowMode.choices.showOriginal"),
                "showIfOne": game.i18n.localize("foundrytodiscord.settings.polyglotShowMode.choices.showIfOne"),
                "showAll": game.i18n.localize("foundrytodiscord.settings.polyglotShowMode.choices.showAll")
            }
        });
    }
    if (game.modules.get("anonymous")?.active) {
        game.settings.register('foundrytodiscord', 'enableAnon', {
            name: game.i18n.localize("foundrytodiscord.settings.enableAnon.name"),
            hint: game.i18n.localize("foundrytodiscord.settings.enableAnon.hint"),
            scope: "world",
            config: true,
            default: true,
            type: Boolean
        });
    }
    game.settings.register('foundrytodiscord', 'forceShowNames', {
        name: game.i18n.localize("foundrytodiscord.settings.forceShowNames.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.forceShowNames.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'forceShowRolls', {
        name: game.i18n.localize("foundrytodiscord.settings.forceShowRolls.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.forceShowRolls.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    /*if (SYSTEM_ID === 'PLACEHOLDER') {
        game.settings.register('foundrytodiscord', 'experimentalFeatures', {
            name: "(PLACEHOLDER) Experimental Parser",
            hint: "If you're experiencing issues with the experimental message parser, turn this off.",
            scope: "world",
            config: true,
            default: true,
            requiresReload: true,
            type: Boolean
        });
    }*/
    game.settings.register('foundrytodiscord', 'autoUuidEmbed', {
        name: game.i18n.localize("foundrytodiscord.settings.autoUuidEmbed.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.autoUuidEmbed.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    })
    game.settings.register('foundrytodiscord', 'showAuthor', {
        name: game.i18n.localize("foundrytodiscord.settings.showAuthor.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.showAuthor.hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'disableDeletions', {
        name: game.i18n.localize("foundrytodiscord.settings.disableDeletions.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.disableDeletions.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'disableMessages', {
        name: game.i18n.localize("foundrytodiscord.settings.disableMessages.name"),
        hint: game.i18n.localize("foundrytodiscord.settings.disableMessages.hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });


    // Register hotkeys
    game.keybindings.register('foundrytodiscord', 'screenshotButton', {
        name: "Take a Screenshot",
        hint: "Screenshots the canvas that is visible to you, and allows you to send it to Discord.",
        editable: [
            {
                key: "Not Set"
            }
        ],
        onDown: async () => {
            canvas.app.render();
            let data = await canvas.app.renderer.extract.base64();
            const ip = new ImagePopout(data, {
                title: "Screen Capture",
            });
            ip.render(true);
        },
        onUp: () => { },
        restricted: !getThisModuleSetting('allowPlayerSend'),
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });

    game.keybindings.register('foundrytodiscord', 'serverStatusOffline', {
        name: "Set Server Status Offline",
        hint: "Sets the server status on your channel to Offline.",
        editable: [
            {
                key: "Not Set"
            }
        ],
        onDown: async () => {
            if (getThisModuleSetting('serverStatusMessage')) {
                if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
                    const response = await updateServerStatus(false);
                    if (response.ok) {
                        console.log(localizeWithPrefix("foundrytodiscord.logs.serverStateOffline"));
                        ChatMessage.create({ content: game.i18n.localize("foundrytodiscord.server.stateOfflineMessage"), speaker: { alias: "Foundry to Discord" }, whisper: [game.user.id] });
                    }
                    else {
                        console.error(localizeWithPrefix("foundrytodiscord.logs.errorEditingEmbed", { status: response.status, statusText: response.statusText }));
                    }
                }
            }
        },
        onUp: () => { },
        restricted: true,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL

    });

}

export function getThisModuleSetting(settingName) {
    try {
        return game.settings.get('foundrytodiscord', settingName);
    }
    catch (e) {
        return undefined;
    }
}

export function getSystemParser() {
    /* all message parsers MUST return a set of request params. The module queues each request param to be sent
    *  one by one to Discord to avoid rate limits.
    */
    switch (SYSTEM_ID) {
        case "pf2e":
            console.log(localizeWithPrefix("foundrytodiscord.logs.systemDetected", { systemId: "pf2e" }));
            return new MessageParserPF2e();
            break;
        case "dnd5e":
            console.log(localizeWithPrefix("foundrytodiscord.logs.systemDetected", { systemId: "dnd5e" }));
            return new MessageParserDnD5e();
            break;
        case "pf1":
            console.log(localizeWithPrefix("foundrytodiscord.logs.systemDetected", { systemId: "pf1" }));
            return new MessageParserPF1();
            break;
        case "projectfu":
            console.log(localizeWithPrefix("foundrytodiscord.logs.systemDetected", { systemId: "projectfu" }));
            return new MessageParserProjectFU();
            break;
        case "cosmere-rpg":
            console.log(localizeWithPrefix("foundrytodiscord.logs.systemDetected", { systemId: "cosmere-rpg" }));
            return new MessageParserCosmereRPG();
            break;
        default:
            console.log(localizeWithPrefix("foundrytodiscord.logs.systemNotSupported", { systemId: SYSTEM_ID }));
            return new MessageParser();
            break;
    }
}

export function anonEnabled() {
    return game.modules.get("anonymous")?.active && getThisModuleSetting('enableAnon');
}