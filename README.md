[![Buy Me a Coffee](https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0)](https://ko-fi.com/loki123)

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
- Detects the languages known by players and sends languages they don't know to Discord as "Unintelligible."
- Adds options for the GM to specify which languages the module will "understand" and sends the rest to Discord as "Unintelligible."
- Allows overriding "common" languages in your world to ensure they pass the Polyglot check and are sent to Discord as plaintext.

**Chat Media / Chat GIFs / Similar Modules:**
- Sends image, video links, and uploaded images to Discord.

**Monk's Token Bar:**
- Supports Contested Rolls, Roll Requests, and Experience cards.

**Forien's Quest Log:**
- Adds a button to the window of a Quest that allows the details to be sent to Discord.

**Pf2e Target Damage:**
- Multiple targets are also sent to Discord.

**Pf2e Toolbelt:**
- Target damage helper save results are displayed if they're from a player.

**Midi QOL:**
- Edits Mergecards in real-time.

# WARNING(for versions below 1.8.x)
- If any of your modules automatically deletes the chat archive other than you clicking on the flush chat log button (i.e. DF Chat Enhancements Archive function), **DISABLE** Message Deletions via config first! Otherwise, your discord messages will be deleted!

## Known Issues:
- Foundry to Discord uses the same enrichers that a system uses for ease of parsing custom inline rolls and the like. This means that notification warnings or console errors may be doubled if the enricher throws them at you. Not a huge issue, but it's something.
- There's a very low chance that a midi-qol mergecard might not be parsed properly. I do not know the cause of this, and it is *almost* always the first mergecard the module encounters. Subsequent ones are fine... for some reason. If this ever happens to you, you can try resending the message by right-clicking on the message in Foundry and clicking "Send to Discord".

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
    - For the Invite URL, make sure your address is public. Use a tunneling software if you can't forward ports.

Follow the hints provided by the settings, and use the webhook link from your channel as the Webhook URL. Also, ensure your invite URL is public, which means you'll need to be port-forwarded as usual. If you can't forward ports due to limitations, you can use a network tunnel to expose your port to the internet. [Tailscale](https://www.reddit.com/r/FoundryVTT/comments/15lt40x/easy_public_foundry_vtt_hosting_using_tailscale) is recommended for this purpose.

**FAQ: Is the Invite URL necessary for the module to work?**
- The full features **require** a public invite link to be added to the config. Otherwise, Discord can't access images located on your server for avatars and etc. This should be done manually, since some people use network tunneling software to expose a port to the public internet.

---

### Full Features:

#### Chat Mirroring

Publicly-seen messages are sent to Discord while **attempting to block as much metagame data as possible**, depending on your other modules that may change how ChatMessages display information. This works well with the "anonymous" module.

Screenshots are from a Pathfinder Second Edition game. Compatibility with other systems may vary, but regular rolls, regular chat cards (using foundry's native .chat-card CSS styling), and chat will work fine on ANY system.
On DnD5e, roll cards from midi-qol are also supported.

Do note that this follows message deletions as well. If a message is deleted in Foundry, it will also be deleted in the channel. Although this can be disabled in the config, it is recommended to keep it on for any "oopsie" moments. When clicking on Reveal Message or Hide Message, it will also mirror it onto Discord, unless you have Ignore Whispers turned off, in which case whispers will always be displayed.


**Enhance your chat mirroring experience by enabling custom emojis! Go to the config and turn on "Use External Emojis". Webhooks use `@everyone` permissions, so make sure to enable `@everyone` to use external emojis on your server.**

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/78bd2264-1d7d-497a-acce-031b4ea468c8)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/9f228ea5-3849-41cf-91c6-4063505129aa)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/fe7953d7-c880-406b-9cc2-c16f341a62ff)


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

Allow your players to check if your world is online by setting your server status as ONLINE in your Server Status Message when a GM logs in. To indicate it's offline, have a GM type "ftd serveroff" in your world chat. Enable this feature in the config with a step-by-step tutorial. Note that this feature is only available for your main Webhook URL. Modules work client-side, so there's not much other better solutions to the problem other than the GM manually using the command to set it offline.

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

Available methods:
#### IMPORTANT NOTE! These methods do not abide with Discord's rate limiting system, so don't spam the requests too much or YOU will be banned from using the API for about an hour!
#### When using these methods in another module, make sure to use the response headers that the methods return to know when you've hit the rate limit! 

### Refer to the [Discord Webhook documentation](https://discord.com/developers/docs/resources/webhook).

```javascript
/* generateSendFormData allows anyone to formulate a simple message that can be sent to the webhook without much knowledge of javascript or the Discord API.
*  Parameters:
*  (string) content (required): A string of characters to be sent as a message. If you only want to send an embed, leave this as "".
*  (Array) embeds (optional, default=[]): Up to 10 embeds can be included here. Refer to https://discord.com/developers/docs/resources/webhook for instructions on how to construct an embed.
*  (string) username (optional, default=game.user.name): A custom username for your message. The default is your client username.
*  (string) avatar_url (optional, default is the FoundryVTT icon): A link to a JPG, PNG, or WEBP that can be accessed publicly. This will be used as the avatar of the webhook for that message.
*  Output: a FormData object containing parameters that are compatible with the Discord webhook, and can be used in junction with Foundry to Discord's API sendMessage() method.
*/
let myMessageContents = ftd.generateSendFormData("Hello, World!");
```

```javascript
/* (async) sendMessage sends a message to the webhook.
*  Parameters:
*  (FormData) formData (required): A FormData object containing the specifics of the message being sent.
*  (boolean) isRoll (optional, default=false): Determines whether the message being sent is ending up in the Webhook URL, or the Roll Webhook URL.
*  (string) sceneID (optional, default=""): If your world is using the Threaded Scenes feature, inputting a scene ID here will let the module know where to send it.
*  Output: Returns an Object with the API response and the Discord Message object in the format of { response, message }. These can later be used to edit or delete the message that was sent using editMessage() and deleteMessage() respectively.
*/
const responseAndMessage = await ftd.sendMessage(myMessageContents);
```

```javascript
/* (async) editMessage edits a message in the channel or thread.
*  Parameters:
*  (FormData) formData (required): A FormData object containing the specifics of the message that will replace the contents of the specified message in discord.
*  (string) webhook (required): The URL that was used to send the message. If you used sendMessage(), you can use the url in the response that it returns.
*  (string) messageID (required): The Discord message ID of the message that will be edited.
*  Output: This sort of request usually ends in a 204 code, which means no response body will be in the response, but editMessage() will return a response anyways for headers.
*/
await ftd.editMessage(newMessageFormData, responseAndMessage.response.url, responseAndMessage.message.id);
```

```javascript
/* (async) deleteMessage deletes a message in the channel or thread.
*  Parameters:
*  (string) webhook (required): The URL that was used to send the message. If you used sendMessage(), you can use the url that it returns.
*  (string) messageID (required): The Discord message ID of the message that will be edited.
*  Output: This sort of request usually ends in a 204 code, which means no response body will be in the response, but deleteMessage() will return a response anyways for headers.
*/
await ftd.deleteMessage(responseAndMessage.response.url, responseAndMessage.message.id);
```

--------------------------------------------------

I have to thank caoranach for making DiscordConnect, as I did use some code from there to create Foundry to Discord, especially mimicking the options scheme of DiscordConnect, and of course, the same instructions to set it up.

If anyone wants to help with this project, you can talk with me on Discord @loki123. I'm always looking for help. If you want to port this over to a system you want, go ahead and open a PR! I'll help as much as I can.
