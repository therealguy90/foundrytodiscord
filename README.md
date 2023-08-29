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

### What it's confirmed *not* to support:

- DnD5e midi-qol mergecards, and some of midi-qol in general

### Future Plans:

- DnD5e partial support (likely without midi-qol mergecards)
- FVTT Chat Media support

--------------------------------------------------

## Screenshots

![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/02a174a5-ae1b-4e23-9d6b-eb2ab333c747)
![image](https://github.com/therealguy90/foundrytodiscord/assets/100253440/a56012ee-ab0b-46b7-94cb-7ff42ab2cb11)

--------------------------------------------------

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

## Setting up the Server Status Indicator on your Discord channel

As of version 1.1.0, this module now supports the detection of when your server goes online.
Check the "Enable Server Status Message" in the config of this module and follow the instructions to quickly set it up!

--------------------------------------------------

I have to thank caoranach for making DiscordConnect, as I did use some code from there to create Foundry to Discord, especially mimicking the options scheme of DiscordConnect, and of course, the same instructions to set it up.

If anyone wants to help with this project, you can talk with me on Discord @loki123. I'm always looking for help. If you want to port this over to a system you want, go ahead and open a PR! I'll help as much as I can.
