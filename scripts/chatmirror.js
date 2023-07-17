Hooks.on("init", function () {
  game.settings.register('foundrytodiscord', 'mainUserId', {
    name: "Main GM ID",
    hint: "If you plan on having two GMs in one session, fill this in with the main DM's ID to avoid duplicated messages. Just type 'dc getID' in chat to have your ID sent to your discord channel.",
    scope: "world",
    config: true,
    default: "",
    type: String
  });
  game.settings.register('foundrytodiscord', 'ignoreWhispers', {
    name: "Ignore Whispers & Private Rolls",
    hint: "If this is on, then it will ignore whispers and private rolls. If this is off, it will send them to discord just like any other message.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });
  game.settings.register('foundrytodiscord', 'addChatQuotes', {
    name: "Add Quotes to Chat",
    hint: "If this is on, then it will surround chat messages with quotes in discord.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });
  game.settings.register('foundrytodiscord', 'inviteURL', {
    name: "Game Invite URL",
    hint: "This should be the internet invite URL for your game session. Duh.",
    scope: "world",
    config: true,
    default: "http://",
    type: String
  });
  game.settings.register('foundrytodiscord', 'webHookURL', {
    name: "Web Hook URL",
    hint: "This should be the Webhook's URL from the discord server you want to send chat messages to. Leave it blank to have foundrytodiscord ignore regular chat messages.",
    scope: "world",
    config: true,
    default: "",
    type: String
  });
  game.settings.register('foundrytodiscord', 'rollWebHookURL', {
    name: "Roll Web Hook URL",
    hint: "This is the webhook for wherever you want rolls to appear in discord. Leave it blank to have foundrytodiscord ignore rolls.",
    scope: "world",
    config: true,
    default: "",
    type: String
  });
  if (game.modules.get("polyglot")) {
    game.settings.register('foundrytodiscord', 'includeOnly', {
      name: "Include only these languages:",
      hint: "A list of languages that you wish to only be understood to be sent in Discord, separated by commas. Leave blank for normal Polyglot behavior.",
      scope: "world",
      config: true,
      default: "",
      type: String
    });
  }
});

Hooks.on("ready", function () {
});

Hooks.on('createChatMessage', (msg, options, userId) => {
  //const speaker = ChatMessage.getSpeaker({ actor: options.actor, token: options.token });
  //const actor = ChatMessage.getSpeakerActor(speaker);
  //console.log(actor);
  if (!game.user.isGM || (game.settings.get("foundrytodiscord", "ignoreWhispers") && msg.whisper.length > 0)) {
    return;
  }
  if (game.userId != game.settings.get("foundrytodiscord", "mainUserId") && game.settings.get("foundrytodiscord", "mainUserId") != "") {
    return;
  }
  if (msg.isRoll && game.settings.get("foundrytodiscord", "rollWebHookURL") == "") {
    return;
  }
  if (!msg.isRoll && game.settings.get("foundrytodiscord", "webHookURL") == "") {
    return;
  }
  var constructedMessage = '';
  var hookEmbed = [];

  if (msg.content == "dc getID") {
    sendMessage(msg, "UserId: " + game.userId, hookEmbed, options);
    return;
  }

  if (!msg.isRoll) {
    if (game.modules.get("polyglot") && msg.flags.polyglot) {
      if (msg.flags.polyglot.language != "common") {
        if (game.settings.get("foundrytodiscord", "includeOnly") == "") {
          constructedMessage = polyglotize(msg);
        }
        else {
          listLanguages = game.settings.get("foundrytodiscord", "includeOnly").split(",").map(item => item.trim().toLowerCase());
          if(!listLanguages == null){
            listLanguages = [];
          }
          constructedMessage = polyglotize(msg, listLanguages);
        }
      }
      else {
        constructedMessage = msg.content;
      }
    }
    else {
      constructedMessage = msg.content;
    }
  }
  else {
    if (msg.flavor != null && msg.flavor.length > 0) {
      // Construct embed
      hookEmbed = createSpecialRollEmbed(msg);
    }
    else {
      hookEmbed = createRollEmbed(msg);
    }
  }

  if (isSpellCard(msg.content)) {
    constructedMessage = "";
    hookEmbed = createSpellEmbed(msg.content);
  }

  //Fix formatting before sending
  constructedMessage = reformatMessage(constructedMessage);
  if (hookEmbed != [] && hookEmbed[0]) {
    hookEmbed[0].description = reformatMessage(hookEmbed[0].description);
  }

  sendMessage(msg, constructedMessage, hookEmbed, options);
});

function createRollEmbed(message) {
  var desc = 'Rolled ' + message.rolls[0].formula + ', and got a ' + message.rolls[0].result + ' = ' + message.rolls[0].total;
  embed = [{ title: '', description: desc }];
  return embed;
}

function createSpecialRollEmbed(message) {
  var embed = []
  var anon = game.modules.get('anonymous').api;
  //Build Title
  var str = message.flavor;
  var regex = /<h4 class="action">(.*?)<\/h4>/g;
  let m;
  var title = "";
  while ((m = regex.exec(str)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    if (m[1] != null) {
      title = m[1];
    }
  }

  if (title == "") {
    regex = /<strong>(.*?)<\/strong>/g;
    while ((m = regex.exec(str)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      if (m[1] != null) {
        title = m[1];
      }
    }
  }

  var desc = "";
  //Build Description
  //Add targets to embed:

  targetActor = parseActorFromTarget(message);
  if (targetActor) {
    if (message.flags['pf2e-target-damage'].targets.length < 2 || targetActor) {
      if (!parseActorFromTargetToken(message).flags.anonymous.showName) {
        desc = desc + "**Target:** `Unknown`\n";
      }
      else {
        desc = desc + "**Target:** `" + targetActor.name + "`\n";
      }
    }
    else {
      desc = desc + "**Targets:** ";
      for (let i = 0; i < message.flags['pf2e-target-damage'].targets.length; i++) {
        var curActor = canvas.tokens.get(message.flags.pf2e - target - damage.targets[i].id).actor;
        if (!curActor.flags.anonymous.showName) {
          desc = desc + "`Unknown` ";
        }
        else {
          desc = desc + "`" + curActor.name + "` ";
        }
      }
      desc = desc + "\n";
    }
  }
  else {
    desc = desc + "**Targets:** ";
    for (let i = 0; i < message.flags['pf2e-target-damage'].targets.length; i++) {
      var curActor = canvas.tokens.get(message.flags['pf2e-target-damage'].targets[i].id).actor;
      if (!curActor.flags.anonymous.showName) {
        desc = desc + "`Unknown` ";
      }
      else {
        desc = desc + "`" + curActor.name + "` ";
      }
    }
    desc = desc + "\n";
  }

  //Add roll information to embed:
  for (let i = 0; i < message.rolls.length; i++) {
    desc = desc + "**Result: **" + message.content + " `(" + parseDegree(message.rolls[i].options.degreeOfSuccess) + ")`\n";
  }

  embed = [{ title: title, description: desc }];
  return embed;
}

function createSpellEmbed(spellcard) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(spellcard, "text/html");

  // Find the <h3> element and extract its text content
  var h3Element = doc.querySelector("h3");
  var title = h3Element.textContent.trim();
  var desc = "";

  //parse spell traits

  var tagsSection = doc.querySelector(".item-properties.tags");
  var tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
  var traits = "";
  for (let i = 0; i < tags.length; i++) {
    traits = traits + "[" + tags[i] + "] ";
  }

  desc = desc + "`" + traits.trim() + "`";
  //parse spell description
  desc = desc + doc.querySelector(".card-content > p").textContent.trim() + "\n\n";

  desc = desc + "----------------\n\n"

  var doc = parser.parseFromString(spellcard, "text/html");

  var heightenedTags = doc.querySelectorAll("section.card-content p strong");
  var reformattedTexts = Array.from(heightenedTags).map((tag) => {
    var nextSibling = tag.nextSibling;
    return `**${tag.textContent.trim()}** ${nextSibling.textContent.trim()}`;
  });

  var reformattedText = reformattedTexts.join("\n");

  desc = desc + reformattedText;

  embed = [{ title: title, description: desc }];
  return embed;
}

function parseActorFromTarget(message) {
  if (message.flags.pf2e.context.target) {
    var str = message.flags.pf2e.context.target.actor;
    var arr = str.split('.');
    var actor = game.actors.get(arr[5]);
    return actor;
  }
  else return undefined;
}

function parseActorFromTargetToken(message) {
  if (message.flags.pf2e.context.target) {
    var str = message.flags.pf2e.context.target.token;
    var arr = str.split('.');
    var tokenID = arr[3];
    var token = canvas.tokens.get(tokenID);
    return token.actor;
  }
}

function parseDegree(degree) {
  switch (degree) {
    case 0:
      return "Critical Failure";
    case 1:
      return "Failure";
    case 2:
      return "Success";
    case 3:
      return "Critical Success";
    default:
      return "Invalid";
  }
}

function sendMessage(message, msgText, hookEmbed, options) {
  var speaker = ChatMessage.getSpeaker({ actor: options.actor, token: options.token });
  var actor = ChatMessage.getSpeakerActor(speaker);
  let img = "";
  if (actor) {
    img = actor.prototypeToken.texture.src;
  } else {
    img = message.user.avatar;
  }

  var imgurl = "";
  if (img.includes("http")) {
    imgurl = img;
  } else {
    imgurl = game.settings.get("foundrytodiscord", "inviteURL") + img;
  }

  var hook = "";
  if (message.isRoll) {
    hook = game.settings.get("foundrytodiscord", "rollWebHookURL");
  } else {
    hook = game.settings.get("foundrytodiscord", "webHookURL");
  }

  sendToWebhook(message, msgText, hookEmbed, hook, imgurl, actor);
}

function sendToWebhook(message, msgText, hookEmbed, hook, img, actor) {
  var anon = game.modules.get('anonymous').api;
  var request = new XMLHttpRequest();
  request.open('POST', hook);
  request.setRequestHeader('Content-type', 'application/json');
  var alias = message.alias;
  if (actor) {
    if (!anon.playersSeeName(actor)) {
      alias = "Unknown (" + actor.id + ")";
    }
  }
  var avatarURL = encodeURI(img);

  var params = {
    username: alias,
    avatar_url: avatarURL,
    content: msgText,
    embeds: hookEmbed
  };

  request.send(JSON.stringify(params));
}

function isSpellCard(htmlString) {

  var temporaryElement = document.createElement('div');
  temporaryElement.innerHTML = htmlString;

  var divElement = temporaryElement.querySelector('div.pf2e.chat-card.item-card');

  if (divElement !== null) {
    return true;
  } else {
    return false;
  }
}

function polyglotize(message, playerlanguages = []) {
  //get a list of all PCs
  if (playerlanguages == [] || playerlanguages.length == 0) {
    let characters = game.actors.filter(a => a.type === "character");
    let languages = new Set();
    for (let character of characters) {
      let characterLanguages = character.system.traits.languages.value;
      for (let language of characterLanguages) {
        languages.add(language);
      }
    }

    if (languages.has(message.flags.polyglot.language)) {
      return message.content;
    }
    else {
      return "*Unintelligible*"
    }
  }
  else {
    if (playerlanguages.includes(message.flags.polyglot.language)) {
      return message.content;
    }
    else {
      return "*Unintelligible*"
    }
  }
}

function reformatMessage(text) {
  var reformattedText = ""
  //replace UUIDs to be consistent with Foundry
  var regex = /@UUID\[[^\]]+\]\{([^}]+)\}/g;
  reformattedText = text.replace(regex, ':baggage_claim: `$1`');

  //replace UUID if custom name is not present (redundancy)
  regex = /@UUID\[(.*?)\]/g;
  reformattedText = reformattedText.replace(regex, (_, text) => getNameFromItem(text));

  //replace Checks
  regex = /@Check\[[^\]]+\]{([^}]+)}/g;
  reformattedText = reformattedText.replace(regex, ':game_die: `$1`');

  //replace checks without name labels
  regex = /@Check\[(.*?)\]/g;
  reformattedText = reformattedText.replace(regex, (_, text) => getNameFromCheck(text));

  //for de-mystification checks
  isHtmlFormatted = /<[a-z][\s\S]*>/i.test(reformattedText);
  if (isHtmlFormatted) {
    reformattedText = parseMystifiedChecks(reformattedText);
  }
  return reformattedText;
}

function getNameFromItem(itempath) {
  var itemID = ""
  var itemName = ""
  var parts = itempath.split('.');
  if (parts.length > 1) {
    itemID = parts[parts.length - 1];
  }
  if (itemID == "") {
    itemID = itempath;
  }
  try {
    itemName = ":baggage_claim: `" + game.items.get(itemID).name + "`";
    return itemName;
  }
  catch (e) {
    if (parts[0] == "Actor") {
      let actorID = parts[1];
      let actor = game.actors.get(actorID);
      var item = actor.items.find(item => item._id === itemID);
      itemName = item ? item.name : undefined;
    }

    if (itemName) {
      return ":baggage_claim: `" + itemName + "`";
    }
    else { //Failsafe just in case.
      return ":baggage_claim: `Unknown Item`";
    }
  }
}

function getNameFromCheck(checkString) {

  var check = parseCheckString(checkString);
  if (check.type) {
    skillcheck = check.type.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    if (check.basic) {
      return ":game_die: `Basic " + skillcheck + "`";
    }
    else {
      return ":game_die: `" + skillcheck + "`";
    }
  }
}

function parseCheckString(checkString) {
  let check = {};

  // Split the string into an array of key-value pairs
  let pairs = checkString.split("|");

  // Loop through the pairs and add them to the check object
  for (let i = 0; i < pairs.length; i++) {
    let [key, value] = pairs[i].split(":");
    check[key] = value === "true" ? true : value === "false" ? false : value;
  }

  return check;
}

function parseMystifiedChecks(htmlString) {
  var tempElement = document.createElement('div');
tempElement.innerHTML = htmlString;

// Extract the item name
var itemName = tempElement.querySelector('h4').textContent.trim().replace(/^.+`(.+)`.+$/, "$1");

// Extract the skill checks
var skillChecks = Array.from(tempElement.querySelectorAll('span[data-pf2-check]'))
  .map(span => `:game_die:\`${span.textContent.trim()}\``)
  .join('\n');

// Format the result
var result = `:baggage_claim:\`${itemName}\`\n\nIdentify item: Skill checks\n${skillChecks}`;

  return result;
}