import { messageParserGeneric } from '../generic.mjs';
import { ThreadedChatConfig } from '../../src/forms/threadedchatconfig.mjs'
import { messageParserPF2e } from '../pf2e.mjs';
import { messageParserDnD5e } from '../dnd5e.mjs';
let SYSTEM_ID;

export function initModuleSettings(){
    SYSTEM_ID = game.system.id;
    game.settings.register('foundrytodiscord', 'mainUserId', {
        scope: "world",
        config: false,
        default: "",
        type: String
    });
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
        name: "Web Hook URL",
        hint: "This should be the Webhook's URL from the discord server you want to send chat messages to. Leave it blank to have foundrytodiscord ignore regular chat messages.",
        scope: "world",
        config: true,
        default: "",
        requiresReload: true,
        type: String
    });
    game.settings.register('foundrytodiscord', 'rollWebHookURL', {
        name: "Roll Web Hook URL",
        hint: "This is the webhook for wherever you want rolls to appear in discord. Leave it blank to have foundrytodiscord ignore rolls.",
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
    game.settings.register('foundrytodiscord', 'messageList', {
        // messageList is a list of the past 100 messages that have been sent to discord.
        // It has a URL and a discord Message object for each entry with a key of the FoundryVTT message ID.
        // This allows for real-time tracking of messages.
        config: false,
        scope: "world",
        default: {},
        type: Object,
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
    game.settings.register('foundrytodiscord', 'ignoreWhispers', {
        name: "Ignore Whispers & Private Rolls",
        hint: "If this is on, then it will ignore whispers and private rolls. If this is off, it will send them to Discord just like any other message.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'showDescription', {
        name: "Show chat card descriptions",
        hint: "Disabling this means chat cards descriptions are no longer sent to discord.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'sendEmbeds', {
        name: "Show chat card embeds",
        hint: "Disabling this means chat cards are no longer sent to discord.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    if (game.modules.get("polyglot")?.active) {
        game.settings.register('foundrytodiscord', "commonLanguages", {
            name: "(Polyglot) Override common languages: ",
            hint: "A list of languages that are \"common\" to your world. By default, this is \"common\", but this can be replaced by a list of language ids, separated by commas. Homebrew languages might use a different language id, such as 'hb_english'",
            scope: "world",
            config: true,
            default: "common",
            type: String
        });
        game.settings.register('foundrytodiscord', 'includeOnly', {
            name: "(Polyglot) Understand only these languages:",
            hint: "A list of languages that you wish to ONLY be understood to be sent in Discord, separated by commas. Leave blank for normal Polyglot behavior.",
            scope: "world",
            config: true,
            default: "",
            type: String
        });
    }
    /*if (SYSTEM_ID === '') {
        game.settings.register('foundrytodiscord', 'experimentalFeatures', {
            name: "() Experimental Parser",
            hint: "If you're experiencing issues with the experimental message parser, turn this off.",
            scope: "world",
            config: true,
            default: true,
            requiresReload: true,
            type: Boolean
        });
    }*/
    game.settings.register('foundrytodiscord', 'disableDeletions', {
        name: "Disable message deletions",
        hint: "If this is turned ON, deleted messages in Foundry won't be synced with your Discord webhook.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'disableMessages', {
        name: "Disable ALL messages",
        hint: "If you want to use Foundry to Discord purely as an API or use the Server Status Message ONLY, you can toggle this on. This disables the detection of new chat messages.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    /*all message parsers MUST return a set of request params. The module queues each request param to be sent
    *one by one to Discord to avoid rate limits.
    */
}

export function initMainGM() {
    const mainGM = game.users.get(getThisModuleSetting('mainUserId'));
    if (!mainGM || !mainGM.active) {
        if (!mainGM || !mainGM.active) {
            if (game.user.isGM) {
                game.settings.set('foundrytodiscord', 'mainUserId', game.user.id);
                console.log("foundrytodiscord | Main GM set to this client's user.");
            }
        }
    }
    return getThisModuleSetting('mainUserId');
}

export function getThisModuleSetting(settingName) {
    return game.settings.get('foundrytodiscord', settingName);
}

export function initParser(){
    switch (SYSTEM_ID) {
        case "pf2e":
            console.log("foundrytodiscord | Game system detected as 'pf2e'.");
            return messageParserPF2e;
            break;
        case "dnd5e":
            console.log("foundrytodiscord | Game system detected as 'dnd5e'.");
            return messageParserDnD5e;
            break;
        default:
            console.log("foundrytodiscord | Game system not fully supported. Using 'generic' mode.");
            return messageParserGeneric;
            break;
    }
}