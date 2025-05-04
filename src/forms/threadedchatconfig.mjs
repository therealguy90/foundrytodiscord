const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { getThisModuleSetting } from "../../scripts/helpers/modulesettings.mjs";

export class ThreadedChatConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "threaded-chat-config",
        position: {
            width: 900,
            height: 600
        },
        window: {
            icon: "fas fa-comments",
            title: "Foundry to Discord Threaded Scenes: Scene-Thread Mapping"
        }
    };

    get title() {
        return "Foundry to Discord Threaded Scenes: Scene-Thread Mapping";
    }

    static PARTS = {
        threadedchatconfig: {
            template: "modules/foundrytodiscord/templates/threadedchat-config-menu.hbs"
        }
    };

    _prepareContext(options) {
        const scenes = game.scenes
            .filter(scene => !this.settingExistsForScene(scene.id))
            .map(scene => ({ id: scene.id, name: scene.name }));
        const threadedChatMap = getThisModuleSetting('threadedChatMap');
        const enrichedMap = Object.entries(threadedChatMap).reduce((acc, [sceneId, data]) => {
            const scene = game.scenes.get(sceneId);
            acc[sceneId] = {
                ...data,
                sceneName: scene?.name ?? "Unknown Scene"
            };
            return acc;
        }, {});
        return { scenes, threadedChatMap: enrichedMap };
    }

    _onRender(context, options) {
        const html = $(this.element);

        html.find('.delete-entry').click(async event => {
            const sceneId = event.currentTarget.getAttribute('data-scene-id-placeholder');
            const setting = getThisModuleSetting('threadedChatMap');
            delete setting[sceneId];
            await game.settings.set('foundrytodiscord', 'threadedChatMap', setting);
            this.render();
        });

        html.find('.add-entry').click(async (event) => {
            const sceneId = document.getElementById("sceneId").value;
            const chatThreadId = document.getElementById("chatThreadId").value.trim();
            const rollThreadId = document.getElementById("rollThreadId").value.trim();

            if (!sceneId || ((!chatThreadId || chatThreadId === "") && (!rollThreadId || rollThreadId === ""))) {
                return;
            }

            const setting = getThisModuleSetting('threadedChatMap');
            setting[sceneId] = { chatThreadId, rollThreadId };
            await game.settings.set('foundrytodiscord', 'threadedChatMap', setting);
            this.render();
        });
    }

    settingExistsForScene(sceneId) {
        const setting = getThisModuleSetting('threadedChatMap');
        return setting.hasOwnProperty(sceneId);
    }
}
