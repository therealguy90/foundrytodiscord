import { getThisModuleSetting } from "../../scripts/helpers/modulesettings.mjs";

export class AutoPingConfig extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: 'Foundry to Discord: Auto-Ping Mapper Tool',
            template: 'modules/foundrytodiscord/templates/autoping-config-menu.html',
            width: 750,
            height: 600,
            closeOnSubmit: false,
            tabs: [{ navSelector: '.tabs', contentSelector: '.tabs-content', initial: 'autoPingTab' }]
        });
    }


    getData() {
        const autoPingMap = getThisModuleSetting('autoPingMap');
        return { autoPingMap };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.delete-entry').click(async event => {
            const keyword = event.currentTarget.getAttribute('data-keyword-placeholder');
            const setting = getThisModuleSetting('autoPingMap');
            delete setting[keyword];
            await game.settings.set('foundrytodiscord', 'autoPingMap', setting);
            this.render();
        });
    }

    async _updateObject(event, formData) {
        const keyword = formData.keyword.trim();
        const ID = formData.ID;
        const type = formData.type;

        // Check for spaces in the keyword
        if (keyword.includes(" ")) {
            ui.notifications.warn("Keyword cannot contain spaces.");
            return;
        }

        // Check for disallowed substrings and usernames
        const disallowedSubstrings = ['@', '#', ':', '```', 'discord'];
        const disallowedUsernames = ['everyone', 'here'];
        for (const substring of disallowedSubstrings) {
            if (keyword.includes(substring)) {
                ui.notifications.warn(`Keyword cannot contain the substring '${substring}'.`);
                return;
            }
        }
        if (disallowedUsernames.includes(keyword.toLowerCase())) {
            ui.notifications.warn("The keyword cannot be 'everyone' or 'here'.");
            return;
        }

        if (!keyword || !type || !ID) {
            ui.notifications.warn('Please fill out all fields.');
            return;
        }

        const setting = getThisModuleSetting('autoPingMap');
        if (setting.hasOwnProperty(keyword)) {
            ui.notifications.warn(`Keyword '${keyword}' already exists.`);
            return;
        }

        setting[keyword] = { type: type, ID: ID };
        await game.settings.set('foundrytodiscord', 'autoPingMap', setting);
        this.render();
    }

    async _renderInner(data, options) {
        const inner = await super._renderInner(data, options);

        const configRows = inner.find('#config-rows');
        for (const [keyword, mapping] of Object.entries(data.autoPingMap)) {
            const rowHtml = `
            <tr>
              <td style="text-align: center;">${keyword}</td>
              <td style="text-align: center;">${mapping.type}</td>
              <td style="text-align: center;">${mapping.ID}</td>
              <td><button class="btn btn-danger delete-entry" data-keyword-placeholder="${keyword}">Delete</button></td>
            </tr>
          `;
            configRows.append(rowHtml);
        }

        return inner;
    }
}
