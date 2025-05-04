import { getThisModuleSetting } from "../../scripts/helpers/modulesettings.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class AutoPingConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "auto-ping-form",
        position: {
            width: 900,
            height: 600
        },
        tag: "autopingform",
        window: {
            icon: "fas fa-gear",
            title: "test"
        }
    }

    get title() {
        return "Foundry to Discord: Auto-Ping Mapper Tool"
    }

    static PARTS = {
        autopingform: {
            template: "modules/foundrytodiscord/templates/autoping-config-menu.hbs"
        }
    }

    _prepareContext(options) {
        const autoPingMap = getThisModuleSetting('autoPingMap') ?? {};
        console.log("[AutoPingConfig] Rendering with autoPingMap:", autoPingMap);
        return { autoPingMap };
    }

    _onRender(context, options) {
        const html = $(this.element);
        
        // Handle click on the 'Add Mapping' button
        html.find('.add-entry').click(async (event) => {
            const type = document.getElementById("type").value;
            const keyword = document.getElementById("keyword").value.trim();
            const ID = document.getElementById("ID").value.trim();
    
            if (!type || !keyword || !ID) {
                ui.notifications.error('Please fill out all fields.');
                return;
            }
    
            // Add row to the table manually
            const tableBody = document.getElementById("config-rows");
            const row = document.createElement("tr");
    
            row.innerHTML = `
                <td style="text-align: center;">${keyword}</td>
                <td style="text-align: center;">${type}</td>
                <td style="text-align: center;">${ID}</td>
                <td>
                    <button class="btn btn-danger delete-entry" data-keyword-placeholder="${keyword}">
                        Delete
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
            
            // Optionally clear the form fields after adding the entry
            document.getElementById("type").value = '';
            document.getElementById("keyword").value = '';
            document.getElementById("ID").value = '';
            
            // Persist the data if necessary (e.g., update Foundry settings)
            const setting = getThisModuleSetting('autoPingMap');
            setting[keyword] = { type, ID };
            await game.settings.set('foundrytodiscord', 'autoPingMap', setting);
    
            this.render();
        });
    
        // Handle click on the 'Delete' button (as you already have)
        html.find('.delete-entry').click(async (event) => {
            const keyword = event.currentTarget.getAttribute('data-keyword-placeholder');
            const setting = getThisModuleSetting('autoPingMap');
            delete setting[keyword];
            await game.settings.set('foundrytodiscord', 'autoPingMap', setting);
            this.render();
        });
    }

}

/*
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
*/