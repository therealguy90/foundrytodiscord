# 1.11.0

- #27 Added Login/Logout monitoring. Enable `Monitor User Login/Logout` for this to function.
- "Return to Setup" button on the sidebar now sets the server status message to offline automatically (Hopefully!). The command `ftd serveroff` hasn't been removed.
- #28 Added the Auto Ping feature, where an `@mention` on Foundry will reflect on Discord as a User/Role ping. The mentions have to be manually mapped to a keyword.

## 1.10.0

- In light of the upcoming changes to midi-qol and dnd5e, this module now supports the new chat cards for dnd5e 3.x. This version is only compatible with the upcoming 11.4.x version of midi-qol.
- (midi-qol) #26 Attack and spell mergecards have been updated to fit the new format. Mergecards are now all merged into one embed on Discord, instead of multiple embeds.
- (midi-qol) #22 Roll breakdowns (in spoiler tags) are now added to all mergecards if visible.
- (midi-qol) other-damage and bonus-damage rolls are now included on the embed.
- (midi-qol) Saves are now better hidden according to your midi settings.
- (dnd5e) Auto UUID embeds use their own parser for the system.
- Rolls with modifiers (i.e. 2d20kh, 1d10r1) now display the discarded rolls with a `ˣ` symbol to indicate that the die result does not count towards the total. For 2d20kh, for example, the roll breakdown would show the lower result with an `ˣ` symbol. This still only applies to rolls which include the formulas.
- Added a new toggle to force show GM roll details on embeds.
- Fix for embed titles including HTML sometimes.

## 1.9.0

- No more limits! Messages of 2000 characters or longer will be split up into multiple messages. Long embeds can now also be split up into 2 or more messages in Discord. Note that this does not affect the API, but does affect everything else. ~~This means Foundry to Discord now fully supports unnecessarily long item descriptions!~~
- Note that because of the major changes in the chat mirroring system, I may have missed some bugs. For now, though, foundry messages sent prior to 1.9.0 can't be edited nor can they be deleted, but that's not much of an issue. I recommend clearing your chat log before installing this update, but it's not really necessary, since the module can't touch any of the messages sent before this version.

- Added the UUID Auto Embed system, as requested in #23. By toggling "Auto-embed UUID Link Messages" on, all messages that contain a `@UUID` link to an item, journal, or journal page will be automatically appended with an embed of the title and description of the item/journal. Up to 10 `@UUID` links will be embedded onto the message. Be careful with journals, though, as they will spam your channel, but a hard 10-page limit is set on journals to prevent massive spam. Deleting the message with the UUID link will delete the embeds associated with them, so don't worry if you accidentally spammed your channel with long journal pages.
- #24 Added a button to only delete a message on Foundry, but keep the sent message/s on Discord. This is available for GMs only. It will appear in the chat message context menu as "Delete (Foundry Chat Only)".
- #25 Split "Send to Discord" buttons into two: a "Send (Main Channel)" button and a "Send (Player Notes)" button. To enable sending to player notes, a Player Notes Webhook must be added. Follow the steps as usual for making webhooks, and add `?thread_id=xxx` to the end of the webhook if you want to send to a thread instead. Toggling 'Enable "Send to Discord" for everyone' will enable the "Send (Player Notes)" button for players.

- Fixes:
- (pf2e) Fixed rerolls not sending on Discord.
- (pf2e) Fixed some action glyph emojis not appearing.
- (dnd5e) Improved compatibility with the 3.0.0+ chat card format slightly.

## 1.8.5

- Use enrichers on journal pages before sending.
- Remove polyglot common override in favor of using polyglot's omniglot function. The chosen default language(common for dnd5e, taldane for post-5.12 pf2e) is always included.

## 1.8.4

- Adds a toggle to force token names to show on Discord regardless of token visibility.
- Bug fixes.

## 1.8.3

- Small bug fixes, including the "Target" text still being displayed for no targets on PF2e target damage, and Polyglot sending "undefined" messages.
- Improves Anonymous replacement name hiding.

## 1.8.2

- Added support for PF2e Toolbelt target damage helper, showing damage targets, and players' save results.
- Minor bug fixes.

## 1.8.1

- Added a few new emojis.
- Improved the roll parsing algorithm to hopefully cover more systems, and skip parsing if it's not supported.
- Better visibility of roll breakdown dice emojis by grouping up dice that are part of the same roll, ex. 2d4, 3d6
- (midi-qol) fixed saving throw success/fail cards not sending

## 1.8.0

- Adds a new config toggle to enable using external emojis, as well as new custom emojis for various things, such as PF2e action glyphs (1,2,3,free,reaction), and all types of dice from d4 to d20. By default, this is turned off. Webhooks will use `@everyone` permissions, so make sure you're allowing external emojis in your Discord server before turning this on.
- Adds a new method of detecting mass deletions of the chatlog, allowing the module to stop functioning momentarily if the chat log is cleared. The threshold is 10 simultaneous deletions.
- Changed roll results to use a different algorithm that crawls through ChatMessage.rolls to construct a result string. This is done for compatibility with the new die emojis.
- (pf2e) Fix sending of reroll messages

## 1.7.3

- Parsing now uses the native `enrichHTML`. This will hopefully make compatibility with other systems better.
- Improve flavor text detection in regular rolls.
- Improve `<img>` link handling on messages that only contain media.
- Small improvement to queueing by removing requests that only contain empty embeds.
- (pf2e) show "Effect Applied" text on actions.
- (monks-tokenbar) Fix showing of success/fail on gmroll requests.
- Other small bug fixes and improvements.

## 1.7.2

- (dnd5e) Support 2.4.0's custom enricher format.
- (pf2e) Use system enrichers
- (pf2e) Adds support for legacy `[[/r]]` enricher (which some items still have)
- (pf2e) Better parses headers with "Level" text besides them, i.e. "Specialization Ability - Level 7"
- Fixes parsing of empty text within `<b>`,`<i>` and similar html
- Adds support for Monk's TokenBar `@Request` and `@Contested`

## 1.7.1

- Fixes midi-qol attack roll result visibility when hide is set to 'none'
- Hotfix for some messages failing to send.

## 1.7.0

- Adds roll formulas where they should be visible. (Can be removed in settings)
- Adds a setting to disregard Polyglot
- Removes all legacy v10 code for hook filtering.
- Revamped most of the HTML parser, functionality remains more or less the same.
- (pf2e) Parse `@Damage` with actor context for parity.
- (pf2e) `@Check` showdc fixed to work with `showDC` and `showdc`.
- (pf2e) Added support for `@Template`.
- Major code refactoring.
- Small bug and localization fixes.

## 1.6.3

- Fixes "Send Image to Discord" on ImagePopouts when said image is raw base64 data.
- Parse isRoll messages that contain no rolls as regular messages instead
- Rolls no longer have "+ 0" added to them when there's nothing to add from the roll argument.
- Improvements to the table parser, where the table will attempt to utilize the full width of the embed instead of padding spaces to the right.
- Slight change to item links, where an additional space after the emoji is removed.
- UUID links formatted in html are now parsed, i.e. `<a data-uuid=...>`
- Change parsing order. HTML is now parsed first before @ tags.
- Checking ownership of actors for hiding metagame info now uses testUserPermission instead.
- Change handover of main GM role to use activeGM instead.
- Lots of refactoring.

## 1.6.2

- Revealing whispers now sends them to Discord, and hiding a message now deletes it from the channel.
- Fixes message editing.
- (pf2e) Traits are now shown in rolls unless hidden via the Anonymous module.
- (pf2e) Conditions(when being shown in combat) are now shown in an embed instead of regular text. Some formatting changes were made in recent versions on the pf2e system. Running older versions will result in conditions being displayed as plaintext as per usual.
- (midi-qol) Fixes "hits, misses" card display
- Added new emojis to some inline links.
- A lot of code refactoring

## 1.6.1

- Added support for Forien's Quest Log. A "Send Quest Details to Discord" button is now present on the Quest Preview window.
- Added notifications for all window header buttons on successful send.

## 1.6.0

- New feature! Added buttons to the window headers of Image Popouts and Journal Entries. They do exactly as what's labeled.
- Hotfix for a message duplication issue when "Allow chat mirroring without a GM" setting is turned on.

## 1.5.4

- Allows the Chat Mirroring feature to function without a GM in the world. (Toggleable in Settings)
- (dnd5e) Add support for missing midi-qol chat cards when mergecards are turned off

## 1.5.3

- Fixed a typo that seldom made the module not work on systems that were not pf2e nor dnd5e.
- (pf2e) checks now display roll arguments, including if the roll was a nat 1 or 20.
- Adds a setting to disable the anonymous module from blocking names on this module.

## 1.5.2

- (pf2e) Fix to rolls without degree of success flag set
- Parse isRoll flagged messages without roll objects as regular chat messages instead
- Show embed colors as foundry user color
- Show username on embeds (toggleable in settings)

## 1.5.1

- (pf2e) Minor bug fixes related to action cards
- Implemented a more robust, language-independent method to detect chat log flushing
- Added more logging to requests

## 1.5.0

- midi-qol GM damage tables are now supported, if whispers are sent to your webhook.
- Improved readability on chat cards
- Tables are now parsed properly.
- If an image was sent to chat without any text, it will also be sent to the webhook.
- DnD5e support is no longer 'experimental'.
- API is now in api.js.

## 1.4.3

- **NEW MODULE SUPPORT** [Monk's TokenBar](https://foundryvtt.com/packages/monks-tokenbar)! Contested Rolls, Roll Requests, and Experience cards now have a custom parser, and will be sent to Discord properly.

## 1.4.2

- **NEW**: Officially added (partial) support for the DnD5e system, more specifically, midi-qol mergecards. Currently experimental, so DnD5e users can turn off the setting from the config menu to use the old (not-so-reliable) parser.
- Minor bug fixes.

## 1.4.1

- Removed the `Main GM ID` setting from the config.
- New GM detection is now in place. Worlds with multiple GMs won't trigger the webhook anymore.
- How this works: The module will now search for a main GM when you enter a world, or if the previous main GM leaves the world. The module will perform all automated actions from the GM it is bound to at the current time.

## 1.4.0

- **NEW**: The Foundry to Discord API! You can now use this module to make it easier to send custom messages to your Discord channel, among other features. Refer to README.md on how to use the API.
- (pf2e) Added support for rerolls! Hero point, fortune, and misfortune rerolls are now sent to the chat as normal.
- Better chat mirroring: Ever needed to delete a message but hate alt-tabbing to Discord to do it? Now, you can delete a message in Foundry, and it will also delete the message linked to it in your channel! This can be disabled in the config for those who like the old style.
- Major code refactorings.
- Minor bug fixes.

## 1.3.0

- **NEW MODULE SUPPORT**: [Chat Media](https://foundryvtt.com/packages/chat-media)! Uploaded images, image links, and videos are now sent to Discord.
- Migrated everything from ye olde XmlHTTPRequests into Fetch() API, all features remain the same.
- Changes queue handling to support Fetch API
- Minor bug fixes.

## 1.2.3

- Hotfix for 1.2.2.
- Other minor bug fixes.

## 1.2.2

- (pf2e) Added support for new action cards in 5.4.0
- Minor bug fixes.

## 1.2.1

- Fix the server status message instructions showing up when you don't want it to.
- Support more formats of chat-cards.
- Several minor bug fixes.

## 1.2.0

- **NEW FEATURE:** Threaded Scenes! This version adds a new config setting which lets you map scenes to different Discord Channel threads. The threads must be within the channel where your webhook URL is set up, and of course, must exist first for this to work. Anything not mapped to a thread will still be sent as usual, so don't worry if you're not going to use this feature.
- Several bug fixes, such as Avatars not being properly sent, and roll embeds not being sent.

## 1.1.6

- Improved support for channel threads, including Server Status Message. Fixes issue #7.
- Improved chat command functionality.
- Minor fixes.

## 1.1.5

- Major improvements to the queueing system, including rate limit protection, and handling of messages in order of being sent. There should be less of a delay when messages are sent to the webhook.
- Refactored most of the code, but functionality remains more or less the same
- (pf2e) Improve support for `@Damage`

## 1.1.4

- The module will now display tokens generated by the Tokenizer module properly!
- (pf2e) small bug fixes in regards to @Check
- (pf2e) @UUID for macros is now supported
- (pf2e) @Check now displays the DCs if it's not set to hidden.

## 1.1.3

- Fixes players being able to set the server status as offline using "ftd serveroff".
- Fixes a bug that will occassionally make the module send the incorrect image to the webhook.
- Chat cards are now treated as a separate entity, but functionality remains more or less the same.
- More code refactorings.

## 1.1.2

- Fixes a small bug with chat cards on other systems that makes it fail to send.
- Minor code refactorings.

## 1.1.1

- Fix an issue where the invite URL not having a "/" at the end not allowing the messages to be posted.
- Minor bug fix.

## 1.1.0

- **NEW FEATURE:** Server status message! This feature detects when your world is ONLINE and edits a message on your Discord channel. To set it to OFFLINE, type "ftd serveroff" in Foundry as the GM. Setup instructions are included on the configuration options for Foundry to Discord. This will only work if you've set up your Webhook URL, obviously.
- This module will now use the default Foundry icon when an avatar doesn't exist or isn't supported by Discord. Supported formats for Discord avatars are as follows: jpg/jpeg, png, webp.

## 1.0.4

- Adds a new option to override common languages for Polyglot.
- Module now uses actor ownership to send chat card descriptions when anonymous is active.
- Adds new option to disable sending of chat cards.
- Minor bug fixes and refactorings.

## 1.0.3

- Changes to chatcard parsing. Descriptions will only be displayed on Discord when the chatcard's source is from a player character.
- Now supports Anonymous much better and hides footers when the setting is enabled.
- (PF2e) Supports hiding traits much better according to Anonymous settings.
- Minor bug fixes.

## 1.0.2

- The module will now attempt to parse targets from a user when rolling a check with message.flavor. This means that stuff like attack rolls, damage rolls, will now have targets parsed on to the embed.

## 1.0.1

- The module will now attempt to support Polyglot on all systems. This only works when the actor structure is similar. For example, PF2e and DnD5e both use `actor.system.traits.languages.value` to store language strings on an actor, so the module will work for both systems.
- Support for additional flavor text, such as the flavor text when rolling weapon attacks in DnD5e.

## 1.0.0

Finally! This module has been in the works for a month now, and I can now confidently release this to the public.

If you didn't read the description, this module is made as a successor to [DiscordConnect](https://github.com/caoranach/DiscordConnect/). It mirrors public chat messages on FVTT to a Discord channel. This will work *very well* on PF2e, and decently on other systems.

**Features:**

- Tokens to Discord Avatars
- Automatic chat card formatting
- Roll embeds
- and more!
