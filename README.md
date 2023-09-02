<a href='https://ko-fi.com/loki123' target='_blank'><img height='35' style='border:0px;height:46px;' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' border='0' alt='Buy Me a Coffee at ko-fi.com' />


# Foundry to Discord

A lightweight FoundryVTT module that sends all FoundryVTT messages to a Discord webhook.

Only FULLY supports Pathfinder Second Edition, but anyone is welcome to help add custom support for other systems. Contact me @loki123 on Discord.
Will work on other systems, but to what extent, I do not know. Regular chat, chat cards, and rolls seem to work just fine on most other systems.

### What it supports:

Anonymous:

- Mimics the behavior of "anonymous" actors, including using the replacement names for descriptions and message aliases.
- For separation, sends over the token ID to discord with the replacement name(i.e. "Unknown NPC (V73Oqm1EL1KOoXOl)") This is to avoid discord grouping up same-named messages without checking if the last message was a different token with the same replacement name. This might have problems when the replacement name is REALLY long, but I doubt I need to accommodate for that.

Pf2e Target Damage:

- Multiple targets are also sent in to Discord!

Polyglot:

- Checks if the players know a language, and sends languages the players don't know to Discord as "Unintelligible". (This might change to a random text instead in the future to mimic Polyglot!)
- Useful for using Polyglot primarily for RP and knowing what the players can and can't understand by simply looking at Discord.
- Adds an option to the config, where the GM can set the only languages this module will "understand", and sends the rest to discord as "Unintelligible". Useful for party splits. Example, if you set this setting to only understand "dwarven, draconic", then even if players know a language different from these, it will still send to Discord as "Unintelligible" unless it's listed here!
- Adds an option to override what the "common" languages are in your world. This is so that messages sent in this language always pass the check for Polyglot, and are sent to Discord as plaintext.

Chat Media

- Image and video links and uploaded images are sent to Discord!

### What it's confirmed *not* to support:

- DnD5e midi-qol mergecards, and some of midi-qol in general

### Future Plans:

- DnD5e partial support (likely without midi-qol mergecards)

------------------------------------

## Setup

 1. Create a Webhook in your Discord server, and specify which channel to output chat to. Copy  the Webhook URL, you'll need it later.
    
  a. Server Settings (or channel settings) > Integrations > Webhooks > [New Webhook]
 
  b. Set webhook name and channel to post to.
 
  c. [Copy Webhook URL]
 
  *NOTE:* if you're planning on having different Foundry Worlds post to separate Discord OR a separate channel for Rolls, additional Webhooks will need to be created.
 
 2. Add the module to FoundryVTT.
    
 Add-on Modules > Install Module > Search for Foundry to Discord
 
 3. Open Foundry and enable the module.
    
 Game Settings > Manage Modules

 4. Configure the module settings in Foundry.
    
 Game Settings > Configure Settings > Foundry to Discord

 For Invite URL: Make sure your address is public! Use a tunnelling software if you can't forward ports.

Simply follow the hints provided by the settings, and use the webhook link from your channel as the Webhook URL. Also, make sure your invite URL is public, which means you'll need to be port-forwarded as usual. This is needed to supply the token images from your server to Discord. If you can't forward ports due to some limitation, you can use a network tunnel to expose your port to the internet. Personally, I recommend [Tailscale](https://www.reddit.com/r/FoundryVTT/comments/15lt40x/easy_public_foundry_vtt_hosting_using_tailscale), since it allows other devices to connect via LAN, as well as exposing a port to the internet. It takes some setting up to use, though, unlike other tunnelling software. Maybe I can even help you with this over on Discord!

## Getting Main GM ID

**Option A:**

1. Open browser Inspect/Developer Tools on the Foundry tab
Chrome: (Windows, Linux, Chrome OS): [F12] or Control+Shift+C
Chrome (Mac): Command+Option+C

2. Within Console type:
game.user for current user information
game.users for all user information

3. Expand to find the correct user's name and find the _id (> data : 16 character string)
This is the ID needed for the Main GM ID field.

**Option B:**

1. Install and enable the module, and provide a webhook.

2. Type **ftd getID** into chat as the user you would like to get the ID of.

3. Check your discord chat channel as defined by your webhook.

*NOTE:* The Main GM must be logged in for Foundry to Discord to work!

--------------------------------------------------

### Full Features:

#### Chat Mirroring

Publicly-seen messages are sent to Discord while attempting to block as much metagame data as possible depending on your other modules that may change how ChatMessages display information. This works well with the "anonymous" module.

Screenshots are from a Pathfinder Second Edition game. I do not guarantee other systems will have support for some ChatMessages, but regular rolls, regular chat-cards, and chat will work fine on ANY system.

Do note that this follows message deletions as well. If a message is deleted in Foundry, it will also be deleted in the channel. Although this can be disabled in the config, I suggest you keep it on for any "oopsie" moments.

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/b7eb9ebd-e64d-4f1e-9ffc-5fd85f025a99)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/caaa5350-fdf2-4aeb-a697-41f59551b506)

#### Threaded Scenes

Discord threads are also supported by Foundry to Discord simply by adding a `?thread_id` query parameter to your webhook URL, but one application of the threads is the **Threaded Scenes** feature. The configuration is quite simple, select a Scene in your world, and paste your Thread ID into the boxes. Do note that a Chat Thread must be a thread in the channel where you have your regular Webhook URL, and a Roll Thread must be a thread in the channel where you have your Roll Webhook URL. When this feature is used, all message traffic that is found in one scene is automatically sent to the corresponding thread.

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/c11578ba-5e52-4baf-b4ce-e6476cebcc20)

#### Server Status Message

Ever wanted your players to check for themselves if your world is online? Now you can! When a GM logs in to a world, it will set your server status as ONLINE in your Server Status Message. To let your players know it's offline, just have a GM type "ftd serveroff" in your world chat. Enable this feature in the config to set it up with a comprehensive step-by-step tutorial. Note that this feature is only available for your main Webhook URL.

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/8a7c5d08-870f-4155-9153-a822f82d0d6c)

#### The Foundry to Discord API

Foundry to Discord also lets you use its features externally! With the API, you can use a macro to send to, edit, and delete messages from your Discord channel-- the whole package! You just need a bit of javascripting knowledge to learn how to use it. Also works for advanced users of the API. 

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
