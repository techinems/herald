//node packages
const SMTPServer = require("simple-smtp-listener").Server;
const axios = require("axios");
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
const HEADSUP_URL = process.env.HEADSUP_URL;
const HEADSUP_TOKEN = process.env.HEADSUP_TOKEN;
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

const handleNonDispatch = (text) => {
  postMessage({
    token: TOKEN,
    channel: CHANNEL,
    text: text,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Message from dispatch:",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: text,
        },
      },
    ],
    unfurl_links: false,
  });
};

const handleMessage = ({ text }) => {
  if (!text.trim().startsWith("PAGE SENT TO")) {
    return handleNonDispatch(text);
  }

  const regex = createRegex();
  const data = text.trim().split(regex);
  data.shift();
  let info = {};

  for (const x in data) {
    info[FIELDS[x]] = data[x];
  }

  //handle run number
  info.INCIDENT = info.INCIDENT.split(/^\d{2}-/)[1];

  //handle call type
  const origCallTypeSplit = info["CALL TYPE"].split("-");
  let callType;
  if (origCallTypeSplit.length == 2) {
    callType = {
      determinant: origCallTypeSplit[0],
      complaint: origCallTypeSplit[1],
    };
  } else {
    callType = {
      determinant: 0,
      complaint: info["CALL TYPE"],
    };
  }
  info["CALL TYPE"] = callType;

  //handle determinant
  switch (info["CALL TYPE"].determinant) {
    case "A":
      info["CALL TYPE"].determinant = "Alpha";
      break;
    case "B":
      info["CALL TYPE"].determinant = "Bravo";
      break;
    case "C":
      info["CALL TYPE"].determinant = "Charlie";
      break;
    case "D":
      info["CALL TYPE"].determinant = "Delta";
      break;
    case "E":
      info["CALL TYPE"].determinant = "Echo";
      break;
    default:
      info["CALL TYPE"].determinant = "Unknown";
      break;
  }

  //handle lat + long
  const origLat = info.LATITUDE;
  info.LATITUDE = origLat.slice(0, 2) + "." + origLat.slice(2);
  const origLong = info.LONGITUDE;
  info.LONGITUDE = "-" + origLong.slice(0, 2) + "." + origLong.slice(2);

  postMessage({
    token: TOKEN,
    channel: CHANNEL,
    text: `Run number ${info.INCIDENT}: ${info[
      "CALL TYPE"
    ].determinant.toLowerCase()} ${info[
      "CALL TYPE"
    ].complaint.toLowerCase()} at ${info.LOCATION}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Run number ${info.INCIDENT}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Determinant: *${info["CALL TYPE"].determinant}*
          \nCategory: *${info["CALL TYPE"].complaint}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Location: *${info.LOCATION}*\nAddress: *${info.ADDRESS}*\n${
            info["APT / FLR"] == "" ? "" : `Apt/floor: *${info["APT / FLR"]}*\n`
          }Cross streets: *${info["CROSS STREETS"]}*`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Navigate:",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Apple Maps",
              emoji: true,
            },
            url: `http://maps.apple.com/?daddr=${info.LATITUDE},${info.LONGITUDE}`,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Google Maps",
              emoji: true,
            },
            url: `https://maps.google.com/?daddr=${info.LATITUDE},${info.LONGITUDE}`,
          },
        ],
      },
    ],
    unfurl_links: false,
  });

  if (HEADSUP_URL != "") {
    console.log("dispatching to headsup");
    axios
      .post(`${HEADSUP_URL}/dispatch?token=${HEADSUP_TOKEN}`, info)
      .catch((err) => console.error(err));
  }
};

const server = new SMTPServer(25);

server.on(RECEIVE_EMAIL, async (mail) => {
  handleMessage(await mail);
});

console.log(`headsup v${VERSION} running`);

console.log(createRegex());
