import { dataToBlob, generateimglink } from "./helpers/parser/images.mjs";
import { postParse, addEmbedsToRequests } from "./helpers/parser/messages.mjs";
import { toHTML } from "./helpers/parser/enrich.mjs";
import { getThisModuleSetting } from "./helpers/modulesettings.mjs";
import { isUserMainGM } from "./helpers/userfilter.mjs";
import * as api from '../api.js';
import { messageParser } from "../main.js";


// Application header buttons and other stuff
export async function initOtherHooks() {
    Hooks.on('deleteScene', async scene => {
        if (isUserMainGM()) {
            const threadedChatMap = getThisModuleSetting('threadedChatMap');
            if (threadedChatMap.hasOwnProperty(scene.id)) {
                delete threadedChatMap[scene.id];
                game.settings.set('foundrytodiscord', 'threadedChatMap', threadedChatMap);
            }
        }
    });
    let imagePopoutHookString = "";
    let chatLogHookString = "";
    // Removed in v14
    if (game.version.startsWith('13')) {
        imagePopoutHookString = "getHeaderControlsImagePopout";
        chatLogHookString = "getChatMessageContextOptions";
    }
    else {
        imagePopoutHookString = "getImagePopoutHeaderButtons";
        chatLogHookString = "getChatLogEntryContext";
    }

    Hooks.on(imagePopoutHookString, (app, controls) => {
        console.log(controls);
        controls.unshift(
            {
                label: "Send Image (Main Channel)",
                class: 'send-image-to-discord',
                icon: 'fa-brands fa-discord',
                onClick: async () => {
                    sendImage(app);
                },
                onclick: async () => {
                    sendImage(app);
                }
            },
            {
                label: "Send Image (Notes)",
                class: 'send-image-to-discord-notes',
                icon: 'fa-brands fa-discord',
                onClick: async () => {
                    sendImage(app, getThisModuleSetting('notesWebHookURL'));
                },
                onclick: async () => {
                    sendImage(app, getThisModuleSetting('notesWebHookURL'));
                },
                visible: getThisModuleSetting('notesWebHookURL') !== "" && (getThisModuleSetting('allowPlayerSend') || game.user.isGM)
            }
        );
    });
    Hooks.on(chatLogHookString, async (html, options) => {
        options.unshift(
            {
                name: "Send (Main Webhook)",
                icon: '<i class="fa-brands fa-discord"></i>',
                condition: game.user.isGM || getThisModuleSetting('allowPlayerSend'),
                callback: async li => {
                    api.sendMessageFromID(li.getAttribute("data-message-id"));
                }
            },
            {
                name: "Send (Player Notes)",
                icon: '<i class="fa-brands fa-discord"></i>',
                condition: getThisModuleSetting('notesWebHookURL') !== "" && (getThisModuleSetting('allowPlayerSend') || game.user.isGM),
                callback: async li => {
                    const { response, message } = await api.sendMessageFromID(li.getAttribute("data-message-id"), getThisModuleSetting('notesWebHookURL'));
                    if (response.ok) {
                        ui.notifications.info("Successfully sent to Discord Player Notes.");
                    }
                    else {
                        ui.notifications.error("An error occurred while trying to send to Discord. Check F12 for logs.");
                    }
                }
            },
            {
                name: "Delete (Foundry Chat Only)",
                icon: '<i class="fa-brands fa-discord"></i>',
                condition: game.user.isGM,
                callback: async li => {
                    let message = game.messages.get(li.getAttribute("data-message-id"));
                    let msgObjects;
                    if (getThisModuleSetting('messageList').hasOwnProperty(message.id) || getThisModuleSetting('clientMessageList').hasOwnProperty(message.id)) {
                        if (game.user.isGM) {
                            msgObjects = getThisModuleSetting('messageList')[message.id];
                        } else {
                            msgObjects = getThisModuleSetting('clientMessageList')[message.id];
                        }
                        delete msgObjects[message.id];
                        if (game.user.isGM) {
                            game.settings.set('foundrytodiscord', 'messageList', msgObjects);
                        }
                        else {
                            game.settings.set('foundrytodiscord', 'clientMessageList', msgObjects);
                        }
                    }
                    message.delete();
                }
            })
    });

    //v13 journal sheets have not updated to ApplicationV2 
    Hooks.on('getJournalSheetHeaderButtons', async (sheet, buttons) => {
        buttons.unshift({
            label: "Send Page (Main Channel)",
            class: 'send-page-to-discord',
            icon: 'fa-brands fa-discord',
            onclick: () => {
                sendJournal(sheet);
            }
        });
    });

    //Forien's Quest Log
    if (game.modules.get("forien-quest-log")?.active) {
        Hooks.on('getQuestPreviewHeaderButtons', (app, buttons) => {
            buttons.unshift({
                label: "Send Quest Details to Discord",
                class: 'send-to-discord',
                icon: 'fa-brands fa-discord',
                onclick: async () => {
                    const questData = app._quest;
                    let embeds = [];
                    //Build author object
                    let author = { name: "", icon_url: "" };
                    if (questData.giverData) {
                        author.name = questData.giverData.name;
                        author.icon_url = await generateimglink(questData.giverData.img);
                    }
                    //
                    let thumbnail = { url: "" };
                    if (questData.splash) {
                        thumbnail.url = await generateimglink(questData.splash);
                    }
                    //Build embed title
                    let title = "QUEST: " + questData._name;
                    switch (questData.status) {
                        case "active":
                            title = ":arrow_forward: " + title;
                            break;
                        case "inactive":
                            title = ":stop_button: " + title;
                            break;
                        case "available":
                            title = ":clipboard: " + title;
                            break;
                        case "completed":
                            title = ":white_check_mark: " + title;
                            break;
                        case "failed":
                            title = ":x: " + title;
                            break;
                        default:
                            break;
                    }
                    // Build Description
                    let description = await messageParser.formatText(questData.description);

                    let fields = [];
                    // Build Objectives field
                    const shownTasks = questData.tasks.filter(task => !task.hidden);
                    if (shownTasks && shownTasks.length > 0) {
                        let value = ""
                        shownTasks.forEach(task => {
                            if (task.completed) {
                                value += ":white_check_mark: ";
                            }
                            else if (task.failed) {
                                value += ":no_entry: ";
                            }
                            else {
                                value += ":blue_square: ";
                            }
                            value += task.name + "\n";
                        });
                        fields.push({
                            name: "Objectives",
                            value: value.trim()
                        })
                    }

                    // Build Rewards field
                    const shownRewards = questData.rewards.filter(reward => !reward.hidden);
                    if (shownRewards && shownRewards.length > 0) {
                        let value = ""
                        shownRewards.forEach(reward => {
                            value += reward.name + "\n";
                        });
                        fields.push({
                            name: "Rewards",
                            value: value.trim()
                        })
                    }
                    embeds = [{
                        author: author,
                        title: title,
                        thumbnail: thumbnail,
                        description: description,
                        fields: fields
                    }];
                    const params = {
                        username: game.user.name,
                        avatar_url: await generateimglink(game.user.avatar),
                        content: "",
                        embeds: embeds
                    };
                    const formData = new FormData();
                    formData.append('payload_json', JSON.stringify(params));
                    const response = api.sendMessage(formData, false, game.user.viewedScene)
                        .catch(error => {
                            ui.notifications.error("An error occurred while trying to send to Discord. Check F12 for logs.");
                        });
                    if (response.ok) {
                        ui.notifications.info("Successfully sent to Discord.");
                    } else {
                        throw new Error("An error occurred.");
                    }
                }
            });
        });
    }
}

async function sendJournal(sheet, hookOverride = undefined) {
    const pageIndex = sheet.pageIndex;
    const pageData = sheet._pages[pageIndex];
    let formData = new FormData();
    let embeds = [];
    let msgText = "";
    switch (pageData.type) {
        case "text":
            embeds = [{
                author: { name: "From Journal " + sheet.title },
                title: pageData.name,
                description: await messageParser.formatText(await toHTML(pageData.text.content))
            }];
            break;
        case "image":
            embeds = [{
                author: { name: "From Journal " + sheet.title },
                title: pageData.name,
                image: {
                    url: await generateimglink(pageData.src)
                },
                footer: {
                    text: pageData.image.caption
                }
            }];
            break;
        case "video":
            if (pageData.src.includes("http")) {
                msgText = pageData.src;
            } else {
                if (getThisModuleSetting('inviteURL') !== "http://") {
                    msgText = (getThisModuleSetting('inviteURL') + pageData.src);
                }
                else {
                    ui.notifications.error("foundrytodiscord | Invite URL not set!");
                }
            }
            break;
        default:
            ui.notifications.warn("Journal page type not supported.");
            break;
    }
    if (embeds.length > 0 || msgText !== "") {
        const user = game.user;
        const username = user.name;
        const imgurl = await generateimglink(game.user.avatar);
        let allRequests = await addEmbedsToRequests([{
            hook: undefined,
            params: {
                username: username,
                avatar_url: imgurl,
                content: msgText,
                embeds: []
            }
        }], undefined, username, imgurl, embeds, user);
        for (const request of allRequests) {
            const { waitHook, formData } = await postParse(undefined, request, hookOverride);
            const response = await api.sendMessage(formData, false, game.user.viewedScene, waitHook)
                .catch(error => {
                    ui.notifications.error("foundrytodiscord | An error occurred while trying to send to Discord. Check F12 for logs.");
                });
            if (response.ok) {
                ui.notifications.info("foundrytodiscord | Successfully sent to Discord.");
            }
            else {
                throw new Error("foundrytodiscord | An error occurred.");
            }
        }
    }
}

async function sendImage(app, hookOverride = undefined) {
    let formData = new FormData();
    let msgText = "";
    let imgblob;
    let src = app.options?.src || app.object; //AppV2 compatibility, removing in v14
    if (src.startsWith("data")) { //if src is data string
        imgblob = dataToBlob(app.object);
        const parts = app.object.split(';');
        if (parts.length < 2) {
            return 'jpg';
        }
        const mimeType = parts[0].split(':')[1];
        const fileExt = mimeType.split('/')[1];
        const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4'];
        if (supportedFormats.includes(fileExt)) {
            const params = {
                username: game.user.name,
                avatar_url: await generateimglink(game.user.avatar),
                content: ""
            }
            formData.append('files[0]', imgblob, "foundrytodiscord_sharedimage." + fileExt);
            formData.append('payload_json', JSON.stringify(params));
            const response = await api.sendMessage(formData, false, game.user.viewedScene, hookOverride)
                .catch(error => {
                    ui.notifications.error("foundrytodiscord | An error occurred while trying to send to Discord. Check F12 for logs.");
                });
            if (response.ok) {
                ui.notifications.info("foundrytodiscord | Successfully sent to Discord.");
            }
            else {
                throw new Error("foundrytodiscord | An error occurred.");
            }
        }
    }
    else { //if src is a URL
        let link;
        link = await generateimglink(src);
        if (link === "") {
            console.error("foundrytodiscord | Your Invite URL isn't set! Image was not sent.");
            return;
        }
        msgText += link;
        const params = {
            username: game.user.name,
            avatar_url: await generateimglink(game.user.avatar),
            content: msgText
        }
        formData.append('payload_json', JSON.stringify(params));
        const response = await api.sendMessage(formData, false, game.user.viewedScene, hookOverride)
            .catch(error => {
                ui.notifications.error("foundrytodiscord | An error occurred while trying to send to Discord. Check F12 for logs.");
            });
        if (response.ok) {
            ui.notifications.info("foundrytodiscord | Successfully sent to Discord.");
        }
        else {
            throw new Error("foundrytodiscord | An error occurred.");
        }
    }
}
