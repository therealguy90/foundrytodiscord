import { messageParserGeneric } from './scripts/generic.mjs';
import { isCard } from './scripts/generic.mjs';
import { messageParserPF2e } from './scripts/pf2e.mjs';
import { ThreadedChatConfig } from './src/forms/threadedchatconfig.mjs';
let SYSTEM_ID;

Hooks.on("init", function () {
    SYSTEM_ID = game.system.id;
    game.settings.register('foundrytodiscord', 'mainUserId', {
        name: "Main GM ID",
        hint: "If you plan on having two GMs in one session, fill this in with the main GM's ID to avoid duplicated messages. Just type 'ftd getID' in chat to have your ID sent to your discord channel.",
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
    game.settings.registerMenu('foundrytodiscord', 'threadedChatConfig', {
        name: 'Threaded Scenes',
        label: 'Edit Scene-Thread Map',
        hint: 'Split your scenes into separate Discord threads in your channel! Requires either or both webhook URLs to be set up.',
        scope: "world",
        icon: 'fas fa-cogs',
        type: ThreadedChatConfig,
        restricted: true
    });
    game.settings.register('foundrytodiscord', 'threadedChatMap', {
        scope: "world",
        config: false,
        default: {},
        type: Object
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
    /*all message parsers MUST return a set of request params. The module queues each request param to be sent
    *one by one to Discord to avoid rate limits.
    */
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

Hooks.on('deleteScene', async scene => {
    const setting = getThisModuleSetting('threadedChatMap');
    if (setting.hasOwnProperty(scene.id)) {
        delete setting[scene.id];
        await game.settings.set('foundrytodiscord', 'threadedChatMap', setting);
    }
});

let requestQueue = [];
let isProcessing = false;

let messageParse;

Hooks.on("ready", function () {
    if (getThisModuleSetting('inviteURL') !== "" && !getThisModuleSetting('inviteURL').endsWith("/")) {
        game.settings.set('foundrytodiscord', 'inviteURL', getThisModuleSetting('inviteURL') + "/");
    }
    if (game.user.isGM) {
        initSystemStatus();
    }
    console.log("foundrytodiscord | Ready");
});

function initSystemStatus() {
    if (getThisModuleSetting('serverStatusMessage')) {
        if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
            let hook;
            if (getThisModuleSetting('webHookURL').split('?').length > 1) {
                const querysplit = getThisModuleSetting('webHookURL').split('?');
                hook = querysplit[0] + '/messages/' + getThisModuleSetting('messageID') + '?' + querysplit[1];
            } else {
                hook = getThisModuleSetting('webHookURL') + '/messages/' + getThisModuleSetting('messageID');
            }

            const params = {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    embeds: [{
                        title: 'Server Status: ' + game.world.name,
                        description: '**ONLINE**\n' + (getThisModuleSetting('showInvite') ? '**Invite Link: **' + getThisModuleSetting('inviteURL') : ''),
                        footer: {
                            text: 'Type "ftd serveroff" in Foundry to set your server status to OFFLINE. This will persist until the next world restart.\n\n' + (game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version)
                        },
                        color: 65280
                    }]
                })
            };

            console.log('foundrytodiscord | Attempting to edit server status...');
            fetch(hook, params)
                .then(response => {
                    if (response.status === 200 || response.status === 204) {
                        console.log('foundrytodiscord | Server state set to ONLINE');
                    } else {
                        console.error('foundrytodiscord | Error editing embed:', response.status, response.statusText);
                    }
                })
                .catch(error => {
                    console.error('foundrytodiscord | Fetch error:', error);
                });
        } else {
            const hook = getThisModuleSetting('webHookURL');
            if (hook && hook !== '') {
                const params = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: game.world.id,
                        avatar_url: getThisModuleSetting('inviteURL') + 'modules/foundrytodiscord/src/images/defaultavatar.png',
                        content: '',
                        embeds: [{
                            title: 'Server Status Setup Instructions',
                            description: `**IMPORTANT**: A limitation of this module is that it can *only* detect your world as online if a Gamemaster account is online. A command 'ftd serveroff' is also needed to set this message to OFFLINE.\n\n` +
                                `**Step 1:** Pin this message so that everyone can find it easily on your channel.\n` +
                                `**Step 2**: Right click on this message and click on **"Copy Message ID"**. Your Discord app must have **User Settings > Advanced > Developer Mode** turned **ON** for this to appear.\n` +
                                `**Step 3**: Go to **Configure Settings > Foundry to Discord > Server Status Message ID** and **paste** the copied ID from Step 2. Afterwards, save your settings, and it should prompt your world to restart.\n` +
                                `**Step 4**: Look at this message again after your world restarts. It should appear as the correct server status message.`,
                            footer: {
                                text: game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version
                            }
                        }]
                    })
                };

                console.log('foundrytodiscord | Attempting to send message to webhook...');
                fetch(hook, params)
                    .catch(error => {
                        console.error('foundrytodiscord | Fetch error:', error);
                    });
            }
        }
    }
}

function getThisModuleSetting(settingName) {
    return game.settings.get('foundrytodiscord', settingName);
}


Hooks.on('createChatMessage', (msg) => {
    if (msg.content == "ftd serveroff" && msg.user.isGM) {
        if (game.user.isGM && getThisModuleSetting('serverStatusMessage')) {
            if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
                let hook;
                if (getThisModuleSetting('webHookURL').split('?').length > 1) {
                    const querysplit = getThisModuleSetting('webHookURL').split('?');
                    hook = querysplit[0] + '/messages/' + getThisModuleSetting('messageID') + '?' + querysplit[1];
                } else {
                    hook = getThisModuleSetting('webHookURL') + '/messages/' + getThisModuleSetting('messageID');
                }

                const params = {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        embeds: [{
                            title: 'Server Status: ' + game.world.id,
                            description: '**OFFLINE**',
                            footer: {
                                text: game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version
                            },
                            color: 16711680
                        }]
                    })
                };

                console.log('foundrytodiscord | Attempting to edit server status...');
                fetch(hook, params)
                    .then(response => {
                        if (response.status === 200 || response.status === 204) {
                            console.log('foundrytodiscord | Server state set to OFFLINE');
                            ChatMessage.create({ content: 'Foundry to Discord | Server state set to OFFLINE.', whisper: [game.user.id] });
                            msg.delete();
                        } else {
                            console.error('foundrytodiscord | Error editing embed:', response.status, response.statusText);
                        }
                    })
                    .catch(error => {
                        console.error('foundrytodiscord | Fetch error:', error);
                    });
            }
        }
        return;
    }
    if (!game.user.isGM || (game.settings.get('foundrytodiscord', "ignoreWhispers") && msg.whisper.length > 0)) {
        return;
    }
    if (game.userId != game.settings.get('foundrytodiscord', "mainUserId") && game.settings.get('foundrytodiscord', "mainUserId") != "") {
        return;
    }
    if (msg.isRoll && (!isCard(msg.content) && msg.rolls.length > 0) && game.settings.get('foundrytodiscord', "rollWebHookURL") == "") {
        return;
    }
    if (!msg.isRoll && (isCard(msg.content) && msg.rolls.length < 1) && game.settings.get('foundrytodiscord', "webHookURL") == "") {
        return;
    }

    if (msg.content == "ftd getID" && msg.user.isGM) {
        const hook = getThisModuleSetting('webHookURL');

        const params = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: game.world.id,
                avatar_url: getThisModuleSetting('inviteURL') + 'modules/foundrytodiscord/src/images/defaultavatar.png',
                content: 'UserId: ' + game.userId,
                embeds: []
            })
        };

        fetch(hook, params)
            .then(response => {
                if (response.status === 200 || response.status === 204) {
                    console.log('foundrytodiscord | UserID sent to Discord.');
                    ChatMessage.create({ content: 'foundrytodiscord | UserID sent to Discord.', whisper: [game.userId] });
                    msg.delete();
                } else {
                    console.error('foundrytodiscord | Error sending UserID:', response.status, response.statusText);
                }
            })
            .catch(error => {
                console.error('foundrytodiscord | Fetch error:', error);
            });
    }

    
    let requestParams = messageParse(msg);

    if (requestParams) {
        let formData = new FormData()
        if (game.modules.get("chat-media")?.active) {
            const { formDataTemp, contentTemp } = getAttachments(formData, requestParams.params.content, msg.content);
            formData = formDataTemp;
            requestParams.params.content = contentTemp;
        }
        else if(requestParams.params.content === "" && requestParams.params.embeds === []){
            return;
        }
        formData.append('payload_json', JSON.stringify(requestParams.params));
        requestQueue.push({ hook: requestParams.hook, formData: formData });
        if (!isProcessing) {
            isProcessing = true;
            sendOnce();
        }
    }
});

async function sendOnce() {
    const { hook, formData } = requestQueue[0];

    const requestOptions = {
        method: 'POST',
        body: formData // Assuming params is a FormData object
    };

    console.log("foundrytodiscord | Attempting to send message to webhook...");
    try {
        const response = await fetch(hook, requestOptions);
        if (response.ok) {
            requestQueue.shift();
            if (requestQueue.length > 0) {
                sendOnce();
            } else {
                isProcessing = false;
            }
        } else if (response.status === 429) {
            const retryAfter = Number(response.headers.get("Retry-After")) || 1;
            console.log("foundrytodiscord | Rate Limit exceeded! Next request in " + retryAfter / 100 + " seconds.");
            await wait(retryAfter * 10);
            if (requestQueue.length > 0) {
                sendOnce();
            } else {
                isProcessing = false;
            }
        }
    } catch (error) {
        console.error('foundrytodiscord | Fetch error:', error);
        if (requestQueue.length > 0) {
            sendOnce();
        } else {
            isProcessing = false;
        }
    }
}

function getAttachments(formData, msgText, content) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(content, "text/html");
    let mediaDivs = doc.querySelectorAll('.chat-media-image');
    let filecount = 0;
    if (mediaDivs.length > 0) {
        mediaDivs.forEach((div) => {
            const imgElement = div.querySelector('img');
            const videoElement = div.querySelector('video');
            
            if (imgElement) {
                const dataSrc = imgElement.getAttribute('data-src');
                const altText = imgElement.getAttribute('alt');
                
                if (dataSrc) {
                    if (dataSrc.startsWith("data")) {
                        const byteCharacters = atob(dataSrc.split(',')[1]);
                        const byteArrays = [];
                        for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
                            const slice = byteCharacters.slice(offset, offset + 1024);
                            const byteNumbers = new Array(slice.length);
                            for (let i = 0; i < slice.length; i++) {
                                byteNumbers[i] = slice.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            byteArrays.push(byteArray);
                        }
                        const parts = dataSrc.split(',');
                        let mimeType;
                        if (parts.length > 0) {
                            // Get the part before the semicolon in the first segment
                            const mimeTypeSegment = parts[0].split(';')[0];

                            // Extract the actual MIME type
                            mimeType = mimeTypeSegment.split(':')[1];
                        }
                        const blob = new Blob(byteArrays, { type: mimeType });
                        formData.append('files[' + filecount + ']', blob, altText);
                        filecount++;
                    }
                    else if (dataSrc.includes('http')) {
                        if (msgText !== "") {
                            msgText += "\n";
                        }
                        msgText += dataSrc;
                    }
                }
            }
            
            if (videoElement) {
                const dataSrc = videoElement.getAttribute('data-src');
                
                if (dataSrc) {
                     if (dataSrc.includes('http')) {
                        if (msgText !== "") {
                            msgText += "\n";
                        }
                        msgText += dataSrc;
                    }
                }
            }
        });
    }
    return { formDataTemp: formData, contentTemp: msgText };
}

/*function getAttachments(formData, msgText, content) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(content, "text/html");
    let mediaDivs = doc.querySelectorAll('.chat-media-image');
    let filecount = 0;
    if (mediaDivs.length > 0) {
        mediaDivs.forEach((div) => {
            const imgElement = div.querySelector('img');
            const dataSrc = imgElement.getAttribute('data-src');
            const altText = imgElement.getAttribute('alt');
            if (dataSrc) {
                if (dataSrc.startsWith("data")) {
                    const byteCharacters = atob(dataSrc.split(',')[1]);
                    const byteArrays = [];
                    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
                        const slice = byteCharacters.slice(offset, offset + 1024);
                        const byteNumbers = new Array(slice.length);
                        for (let i = 0; i < slice.length; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        byteArrays.push(byteArray);
                    }
                    const parts = dataSrc.split(',');
                    let mimeType;
                    if (parts.length > 0) {
                        // Get the part before the semicolon in the first segment
                        const mimeTypeSegment = parts[0].split(';')[0];

                        // Extract the actual MIME type
                        mimeType = mimeTypeSegment.split(':')[1];
                    }
                    const blob = new Blob(byteArrays, { type: mimeType });
                    formData.append('files[' + filecount + ']', blob, altText);
                    filecount++;
                }
                else if(dataSrc.includes('http')){
                    if(content !== ""){
                        content += "\n"
                    }
                    content += dataSrc;
                }
            }
        });
    }
    return { formDataTemp: formData, contentTemp: msgText };
}*/

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}