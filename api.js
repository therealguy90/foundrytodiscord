import { getThisModuleSetting } from "./scripts/helpers/modulesettings.mjs";
import { getDefaultAvatarLink } from "./scripts/helpers/parser/images.mjs";
import { requestQueue } from "./main.js";

Hooks.once("init", function () {
    game.modules.get('foundrytodiscord').api = {
        sendMessage,
        editMessage,
        deleteMessage,
        generateSendFormData
    }
});


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

export async function editMessage(formData, webhook, messageID) {
    if (!webhook.includes('/messages/')) {
        if (!webhook.includes('/messages/')) {
            const querysplit = webhook.split('?');
            webhook =  `${querysplit[0]}/messages/${messageID}${querysplit[1] ? `?${querysplit[1]}` : ""}`;
        }
    }

    return await requestQueue.editMessage(webhook, formData);
}

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