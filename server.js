//node packages
const SMTPServer = require("simple-smtp-listener").Server;
require("dotenv").config();

//local packages
const {
  app: {
    client: {
      chat: { postMessage },
    },
  },
} = require("./utilities/bolt.js");

//globals
const RECEIVE_EMAIL = process.env.RECEIVE_EMAIL;
const FIELDS = JSON.parse(process.env.FIELDS);
const TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL = process.env.SLACK_CHANNEL;
const { version: VERSION } = require("./package.json");

//helper functions
const createRegex = () => {
  let regexString = "\\s*(?:";
  for (const field of FIELDS) {
    regexString += field;
    regexString += ")\\s*\\n*|\\s*(?:";
  }
  regexString = regexString.slice(0, -7);
  const regex = new RegExp(regexString, "g");
  return regex;
};

const handleMessage = async ({ text }) => {
  const regex = createRegex();
  const data = text.trim().split(regex);
  data.shift();
  let info = {};

  for (const x in data) {
    info[FIELDS[x]] = data[x];
  }

  //handle call type
  origCallTypeSplit = info["CALL TYPE"].split("-");
  const callType = {
    determinant: origCallTypeSplit[0],
    complaint: origCallTypeSplit[1],
  };
  info["CALL TYPE"] = callType;

  //handle lat + long
  const origLat = info.LATITUDE;
  info.LATITUDE = origLat.slice(0, 2) + "." + origLat.slice(2);
  const origLong = info.LONGITUDE;
  info.LONGITUDE = "-" + origLong.slice(0, 2) + "." + origLong.slice(2);

  console.log(info);

  postMessage({
    token: TOKEN,
    channel: CHANNEL,
    text: {},
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Run number 22-184121",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Determinant: *Alpha*\nCategory: *Falls*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Location: *RPI - Sage Dining Hall*\nAddress: *1649 15th Street*\nApt/Floor: *3*\nCross streets: *Bouton Road/Sage Avenue*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Location: *RPI - Sage Dining Hall*\nAddress: *1649 15th Street*",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Navigate there:\n\n*<http://maps.apple.com/?daddr=42.729787,-73.678242|Apple Maps>*\n\n*<https://maps.google.com/?daddr=42.729787,-73.678242|Google Maps>*",
        },
      },
    ],
  });
};

const server = new SMTPServer(25);

server.on(RECEIVE_EMAIL, async (mail) => {
  handleMessage(await mail);
});

console.log(createRegex());
