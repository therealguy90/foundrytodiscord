import { getThisModuleSetting } from "../../scripts/helpers/modulesettings.mjs";

export class ThreadedChatConfig extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: 'Foundry to Discord Threaded Scenes: Scene-Thread Mapping',
            template: 'modules/foundrytodiscord/templates/threadedchat-config-menu.html',
            width: 750,
            height: 600,
            closeOnSubmit: false,
            tabs: [{ navSelector: '.tabs', contentSelector: '.tabs-content', initial: 'sceneTab' }]
        });
    }


    getData() {
        const scenes = game.scenes
            .filter(scene => !this.settingExistsForScene(scene.id))
            .map(scene => ({ id: scene.id, name: scene.name }));
        const threadedChatMap = getThisModuleSetting('threadedChatMap');
        return { scenes, threadedChatMap };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.delete-entry').click(async event => {
            const sceneId = event.currentTarget.getAttribute('data-scene-id-placeholder');
            const setting = getThisModuleSetting('threadedChatMap');
            delete setting[sceneId];
            await game.settings.set('foundrytodiscord', 'threadedChatMap', setting);
            this.render();
        });
    }

    async _updateObject(event, formData) {
        const sceneId = formData.sceneId;
        const chatThreadId = formData.chatThreadId;
        const rollThreadId = formData.rollThreadId;
        if (!sceneId || ((!chatThreadId || chatThreadId === "") && (!rollThreadId || rollThreadId === ""))) {
          return;
        }
    
        const setting = getThisModuleSetting('threadedChatMap');
        setting[sceneId] = {chatThreadId: chatThreadId, rollThreadId: rollThreadId};
        await game.settings.set('foundrytodiscord', 'threadedChatMap', setting);
        this.render();
      }

    async _renderInner(data, options) {
        const inner = await super._renderInner(data, options);

        const configRows = inner.find('#config-rows');
        for (const [sceneId, threads] of Object.entries(data.threadedChatMap)) {
            const scene = game.scenes.get(sceneId);
            const sceneName = scene ? scene.name : 'Unknown Scene';
            const rowHtml = `
            <tr>
              <td style="text-align: center;">${sceneName}</td>
              <td style="text-align: center;">${threads.chatThreadId}</td>
              <td style="text-align: center;">${threads.rollThreadId}</td>
              <td><button class="btn btn-danger delete-entry" data-scene-id-placeholder="${sceneId}">Delete</button></td>
            </tr>
          `;
            configRows.append(rowHtml);
        }

        return inner;
    }

    settingExistsForScene(sceneId) {
        const setting = getThisModuleSetting('threadedChatMap');
        return setting.hasOwnProperty(sceneId);
    }
}