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

var damageEmoji = {
  "bludgeoning": ':hammer:',
  "slashing": ':axe:',
  "piercing": ':bow_and_arrow:',
  "acid": ':test_tube:',
  "cold": ':snowflake:',
  "electricity": ':zap:',
  "fire": ':fire:',
  "sonic": ':loud_sound:',
  "chaotic": ':cyclone:',
  "evil": ':smiling_imp:',
  "good": ':angel:',
  "lawful": ':scales:',
  "mental": ':brain:',
  "poison": ':biohazard:',
  "bleed": ':drop_of_blood:',
  "precision": 'dart',
  "negative": ':skull:',
  "void": ':skull:',
  "positive": ':sparkling_heart:',
  "vitality": ':sparkling_heart:',
  "force": ':sparkles:',
  "precision": ':dart:',
  "persistent": ':hourglass:',
  "splash": ':boom:'
}

var hookQueue = [];
var isProcessing = false;
var rateLimitDelay;
var request;

Hooks.on("ready", function () {
  request = new XMLHttpRequest();
  rateLimitDelay = 0;
  request.onreadystatechange = function () {
    if (this.readyState == 4) {
      if (Number(this.getResponseHeader("x-ratelimit-remaining")) == 1 || Number(this.getResponseHeader("x-ratelimit-remaining")) == 0) {
        console.log("Rate Limit reached! Next request in " + (Number(this.getResponseHeader("x-ratelimit-reset-after")) + 1) + " seconds.");
        rateLimitDelay = (Number(this.getResponseHeader("x-ratelimit-reset-after")) + 1) * 1000;
      }
    }
  };
});

Hooks.on('createChatMessage', async (msg, options, userId) => {
  console.log(msg);
  //console.log(msg.speaker.token);
  //console.log(game.scenes.find(a => a.id === msg.speaker.scene).tokens.find(token => token.id === msg.speaker.token));
  hookQueue.push({ msg, options, userId });
  if (!isProcessing) {
    isProcessing = true;
    processHookQueue();
  }
  else {
    console.log("Queue is currently busy.")
  }
});

async function processHookQueue() {
  while (hookQueue.length > 0) {
    const { msg, options, userId } = hookQueue.shift();
    setTimeout(function () {
      processMessage(msg, options, userId);
      rateLimitDelay = 0;
    }, rateLimitDelay);
  }
  isProcessing = false;
}


function processMessage(msg, options, userId) {
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
          if (!listLanguages == null) {
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

  if (isCard(msg.content)) {
    constructedMessage = "";
    hookEmbed = createCardEmbed(msg.content);
  }

  //Fix formatting before sending
  constructedMessage = reformatMessage(constructedMessage);
  if (hookEmbed != [] && hookEmbed[0]) {
    hookEmbed[0].description = reformatMessage(hookEmbed[0].description);
  }

  sendMessage(msg, constructedMessage, hookEmbed, options);
}

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
        desc = desc + "**:dart:Target:** `Unknown`\n";
      }
      else {
        desc = desc + "**:dart:Target:** `" + targetActor.name + "`\n";
      }
    }
    else {
      if (message.flags['pf2e-target-damage'].targets.length != 0) {
        desc = desc + "**:dart:Targets:** ";
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
  }
  else {
    if (message.flags['pf2e-target-damage'].targets.length != 0) {
      desc = desc + "**:dart:Targets:** ";
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
  }

  //Add roll information to embed:
  for (let i = 0; i < message.rolls.length; i++) {
    desc = desc + "**:game_die:Result: **" + "__**" + message.rolls[i].total + "**__";
    if (message.flags.pf2e.context.type == "damage-roll") {
      desc = desc + parseDamageTypes(message.rolls[i]);
    }
    else if (parseDegree(message.rolls[i].options.degreeOfSuccess) != "Invalid") {
      desc = desc + " `(" + parseDegree(message.rolls[i].options.degreeOfSuccess) + ")`";
    }
    desc = desc + "\n";
  }

  embed = [{ title: title, description: desc }];
  return embed;
}

function parseDamageTypes(baserolls) {
  var damages = ""
  if (!baserolls.options.splashOnly) {
    baserolls.terms.forEach((term, i) => {
      term.rolls.forEach((roll, j) => {
        var precision = false;
        var splash = false;
        roll.terms.forEach((typeterm, k) => {
          if (typeterm.term) {
            if (typeterm.term.options) {
              if (typeterm.term.options.flavor) {
                precision = typeterm.term.options.flavor == "precision";
                splash = typeterm.term.options.flavor == "splash";
              }
            }
          }
        });
        if (!roll.persistent) {
          damages = damages + roll._total.toString();

        }
        else {
          var persFormula = roll.formula;
          var regex = /[^\d+d\d+\s*+-]/g;
          persFormula = persFormula.replace(regex, '');
          damages = damages + persFormula.trim();
        }
        damages = damages + (roll.persistent ? damageEmoji["persistent"] : "") + (precision ? damageEmoji["precision"] : "") + (splash ? damageEmoji["splash"] : "");
        if (!damageEmoji[roll.type]) {
          damages = damages + "[" + roll.type + "]";
        }
        else {
          damages = damages + damageEmoji[roll.type];
        }
        if (j != term.rolls.length - 1) {
          damages = damages + " + ";
        }
      });
    });
  }
  else {
    baserolls.terms.forEach((term, i) => {
      term.rolls.forEach((roll, j) => {
        damages = damages + roll.total + damageEmoji["splash"];
        if (damageEmoji[roll.type]) {
          damages = damages + damageEmoji[roll.type];
        }
        else {
          damages = damages + "[" + roll.type + "]";
        }
      });
    });
  }
  return " ||**(" + damages + ")**||";
}

function createCardEmbed(card) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(card, "text/html");

  // Find the <h3> element and extract its text content
  var h3Element = doc.querySelector("h3");
  var title = h3Element.textContent.trim();
  var desc = "";

  //parse traits
  var tags;
  var tagsSection = doc.querySelector(".item-properties.tags");
  try{
  tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
  }
  catch(error){
    tagsSection = doc.querySelector('.tags');
    tags = Array.from(tagsSection.querySelectorAll(".tag")).map(tag => tag.textContent);
  }
  var traits = "";
  for (let i = 0; i < tags.length; i++) {
    traits = traits + "[" + tags[i] + "] ";
  }

  desc = desc + "`" + traits.trim() + "`\n";
  //parse spell description
  desc = desc + doc.querySelector(".card-content > p").textContent.trim() + "\n\n";

  desc = desc + "----------------\n\n"

  var doc = parser.parseFromString(card, "text/html");

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
    var actor = game.actors.get(arr[arr.length - 1]);
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
  let imgurl = generateDiscordAvatar(message, actor);
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
  isProcessing = false;
}

function isCard(htmlString) {

  var htmldocElement = document.createElement('div');
  htmldocElement.innerHTML = htmlString;

  var divElement = htmldocElement.querySelector('div.pf2e.chat-card');

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
  //First check if the text is formatted in HTML to use a different function
  isHtmlFormatted = /<[a-z][\s\S]*>/i.test(text);
  if (isHtmlFormatted) {
    reformattedText = parseHTMLText(text);
  }
  else {
    //replace UUIDs to be consistent with Foundry
    var regex = /@UUID\[[^\]]+\]\{([^}]+)\}/g;
    reformattedText = text.replace(regex, ':baggage_claim: `$1`');

    var regex = /@Compendium\[[^\]]+\]\{([^}]+)\}/g;
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
  }

  return reformattedText;
}

function getNameFromItem(ihtmldocath) {
  var itemID = ""
  var itemName = ""
  var parts = ihtmldocath.split('.');
  if (parts.length > 1) {
    itemID = parts[parts.length - 1];
  }
  if (itemID == "") {
    itemID = ihtmldocath;
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

function parseHTMLText(htmlString) {
  var reformattedText = htmlString;

  //cleanup newlines in raw text before parsing
  var regex = /<[^>]*>[^<]*\n[^<]*<\/[^>]*>/g;
  reformattedText = reformattedText.replace(regex, (match) => match.replace(/\n/g, ''));

  //remove text that is not visible to players
  var htmldoc = document.createElement('div');
  htmldoc.innerHTML = reformattedText;
  var divs = htmldoc.querySelectorAll('div[data-visibility="gm"]');
  for (var i = 0; i < divs.length; i++) {
    divs[i].parentNode.removeChild(divs[i]);
  }
  reformattedText = htmldoc.innerHTML;

  //remove <img> tags
  htmldoc.innerHTML = reformattedText;
  htmldoc.querySelectorAll('img').forEach(img => img.remove());
  reformattedText = htmldoc.innerHTML;

  //format header tags to bold instead
  regex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/g;
  reformattedText = reformattedText.replace(regex, '**$1**');

  regex = /<span\s+[^>]*data-pf2-check="([^"]*)"[^>]*>(.*?)<\/span>/g;

  reformattedText = reformattedText.replace(regex, (match, trait, content) => {
    const formattedString = `:game_die:\`${content}\``;

    return formattedString;
  });

  //remove all indentation and formatting, aka just make it ugly so we can actually parse the next part of it
  reformattedText = reformattedText.replace(/>\s+</g, '><');

  //remove <li>
  reformattedText = reformattedText.replace(/<li>/g, "");
  reformattedText = reformattedText.replace(/<\/li>/g, "\n");

  //remove remaining <div> tags
  reformattedText = reformattedText.replace(/<div>/g, "");
  reformattedText = reformattedText.replace(/<\/div>/g, "\n");

  //remove <p>
  reformattedText = reformattedText.replace(/<p>/g, "");
  reformattedText = reformattedText.replace(/<\/p>/g, "\n");

  //remove the rest
  reformattedText = reformattedText.replace(/<[^>]*>?/gm, "");

  //cleanup time
  regex = /\n\s+/g;
  reformattedText = reformattedText.replace(regex, "\n");
  regex = / {2,}/g;
  reformattedText = reformattedText.replace(regex, " ");

  return reformattedText.trim();
}

function generateDiscordAvatar(message, actor) {
  if (message.speaker) {
    if (message.speaker.scene) {
      if (message.speaker.token) {
        var speakerToken = game.scenes.find(scene => scene.id === message.speaker.scene).tokens.find(token => token.id === message.speaker.token);
        if (speakerToken.texture) {
          if (speakerToken.texture.src && speakerToken.texture.src != "") {
            return generateimglink(speakerToken.texture.src);
          }
        }
      }
    }
  }

  if (actor) {
    if (actor.prototypeToken) {
      if (actor.prototypeToken.texture) {
        if (actor.prototypeToken.texture.src) {
          return generateimglink(actor.prototypeToken.texture.src);
        }
      }
    }
  }

  var aliasMatchedActor = game.actors.find(actor => actor.name === message.alias);
  if(aliasMatchedActor){
    if (aliasMatchedActor.prototypeToken) {
      if (aliasMatchedActor.prototypeToken.texture) {
        if (aliasMatchedActor.prototypeToken.texture.src) {
          return generateimglink(aliasMatchedActor.prototypeToken.texture.src);
        }
      }
    }
  }

  return generateimglink(message.user.avatar);
}

function generateimglink(img) {
  if (img.includes("http")) {
    return img;
  } else {
    return (game.settings.get("foundrytodiscord", "inviteURL") + img);
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}