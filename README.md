# Foundry to Discord
A lightweight FoundryVTT module that sends all FoundryVTT messages to a Discord webhook.

Only FULLY supports Pathfinder Second Edition, but anyone is welcome to help add custom support for other systems. Contact me @loki123 on Discord.
Will work on other systems, but to what extent, I do not know. Regular chat, chat cards, and rolls seem to work just fine on most other systems.

What it supports:

Anonymous:
- Mimics the behavior of "anonymous" actors, including using the replacement names for descriptions and message aliases.
- For separation, sends over the token ID to discord with the replacement name(i.e. "Unknown NPC (V73Oqm1EL1KOoXOl)") This is to avoid discord grouping up same-named messages without checking if the last message was a different token with the same replacement name. This might have problems when the replacement name is REALLY long, but I doubt I need to accommodate for that.

Pf2e Target Damage:
- Multiple targets are also sent in to Discord!

Polyglot:
- Checks if the players know a language, and sends languages the players don't know to Discord as "Unintelligible". (This might change to a random text instead in the future to mimic Polyglot!)
- Useful for using Polyglot primarily for RP and knowing what the players can and can't understand by simply looking at Discord.
- Adds an option to the config, where the GM can set the only languages this module will "understand", and sends the rest to discord as "Unintelligible". Useful for party splits. Example, if you set this setting to only understand "dwarven, draconic", then even if players know a language different from these, it will still send to Discord as "Unintelligible" unless it's listed here!

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

4. Configure the module settings in Foundry. See below for info on each setting.
Game Settings > Configure Settings > Module Settings

That's it!

**Ignore Whispers & Private Rolls:** Enable this to ensure GM and Private messages, (both rolls and chat) aren't posted to Discord for all to see.

**Game Invite URL:** the external, internet URL everyone connects to the server through, this is used for discord avatars if token images are located on your server.
Game Settings > Game Access > Invitation Links "Internet"

Tip: Use a network tunnel, such as Ngrok, playit, or Tailscale Funnel if you don't have access to portforwarding.

**Webhook URL:** Discord Webhook URL from Step 1. This is where chat will be sent, not including rolls.

**Roll Webhook URL:** Discord Webhook URL for rolls - either the same webhook for rolls to appear in the same channel as chat, or a separate webhook needs to be setup for the rolls to appear in. Leave empty to ignore all rolls.

#Getting Main GM ID
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

2. Type **dc getID** into chat as the user you would like to get the ID of.

3. Check your discord chat channel as defined by your webhook.

*NOTE:* The Main GM must be logged in for Foundry to Discord to work!

--------------------------------------------------

I have to thank caoranach for making DiscordConnect, as I did use some code from there to create Foundry to Discord, especially mimicking the options scheme of DiscordConnect, and of course, the same instructions to set it up.
Sadly, this only really works with PF2e, and I'm pretty much a newbie when it comes to making Foundry modules, so I definitely need some tips. This has been a personal project of mine, as I really want to have a way to log chat posts to Discord, since our group's been using Discord for play-by-post since we've started playing Pathfinder 2e years ago.

If anyone wants to help with this project, you can talk with me on Discord @loki123. I'm always looking for help. If you want to port this over to a system you want, go ahead and open a PR! I'll help as much as I can.
