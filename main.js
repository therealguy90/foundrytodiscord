import { isCard } from './scripts/generic.mjs';
import { dataToBlob, getDefaultAvatarLink } from './scripts/helpers/images.mjs';
import { initModuleSettings, getThisModuleSetting, initParser } from './scripts/helpers/modulesettings.mjs';
import { initMenuHooks } from './scripts/apphooks.mjs';
import * as api from './api.js';

let messageParse;
Hooks.once("init", function () {
    initModuleSettings();
    messageParse = initParser();
});


Hooks.on('deleteScene', async scene => {
    if (isUserMainGM()) {
        // Used for Threaded Scenes to delete a thread map if a scene is deleted.
        const threadedChatMap = getThisModuleSetting('threadedChatMap');
        if (threadedChatMap.hasOwnProperty(scene.id)) {
            delete threadedChatMap[scene.id];
            game.settings.set('foundrytodiscord', 'threadedChatMap', threadedChatMap);
        }
    }
});


/* Since the module looks out for message deletions in real time, 
* messages should not be deleted if the GM clears the chat log.
* To avoid this, we add two event listeners for two layers of protection.
* one is for the Clear Chat Log "trash can" button, the other is the "Yes" button on the confirmation dialog.
*/
Hooks.on("renderChatLog", (app, html) => {
    // Add event listener for the "Clear Chat Log" button
    const clearButton = html.find('a.delete.chat-flush');
    clearButton.on("click", () => {
        flushLog = true;
    });
});

Hooks.on("renderApplication", (app, html) => {
    // Check if the 'yes' button was pressed to flush the chat log
    // This is the most consistent method.
    const yesButton = html.find('button.dialog-button.yes.bright, button[data-button="yes"]');
    if (yesButton && yesButton.length > 0) {
        yesButton.on("click", () => {
            console.log("foundrytodiscord | Avoiding deleting messages in Discord...");
            flushLog = true;
        });
    }
});

// For the "Send to Discord" context menu on chat messages.
// Seldom needed, but if chat mirroring is disabled, this is one way to circumvent it.
Hooks.on('getChatLogEntryContext', (html, options) => {
    options.unshift({
        name: "Send to Discord",
        icon: '<i class="fa-brands fa-discord"></i>',
        condition: game.user.isGM,
        callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            tryRequest(message, 'POST');
        }
    })
});

let requestQueue = [];
let isProcessing = false;
let flushLog = false;

Hooks.once("ready", function () {
    // Application and context menu buttons for all users
    initMenuHooks();
    if (isUserMainGM()) {
        const curInviteURL = getThisModuleSetting('inviteURL');
        if (curInviteURL !== "" && !curInviteURL.endsWith("/")) {
            game.settings.set('foundrytodiscord', 'inviteURL', curInviteURL + "/");
        }
        else if(curInviteURL === ""){
            game.settings.set('foundrytodiscord', 'inviteURL', "http://");
        }
        initSystemStatus();
    }
    console.log("foundrytodiscord | Ready");
});


// For Server Status Message
async function initSystemStatus() {
    if (getThisModuleSetting('serverStatusMessage')) {
        if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
            const editedMessage = new FormData()
            const body = JSON.stringify({
                embeds: [{
                    title: 'Server Status: ' + game.world.id,
                    description: '**ONLINE**\n' + (getThisModuleSetting('showInvite') ? '**Invite Link: **' + getThisModuleSetting('inviteURL') : ''),
                    footer: {
                        text: 'Have a GM type "ftd serveroff" in Foundry to set your server status to OFFLINE. This will persist until the next time a GM logs in.\n\n' + (game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version)
                    },
                    color: 65280
                }]
            });
            editedMessage.append('payload_json', body)

            const response = await api.editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
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
                await api.sendMessage(formData);
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
                const response = await api.editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
                if (response.ok) {
                    console.log('foundrytodiscord | Server state set to OFFLINE');
                    ChatMessage.create({ content: 'Server state set to OFFLINE.', speaker: {alias: "Foundry to Discord"}, whisper: [game.user.id] });
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
        if (getThisModuleSetting("ignoreWhispers") && msg.whisper.length > 0) {
            return;
        }
        if (!isUserMainGM() && (game.users.activeGM || !isUserMainNonGM())) {
            return;
        }
        if (msg.isRoll && (!isCard(msg.content) && msg.rolls.length > 0) && getThisModuleSetting("rollWebHookURL") == "") {
            return;
        }
        if (!msg.isRoll && (isCard(msg.content) && msg.rolls.length < 1) && getThisModuleSetting("webHookURL") == "") {
            return;
        }

        tryRequest(msg, 'POST');
    }
});

Hooks.on('updateChatMessage', async (msg, change, options) => {
    if (!isUserMainGM()) {
        if (game.users.activeGM || (!getThisModuleSetting("allowNoGM") && game.user.id !== game.users.filter(user => user.active).sort((a, b) => a.name.localeCompare(b.name))[0].id)) {
            return;
        }
    }
    let tries = 10; // Number of tries before giving up
    const checkExist = async (msgChange) => {
        if (!getThisModuleSetting('messageList')[msg.id] && !getThisModuleSetting('clientMessageList')[msg.id]) {
            if (tries > 0) {
                tries--;
                await wait(500);
                await checkExist(msgChange); // Recursively retry
            } else {
                console.log(`foundrytodiscord | Attempt to ${msgChange} message was unsuccessful due to the message not existing on Discord.`);
            }
        } else {
            let editHook;
            let msgObjects;
            if (game.user.isGM) {
                msgObjects = getThisModuleSetting('messageList')[msg.id];
            } else {
                msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
            }
            if (msgObjects) {
                if (msgChange === "edit") {
                    msgObjects.forEach(msgObject => {
                        const url = msgObject.url;
                        const message = msgObject.message;
                        if (url.split('?').length > 1) {
                            const querysplit = url.split('?');
                            editHook = querysplit[0] + '/messages/' + message.id + '?' + querysplit[1];
                        } else {
                            editHook = url + '/messages/' + message.id;
                        }
                        tryRequest(msg, 'PATCH', editHook);
                    });
                }
                else if (msgChange === "delete") {
                    deleteAll(msgObjects, msg);
                }
            }
        }
    };
    flushLog = false;
    if (!getThisModuleSetting('disableMessages')) {
        if (getThisModuleSetting("ignoreWhispers")) {
            if (change.whisper?.length > 1) {
                await checkExist("delete");
                return;
            }
            else if (change.whisper?.length === 0) {
                let msgObjects;
                if (game.user.isGM) {
                    msgObjects = getThisModuleSetting('messageList')[msg.id];
                } else {
                    msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
                }
                if (!msgObjects || msgObjects.length === 0) {
                    tryRequest(msg, "POST");
                    return;
                }
            }
        }
        await checkExist("edit");
    }
});

Hooks.on('deleteChatMessage', async (msg) => {
    if (!flushLog && !getThisModuleSetting('disableDeletions') && (isUserMainGM() || (getThisModuleSetting("allowNoGM") && !game.users.activeGM && isUserMainNonGM()))) {
        if (getThisModuleSetting('messageList').hasOwnProperty(msg.id) || getThisModuleSetting('clientMessageList').hasOwnProperty(msg.id)) {
            let msgObjects;
            if (game.user.isGM) {
                msgObjects = getThisModuleSetting('messageList')[msg.id];
            } else {
                msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
            }
            deleteAll(msgObjects, msg);
        }
    }
});

function deleteAll(msgObjects, msg) {
    let deleteHook;
    msgObjects.forEach(msgObject => {
        const url = msgObject.url;
        const message = msgObject.message;
        if (url.split('?').length > 1) {
            const querysplit = url.split('?');
            deleteHook = querysplit[0] + '/messages/' + message.id + '?' + querysplit[1];
        } else {
            deleteHook = url + '/messages/' + message.id;
        }
        requestQueue.push({ hook: deleteHook, formData: null, msgID: msg.id, method: 'DELETE', dmsgID: message.id });
        if (!isProcessing) {
            isProcessing = true;
            requestOnce();
        }
    });
}

/* A brief explanation of the queueing system:
* All requests are put into a queue such that everything executes in the order the hooks are detected in-game.
* This also allows any and all requests to stop if a rate limit is reached.
* A single object inqueue consists of a hook string, a FormData object, the message id, the request method, 
* and (for deletions) the discord message ID.
* The client will attempt to send/edit/delete a message thrice, and if it fails every time, the request gets discarded from the queue.
* A successfully sent message is added to the object stored in a hidden module setting (max 100). This allows all clients to access
* previously-sent messages, and for the messages to not be erased after the client reloads their browser.
*/
function tryRequest(msg, method, hookOverride = "") {
    let requestParams = messageParse(msg);
    if (requestParams) {
        if (requestParams.params.avatar_url === "") {
            console.warn("foundrytodiscord | Your Invite URL is not set! Avatar images cannot be displayed on Discord.")
        }
        let formData = new FormData()
        if (game.modules.get("chat-media")?.active || game.modules.get("chatgifs")?.active) {
            const { formDataTemp, contentTemp } = getChatMediaAttachments(formData, requestParams.params.content, msg.content);
            if (formDataTemp !== formData) {
                formData = formDataTemp;
            }
            requestParams.params.content = contentTemp;
        }
        if (requestParams.params.content === "" && requestParams.params.embeds.length === 0 && !formData.get('files[0]')) {
            if (!msg.content.includes('<img') && !msg.content.includes('<video')) {
                return;
            }
            else {
                requestParams.params.content += addMediaLinks(msg);
            }
            if (requestParams.params.content === "") {
                return;
            }
        }
        let waitHook;
        if (requestParams.hook.includes("?")) {
            waitHook = requestParams.hook + "&wait=true";
        }
        else {
            waitHook = requestParams.hook + "?wait=true";
        }
        formData.append('payload_json', JSON.stringify(requestParams.params));
        requestQueue.push({ hook: hookOverride === "" ? waitHook : hookOverride, formData: formData, msgID: msg.id, method: method, dmsgID: null });
        if (!isProcessing) {
            isProcessing = true;
            requestOnce();
        }
    }
}

async function requestOnce(retry = 0) {
    const { hook, formData, msgID, method, dmsgID } = requestQueue[0];
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
            if (method === 'DELETE') {
                if (dmsgID) {
                    deleteSentMessage(msgID, dmsgID);
                }
            }
            requestQueue.shift();
            console.log("foundrytodiscord | " + method + " request succeeded.");
            progressQueue();
        } else if (response.status === 429) {
            const retryAfter = Number(response.headers.get("Retry-After")) || 1;
            console.log("foundrytodiscord | Rate Limit exceeded! Next request in " + retryAfter / 100 + " seconds.");
            await wait(retryAfter * 10);
            progressQueue();
        }
        else {
            throw new Error(response.status);
        }
    } catch (error) {
        console.error('foundrytodiscord | Fetch error:', error);
        if (retry >= 2) {
            console.log("foundrytodiscord | Request discarded from the queue after retrying 2 times.");
            if (method == "DELETE" && error.message === "404") {
                deleteSentMessage(msgID, dmsgID);
            }
            requestQueue.shift();
            retry = 0;
        }
        else {
            retry++;
        }
        console.log("foundrytodiscord | Retrying...");
        progressQueue(retry);
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
                        const blob = dataToBlob(dataSrc);
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
                else if (src) {
                    if (src.startsWith("data")) {
                        const blob = dataToBlob(src);
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
                const src = videoElement.getAttribute('src');

                if (src) {
                    if (src.includes('http')) {
                        if (msgText !== "") {
                            msgText += "\n";
                        }
                        msgText += src;
                    }
                }
            }
        });
    }
    return { formDataTemp: formData, contentTemp: msgText };
}

function addMediaLinks(message) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const images = doc.querySelectorAll('img');
    let links = "";
    images.forEach(imgElement => {
        const src = imgElement.getAttribute('src');
        if (src.includes('http')) {
            if (links !== "") {
                links += "\n";
            }
            links += src;
        }
    });
    const videos = doc.querySelectorAll('video');
    videos.forEach(videoElement => {
        const src = videoElement.getAttribute('src');
        if (src.includes('http')) {
            if (links !== "") {
                links += "\n";
            }
            links += src;
        }
    });
    return links;
}

function addSentMessage(msgID, params) {
    let messageList;
    if (game.user.isGM) {
        messageList = getThisModuleSetting('messageList');
    }
    else {
        messageList = getThisModuleSetting('clientMessageList');
    }
    if (!messageList.hasOwnProperty(msgID)) {
        messageList[msgID] = [params];
    }
    else {
        messageList[msgID].push(params);
    }

    const keys = Object.keys(messageList);
    if (keys.length > 100) {
        delete messageList[keys[0]]; // Remove the oldest property from the object
    }

    if (game.user.isGM) {
        game.settings.set('foundrytodiscord', 'messageList', messageList);
    }
    else {
        game.settings.set('foundrytodiscord', 'clientMessageList', messageList);
    }
}

function deleteSentMessage(msgID, dmsgID) {
    let messageList;
    if (game.user.isGM) {
        messageList = getThisModuleSetting('messageList');
    }
    else {
        messageList = getThisModuleSetting('clientMessageList');
    }
    if (messageList.hasOwnProperty(msgID)) {
        let index = -1;
        for (let i = 0; i < messageList[msgID].length; i++) {
            if (messageList[msgID][i].message.id === dmsgID) {
                index = i;
                break;
            }
        }
        messageList[msgID].splice(index, 1);
    }
    if (game.user.isGM) {
        game.settings.set('foundrytodiscord', 'messageList', messageList);
    }
    else {
        game.settings.set('foundrytodiscord', 'clientMessageList', messageList);
    }
}

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

function isUserMainGM() {
    return game.user === game.users.activeGM;
}

function isUserMainNonGM(){
    return game.user === game.users.filter(user => user.active && !user.isGM).sort((a, b) => a.name.localeCompare(b.name))[0];
}