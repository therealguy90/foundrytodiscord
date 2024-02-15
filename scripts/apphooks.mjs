import { reformatMessage } from "./generic.mjs";
import { PF2e_reformatMessage } from "./pf2e.mjs";
import { DnD5e_reformatMessage } from "./dnd5e.mjs";
import { dataToBlob, generateimglink } from "./helpers/images.mjs";
import { addEmbedsToRequests } from "./helpers/messages.mjs";
import { toHTML } from "./helpers/enrich.mjs";
import { getThisModuleSetting } from "./helpers/modulesettings.mjs";
import * as api from '../api.js';
import { postParse } from "../main.js";


// Application header buttons
export async function initMenuHooks() {
    Hooks.on('getJournalSheetHeaderButtons', async (sheet, buttons) => {
        buttons.unshift(
            {
                label: "Send Page (Main Channel)",
                class: 'send-page-to-discord',
                icon: 'fa-brands fa-discord',
                onclick: () => {
                    sendJournal(sheet);
                }
            },
            {
                label: "Send Page (Notes)",
                class: 'send-page-to-discord-notes',
                icon: 'fa-brands fa-discord',
                condition: getThisModuleSetting('notesWebHookURL') !== "" && (getThisModuleSetting('allowPlayerSend') || game.user.isGM),
                onclick: () => {
                    sendJournal(sheet, getThisModuleSetting('notesWebHookURL'));
                }
            },
        )
    });

    Hooks.on('getImagePopoutHeaderButtons', (sheet, buttons) => {
        buttons.unshift(
            {
                label: "Send Image (Main Channel)",
                class: 'send-image-to-discord',
                icon: 'fa-brands fa-discord',
                onclick: async () => {
                    sendImage(sheet);
                }
            },
            {
                label: "Send Image (Notes)",
                class: 'send-image-to-discord-notes',
                icon: 'fa-brands fa-discord',
                condition: getThisModuleSetting('notesWebHookURL') !== "" && (getThisModuleSetting('allowPlayerSend') || game.user.isGM),
                onclick: async () => {
                    sendImage(sheet, getThisModuleSetting('notesWebHookURL'));
                }
            }
        )
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
                        author.icon_url = generateimglink(questData.giverData.img);
                    }
                    //
                    let thumbnail = { url: "" };
                    if (questData.splash) {
                        thumbnail.url = generateimglink(questData.splash);
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
                    const reformat = getReformatter();
                    let description = await reformat(questData.description);

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
                        avatar_url: generateimglink(game.user.avatar),
                        content: "",
                        embeds: embeds
                    };
                    const formData = new FormData();
                    formData.append('payload_json', JSON.stringify(params));
                    api.sendMessage(formData, false, game.user.viewedScene)
                        .then(({ response, message }) => {
                            if (response.ok) {
                                ui.notifications.info("Successfully sent to Discord.");
                            }
                            else {
                                throw new Error("An error occurred.");
                            }
                        })
                        .catch(error => {
                            ui.notifications.error("An error occurred while trying to send to Discord. Check F12 for logs.");
                        });
                }
            });
        });
    }
}

async function sendJournal(sheet, hookOverride = undefined) {
    const pageIndex = sheet.pageIndex;
    const pageData = sheet._pages[pageIndex];
    let formData = new FormData();
    const reformat = getReformatter();
    let embeds = [];
    let msgText = "";
    switch (pageData.type) {
        case "text":
            embeds = [{
                author: { name: "From Journal " + sheet.title },
                title: pageData.name,
                description: await reformat(await toHTML(pageData.text.content))
            }];
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
        const imgurl = generateimglink(game.user.avatar);
        let allRequests = addEmbedsToRequests([{
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
            const { response, message } = await api.sendMessage(formData, false, game.user.viewedScene, waitHook)
                .catch(error => {
                    ui.notifications.error("An error occurred while trying to send to Discord. Check F12 for logs.");
                });

            if (response.ok) {
                ui.notifications.info("Successfully sent to Discord.");
            }
            else {
                throw new Error("An error occurred.");
            }
        }
    }
}

async function sendImage(sheet, hookOverride = undefined) {
    let formData = new FormData();
    let msgText = "";
    let imgblob;
    if (sheet.object.startsWith("data")) {
        imgblob = dataToBlob(sheet.object);
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
            api.sendMessage(formData, false, game.user.viewedScene, hookOverride)
                .then(({ response, message }) => {
                    if (response.ok) {
                        ui.notifications.info("Successfully sent to Discord.");
                    }
                    else {
                        throw new Error("An error occurred.");
                    }
                })
                .catch(error => {
                    ui.notifications.error("An error occurred while trying to send to Discord. Check F12 for logs.");
                });
        }
    }
    else {
        let link;
        link = generateimglink(sheet.object);
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
        api.sendMessage(formData, false, game.user.viewedScene, hookOverride)
            .then(({ response, message }) => {
                if (response.ok) {
                    ui.notifications.info("Successfully sent to Discord.");
                }
                else {
                    throw new Error("An error occurred.");
                }
            })
            .catch(error => {
                ui.notifications.error("An error occurred while trying to send to Discord. Check F12 for logs.");
            });
    }
}

function getReformatter() {
    switch (game.system.id) {
        case 'pf2e':
            return PF2e_reformatMessage;
            break;
        case 'dnd5e':
            return DnD5e_reformatMessage;
            break;
        default:
            return reformatMessage;
            break;
    }
}