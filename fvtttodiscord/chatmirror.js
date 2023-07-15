Hooks.on("init", function() {
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
        hint: "This should be the internet invite URL for your game session. This is used to fetch avatar images.",
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
});

Hooks.on("ready", function() {
});

Hooks.on('createChatMessage', (msg, options, userId) => {
	if(!game.user.isGM || (game.settings.get("foundrytodiscord", "ignoreWhispers") && msg.whisper.length > 0)){
		return;
	}
	if(game.userId != game.settings.get("foundrytodiscord", "mainUserId") && game.settings.get("foundrytodiscord", "mainUserId") != ""){
		return;
	}
	if(msg.isRoll && game.settings.get("foundrytodiscord", "rollWebHookURL") == ""){
		return;
	}
	if(!msg.isRoll && game.settings.get("foundrytodiscord", "webHookURL") == ""){
		return;
	}
	var constructedMessage = '';
	var hookEmbed = [];
	
	if(msg.content == "dc getID"){
		sendMessage(msg, "UserId: "+game.userId, hookEmbed);
		return;
	}
	
	if(msg.isRoll){
		var title = '';
		var desc = '';
		if(msg.flavor != null && msg.flavor.length > 0){
			title = convertHtmlToMarkdown(msg.flavor) + '\n';
		}
		desc = desc + 'Rolled ' + msg.roll.formula + ', and got a ' + msg.roll.result + ' = ' + msg.roll.total;
		hookEmbed = [{title: title, description: desc}];
	}
	else if(!msg.content.includes("</div>")){
		if(game.settings.get("foundrytodiscord", "addChatQuotes")){
			constructedMessage = '\"' + msg.content + '\"';
		}
		else {
			constructedMessage = msg.content;
		}
	}
	else {
		var ids = msg.content.search("midi-qol-target-name");
		if(ids != -1){
			constructedMessage = "```"+msg.alias + " " + parseHitMessage("<!DOCTYPE html><html><body>"+msg.content+ "</body></html>") + "```";
		}
		else{
			if(!msg.content.search("midi-qol")){
				constructedMessage = '```' + msg.content + '```';
			}
			else {
				constructedMessage = '```Big descriptions of attack/spell go here!```';
				return;
			}
		}
	}
	sendMessage(msg, constructedMessage, hookEmbed);
});

function parseHitMessage(msg){
	var parser = new DOMParser();
  var htmlDoc = parser.parseFromString(msg, 'text/xml');
  
  var search = htmlDoc.getElementsByClassName("midi-qol-nobox");
  if(search == undefined){
	return msg + " x:1";
  }
  var sec = search[0].getElementsByClassName("midi-qol-flex-container");
  if(sec == undefined){
	return msg + " x:2";
  }
  var hitOrMiss = sec[0].getElementsByTagName("div")[0].innerHTML;
   if(hitOrMiss == null){
	return msg + " x:3";
  }
  var name = sec[0].getElementsByTagName("div")[2].innerHTML;
   if(name == null){
	return msg + " x:4";
  }
  
  return hitOrMiss.trim()+" "+name.trim();
}

function sendMessage(message, msgText, hookEmbed) {
    var actor = loadActorForChatMessage(message.speaker);
    let img = "";
    if (actor) {
        img = generatePortraitImageElement(actor);
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

    sendToWebhook(message, msgText, hookEmbed, hook, imgurl);
}


function sendToWebhook(message, msgText, hookEmbed, hook, img) {
  var request = new XMLHttpRequest();
  request.open('POST', hook);
  request.setRequestHeader('Content-type', 'application/json');
  
  var alias = message.alias;
  var avatarURL = avatarDictionary[alias]; // Get the avatar URL from the dictionary if exists
  if(avatarURL === undefined){
    avatarURL = img;
  }
  else{
    avatarURL = encodeURI(avatarURL);
  }

  var params = {
    username: alias,
    avatar_url: avatarURL,
    content: convertHtmlToMarkdown(msgText),
    embeds: hookEmbed
  };

  request.send(JSON.stringify(params));
}

function createDialog(title, content){
	let d = new Dialog({
	title: title,
	content: "<p>"+content+"</p>",
	buttons: {
	  one: {
	   icon: '<i class="fas fa-check"></i>',
	   label: "Option One",
	   callback: () => console.log("Chose One")
	  },
	  two: {
	   icon: '<i class="fas fa-times"></i>',
	   label: "Option Two",
	   callback: () => console.log("Chose Two")
	  }
	 },
	 default: "two",
	 render: html => console.log("Register interactivity in the rendered dialog"),
	 close: html => console.log("This always is logged no matter which option is chosen")
	});
	d.render(true);
}

/**
 * Load the appropriate actor for a given message, leveraging token or actor or actor search.
 * @param {*} speaker
 */
function loadActorForChatMessage(speaker) {
  var actor;
  for (var i = 0; i < game.actors.contents.length; i++) {
      if (game.actors.contents[i].name === speaker.alias) {
        actor = game.actors.contents[i];
        break;
      }
    }
  return actor;
}

function generatePortraitImageElement(actor) {
  let img = "";
  img = actor.prototypeToken.texture.src;
  return img;
}

function convertHtmlToMarkdown(html) {
  // Remove header tags (1, 2, 3, 4, 5, 6)
  let markdown = html.replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi, '**$2**');

  // Remove tags for skill checks
  markdown = markdown.replace(/<div class="tags">(.*?)<\/div>/g, '');

  // Remove div and span tags
  markdown = markdown.replace(/<\/?(div|span)[^>]*>/gi, '');

  // Replace <br> tags with new lines
  markdown = markdown.replace(/<br\s?\/?>/gi, '\n');

  // Replace <strong> tags with bold markdown
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');

  // Replace <em> tags with italic markdown
  markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');

  // Replace <a> tags with markdown links
  markdown = markdown.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi, '[$3]($2)');

  // Replace <code> tags with inline code markdown
  markdown = markdown.replace(/<code>(.*?)<\/code>/gi, '`$1`');

  // Replace <pre> tags with multiline code blocks
  markdown = markdown.replace(/<pre>(.*?)<\/pre>/gi, '```\n$1\n```');

  // Strip remaining
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  const regex = /^([\w\s]+)\s+DC\s+(\d+)\s+([\w\s]+)$/;
  if (regex.test(markdown)) {
  return markdown.replace(regex, function(match, p1, p2, p3) {
      if (["reflex", "will", "fortitude"].includes(p1.toLowerCase())) {
        return 'Make a ' + p1 + ' save!';
      } else {
        return 'Make a ' + p1 + ' check!';
      }
    });
  }


  const regexmeta = /Target: [\w\s]+ \(AC [\w\s]+\)/g;
  markdown = markdown.replace(regexmeta, '');

  const regexmeta2 = /(\w+) takes (\w+) from (\w+)/;
  markdown = markdown.replace(regexmeta2, '$1 takes $2');

  return markdown;
}

