# 1.1.1

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
