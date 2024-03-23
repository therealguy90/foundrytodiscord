import { getThisModuleSetting } from "./scripts/helpers/modulesettings.mjs";
import { getDefaultAvatarLink } from "./scripts/helpers/parser/images.mjs";
import { tryPOST } from "./main.js";
import { requestQueue } from "./main.js";

Hooks.once("init", function () {
    game.modules.get('foundrytodiscord').api = {
        sendMessage,
        sendMessageFromID,
        editMessage,
        deleteMessage,
        generateSendFormData
    }
});

/**
 * Generates a Discord-compatible FormData object to use as the request body. 
 * @param {string} content - The text content of the message to send.
 * @param {Array} embeds - An array of embeds (max 10.) Default: []
 * @param {string} username - The username to be used on Discord. Default: game.user.name
 * @param {string} avatar_url - The URL of an image that the webhook will use as an avatar. Default: FoundryVTT icon.
 * @returns {FormData} - A Discord-compatible FormData object with the specified parameters.
 */
export function generateSendFormData(content, embeds = [], username = game.user.name, avatar_url = getDefaultAvatarLink()) {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify({
        username: username,
        avatar_url: avatar_url,
        content: content,
        embeds: embeds
    }));
    
    return formData;
}


/**
* Sends a Foundry ChatMessage to a webhook via ID.
* @param {string} messageID - The ID of the ChatMessage in game.messages
* @param {string} hookOverride - Default: The WebHook URL or Roll WebHook URL you set in Foundry to Discord's settings. If this is overriden, the message will not be edited nor deleted by the module through Chat Mirroring.
* @returns {Promise<Response>} - The API response. To get the message object, use response.json()
*/
export async function sendMessageFromID(messageID, hookOverride = undefined){
    const message = game.messages.get(messageID);
    if(message){
        return await tryPOST(message, hookOverride);
    }
}

/**
 * Sends a message to Discord using a FormData object.
 * @param {FormData} formData - A Discord-compatible FormData object.
 * @param {Boolean} isRoll - Default: False. If this is true, your message will be sent to the Roll WebHook URL if hookOverride is not defined.
 * @param {string} sceneID - The ID of the scene, in the case of Threaded Scenes. Default: The currently viewed scene.
 * @param {string} hookOverride - Default: The WebHook URL or Roll WebHook URL you set in Foundry to Discord's settings.
 * @returns {Promise<Response>} - The API response. To get the message object, use response.json()
 */
export async function sendMessage(formData, isRoll = false, sceneID = game.user.viewedScene, hookOverride = undefined) {
    let hook = "";
    if (hookOverride) {
        hook = hookOverride;
    } else if (isRoll) {
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

    return await requestQueue.sendMessage(hook, formData);
}

/**
 * Edits a message from a webhook's channel via the Discord Message ID.
 * @param {FormData} formData - A Discord-compatible FormData object.
 * @param {string} webhook - The webhook link. You can get this via Response.url when a message is sent successfully.
 * @param {string} messageID - The Discord Message ID. You can get this via (await Response.json()).id when a message is sent successfully.
 * @returns {Promise<Response>} - The API response.
 */
export async function editMessage(formData, webhook, messageID) {
    if (!webhook.includes('/messages/')) {
        if (!webhook.includes('/messages/')) {
            const querysplit = webhook.split('?');
            webhook =  `${querysplit[0]}/messages/${messageID}${querysplit[1] ? `?${querysplit[1]}` : ""}`;
        }
    }

    return await requestQueue.editMessage(webhook, formData);
}

/**
 * Deletes a message from a webhook's channel via the Discord Message ID.
 * @param {string} webhook - The webhook link. You can get this via Response.url when a message is sent successfully.
 * @param {string} messageID - The Discord Message ID. You can get this via (await Response.json()).id when a message is sent successfully.
 * @returns {Promise<Response>} - The API response.
 */
export async function deleteMessage(webhook, messageID) {
    if (!webhook.includes('/messages/')) {
        if (webhook.split('?').length > 1) {
            const querysplit = webhook.split('?');
            webhook = querysplit[0] + '/messages/' + messageID + '?' + querysplit[1];
        } else {
            webhook = webhook + '/messages/' + messageID;
        }
    }

    return await requestQueue.deleteMessage(webhook);
}
