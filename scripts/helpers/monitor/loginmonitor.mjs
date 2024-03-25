import { getThisModuleSetting } from "../modulesettings.mjs";
import { getDefaultAvatarLink } from "../parser/images.mjs";
import { getMessageInfo } from "../parser/messages.mjs";
import { updateServerStatus } from "./serverstatus.mjs";
import * as api from "../../../api.js"

let logoutListenersAdded = false;
let adminDisconnect = false;

export function initLoginMonitor() {
    Hooks.on('userConnected', async (user, connected) => {
        if (!user.isSelf || isUserMainGM() || (!game.users.activeGM && isUserMainNonGM())) {
            const webhook = getThisModuleSetting('webHookURL');
            await sendUserMonitorMessage(user, connected);
            if (getThisModuleSetting('serverStatusMessage') && webhook !== "") {
                const messageID = getThisModuleSetting('messageID');
                if (messageID !== "") {
                    const response = await getMessageInfo(webhook, messageID);
                    const serverStatusMsg = await response.json();
                    if (serverStatusMsg?.embeds[0]?.description !== '## OFFLINE') {
                        await updateServerStatus(true);
                    }
                }
            }
        }
    });

    window.addEventListener("beforeunload", beforeUnloadUserUpdate);

    Hooks.on('changeSidebarTab', async (app) => {
        if (!logoutListenersAdded && app.tabName === "settings") {
            const element = app.element[0];
            const logout = element.querySelector('button[data-action="logout"]');
            const setup = element.querySelector('button[data-action="setup"]');
            const forgevtt = element.querySelector('button[data-action="forgevtt"]');
            if (logout) {
                logout.addEventListener('click', async () => {
                    window.removeEventListener('beforeunload', beforeUnloadUserUpdate);
                    await beforeUnloadUserUpdate();
                });
            }
            if (setup) {
                setup.addEventListener('click', backToSetupUpdate);
            }
            if (forgevtt) {
                forgevtt.addEventListener('click', backToSetupUpdate);
            }
            logoutListenersAdded = true;
        }
    });
}

async function beforeUnloadUserUpdate() {
    if (game.users.filter(user => user.active).length === 1) {
        updateServerStatus(true, true).then(() => { });
        sendUserMonitorMessage(game.user, false).then(() => { });
    }
}

async function backToSetupUpdate() {
    const hook = getThisModuleSetting('webHookURL');
    let serverCloseMsg = undefined;
    window.removeEventListener('beforeunload', beforeUnloadUserUpdate);
    adminDisconnect = true;
    if (hook && hook !== '' && getThisModuleSetting("userMonitor")) {
        const formData = api.generateSendFormData("Admin has closed the server.");
        serverCloseMsg = await api.sendMessage(formData, false, "");
    }
    await updateServerStatus(false);
    /*await wait(30000);
    console.log('foundrytodiscord | False alarm... resetting server status.');
    adminDisconnect = false;
    window.addEventListener("beforeunload", beforeUnloadUserUpdate);
    if (serverCloseMsg) {
        await api.deleteMessage(serverCloseMsg.response.url, serverCloseMsg.message.id);
        await updateServerStatus(true);
    }*/
}

export async function sendUserMonitorMessage(user, userConnected) {
    if (!getThisModuleSetting("userMonitor") || adminDisconnect) {
        return;
    }
    let numActive;
    const noUsers = game.users.filter(user => user.active).length === 1 && user.isSelf && !userConnected;
    if (noUsers) {
        numActive = 0;
    }
    else {
        numActive = game.users.filter(user => user.active).length;
    }
    const hook = getThisModuleSetting('webHookURL');
    if (hook && hook !== '') {
        const formData = new FormData();
        formData.append("payload_json", JSON.stringify({
            username: game.world.title,
            avatar_url: getDefaultAvatarLink(),
            content: `User ${user.name} ${userConnected ? "connected" : "disconnected"} ${userConnected ? "to" : "from"} ${game.world.title}. __**(${numActive}/${Array.from(game.users).length})**__`,
        }));
        return await api.sendMessage(formData, false, "");
    }
    return undefined;
}
