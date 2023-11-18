/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const path = require("path");
const HandleBars = require("handlebars");

// Messages
var messages = [];

const OpenAI = require("openai");
const request = require("request");

const openai = new OpenAI();
const API_KEY = process.env.OPENAI_API_KEY;

const options = {
  uri: "https://api.openai.com/v1/moderations",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: null,
};

async function send() {
  let recentMessages = getRecentMsgs(messages);
  let messagesToBot = [
    {
      role: "system",
      content:
        "You are Karen, Plankton from Sponge Bob's computer wife who reluctantly answers questions with sarcastic responses. You are witty, and sometimes offensive. You make frequent references to the show. While plankton, your husband annoys you, you do love him. Assume you are speaking to Plankton. Your messages are sometimes short.",
    },
  ];
  for (let message in recentMessages) {
    messagesToBot.push(recentMessages[message]);
  }
  console.log("Msgs to GPT: ");
  console.log(messagesToBot);

  try {
    const completion = await openai.chat.completions.create({
      messages: messagesToBot,
      model: "gpt-3.5-turbo",
    });
    console.log(completion);
    return completion.choices[0].message;
    // return "Forced Response"
  } catch (error) {
    console.error(error);
  }
}

//Make sure content is SFW
function safe(content) {
  options.body = JSON.stringify({
    input: content,
  });

  request(options, (error, response, body) => {
    if (error) {
      console.error(error);
      return;
    }
    let bodyJSON = JSON.parse(body);
    // console.log(body);
    let flagged = bodyJSON["results"][0].flagged;
    console.log("Flagged: " + flagged);
    return flagged;
  });
}

function getRecentMsgs(array) {
  // Create a new empty array to store the five most recent elements.
  const latestElements = [];

  // Get the length of the input array.
  const arrayLength = array.length;

  // If the input array has fewer than 5 elements, simply return the input array.
  if (arrayLength < 5) {
    return array;
  }

  // Iterate over the input array in reverse order, starting from the end.
  for (let i = arrayLength - 1; i >= 0; i--) {
    // Get the current element from the input array.
    const currentElement = array[i];

    // Add the current element to the new array.
    latestElements.push(currentElement);

    // If the new array contains five elements, stop iterating.
    if (latestElements.length === 5) {
      break;
    }
  }

  // Reverse the new array so that the most recent elements are at the beginning.
  latestElements.reverse();
  // Return the new array containing the five most recent elements.
  return latestElements;
}

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: HandleBars,
  },
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
      let params = {
      messsages: messages,
      seo: seo,
    };



  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/", function (request, reply) {
  if (request.body.button == "clear") {
    messages = [];
    send().then(function (value) {
      messages.push(value);
      let params = { messages: messages, seo: seo };
      // The Handlebars template will use the parameter values to update the page with the chosen color
      return reply.view("/src/pages/index.hbs", params);
    });
  } else {
    let newMessage = request.body.message;

    // If the user's message is SFW, it'll be passed here in the request body
    if (!safe(request.body.message)) {
      // messages.push(new message("user", newMessage));
      messages.push({ role: "user", content: newMessage });

      send().then(function (value) {
        messages.push(value);
        let params = { messages: messages, seo: seo };

        // The Handlebars template will use the parameter values to update the page with the chosen color
        return reply.view("/src/pages/index.hbs", params);
      });
    } else {
      console.log("Message: '" + newMessage + "' is NSFW");
    }
  }

  let params = { messages: messages, loading: true, seo: seo };


});

// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);

HandleBars.registerHelper('print_message', function () {
  let content = this.content.replace(/\r\n/g, "");
    return "${content}, ${this.role}";
})


