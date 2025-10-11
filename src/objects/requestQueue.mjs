/* A brief explanation of the queueing system:
* All requests are put into a queue such that everything executes in the order the hooks are detected in-game.
* This also allows any and all requests to stop if a rate limit is reached.
* A single object inqueue consists of a hook string, a FormData object, the message id, the request method, 
* (for deletions) the discord message ID, and the linked message ID number, for messages that get mapped to multiple discord messages.
* The client will attempt to send/edit/delete a message thrice, and if it fails every time, the request gets discarded from the queue.
* A successfully sent message is added to the object stored in a hidden module setting (max 100). This allows all clients to access
* previously-sent messages, and for the messages to not be erased after the client reloads their browser.
*/

import { localizeWithPrefix } from '../../scripts/helpers/localization.mjs';

export class DiscordRequestQueue {

    constructor() {
        this._requestQueue = [];
        this._isBusy = false;
    }

    /**
     * Adds a POST request to the queue using the webhook link and a FormData object.
     * @param {string} hook - The webhook link.
     * @param {FormData} formData - The FormData object of the message.
     * @returns {Promise<Response>} - A Promise that is resolved with a Response object when the request goes through the queue.
     */
    sendMessage(hook, formData) {
        return new Promise((resolve, reject) => {
            const completeRequestWebhook = `${!hook.includes("wait=true") ? `${hook}${hook.includes("?") ? "&" : "?"}wait=true` : hook}`;
            this._requestQueue.push({
                hook: completeRequestWebhook,
                formData: formData,
                method: "POST",
                resolve: resolve,
                reject: reject
            });
            this.#startQueue();
        })
    }

    /**
     * Adds a PATCH request to the queue using the webhook link and a FormData object.
     * @param {string} hook - The webhook link appended with /messages/ and the Discord Message ID.
     * @param {FormData} formData - The FormData object of the message.
     * @returns {Promise<Response>} - A Promise that is resolved with a Response object when the request goes through the queue.
     */
    editMessage(hook, formData) {
        return new Promise((resolve, reject) => {
            this._requestQueue.push({
                hook: hook,
                formData: formData,
                method: "PATCH",
                resolve: resolve,
                reject: reject
            });
            this.#startQueue();
        });
    }

    /**
     * Adds a DELETE request to the queue using the webhook link.
     * @param {string} hook - The webhook link appended with /messages/ and the Discord Message ID.
     * @returns {Promise<Response>} - A Promise that is resolved with a Response object when the request goes through the queue.
     */
    deleteMessage(hook) {
        return new Promise((resolve, reject) => {
            this._requestQueue.push({
                hook: hook,
                method: "DELETE",
                resolve: resolve,
                reject: reject,
                isLinked: false
            });
            this.#startQueue();
        });
    }

    /**
     * Used internally for removing messages from the module's memory. Not to be used externally.
     * @param {string} hook - The webhook link appended with /messages/ and the Discord Message ID.
     * @param {string} chatMessageID - The ID of the ChatMessage object that the Discord Message is linked to.
     * @returns {Promise<Response>} - A Promise that is resolved with a Response object when the request goes through the queue.
     */
    _deleteLinkedMessage(hook, chatMessageID) {
        return new Promise((resolve, reject) => {
            this._requestQueue.push({
                hook: hook,
                method: "DELETE",
                resolve: resolve,
                reject: reject,
                isLinked: true,
                msgID: chatMessageID
            });
            this.#startQueue();
        });
    }

    #clearQueue() {
        this._requestQueue = [];
    }

    #startQueue() {
        if (!this._isBusy) {
            this._isBusy = true;
            this.#requestOnce();
        }
    }

    async #requestOnce(retry = 0, ignoreRescuePartyFor = 0) {
        const { method, hook, resolve, reject, formData } = this._requestQueue[0];

        if (!method || !["POST", "PATCH", "DELETE"].includes(method)) {
            this._requestQueue.shift();
            console.error(localizeWithPrefix("foundrytodiscord.error.unknownRequestMethod", {}, false));
            this.#progressQueue();
            return;
        }

        console.log(localizeWithPrefix("foundrytodiscord.info.attemptingRequest", { method }, false))
        if (method === "DELETE") {
            if (ignoreRescuePartyFor === 0) {
                // Message flush rescue party!
                await this.#delay(250); // wait for more requests
                if (this._requestQueue.length > 1 && this._requestQueue[1].method === "DELETE" && this._requestQueue[0].msgID !== this._requestQueue[1].msgID) {
                    console.log(localizeWithPrefix("foundrytodiscord.logs.deletingMessagesQuickly"));
                    await this.#delay(1000);
                    const countedDeletions = this.#countSuccessiveDeletions();
                    if (countedDeletions > 10) {
                        console.group('Rescue party!');
                        console.log(localizeWithPrefix("foundrytodiscord.logs.deletionRescuePartyTriggered"));
                        console.log(localizeWithPrefix("foundrytodiscord.logs.deletionRescuePartyMessage"));
                        console.log(localizeWithPrefix("foundrytodiscord.logs.requestQueueCleared"));
                        console.groupEnd();
                        this.#clearQueue();
                        await this.#delay(5000);
                        this.#progressQueue();
                        return;
                    }
                    else {
                        console.log(localizeWithPrefix("foundrytodiscord.logs.deletionRescuePartyNotTriggered"))
                        ignoreRescuePartyFor = 10;
                    }
                }
            }
        }

        const requestOptions = {
            method,
            body: method !== 'DELETE' ? formData : undefined
        };

        try {
            const response = await fetch(hook, requestOptions);
            if (response.ok) {
                if (method === "DELETE") {
                    if (ignoreRescuePartyFor > 0) {
                        ignoreRescuePartyFor--;
                    }
                }
                resolve(response);
                this._requestQueue.shift();
                console.log(localizeWithPrefix("foundrytodiscord.logs.requestSucceeded", { method }));
                this.#progressQueue(retry, ignoreRescuePartyFor);
            } else if (response.status === 429) {
                const retryAfter = Number(response.headers.get("Retry-After")) || 1;
                console.log(localizeWithPrefix("foundrytodiscord.logs.rateLimitExceeded", { seconds: retryAfter / 100 }));
                await this.#delay(retryAfter * 10);
                this.#progressQueue(retry, ignoreRescuePartyFor);
            }
            else {
                throw new Error(response);
            }
        } catch (response) {
            console.error(localizeWithPrefix("foundrytodiscord.logs.fetchError", { status: response.status }));
            if (retry >= 2) {
                if (method === "DELETE") {
                    if (ignoreRescuePartyFor > 0) {
                        ignoreRescuePartyFor--;
                    }
                }
                reject(response);
                this._requestQueue.shift();
                console.log(localizeWithPrefix("foundrytodiscord.logs.requestDiscarded"));
                retry = 0;
            }
            else {
                retry++;
            }
            console.log(localizeWithPrefix("foundrytodiscord.logs.retrying"));
            this.#progressQueue(retry, ignoreRescuePartyFor);
        }
    }

    #progressQueue(retry = 0, ignoreRescuePartyFor = 0) {
        if (this._requestQueue.length > 0) {
            this.#requestOnce(retry, ignoreRescuePartyFor);
        } else {
            this._isBusy = false;
        }
    }

    #delay(milliseconds) {
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    #countSuccessiveDeletions() {
        let deletions = 0;
        let currentMessageID = "";
        for (const request of this._requestQueue) {
            if (request.method === "DELETE" && request.isLinked) {
                if (request.msgID !== currentMessageID) {
                    currentMessageID = request.msgID;
                    deletions++;
                }
                if (deletions > 10) {
                    break;
                }
            }
            else {
                break;
            }
        }
        return deletions;
    }

}

export function delay(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}