import { initModuleSettings, getThisModuleSetting, getSystemParser } from './scripts/helpers/modulesettings.mjs';
import { initOtherHooks } from './scripts/hooks.mjs';
import { postParse } from './scripts/helpers/parser/messages.mjs';
import { updateServerStatus, initSystemStatus } from './scripts/helpers/monitor/serverstatus.mjs';
import { sendUserMonitorMessage } from './scripts/helpers/monitor/loginmonitor.mjs';
import { initLoginMonitor } from './scripts/helpers/monitor/loginmonitor.mjs';
import { isUserMainGM, isUserMainNonGM } from './scripts/helpers/userfilter.mjs';
import { DiscordRequestQueue, delay } from './src/objects/requestQueue.mjs';

export let messageParser;
export const requestQueue = new DiscordRequestQueue();

Hooks.once("init", function () {
    initModuleSettings();
    initLoginMonitor();
    initOtherHooks();
    messageParser = getSystemParser();
});

Hooks.once("ready", async () => {
    if (isUserMainGM()) {
        const curInviteURL = getThisModuleSetting('inviteURL');
        if (curInviteURL !== "" && !curInviteURL.endsWith("/")) {
            game.settings.set('foundrytodiscord', 'inviteURL', curInviteURL + "/");
        }
        else if (curInviteURL === "") {
            game.settings.set('foundrytodiscord', 'inviteURL', "http://");
        }
        await initSystemStatus();
    }
    console.log("foundrytodiscord | Ready");
    //PLACEHOLDER
    if ((isUserMainGM() || (!game.users.activeGM && isUserMainNonGM())) || game.users.filter(user => user.active).length === 1) {
        await sendUserMonitorMessage(game.user, true);
    }
});

Hooks.on('createChatMessage', async (msg) => {
    const user = msg.author || msg.user /*Will be removed in v13*/
    if (msg.content === "ftd serveroff" && user.isGM) {
        if (getThisModuleSetting('serverStatusMessage')) {
            if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
                const response = await updateServerStatus(false);
                if (response.ok) {
                    console.log('foundrytodiscord | Server state set to OFFLINE');
                    ChatMessage.create({ content: 'Server state set to OFFLINE.', speaker: { alias: "Foundry to Discord" }, whisper: [game.user.id] });
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
        if (!isUserMainGM() && (game.users.activeGM || !(getThisModuleSetting("allowNoGM") && isUserMainNonGM()))) {
            return;
        }
        if (msg.isRoll && (!messageParser.isCard(msg.content) && msg.rolls.length > 0) && getThisModuleSetting("rollWebHookURL") === "") {
            return;
        }
        if (!msg.isRoll && (messageParser.isCard(msg.content) && msg.rolls.length < 1) && getThisModuleSetting("webHookURL") === "") {
            return;
        }

        await tryPOST(msg);
    }
});

Hooks.on('updateChatMessage', async (msg, change, options) => {
    if (!isUserMainGM() && (game.users.activeGM || !(getThisModuleSetting("allowNoGM") && isUserMainNonGM()))) {
        return;
    }
    let tries = 10; // Number of tries before giving up
    const checkExist = async (msgChange) => {
        if (!getThisModuleSetting('messageList')[msg.id] && !getThisModuleSetting('clientMessageList')[msg.id]) {
            if (tries > 0) {
                tries--;
                await delay(500);
                await checkExist(msgChange); // Recursively retry
            } else {
                console.log(`foundrytodiscord | Attempt to ${msgChange} message was unsuccessful due to the message not existing on Discord.`);
            }
        } else {
            let msgObjects;
            if (game.user.isGM) {
                msgObjects = getThisModuleSetting('messageList')[msg.id];
            } else {
                msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
            }
            if (msgObjects) {
                if (msgChange === "edit") {
                    // Edit all linked messages 
                    let msgObjects;
                    if (game.user.isGM) {
                        msgObjects = getThisModuleSetting('messageList')[msg.id];
                    } else {
                        msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
                    }
                    let editHook;
                    const requestParams = await messageParser.parseMessage(msg, true);
                    if (requestParams) {
                        for (const request of requestParams) {
                            for (const linkedIndex in msgObjects) {
                                const linkedMsgObjects = msgObjects[linkedIndex];
                                for (const msgIndex in linkedMsgObjects) {
                                    const msgObject = linkedMsgObjects[msgIndex];
                                    const url = msgObject.url;
                                    const message = msgObject.message;
                                    if (url.split('?').length > 1) {
                                        const querysplit = url.split('?');
                                        editHook = querysplit[0] + '/messages/' + message.id + '?' + querysplit[1];
                                    } else {
                                        editHook = url + '/messages/' + message.id;
                                    }
                                    const { waitHook, formData } = await postParse(msg, request);
                                    requestQueue.editMessage(editHook, formData);
                                }
                            }
                        }
                    }
                }
                else if (msgChange === "delete") {
                    deleteAll(msg);
                }
            }
        }
    };
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
                if (!msgObjects) {
                    await tryPOST(msg);
                    return;
                }
            }
        }
        await checkExist("edit");
    }
});

Hooks.on('deleteChatMessage', async (msg) => {
    if (!isUserMainGM() && (game.users.activeGM || !(getThisModuleSetting("allowNoGM") && isUserMainNonGM()))) {
        return;
    }
    if (!getThisModuleSetting('disableDeletions')) {
        if (getThisModuleSetting('messageList').hasOwnProperty(msg.id) || getThisModuleSetting('clientMessageList').hasOwnProperty(msg.id)) {
            deleteAll(msg);
        }
    }
});

export async function tryPOST(msg, hookOverride = undefined) {
    let requestParams = await messageParser.parseMessage(msg);
    // do post-parse checks, such as adding images to upload and editing webhook links
    if (requestParams && requestParams.length > 0) {
        let messageList;
        if (game.user.isGM) {
            messageList = getThisModuleSetting('messageList');
        }
        else {
            messageList = getThisModuleSetting('clientMessageList');
        }
        let linkedMsgNum;
        if (!messageList[msg.id]) {
            linkedMsgNum = 0;
        }
        else {
            linkedMsgNum = Object.keys(messageList[msg.id]).length;
        }
        for (const request of requestParams) {
            const { waitHook, formData } = await postParse(msg, request, hookOverride);
            if (waitHook) {
                const response = await requestQueue.sendMessage(waitHook, formData);
                if (response) {
                    if (!hookOverride) {
                        const message = await response.json();
                        addSentMessage(msg.id, { url: response.url, message: message }, linkedMsgNum);
                    }
                    return response;
                }
                else {
                    return undefined;
                }
            }
        }
    }
}

function deleteAll(msg) {
    let msgObjects;
    if (game.user.isGM) {
        msgObjects = getThisModuleSetting('messageList')[msg.id];
    } else {
        msgObjects = getThisModuleSetting('clientMessageList')[msg.id];
    }
    let deleteHook;
    for (const linkedIndex in msgObjects) {
        const linkedMsgObjects = msgObjects[linkedIndex];
        for (const msgIndex in linkedMsgObjects) {
            const msgObject = linkedMsgObjects[msgIndex];
            const url = msgObject.url;
            const discordMessage = msgObject.message;
            if (url.split('?').length > 1) {
                const querysplit = url.split('?');
                deleteHook = querysplit[0] + '/messages/' + discordMessage.id + '?' + querysplit[1];
            } else {
                deleteHook = url + '/messages/' + discordMessage.id;
            }
            requestQueue.deleteLinkedMessage(deleteHook, discordMessage.id);
            deleteSentMessage(msg.id, discordMessage.id)
        }
    }
    delete msgObjects[msg.id];
    if (game.user.isGM) {
        game.settings.set('foundrytodiscord', 'messageList', msgObjects);
    }
    else {
        game.settings.set('foundrytodiscord', 'clientMessageList', msgObjects);
    }
}

function addSentMessage(msgID, params, linkedMsgNum) {
    let messageList;
    if (game.user.isGM) {
        messageList = getThisModuleSetting('messageList');
    }
    else {
        messageList = getThisModuleSetting('clientMessageList');
    }
    if (!messageList.hasOwnProperty(msgID)) {
        messageList[msgID] = {}
    }
    if (!messageList[msgID][linkedMsgNum]) {
        messageList[msgID][linkedMsgNum] = { 0: params };
    }
    else {
        messageList[msgID][linkedMsgNum][Object.keys(messageList[msgID][linkedMsgNum]).length] = params;
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
        for (let i = 0; i < Object.keys(messageList[msgID]).length; i++) {
            for (let j = 0; j < Object.keys(messageList[msgID][i]).length; j++) {
                if (messageList[msgID][i][j] && messageList[msgID][i][j].message.id === dmsgID) {
                    index = j;
                    break;
                }
            }
            delete messageList[msgID][i][index];
            break;
        }
    }
    if (game.user.isGM) {
        game.settings.set('foundrytodiscord', 'messageList', messageList);
    }
    else {
        game.settings.set('foundrytodiscord', 'clientMessageList', messageList);
    }
}