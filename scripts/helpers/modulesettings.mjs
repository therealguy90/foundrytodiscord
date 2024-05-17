import { MessageParser } from '../systemparsers/generic.mjs';
import { MessageParserPF2e } from '../systemparsers/pf2e.mjs';
import { MessageParserDnD5e } from '../systemparsers/dnd5e.mjs';
import { ThreadedChatConfig } from '../../src/forms/threadedchatconfig.mjs'
import { AutoPingConfig } from '../../src/forms/autopingconfig.mjs';
let SYSTEM_ID;

export function initModuleSettings() {
    SYSTEM_ID = game.system.id;
    game.settings.register('foundrytodiscord', 'inviteURL', {
        name: "Game Invite URL",
        hint: "This should be the internet invite URL for your game session. Make sure the domain is public! To test if your URL works, go to\n<https://yourinviteurl.example>/modules/foundrytodiscord/src/images/defaultavatar.png\n(excluding <>, of course). If you visit the link where this image is hosted, it should appear as the default FoundryVTT icon!",
        scope: "world",
        config: true,
        default: "http://",
        requiresReload: true,
        type: String
    });
    game.settings.register('foundrytodiscord', 'webHookURL', {
        name: "Webhook URL",
        hint: "This should be the Webhook's URL from the discord channel you want to send chat messages to. Leave it blank to have Foundry to Discord ignore regular chat messages.",
        scope: "world",
        config: true,
        default: "",
        requiresReload: true,
        type: String
    });
    game.settings.register('foundrytodiscord', 'rollWebHookURL', {
        name: "Roll Webhook URL",
        hint: "This is the webhook for wherever you want rolls to appear in discord. Leave it blank to have Foundry to Discord ignore rolls. You can set this as the same webhook URL as above.",
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
        name: 'Threaded Scenes',
        label: 'Edit Scene-Thread Map',
        hint: 'Split your scenes into separate Discord threads in your channel! Requires either or both webhook URLs to be set up.',
        scope: "world",
        icon: 'fas fa-cogs',
        type: ThreadedChatConfig,
        restricted: true
    });
    game.settings.registerMenu('foundrytodiscord', 'autoPingConfig', {
        name: 'Auto Ping User/Role',
        label: 'Edit Auto Ping Mapping',
        hint: 'Ping users when a keyword is mentioned in chat!',
        scope: "world",
        icon: 'fas fa-cogs',
        type: AutoPingConfig,
        restricted: true
    });
    game.settings.register('foundrytodiscord', 'serverStatusMessage', {
        name: "Enable Server Status Message",
        hint: "Toggle this on to enable your world to detect when your world is online. When the server is restarted, given that you have set up your Webhook link and invite URL, it will send instructions on how to set this up. Come back to this setting page after this setting has been turned on.",
        scope: "world",
        config: true,
        type: Boolean,
        requiresReload: true,
        default: false
    });
    if (getThisModuleSetting('serverStatusMessage')) {
        game.settings.register('foundrytodiscord', 'messageID', {
            name: "Server Status Message ID",
            hint: "The message ID of the message that will be edited when the module detects that your world is online or offline. Follow the instructions sent to the channel where you have set up your webhook. Leaving this blank will send a new instruction message to your webhook after a restart.",
            scope: "world",
            config: true,
            type: String,
            requiresReload: true,
            default: ""
        });
        game.settings.register('foundrytodiscord', 'showInvite', {
            name: "Show Invite Link",
            hint: "The server status message will include your world's public invite link when this is turned on.",
            scope: "world",
            config: true,
            type: Boolean,
            requiresReload: true,
            default: true
        });
    }
    game.settings.register('foundrytodiscord', 'userMonitor', {
        name: "Monitor user login/logout",
        hint: "Foundry to Discord will send a message to your webhook if a user connects or disconnects.",
        scope: "world",
        config: true,
        requiresReload: true,
        type: Boolean,
        default: false
    });
    game.settings.register('foundrytodiscord', 'prettierEmojis', {
        name: "Use External Emojis",
        hint: "Enhance your experience by allowing the module to use external emojis from other discord servers! Make sure that @everyone permissions in your channel/server are set to enable external emojis.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'ignoreWhispers', {
        name: "Ignore Whispers & Private Rolls",
        hint: "Turning this off will allow Foundry to Discord to detect whispers and private rolls, and send them to your webhook like any other message.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'allowNoGM', {
        name: "Allow Chat Mirroring without a GM",
        hint: "Foundry to Discord will mirror messages even when a GM is not in the world.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'allowPlayerSend', {
        name: "Enable \"Send to Discord\" for everyone",
        hint: "This will allow players to use the \"Send to Discord\" context menu option on chat messages, as well as the \"Send to Player Notes\" context menu option, if you have the \"Player Notes Webhook URL\" filled in.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'notesWebHookURL', {
        name: "Player Notes Webhook URL",
        hint: "This is the webhook for player notes, which is used when \"Send _ to Player Notes\" is clicked. (option does not appear in windows or context menus if this is not filled in)",
        scope: "world",
        config: true,
        default: "",
        requiresReload: true,
        type: String
    })
    game.settings.register('foundrytodiscord', 'showDescription', {
        name: "Show chat card descriptions",
        hint: "Disabling this means chat cards descriptions are no longer sent to discord, which could be useful if you don't want to log long spell descriptions, for example.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'sendEmbeds', {
        name: "Show chat card embeds",
        hint: "Disabling this means chat cards are no longer sent to discord. (Does not affect chat cards with rolls attached to them, such as with midi-qol)",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'showFormula', {
        name: "Show roll formulas where applicable",
        hint: "Enable roll formulas to be shown in roll embeds where applicable. This does not override the general rule of roll formula visibility, i.e. most rolls from the GM are generally still hidden if this is turned on, and GM roll formulas are only shown in midi-qol when GM roll detail hiding is set to \"None\".",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    if (game.modules.get("polyglot")?.active) {
        game.settings.register('foundrytodiscord', "enablePolyglot", {
            name: "(Polyglot) Enable language check",
            hint: "Turn this off to disable polyglot integration with Foundry to Discord.",
            scope: "world",
            config: true,
            default: true,
            type: Boolean
        });
        game.settings.register('foundrytodiscord', 'includeOnly', {
            name: "(Polyglot) Understand only these languages:",
            hint: "A comma-separated list of languages that you wish to ONLY be understood to be sent in Discord. Leave blank for normal Polyglot behavior.",
            scope: "world",
            config: true,
            default: "",
            type: String
        });
        game.settings.register('foundrytodiscord', 'includeLanguage', {
            name: "(Polyglot) Show language in message",
            hint: "Show the language of the message if the message is not in common language",
            scope: "world",
            config: true,
            default: false,
            type: Boolean
        });
        game.settings.register('foundrytodiscord', 'polyglotShowMode', {
            name: "(Polyglot) Show obfuscated message, original, or both",
            hint: "Omniglot language messages will not be obfuscated",
            scope: "world",
            config: true,
            default: "showOriginal",
            type: String,
            choices: {
                "showOriginal": "Obfuscate message only if none understand",
                "showIfOne": "Obfuscate, but show original in spoilers if one understands",
                "showAll": "Obfuscate, but show original in spoilers"
            }
        });
    }
    if (game.modules.get("anonymous")?.active) {
        game.settings.register('foundrytodiscord', 'enableAnon', {
            name: "(anonymous) Use Replacement Names",
            hint: "Use Anonymous in Discord messages, such as replacing names, removing them in descriptions and footers. Do not turn this off if you want to limit metagame information as usual.",
            scope: "world",
            config: true,
            default: true,
            type: Boolean
        });
    }
    game.settings.register('foundrytodiscord', 'forceShowNames', {
        name: "Force show names on Discord",
        hint: "Turn this on to show token names on Discord regardless of token name visibility. The default behavior is to show only token names if the name on the token is visible to players. This overrides Anonymous.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'forceShowRolls', {
        name: "Force show GM roll results, formulas, and breakdowns",
        hint: "The module will no longer attempt to hide all GM roll details. \"Show roll formulas where applicable\" still needs to be on to show formulas and roll breakdowns. This only affects public rolls, and no other metagame info.",
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
        name: "Auto-embed UUID Link Messages",
        hint: "Turn this on to automatically append an embed for an item description or journal if a message only contains UUID links, up to 10 item links and/or journal pages. If you send a ridiculously long journal, deleting the message containing the UUID link on Foundry will also remove the long embeds on Discord.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    })
    game.settings.register('foundrytodiscord', 'showAuthor', {
        name: "Show username on embeds",
        hint: "Include the Foundry username and avatar(if any) of the message sender in embeds.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'disableDeletions', {
        name: "Disable message deletions",
        hint: "If this is turned ON, deleted messages in Foundry won't be synced with your Discord webhook.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'disableMessages', {
        name: "Disable Chat Mirroring",
        hint: "This disables the detection of new chat messages. If you want to use Foundry to Discord purely as an API or use the Server Status Message ONLY, you can toggle this on.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
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
            console.log("foundrytodiscord | Game system detected as 'pf2e'.");
            return new MessageParserPF2e();
            break;
        case "dnd5e":
            console.log("foundrytodiscord | Game system detected as 'dnd5e'.");
            return new MessageParserDnD5e();
            break;
        default:
            console.log("foundrytodiscord | Game system not fully supported. Using 'generic' mode.");
            return new MessageParser();
            break;
    }
}

export function anonEnabled() {
    return game.modules.get("anonymous")?.active && getThisModuleSetting('enableAnon');
}