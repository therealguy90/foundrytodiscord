import { messageParserGeneric } from './scripts/generic.mjs';
import { isCard } from './scripts/generic.mjs';
import { messageParserPF2e } from './scripts/pf2e.mjs';
let SYSTEM_ID;
Hooks.on("init", function () {
    SYSTEM_ID = game.system.id;
    console.log("foundrytodiscord | it's fucking loading");
    game.settings.register('foundrytodiscord', 'mainUserId', {
        name: "Main GM ID",
        hint: "If you plan on having two GMs in one session, fill this in with the main DM's ID to avoid duplicated messages. Just type 'ftd getID' in chat to have your ID sent to your discord channel.",
        scope: "world",
        config: true,
        default: "",
        type: String
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
    game.settings.register('foundrytodiscord', "sendEmbeds", {
        name: "Show chat card embeds",
        hint: "Disabling this means chat cards are no longer sent to discord.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'inviteURL', {
        name: "Game Invite URL",
        hint: "This should be the internet invite URL for your game session. Make sure the domain is public! To test if your URL works, go to\n<https://yourinviteurl.example>/modules/foundrytodiscord/src/defaultavatar.png\n(excluding <>, of course). If you visit the link where this image is hosted, it should appear as the default FoundryVTT icon!",
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
    switch (SYSTEM_ID) {
        case "pf2e":
            console.log("foundrytodiscord | Game system detected as 'pf2e'.");
            messageParse = messageParserPF2e;
            break;
        default:
            console.log("foundrytodiscord | Game system not fully supported. Using 'generic' mode.");
            messageParse = messageParserGeneric;
            break;
    }
});

let hookQueue = [];
let isProcessing = false;
let rateLimitDelay;
let request = new XMLHttpRequest();
let messageParse;

Hooks.on("init", function () {
    game.settings.register('foundrytodiscord', 'mainUserId', {
        name: "Main GM ID",
        hint: "If you plan on having two GMs in one session, fill this in with the main DM's ID to avoid duplicated messages. Just type 'ftd getID' in chat to have your ID sent to your discord channel.",
        scope: "world",
        config: true,
        default: "",
        type: String
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
    game.settings.register('foundrytodiscord', "sendEmbeds", {
        name: "Show chat card embeds",
        hint: "Disabling this means chat cards are no longer sent to discord.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register('foundrytodiscord', 'inviteURL', {
        name: "Game Invite URL",
        hint: "This should be the internet invite URL for your game session. Make sure the domain is public! To test if your URL works, go to\n<https://yourinviteurl.example>/modules/foundrytodiscord/src/defaultavatar.png\n(excluding <>, of course). If you visit the link where this image is hosted, it should appear as the default FoundryVTT icon!",
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
    switch (SYSTEM_ID) {
        case "pf2e":
            //messageParse = messageParserPF2e;
            break;
        default:
            //messageParse = messageParserGeneric;
            break;
    }
});

Hooks.on("ready", function () {
    if (getThisModuleSetting('inviteURL') !== "" && !getThisModuleSetting('inviteURL').endsWith("/")) {
        game.settings.set('foundrytodiscord', 'inviteURL', getThisModuleSetting('inviteURL') + "/");
    }
    rateLimitDelay = 0;
    request.onreadystatechange = rateLimitDetect;
    initSystemStatus();
    console.log("foundrytodiscord | Ready");
});

function initSystemStatus() {
    if (game.user.isGM && getThisModuleSetting('serverStatusMessage')) {
        if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
            const hook = game.settings.get("foundrytodiscord", "webHookURL") + "/messages/" + getThisModuleSetting('messageID');
            request.open('PATCH', hook);
            request.setRequestHeader('Content-Type', 'application/json');
            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        console.log('foundrytodiscord | Server state set to ONLINE');
                    } else {
                        console.error('foundrytodiscord | Error editing embed:', request.status, request.responseText);
                    }
                    request.onreadystatechange = rateLimitDetect;
                };
            }
        };

        const params = {
            embeds: [{
                title: "Server Status: " + game.world.name,
                description: "**ONLINE**\n" + (getThisModuleSetting('showInvite') ? "**Invite Link: **" + game.settings.get("foundrytodiscord", "inviteURL") : ""),
                footer: {
                    text: "Type \"ftd serveroff\" in Foundry to set your server status to OFFLINE. This will persist until the next server restart.\n\n" + (game.modules.get("foundrytodiscord").id + " v" + game.modules.get("foundrytodiscord").version),
                },
                color: 65280
            }]
        }

        console.log("foundrytodiscord | Attempting to edit server status...");
        request.send(JSON.stringify(params));
    }
    else {
        const hook = game.settings.get("foundrytodiscord", "webHookURL");
        if (hook && hook !== "") {
            request.open('POST', hook);
            request.setRequestHeader('Content-type', 'application/json');
            const desc = "**IMPORTANT**: A limitation of this module is that it can *only* detect your world as online if a Gamemaster account is online.\n\n" +
                "**Step 1:** Pin this message so that everyone can find it easily on your channel.\n" +
                "**Step 2**: Right click on this message and click on **\"Copy Message ID\"**. Your Discord app must have **User Settings > Advanced > Developer Mode** turned **ON** for this to appear.\n" +
                "**Step 3**: Go to **Configure Settings > Foundry to Discord > Server Status Message ID** and **paste** the copied ID from Step 2. Afterwards, save your settings, and it should prompt your world to restart.\n" +
                "**Step 4**: Look at this message again after your world restarts. It should appear as the correct server status message.";
            let hookEmbed = [{ title: "Server Status Setup Instructions", description: desc, footer: { text: (game.modules.get("foundrytodiscord").id + " v" + game.modules.get("foundrytodiscord").version) } }];
            const params = {
                username: game.world.id,
                avatar_url: game.settings.get("foundrytodiscord", "inviteURL") + "modules/foundrytodiscord/src/defaultavatar.png",
                content: "",
                embeds: hookEmbed
            };
            console.log("foundrytodiscord | Attempting to send message to webhook...");
            request.send(JSON.stringify(params));
        }
    }
}

function getThisModuleSetting(settingName) {
    return game.settings.get('foundrytodiscord', settingName);
}

function rateLimitDetect() {
    if (this.readyState == 4) {
        if (Number(this.getResponseHeader("x-ratelimit-remaining")) == 1 || Number(this.getResponseHeader("x-ratelimit-remaining")) == 0) {
            console.log("foundrytodiscord | Rate Limit reached! Next request in " + (Number(this.getResponseHeader("x-ratelimit-reset-after")) + 1) + " seconds.");
            rateLimitDelay = (Number(this.getResponseHeader("x-ratelimit-reset-after")) + 1) * 1000;
        }
    }
}


Hooks.on('createChatMessage', (msg, userId) => {
    console.log(msg);
    if (!game.user.isGM || (game.settings.get("foundrytodiscord", "ignoreWhispers") && msg.whisper.length > 0)) {
        return;
    }
    if (game.userId != game.settings.get("foundrytodiscord", "mainUserId") && game.settings.get("foundrytodiscord", "mainUserId") != "") {
        return;
    }
    if (msg.isRoll && (!isCard(msg.content) && msg.rolls.length > 0) && game.settings.get("foundrytodiscord", "rollWebHookURL") == "") {
        return;
    }
    if (!msg.isRoll && (isCard(msg.content) && msg.rolls.length < 1) && game.settings.get("foundrytodiscord", "webHookURL") == "") {
        return;
    }

    if (msg.content == "ftd getID" && msg.user.isGM) {
        sendMessage(msg, "UserId: " + userId, hookEmbed);
        return;
    }
    if (msg.content == "ftd serveroff") {
        if (msg.user.isGM) {
            if (game.user.isGM && game.settings.get('foundrytodiscord', 'serverStatusMessage')) {
                if (game.settings.get('foundrytodiscord', 'messageID') && game.settings.get('foundrytodiscord', 'messageID') !== "") {
                    const hook = game.settings.get("foundrytodiscord", "webHookURL") + "/messages/" + game.settings.get('foundrytodiscord', 'messageID');
                    request.open('PATCH', hook);
                    request.setRequestHeader('Content-Type', 'application/json');
                    request.onreadystatechange = function () {
                        if (request.readyState === 4) {
                            if (request.status === 200) {
                                console.log('foundrytodiscord | Server state set to OFFLINE');
                            } else {
                                console.error('foundrytodiscord | Error editing embed:', request.status, request.responseText);
                            }
                            request.onreadystatechange = rateLimitDetect;
                        }
                    };

                    const params = {
                        embeds: [{
                            title: "Server Status: " + game.world.id,
                            description: "**OFFLINE**",
                            footer: {
                                text: (game.modules.get("foundrytodiscord").id + " v" + game.modules.get("foundrytodiscord").version)
                            },
                            color: 16711680
                        }]
                    }

                    console.log("foundrytodiscord | Attempting to edit server status...");
                    request.send(JSON.stringify(params));
                }
            }
        }
        return;
    }
    hookQueue.push({ msg });
    if (!isProcessing) {
        isProcessing = true;
        processHookQueue();
    }
    else {
        console.log("foundrytodiscord | Queue is currently busy.")
    }
});

function processHookQueue() {
    while (hookQueue.length > 0) {
        const { msg } = hookQueue.shift();
        setTimeout( function () {
            messageParse(msg);
            rateLimitDelay = 0;
        }, rateLimitDelay + 1000);
    }
    isProcessing = false;
}
