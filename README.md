[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/C0C0OL95Y)

# Foundry to Discord

A lightweight FoundryVTT module that sends all FoundryVTT messages to a Discord webhook. It has the capability to edit AND delete messages in real-time, making it great for play-by-post-style campaigns, logging, and more! Read the full features below.

**System Support:**
- Pathfinder Second Edition
- DnD 5e

While it will work with other systems, the extent of compatibility may vary. Regular chat, chat cards, and rolls seem to work just fine on most other systems.

### What it Supports

**Anonymous:**
- Mimics the behavior of "anonymous" actors, including using replacement names for descriptions and message aliases.
- To avoid Discord grouping up same-named messages, it sends the token ID to Discord with the replacement name (e.g., "Unknown NPC (V73O****)").

**Polyglot:**
- Detects the languages known by players and sends languages they don't know to Discord as jumbled letters.
- Adds options for the GM to specify which languages the module will "understand".

**Chat Media / Chat GIFs / Similar Modules:**
- Sends image, video links, and uploaded images to Discord.

**Monk's Token Bar:**
- Supports Contested Rolls, Roll Requests, and Experience cards.

**Forien's Quest Log:**
- Adds a button to the window of a Quest that allows the details to be sent to Discord.

**Pf2e Toolbelt:**
- Target damage helper save results are displayed if they're from a player.

**Midi QOL:**
- Edits Mergecards in real-time.

## Known Issues:
- Foundry to Discord uses the same enrichers that a system uses for ease of parsing custom inline rolls and the like. This means that notification warnings or console errors may be doubled if the enricher throws them at you. Not a huge issue, but it's something.
- There's a very low chance that a midi-qol mergecard might not be parsed properly. I do not know the cause of this, and it is *almost* always the first mergecard the module encounters. Subsequent ones are fine... for some reason. If this ever happens to you, you can try resending the message by right-clicking on the message in Foundry and clicking "Send (Main Channel)".

## Frequently Asked Suggestions:

**How about adding more webhooks so I can have the chat stream to two servers?**
- Rate limiting is the main limiting factor in this. Modules like midi-qol are already pushing the rate limit as it is (mergecards edit the same message about 5 or 6 times in less than a second). Adding more webhooks is just going to make the module slower to respond (messages won't be lost to the rate limits because of the queueing system Foundry to Discord implements). However, you're free to do anything with Foundry to Discord, and that includes making a copy of it on your machine, changing the package names to something different, and setting it up as usual. This will allow you to have two different channels with different settings, mirroring the same chat, but it's obviously not recommended to do so, and I won't be supporting the use of two or more instances of the module.

**Sending statblocks to Discord**
- Every actor structure is different. While I would love to do this, it's simply a matter of maintaining sheet parsers for every system I'll support, and it's a one-man team over here. I advise you to make a macro for your system using the API and share it around to folks who want this sort of functionality.

## Setup

1. Create a Webhook in your Discord server and specify the channel to output chat to. Copy the Webhook URL; you'll need it later.
    - Server Settings (or channel settings) > Integrations > Webhooks > [New Webhook]
    - Set the webhook name and channel to post to.
    - [Copy Webhook URL]
   
   *NOTE:* If you plan on having different Foundry Worlds post to separate Discord OR a separate channel for Rolls, you'll need additional Webhooks.

2. Add the module to FoundryVTT.
    - Add-on Modules > Install Module > Search for Foundry to Discord

3. Open Foundry and enable the module.
    - Game Settings > Manage Modules

4. Configure the module settings in Foundry.
    - Game Settings > Configure Settings > Foundry to Discord
    - For the Invite URL, make sure your address is public. Use a tunneling software if you can't forward ports. Do not include /join, only the first part of the URL is needed.

Follow the hints provided by the settings, and use the webhook link from your channel as the Webhook URL. Also, ensure your invite URL is public, which means you'll need to be port-forwarded as usual. If you can't forward ports due to limitations, you can use a network tunnel to expose your port to the internet. [Tailscale](https://www.reddit.com/r/FoundryVTT/comments/15lt40x/easy_public_foundry_vtt_hosting_using_tailscale) is recommended for this purpose.

**FAQ: Is the Invite URL necessary for the module to work?**
- The full features **require** a public invite link to be added to the config. Otherwise, Discord can't access images located on your server for avatars and etc. This should be done manually, since some people use network tunneling software to expose a port to the public internet. For Forge users: use your forge-vtt.com link, and set your game to public, so this module can pick up images from your server.

---

### Full Features:

#### Chat Mirroring

Publicly-seen messages are sent to Discord while **attempting to block as much metagame data as possible**, depending on your other modules that may change how ChatMessages display information. This works well with the "anonymous" module.

Screenshots are from a Pathfinder Second Edition game. Compatibility with other systems may vary, but regular rolls, regular chat cards (using foundry's native .chat-card CSS styling), and chat will work fine on ANY system.
On DnD5e, roll cards from midi-qol are also supported.

Do note that this follows message deletions as well. If a message is deleted in Foundry, it will also be deleted in the channel. Although this can be disabled in the config, it is recommended to keep it on for any "oopsie" moments. When clicking on Reveal Message or Hide Message, it will also mirror it onto Discord, unless you have Ignore Whispers turned off, in which case whispers will always be displayed.

Clearing the chat log via the button **does not** delete any of your Discord messages, unless there are 10 or less messages in the chat log, as the module will automatically detect a deletion of more than 10 ChatMessages and cancel deleting the corresponding messages on Discord. Similarly, using ChatMessage.deleteDocuments on more than 10 ChatMessage objects will trigger the same detection system.


**Enhance your chat mirroring experience by enabling custom emojis! Go to the config and turn on "Use External Emojis". Webhooks use `@everyone` permissions, so make sure to enable `@everyone` to use external emojis on your server.**

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/78bd2264-1d7d-497a-acce-031b4ea468c8)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/9f228ea5-3849-41cf-91c6-4063505129aa)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/4e981c36-80e5-4981-a50c-3d882e652428)


#### Send to Discord

Journal Entries, Image Popouts, and even individual chat messages have a "Send" button on the window header or on the chat message context menu, either to the Main Channel webhook, or a separate Player Notes webhook. Journal Entries will send the current page you're looking at. 

#### UUID Tag Auto-Embeds

Messages containing UUID tags of items or journal entriess will automatically show the description of the item or the contents of the journal entry.

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/e61d0fe9-3ef4-4c0b-b90f-dcec164815d2)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/2f9fa584-5e40-4da0-8898-40227f4f8164)


#### Threaded Scenes

Discord threads are supported by Foundry to Discord by adding a `?thread_id` query parameter to your webhook URL, but one application of threads is the **Threaded Scenes** feature. Select a Scene in your world, and paste your Thread ID into the boxes. When this feature is used, all message traffic that is found in one scene is automatically sent to the corresponding thread.

![Threaded Scenes Example](https://github.com/therealguy90/foundrytodiscord/assets/100253440/c11578ba-5e52-4baf-b4ce-e6476cebcc20)

#### Auto-Ping

Map a keyword to ping a user from Foundry without having to tab out to Discord!

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/36529bf7-9c1e-4855-9e01-19ec7c4138d2)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/e881517a-d1da-4108-a401-ff72a9c8a2c8)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/e0686c9a-d4c7-46eb-8038-093e6b09b1a5)


#### Server Status Message

Allow your players to check if your world is online by setting your server status as ONLINE in your Server Status Message when a GM logs in. To indicate it's offline, have a GM type "ftd serveroff" in your world chat. Enable this feature in the config with a step-by-step tutorial. Note that this feature is only available for your main Webhook URL. Clicking on Return to Setup / Back to the Forge (for Forge users) also automatically sets the Server Status Message to Offline.

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/02d34b9f-ead9-477e-aac4-5ffc44758821)

#### User Login Alerts

Toggle the module setting on to send an alert to your Discord channel whenever someone logs in to the server. The Server Status Message already indicates how many players are in the server, but this will alert you to when a certain user logs in to the server through your Discord channel.

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/57f8f9c6-c3b2-4cce-bc6a-563146fca1f7)


#### The Foundry to Discord API

Foundry to Discord also lets you use its features externally with the API. You can use a macro to send to, edit, and delete messages from your Discord channel. A bit of JavaScript knowledge is required to use it.

**Usage**

Declaration:
```javascript
const ftd = game.modules.get('foundrytodiscord').api
```

**Starting from the v2.0.0 update, all API requests are properly rate-limited.**

Available methods:

```javascript

/**
 * generateSendFormData generates a Discord-compatible FormData object to use as the request body. 
 * @param {string} content - The text content of the message to send.
 * @param {Array} embeds - An array of embeds (max 10.) Default: []
 * @param {string} username - The username to be used on Discord. Default: game.user.name
 * @param {string} avatar_url - The URL of an image that the webhook will use as an avatar. Default: FoundryVTT icon.
 * @returns {FormData} - A Discord-compatible FormData object with the specified parameters.
 */
let myMessageContents = ftd.generateSendFormData("Hello, World!");

/**
* sendMessageFromID parses and sends a Foundry ChatMessage to a webhook via ID.
* @param {string} messageID - The ID of the ChatMessage in game.messages
* @param {string} hookOverride - Default: The WebHook URL or Roll WebHook URL you set in Foundry to Discord's settings. If this is overriden, the message will not be edited nor deleted by the module through Chat Mirroring.
* @returns {Promise<Response>} - The API response. To get the message object, use response.json()
*/
let response = await ftd.sendMessageFromID("ZwQpsUpdEbruORfF");

/**
 * sendMessage sends a message to Discord using a FormData object.
 * @param {FormData} formData - A Discord-compatible FormData object.
 * @param {Boolean} isRoll - Default: False. If this is true, your message will be sent to the Roll WebHook URL if hookOverride is not defined.
 * @param {string} sceneID - The ID of the scene, in the case of Threaded Scenes. Default: The currently viewed scene.
 * @param {string} hookOverride - Default: The WebHook URL or Roll WebHook URL you set in Foundry to Discord's settings.
 * @returns {Promise<Response>} - The API response. To get the message object, use response.json()
 */
response = await ftd.sendMessage(myMessageContents);

/**
 * editMessage edits a message from a webhook's channel via the Discord Message ID.
 * @param {FormData} formData - A Discord-compatible FormData object.
 * @param {string} webhook - The webhook link. You can get this via Response.url when a message is sent successfully.
 * @param {string} messageID - The Discord Message ID. You can get this via (await Response.json()).id when a message is sent successfully.
 * @returns {Promise<Response>} - The API response.
 */

const messageURL = response.url;
const message = await response.json(); //Returns a Discord Message Object
const myEditContents = ftd.generateSendFormData("Message is Edited!");
response = await ftd.editMessage(myEditContents, messageURL, message.id);

/**
 * deleteMessage deletes a message from a webhook's channel via the Discord Message ID.
 * @param {string} webhook - The webhook link. You can get this via Response.url when a message is sent successfully.
 * @param {string} messageID - The Discord Message ID. You can get this via (await Response.json()).id when a message is sent successfully.
 * @returns {Promise<Response>} - The API response.
 */
response = await ftd.deleteMessage(messageURL, message.id);

```

--------------------------------------------------

Foundry to Discord will always be free and open-source. While you can support me via [ko-fi](https://ko-fi.com/loki123), I will never lock away features for money. I'm no expert in making modules (I make mistakes sometimes :P), but I hope you enjoy using Foundry to Discord for as long as I can keep updating.

--------------------------------------------------

I have to thank caoranach for making DiscordConnect, as I did use some code from there to create Foundry to Discord, especially mimicking the options scheme of DiscordConnect, and of course, the same instructions to set it up.

If anyone wants to help with this project, you can talk with me on Discord @loki123. I'm always looking for help. If you want to port this over to a system you want, go ahead and open a PR! I'll help as much as I can.
