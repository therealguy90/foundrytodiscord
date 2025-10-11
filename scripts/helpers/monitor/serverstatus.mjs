import * as api from "../../../api.js";
import { getDefaultAvatarLink } from '../parser/images.mjs';
import { getThisModuleSetting } from '../modulesettings.mjs';
import { localizeWithPrefix } from '../localization.mjs';


// For Server Status Message
export async function initSystemStatus() {
    if (getThisModuleSetting('serverStatusMessage')) {
        if (getThisModuleSetting('messageID') && getThisModuleSetting('messageID') !== "") {
            await updateServerStatus(true);
        } else {
            const hook = getThisModuleSetting('webHookURL');
            if (hook && hook !== '') {
                const formData = new FormData();
                formData.append("payload_json", JSON.stringify({
                    username: game.world.title,
                    avatar_url: getDefaultAvatarLink(),
                    content: '',
                    embeds: [{
                        title: game.i18n.localize("foundrytodiscord.statusMonitor.setupTitle"),
                        description: game.i18n.localize("foundrytodiscord.statusMonitor.setupDescription"),
                        footer: {
                            text: game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version
                        }
                    }]
                }));
                await api.sendMessage(formData, false, undefined);
            }
        }
    }
}

export async function updateServerStatus(online, noneActive = false) {
    if (online) {
        let numActive;
        if (noneActive) {
            numActive = 0;
        }
        else {
            numActive = game.users.filter(user => user.active).length;
        }
        const editedMessage = new FormData();
        const invitePart = getThisModuleSetting('showInvite') ? 
            game.i18n.format("foundrytodiscord.statusMonitor.inviteLink", { inviteURL: getThisModuleSetting('inviteURL') }) + '\n' : '';
        const activeUsersPart = game.i18n.format("foundrytodiscord.statusMonitor.activeUsers", { 
            activeUsers: numActive, 
            totalUsers: Array.from(game.users).length 
        });
        
        const body = JSON.stringify({
            embeds: [{
                title: game.i18n.format("foundrytodiscord.statusMonitor.serverStatusTitle", { worldId: game.world.id }),
                description: `${game.i18n.localize("foundrytodiscord.statusMonitor.onlineStatus")}\n${invitePart}\n${activeUsersPart}`,
                footer: {
                    text: game.i18n.localize("foundrytodiscord.statusMonitor.offlineFooter") + '\n\n' + (game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version)
                },
                color: 65280
            }]
        });
        editedMessage.append('payload_json', body);
        return await api.editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
    }
    else {
        const editedMessage = new FormData();
        const body = JSON.stringify({
            embeds: [{
                title: game.i18n.format("foundrytodiscord.statusMonitor.serverStatusTitle", { worldId: game.world.id }),
                description: game.i18n.localize("foundrytodiscord.statusMonitor.offlineStatus"),
                footer: {
                    text: game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version
                },
                color: 16711680
            }]
        });

        editedMessage.append('payload_json', body);

        console.log(localizeWithPrefix("foundrytodiscord.logs.attemptingEditServerStatus"));
        return await api.editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
    }
}
