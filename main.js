import { isCard } from './scripts/generic.mjs';
import { generateimglink } from './scripts/generic.mjs';
import { getDefaultAvatarLink } from './scripts/generic.mjs';
import { parseHTMLText } from './scripts/generic.mjs';
import { initModuleSettings } from './scripts/helpers/modulesettings.mjs';
import { initMainGM } from './scripts/helpers/modulesettings.mjs';
import { getThisModuleSetting } from './scripts/helpers/modulesettings.mjs';
import { initParser } from './scripts/helpers/modulesettings.mjs';
import { splitEmbed } from './scripts/helpers/embeds.mjs';
import { hexToColor } from './scripts/helpers/embeds.mjs';
import { reformatMessage } from './scripts/generic.mjs';
import { PF2e_reformatMessage } from './scripts/pf2e.mjs';
import { DnD5e_reformatMessage } from './scripts/dnd5e.mjs';
import * as api from './api.js';

let messageParse;
Hooks.once("init", function () {
    initModuleSettings();
    messageParse = initParser();
});

Hooks.on('userConnected', async (user, connected) => {
    if (game.user.isGM && game.user.id === game.users.filter(user => user.active && user.isGM)[0]) {
        if (connected) {
            //Search for main GM
            const mainUser = game.users.get(getThisModuleSetting('mainUserId'));
            if (mainUser && mainUser.active) {
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
                    game.settings.set('foundrytodiscord', 'mainUserId', "");
                }
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


let requestQueue = [];
let isProcessing = false;
let flushLog = false;

Hooks.once("ready", function () {
    // Search for main GM
    initMainGM();
    if (game.user.isGM) {
        if (getThisModuleSetting('inviteURL') !== "" && !getThisModuleSetting('inviteURL').endsWith("/")) {
            game.settings.set('foundrytodiscord', 'inviteURL', getThisModuleSetting('inviteURL') + "/");
        }
        else if (getThisModuleSetting('inviteURL') === "") {
            game.settings.set('foundrytodiscord', 'inviteURL', "http://");
        }
        initSystemStatus();
    }
    console.log("foundrytodiscord | Ready");
});

Hooks.on('getJournalSheetHeaderButtons', (sheet, buttons) => {
    buttons.unshift({
        label: "Send Current Page to Discord",
        class: 'send-to-discord',
        icon: 'fa-brands fa-discord',
        onclick: () => {
            console.log(sheet);
            const pageIndex = sheet.pageIndex;
            const pageData = sheet._pages[pageIndex];
            let formData = new FormData();
            let reformat;
            switch (game.system.id) {
                case 'pf2e':
                    reformat = PF2e_reformatMessage;
                    break;
                case 'dnd5e':
                    reformat = DnD5e_reformatMessage;
                    break;
                default:
                    reformat = reformatMessage;
                    break;
            }
            let embeds = [];
            let msgText = "";
            switch (pageData.type) {
                case "text":
                    embeds = [{
                        author: { name: "From Journal " + sheet.title },
                        title: pageData.name,
                        description: reformat(pageData.text.content)
                    }];
                    if (embeds[0].description.length > 4000) {
                        embeds = splitEmbed(embeds[0]);
                    }
                    break;
                case "image":
                    embeds = [{
                        author: { name: "From Journal " + sheet.title },
                        title: pageData.name,
                        image: {
                            url: generateimglink(pageData.src)
                        },
                        footer: {
                            text: pageData.image.caption
                        }
                    }];
                    break;
                case "video":
                    msgText += generateimglink(pageData.src);
                    break;
                default:
                    console.warn("foundrytodiscord | Journal page type not supported.");
                    break;
            }
            if (embeds.length > 0 || msgText !== "") {
                embeds.forEach((embed) => {
                    // Add color to all embeds
                    if (game.user?.color) {
                        embed.color = hexToColor(game.user.color);
                    }
                })
                const params = {
                    username: game.user.name,
                    avatar_url: generateimglink(game.user.avatar),
                    content: msgText,
                    embeds: embeds
                }
                formData.append('payload_json', JSON.stringify(params));
                api.sendMessage(formData, false, game.user.viewedScene);
            }
        }
    })
});

Hooks.on('getImagePopoutHeaderButtons', (sheet, buttons) => {
    buttons.unshift({
        label: "Send Image to Discord",
        class: 'send-to-discord',
        icon: 'fa-brands fa-discord',
        onclick: () => {
            let formData = new FormData();
            let msgText = "";
            let imgblob;
            if (sheet.object.startsWith("data")) {
                imgblob = dataToBlob(sheet.object);
                console.log(sheet.object);
                const parts = sheet.object.split(';');
                if (parts.length < 2) {
                    return 'jpg';
                }
                const mimeType = parts[0].split(':')[1];
                const fileExt = mimeType.split('/')[1];
                const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4'];
                if (supportedFormats.includes(fileExt)) {
                    const params = {
                        username: game.user.name,
                        avatar_url: generateimglink(game.user.avatar),
                        content: ""
                    }
                    formData.append('files[0]', imgblob, "foundrytodiscord_sharedimage." + fileExt);
                    formData.append('payload_json', JSON.stringify(params));
                    api.sendMessage(formData, false, game.user.viewedScene);
                }
            }
            else {
                let link;
                if (!sheet.object.includes("http")) {
                    link = generateimglink(sheet.object);
                }
                else {
                    link = sheet.object;
                }
                if (link === "") {
                    console.error("foundrytodiscord | Your Invite URL isn't set! Image was not sent.");
                    return;
                }
                msgText += link;
                const params = {
                    username: game.user.name,
                    avatar_url: generateimglink(game.user.avatar),
                    content: msgText
                }
                formData.append('payload_json', JSON.stringify(params));
                api.sendMessage(formData, false, game.user.viewedScene);
            }
        }
    })
});

Hooks.on('getChatLogEntryContext', (html, options) => {
    options.unshift({
        name: "Send to Discord",
        icon: '<i class="fa-brands fa-discord"></i>',
        condition: game.user.isGM, // optional condition
        callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            tryRequest(message, 'POST');
        }
    })
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
        if (getThisModuleSetting("ignoreWhispers") && msg.whisper.length > 0) {
            return;
        }
        if (game.user.id !== getThisModuleSetting("mainUserId") && getThisModuleSetting("mainUserId") !== "") {
            initMainGM();
            if (game.users.filter(user => user.isGM && user.active).length > 0 || (!getThisModuleSetting("allowNoGM") && game.user.id !== getThisModuleSetting("mainUserId") && game.user.id !== game.users.filter(user => user.active).sort((a, b) => a.name.localeCompare(b.name))[0].id)) {
                return;
            }
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

Hooks.on('updateChatMessage', async (msg) => {
    let tries = 10; // Number of tries before giving up
    const checkExist = async () => {
        if (!getThisModuleSetting('messageList')[msg.id] && !getThisModuleSetting('clientMessageList')[msg.id]) {
            if (tries > 0) {
                tries--;
                await wait(500);
                await checkExist(); // Recursively retry
            } else {
                console.log('foundrytodiscord | Attempt to edit message was unsuccessful due to the message not existing on Discord.');
            }
        } else {
            let editHook;
            let msgObjects;
            if (game.users.filter(user => user.isGM && user.active).length > 0) {
                msgObjects = getThisModuleSetting('messageList')[msg.id];
            } else {
                msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
            }
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
    };

    flushLog = false;
    if (getThisModuleSetting("ignoreWhispers") && msg.whisper.length > 0) {
        return;
    }
    if (game.user.id !== getThisModuleSetting("mainUserId") && getThisModuleSetting("mainUserId") !== "") {
        initMainGM();
        if (game.users.filter(user => user.isGM && user.active).length > 0 || (!getThisModuleSetting("allowNoGM") && game.user.id !== getThisModuleSetting("mainUserId") && game.user.id !== game.users.filter(user => user.active).sort((a, b) => a.name.localeCompare(b.name))[0].id)) {
            return;
        }
    }
    if (!getThisModuleSetting('disableMessages')) {
        await checkExist();
    }
});

Hooks.on('deleteChatMessage', async (msg) => {
    if ((!flushLog && !getThisModuleSetting('disableDeletions')) && ((game.userId === getThisModuleSetting("mainUserId") && getThisModuleSetting("mainUserId") !== "") || (getThisModuleSetting("allowNoGM") && game.users.filter(user => user.isGM && user.active).length === 0 && game.user.id === game.users.filter(user => user.active).sort((a, b) => a.name.localeCompare(b.name))[0].id))) {
        if (getThisModuleSetting('messageList').hasOwnProperty(msg.id) || getThisModuleSetting('clientMessageList').hasOwnProperty(msg.id)) {
            let deleteHook;
            let msgObjects;
            if (game.users.filter(user => user.isGM && user.active).length > 0) {
                msgObjects = getThisModuleSetting('messageList')[msg.id];
            } else {
                msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
            }
            msgObjects.forEach(msgObject => {
                const url = msgObject.url;
                const message = msgObject.message;
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
            });
        }
    }
});

function tryRequest(msg, method, hookOverride = "") {
    let requestParams = messageParse(msg);
    if (requestParams) {
        if (requestParams.params.avatar_url === "") {
            console.warn("foundrytodiscord | Your Invite URL is not set! Avatar images cannot be displayed on Discord.")
        }
        let formData = new FormData()
        let hasAttachments = false;
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
            if (requestParams.params.content === "" && !hasAttachments) {
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
        requestQueue.push({ hook: hookOverride === "" ? waitHook : hookOverride, formData: formData, msgID: msg.id, method: method });
        if (!isProcessing) {
            isProcessing = true;
            requestOnce();
        }
    }
}

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
            console.log("foundrytodiscord | Message discarded from the queue after retrying 2 times.");
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
    console.log(images);
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

function dataToBlob(base64String) {
    const byteCharacters = atob(base64String.split(',')[1]);
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
    const parts = base64String.split(',');
    let mimeType;
    if (parts.length > 0) {
        // Get the part before the semicolon in the first segment
        const mimeTypeSegment = parts[0].split(';')[0];
        // Extract the actual MIME type
        mimeType = mimeTypeSegment.split(':')[1];
    }
    return new Blob(byteArrays, { type: mimeType });
}

function addSentMessage(msgID, params) {
    let messageList;
    if (game.users.filter(user => user.active && user.isGM).length > 0) {
        messageList = game.settings.get('foundrytodiscord', 'messageList');
    }
    else {
        messageList = game.settings.get('foundrytodiscord', 'clientMessageList');
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

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}
