import { getThisModuleSetting } from "./scripts/helpers/modulesettings.mjs";
import { getDefaultAvatarLink } from "./scripts/helpers/images.mjs";

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

export async function sendMessage(formData, isRoll = false, sceneID = game.user.viewedScene) {
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
        console.error("foundrytodiscord | Error sending message: ", error);
    }
}

export async function editMessage(formData, webhook, messageID) {
    if (!webhook.includes('/messages/')) {
        if (webhook.split('?').length > 1) {
            const querysplit = webhook.split('?');
            webhook = querysplit[0] + '/messages/' + messageID + '?' + querysplit[1];
        } else {
            webhook = webhook + '/messages/' + messageID;
        }
    }
    const requestOptions = {
        method: 'PATCH',
        body: formData
    };
    console.log("foundrytodiscord | Attempting to edit message...");
    return await fetch(webhook, requestOptions)
        .catch(error => {
            console.error('foundrytodiscord | Error editing message:', error);
        });
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
    console.log("foundrytodiscord | Attempting to delete message...");
    return await fetch(webhook, { method: 'DELETE' })
        .catch(error => {
            console.error("foundrytodiscord | Error deleting message:", error);
        });
}