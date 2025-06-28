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

