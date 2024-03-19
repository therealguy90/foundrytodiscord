import * as api from "../../../api.js";
import { getDefaultAvatarLink } from '../parser/images.mjs';
import { getThisModuleSetting } from '../modulesettings.mjs';


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
        const body = JSON.stringify({
            embeds: [{
                title: 'Server Status: ' + game.world.id,
                description: `## ONLINE\n${getThisModuleSetting('showInvite') ? `**Invite Link: **${getThisModuleSetting('inviteURL')}\n` : ''}\n__**${numActive}/${Array.from(game.users).length} Active Users**__`,
                footer: {
                    text: 'Have a GM type "ftd serveroff" in Foundry to set your server status to OFFLINE. This will persist until the next time a GM logs in.\n\n' + (game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version)
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
                title: 'Server Status: ' + game.world.id,
                description: '## OFFLINE',
                footer: {
                    text: game.modules.get('foundrytodiscord').id + ' v' + game.modules.get('foundrytodiscord').version
                },
                color: 16711680
            }]
        });

        editedMessage.append('payload_json', body);

        console.log('foundrytodiscord | Attempting to edit server status...');
        return await api.editMessage(editedMessage, getThisModuleSetting('webHookURL'), getThisModuleSetting('messageID'));
    }
}
