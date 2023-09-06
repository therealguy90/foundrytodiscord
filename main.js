import { isCard } from './scripts/generic.mjs';
import { getDefaultAvatarLink } from './scripts/generic.mjs';
import { initModuleSettings } from './scripts/helpers/modulesettings.mjs';
import { initMainGM } from './scripts/helpers/modulesettings.mjs';
import { getThisModuleSetting } from './scripts/helpers/modulesettings.mjs';
import { initParser } from './scripts/helpers/modulesettings.mjs';

let messageParse;
Hooks.once("init", function () {
    initModuleSettings();
    messageParse = initParser();
    game.modules.get('foundrytodiscord').api = {
        sendMessage,
        editMessage,
        deleteMessage,
        generateSendFormData
    };
});

Hooks.on('userConnected', async (user, connected) => {
    if (connected) {
        //Search for main GM
        const mainGM = game.users.get(getThisModuleSetting('mainUserId'));
        if (mainGM && mainGM.active) {
            // If there is already an online main GM
            return;
        }
        else {
            // If the main GM doesn't exist, the connecting GM becomes the main GM
            if (user.isGM) {
                game.settings.set('foundrytodiscord', 'mainUserId', user.id);
            }
        }
    }
    else {
        // If the main GM disconnects, reassign a new GM from the list
        if (user.isGM && user.id === getThisModuleSetting('mainUserId')) {
            // Get a list of all GMs currently active
            const gmList = game.users.filter(user => user.isGM && user.active)
            if (gmList.length > 0) {
                game.settings.set('foundrytodiscord', 'mainUserId', gmList[0].id);
            }
            else {
                // If no GMs exist, force search of a new GM when one does reconnect.
                game.settings.set('foundrytodiscord', 'mainUserId', "");
            }
        }
    }
});

Hooks.on('deleteScene', async scene => {
    const setting = getThisModuleSetting('threadedChatMap');
    if (setting.hasOwnProperty(scene.id)) {
        delete setting[scene.id];
        await game.settings.set('foundrytodiscord', 'threadedChatMap', setting);
    }
});

Hooks.on('closeApplication', (app) => {
    // Avoid removing discord messages when chat log is flushed
    try {
        if (app.data.title === "Flush Chat Log" && game.user.isGM) {
            flushLog = true;
        }
    } catch (error) {

    }
});

let requestQueue = [];
let isProcessing = false;
let flushLog = false;


Hooks.once("ready", function () {
    // Search for main GM
    initMainGM();
    if (getThisModuleSetting('inviteURL') !== "" && !getThisModuleSetting('inviteURL').endsWith("/")) {
        game.settings.set('foundrytodiscord', 'inviteURL', getThisModuleSetting('inviteURL') + "/");
    }
    if (game.user.isGM) {
        initSystemStatus();
    }
    console.log("foundrytodiscord | Ready");
});

async function initSystemStatus() {
    if (getThisModuleSetting('serverStatusMessage')) {
        if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
            const editedMessage = new FormData()
            const body = JSON.stringify({
                embeds: [{
                    title: 'Server Status: ' + game.world.id,
                    description: '**ONLINE**\n' + (getThisModuleSetting('showInvite') ? '**Invite Link: **' + getThisModuleSetting('inviteURL') : ''),
                    footer: {
                        text: 'Type "ftd serveroff" in Foundry to set your server status to OFFLINE. This will persist until the next world restart.\n\n' + (game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version)
                    },
                    color: 65280
                }]
            });
            editedMessage.append('payload_json', body)

            console.log('foundrytodiscord | Attempting to edit server status...');
            const response = await editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
            if (response.ok) {
                console.log('foundrytodiscord | Server state set to ONLINE');
            }
            else {
                console.error('foundrytodiscord | Error editing embed:', response.status, response.statusText);
            }
        } else {
            const hook = getThisModuleSetting('webHookURL');
            if (hook && hook !== '') {
                const formData = new FormData();
                formData.append("payload_json", JSON.stringify({
                    username: game.world.id,
                    avatar_url: getDefaultAvatarLink(),
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
                }));
                await sendMessage(formData);
            }
        }
    }
}

Hooks.on('createChatMessage', async (msg) => {
    flushLog = false;
    if (msg.content == "ftd serveroff" && msg.user.isGM) {
        if (game.user.isGM && getThisModuleSetting('serverStatusMessage')) {
            if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
                const editedMessage = new FormData()
                const body = JSON.stringify({
                    embeds: [{
                        title: 'Server Status: ' + game.world.id,
                        description: '**OFFLINE**',
                        footer: {
                            text: game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version
                        },
                        color: 16711680
                    }]
                });

                editedMessage.append('payload_json', body);

                console.log('foundrytodiscord | Attempting to edit server status...');
                const response = await editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
                if (response.ok) {
                    console.log('foundrytodiscord | Server state set to OFFLINE');
                    ChatMessage.create({ content: 'Foundry to Discord | Server state set to OFFLINE.', whisper: [game.user.id] });
                    msg.delete();
                }
                else {
                    console.error('foundrytodiscord | Error editing embed:', response.status, response.statusText);
                }
            }
        }
        return;
    }
    else if (!getThisModuleSetting('disableMessages')) {
        if (!game.user.isGM || (getThisModuleSetting("ignoreWhispers") && msg.whisper.length > 0)) {
            return;
        }
        if (game.userId !== getThisModuleSetting("mainUserId") && getThisModuleSetting("mainUserId") !== "") {
            console.log("foundrytodiscord | The current client's user does not match the main GM.");
            initMainGM();
            if (game.user.id !== getThisModuleSetting("mainUserId")) {
                return;
            }
        }
        if (msg.isRoll && (!isCard(msg.content) && msg.rolls.length > 0) && getThisModuleSetting("rollWebHookURL") == "") {
            return;
        }
        if (!msg.isRoll && (isCard(msg.content) && msg.rolls.length < 1) && getThisModuleSetting("webHookURL") == "") {
            return;
        }

        let requestParams = messageParse(msg);
        if (requestParams) {
            let formData = new FormData()
            if (game.modules.get("chat-media")?.active || game.modules.get("chatgifs")?.active) {
                const { formDataTemp, contentTemp } = getChatMediaAttachments(formData, requestParams.params.content, msg.content);
                formData = formDataTemp;
                requestParams.params.content = contentTemp;
            }
            else if (requestParams.params.content === "" && requestParams.params.embeds === []) {
                return;
            }
            let waitHook;
            if (requestParams.hook.includes("?")) {
                waitHook = requestParams.hook + "&wait=true";
            }
            else {
                waitHook = requestParams.hook + "?wait=true";
            }
            formData.append('payload_json', JSON.stringify(requestParams.params));
            requestQueue.push({ hook: waitHook, formData: formData, msgID: msg.id, method: 'POST' });
            if (!isProcessing) {
                isProcessing = true;
                requestOnce();
            }
        }
    }
});

Hooks.on('updateChatMessage', async (msg) => {
    let tries = 10; // Number of tries before giving up
    const checkExist = async () => {
        if (!getThisModuleSetting('messageList')[msg.id]) {
            if (tries > 0) {
                tries--;
                await wait(500);
                await checkExist(); // Recursively retry
            } else {
                console.log('foundrytodiscord | Attempt to edit message was unsuccessful due to the message not existing on Discord.');
            }
        } else {
            let requestParams = messageParse(msg);
            if (requestParams) {
                let editParamsOnly = {
                    content: requestParams.params.content,
                    embeds: requestParams.params.embeds
                }
                let formData = new FormData()
                if (game.modules.get("chat-media")?.active) {
                    const { formDataTemp, contentTemp } = getChatMediaAttachments(formData, editParamsOnly.content, msg.content);
                    formData = formDataTemp;
                    editParamsOnly.content = contentTemp;
                }
                else if (editParamsOnly.content === "" && editParamsOnly.embeds === []) {
                    return;
                }
                let editHook;
                let { url, message } = getThisModuleSetting('messageList')[msg.id];
                if (url.split('?').length > 1) {
                    const querysplit = url.split('?');
                    editHook = querysplit[0] + '/messages/' + message.id + '?' + querysplit[1];
                } else {
                    editHook = url + '/messages/' + message.id;
                }
                formData.append('payload_json', JSON.stringify(editParamsOnly));
                requestQueue.push({ hook: editHook, formData: formData, msgID: msg.id, method: 'PATCH' });
                if (!isProcessing) {
                    isProcessing = true;
                    requestOnce();
                }
            }

        }
    };

    flushLog = false;
    if (!game.user.isGM || (getThisModuleSetting("ignoreWhispers") && msg.whisper.length > 0)) {
        return;
    }
    if (game.userId !== getThisModuleSetting("mainUserId") && getThisModuleSetting("mainUserId") !== "") {
        initMainGM();
        if (game.user.id !== getThisModuleSetting("mainUserId")) {
            return;
        }
    }
    if (!getThisModuleSetting('disableMessages')) {
        await checkExist();
    }
});

Hooks.on('deleteChatMessage', async (msg) => {
    if ((!flushLog && !getThisModuleSetting('disableDeletions')) && (game.userId === getThisModuleSetting("mainUserId") || getThisModuleSetting("mainUserId") === "")) {
        if (getThisModuleSetting('messageList').hasOwnProperty(msg.id)) {
            const { url, message } = getThisModuleSetting('messageList')[msg.id];
            let deleteHook;
            if (url.split('?').length > 1) {
                const querysplit = url.split('?');
                deleteHook = querysplit[0] + '/messages/' + message.id + '?' + querysplit[1];
            } else {
                deleteHook = url + '/messages/' + message.id;
            }
            requestQueue.push({ hook: deleteHook, formData: null, msgID: msg.id, method: 'DELETE' });
            if (!isProcessing) {
                isProcessing = true;
                requestOnce();
            }
        }
    }
});


async function requestOnce(retry = 0) {
    const { hook, formData, msgID, method } = requestQueue[0];
    if (method === 'PATCH') {
        console.log("foundrytodiscord | Attempting to edit message...");
    }
    else if (method === 'DELETE') {
        console.log("foundrytodiscord | Attempting to delete message...");
    }
    else {
        console.log("foundrytodiscord | Attempting to send message to webhook...");
    }

    let requestOptions = {
        method: method,
        body: formData
    };

    if (method === 'DELETE') {
        requestOptions = {
            method: method
        }
    }

    try {
        const response = await fetch(hook, requestOptions);
        if (response.ok) {
            if (method === 'POST') {
                addSentMessage(msgID, { url: response.url, message: await response.json() });
            }
            requestQueue.shift();
            progressQueue()
        } else if (response.status === 429) {
            const retryAfter = Number(response.headers.get("Retry-After")) || 1;
            console.log("foundrytodiscord | Rate Limit exceeded! Next request in " + retryAfter / 100 + " seconds.");
            await wait(retryAfter * 10);
            progressQueue()
        }
        else {
            throw new Error(response.status);
        }
    } catch (error) {
        console.error('foundrytodiscord | Fetch error:', error);
        if (retry >= 2) {
            console.log("foundrytodiscord | Message discarded from the queue after retrying 2 times.");
            requestQueue.shift();
            retry = 0;
        }
        else {
            retry++;
        }
        progressQueue(retry)
    }
}

function progressQueue(retry = 0) {
    if (requestQueue.length > 0) {
        requestOnce(retry);
    } else {
        isProcessing = false;
    }
}

function getChatMediaAttachments(formData, msgText, content) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(content, "text/html");
    let mediaDivs = doc.querySelectorAll('.chat-media-image, .giphy-container');
    let filecount = 0;
    if (mediaDivs.length > 0) {
        mediaDivs.forEach((div) => {
            const imgElement = div.querySelector('img');
            const videoElement = div.querySelector('video');

            if (imgElement) {
                const dataSrc = imgElement.getAttribute('data-src');
                const src = imgElement.getAttribute('src');
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
                else if(src){
                    if (src.startsWith("data")) {
                        const byteCharacters = atob(src.split(',')[1]);
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
                        const parts = src.split(',');
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
                    else if (src.includes('http')) {
                        if (msgText !== "") {
                            msgText += "\n";
                        }
                        msgText += src;
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

function addSentMessage(msgID, params) {
    const messageList = game.settings.get('foundrytodiscord', 'messageList');
    messageList[msgID] = params;

    const keys = Object.keys(messageList);
    if (keys.length > 100) {
        delete messageList[keys[0]]; // Remove the oldest property from the object
    }

    game.settings.set('foundrytodiscord', 'messageList', messageList);
}

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

//API Functions

function generateSendFormData(content, embeds = [], username = game.user.name, avatar_url = getDefaultAvatarLink()) {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify({
        username: username,
        avatar_url: avatar_url,
        content: content,
        embeds: embeds
    }));
    return formData;
}

async function sendMessage(formData, isRoll = false, sceneID = "") {
    let hook = "";
    if (isRoll) {
        if (sceneID !== "" && getThisModuleSetting("threadedChatMap").hasOwnProperty(sceneID)) {
            hook = getThisModuleSetting("rollWebHookURL").split('?')[0] + "?thread_id=" + getThisModuleSetting('threadedChatMap')[sceneID].rollThreadId;
        }
        else {
            hook = getThisModuleSetting("rollWebHookURL");
        }
    } else {
        if (sceneID !== "" && getThisModuleSetting("threadedChatMap").hasOwnProperty(sceneID)) {
            hook = getThisModuleSetting("webHookURL").split('?')[0] + "?thread_id=" + getThisModuleSetting('threadedChatMap')[sceneID].chatThreadId;
        }
        else {
            hook = getThisModuleSetting("webHookURL");
        }
    }

    if (hook.includes("?")) {
        hook += "&wait=true";
    }
    else if (hook !== "") {
        hook += "?wait=true";
    }

    const requestOptions = {
        method: 'POST',
        body: formData
    };

    console.log("foundrytodiscord | Attempting to send message to webhook...");
    try {
        const response = await fetch(hook, requestOptions)
        if (response.ok) {
            const message = (await response.json());
            return { response: response, message: message }
        }
    } catch (error) {
        console.log("foundrytodiscord | Error sending message: ", error);
        return error;
    }
}

async function editMessage(formData, webhook, messageID) {
    if (webhook.split('?').length > 1) {
        const querysplit = webhook.split('?');
        webhook = querysplit[0] + '/messages/' + messageID + '?' + querysplit[1];
    } else {
        webhook = webhook + '/messages/' + messageID;
    }
    const requestOptions = {
        method: 'PATCH',
        body: formData
    };
    return await fetch(webhook, requestOptions).catch(error => {
        console.error('foundrytodiscord | Error editing message:', error);
    });
}

async function deleteMessage(webhook, messageID) {
    if (webhook.split('?').length > 1) {
        const querysplit = webhook.split('?');
        webhook = querysplit[0] + '/messages/' + messageID + '?' + querysplit[1];
    } else {
        webhook = webhook + '/messages/' + messageID;
    }
    return await fetch(webhook, { method: 'DELETE' })
        .catch(error => {
            console.log("foundrytodiscord | Error deleting message:", error);
        });
}