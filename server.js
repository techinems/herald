// A replacement/augmentation of server.js that:
// - validates the SMTP recipient (ensures the message was sent to a specific address)
// - parses the sample dispatch text into fields
// - uses the Google Maps Geocoding API (with a Troy, NY bias) to get lat/long
// - posts a Slack message formatted similarly to server.js
//
// Environment variables required:
// - SLACK_BOT_TOKEN         (the bot token used with chat.postMessage)
// - SLACK_CHANNEL           (channel id to post to)
// - GOOGLE_MAPS_API_KEY     (API key for Google Maps Geocoding API)
// - RECEIVE_EMAIL        (the exact recipient address that must be used in RCPT TO)
// - PORT (optional, defaults to 25)
//
// Usage: node server-geocode.js
//
// Note: install dependencies:
//   npm install smtp-server dotenv

const { SMTPServer } = require("smtp-server");
require("dotenv").config();

// local bolt helper (same shape as server.js); adjust path as needed
const {
  app: {
    client: {
      chat: { postMessage },
    },
  },
} = require("./utilities/bolt.js");

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const RECEIVE_EMAIL = process.env.RECEIVE_EMAIL;
const PORT = parseInt(process.env.PORT || "25", 10);
const { version: VERSION } = require("./package.json");

// Helper: parse a simple "Key: Value" style message into an object.
// Handles blank values and keys with spaces. Also collapses multiple lines into the value if needed.
function parseKeyValueText(text) {
  const obj = {};
  // Normalize line endings and split
  const lines = text.replace(/\r/g, "").split("\n");
  let currentKey = null;
  for (let line of lines) {
    line = line.trim();
    if (line === "") {
      // preserve blank known keys as empty string (handled by falling through)
      continue;
    }
    const kvMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1].trim();
      obj[currentKey] = kvMatch[2] || "";
    } else if (currentKey) {
      // continuation line for previous key
      obj[currentKey] = (obj[currentKey] ? obj[currentKey] + " " : "") + line;
    }
  }
  return obj;
}

// Use Google Geocoding API to turn an address into lat/lng.
// We "bias" to Troy, NY by setting components=locality:Troy|administrative_area:NY|country:US
// which will prefer results in Troy, NY.
async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }

  const params = {
    address: address,
    key: GOOGLE_MAPS_API_KEY,
    // components acts like a bias/filter: prefer Troy, NY results.
    components: "locality:Troy|administrative_area:NY|country:US",
  };

  const url = "https://maps.googleapis.com/maps/api/geocode/json";

  try {
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch(`${url}?${qs}`);
    const data = await resp.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      // Try without components as a fallback
      const fallbackQs = new URLSearchParams({ address, key: GOOGLE_MAPS_API_KEY }).toString();
      const fallbackResp = await fetch(`${url}?${fallbackQs}`);
      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();
        if (
          fallbackData &&
          fallbackData.status === "OK" &&
          fallbackData.results &&
          fallbackData.results.length > 0
        ) {
          const loc = fallbackData.results[0].geometry.location;
          return { lat: loc.lat, lng: loc.lng, place: fallbackData.results[0].formatted_address };
        }
      }
      return null;
    }
    const result = data.results[0];
    const loc = result.geometry.location;
    return { lat: loc.lat, lng: loc.lng, place: result.formatted_address };
  } catch (err) {
    console.error("geocodeAddress error:", err && err.message ? err.message : err);
    throw err;
  }
}

// Convert "Call Type: A - Sick Person" into the same CALL TYPE object server.js builds
function parseCallType(callTypeRaw) {
  const split = callTypeRaw.split(/\s*-\s*/);
  let callType;
  if (split.length === 2) {
    callType = {
      determinant: split[0].trim(),
      complaint: split[1].trim(),
    };
  } else {
    callType = {
      determinant: "0",
      complaint: callTypeRaw.trim(),
    };
  }

  switch (callType.determinant) {
    case "A":
      callType.determinant = "Alpha";
      break;
    case "B":
      callType.determinant = "Bravo";
      break;
    case "C":
      callType.determinant = "Charlie";
      break;
    case "D":
      callType.determinant = "Delta";
      break;
    case "E":
      callType.determinant = "Echo";
      break;
    default:
      // leave as-is (e.g., "0" or unknown)
      if (callType.determinant !== "0") {
        callType.determinant = "Unknown";
      } else {
        callType.determinant = "Unknown";
      }
      break;
  }
  return callType;
}

// Build Slack message blocks similar to server.js
function buildSlackBlocks(info) {
  const coordsText = info.latitude && info.longitude ? ` (${info.latitude}, ${info.longitude})` : "";
  const aptFloor = info["Additional Location Info"] || "";
  const crossStreets = info["Cross Street"] || info["Cross Streets"] || "";

  const headerText = `Call received: ${info["CALL TYPE"].determinant} - ${info["CALL TYPE"].complaint}`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: headerText,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Location:* ${info.Location}\n*Business:* ${info.Business || "N/A"}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Cross Streets:* ${crossStreets || "N/A"}\n*Additional Info:* ${
          aptFloor || "N/A"
        }`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Navigate:\n${info.geocoded_place}`,
      },
    },
  ];

  // If we have coordinates add map buttons
  if (info.latitude && info.longitude) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Apple Maps",
            emoji: true,
          },
          url: `http://maps.apple.com/?daddr=${info.latitude},${info.longitude}`,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Google Maps",
            emoji: true,
          },
          url: `https://maps.google.com/?daddr=${info.latitude},${info.longitude}`,
        },
      ],
    });
  }

  return blocks;
}

// Main message handler: parse text, geocode Location, post to Slack
async function handleDispatchText(text) {
  try {
    const parsed = parseKeyValueText(text);

    // Normalize keys used in server.js style
    // Map "Call Type" -> "CALL TYPE", etc.
    const info = {};
    for (const k of Object.keys(parsed)) {
      info[k] = parsed[k];
    }

    // Parse call type into object
    if (info["Call Type"]) {
      info["CALL TYPE"] = parseCallType(info["Call Type"]);
    } else if (info["CALL TYPE"]) {
      info["CALL TYPE"] = parseCallType(info["CALL TYPE"]);
    } else {
      info["CALL TYPE"] = { determinant: "Unknown", complaint: "Unknown" };
    }

    // Geocode Location
    if (info.Location) {
      let geocode;
      try {
        geocode = await geocodeAddress(info.Location);
      } catch (err) {
        console.warn("Geocoding failed, continuing without coords");
        geocode = null;
      }
      if (geocode) {
        // format lat/long similar to server.js (latitude like 42.7, longitude negative)
        info.latitude = geocode.lat;
        info.longitude = geocode.lng;
        info["geocoded_place"] = geocode.place;
      }

      // Strip leading 'RPI -' (or variants like 'RPI-') from Business field, case-insensitive
      if (info.Business) {
        info.Business = info.Business.replace(/^\s*RPI\s*-\s*/i, "").trim();
      }
    }

    // Compose the short text and post to Slack
    const shortText = `${info["CALL TYPE"].determinant.toLowerCase()} ${info["CALL TYPE"].complaint.toLowerCase()} at ${info.Location}`;

    await postMessage({
      token: SLACK_TOKEN,
      channel: SLACK_CHANNEL,
      text: shortText,
      blocks: buildSlackBlocks(info),
      unfurl_links: false,
    });

    console.log("Posted to Slack:", shortText);
    if (info.geocoded_place) {
      console.log("Geocoded to:", info.geocoded_place);
    }

    // Dispatch to HEADSUP if configured (using fetch, similar to original pattern)
    const HEADSUP_URL = process.env.HEADSUP_URL || "";
    const HEADSUP_TOKEN = process.env.HEADSUP_TOKEN || "";
    if (HEADSUP_URL != "") {
      console.log(`dispatching to headsup`);
      const x = await fetch(`${HEADSUP_URL}/dispatch?token=${HEADSUP_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      }).catch((err) => console.error(err));
    }
  } catch (err) {
    console.error("handleDispatchText error:", err && err.message ? err.message : err);
  }
}

// Set up SMTP server that only accepts messages sent to RECEIVE_EMAIL
if (!RECEIVE_EMAIL) {
  console.error("RECEIVE_EMAIL env var is required");
  process.exit(1);
}
const server = new SMTPServer({
  // Do not require authentication for this example; tighten for production
  disabledCommands: ["AUTH"],
  // Called for each RCPT TO. Reject if recipient != RECEIVE_EMAIL
  onRcptTo(address, session, callback) {
    const rcpt = address && address.address ? address.address.toLowerCase() : String(address).toLowerCase();
    if (rcpt === RECEIVE_EMAIL.toLowerCase()) {
      return callback(); // accept
    }
    const err = new Error("550 Recipient not accepted");
    err.responseCode = 550;
    return callback(err);
  },
  // Collect the message data and run the parser
  async onData(stream, session, callback) {
    let emailBody = "";
    stream.on("data", (chunk) => {
      emailBody += chunk.toString();
    });
    stream.on("end", async () => {
      try {
        // Very simple extraction: prefer the plain text body if present.
        // If the email is raw MIME, attempt to pull after the first blank line
        // (headers end) — this is a naive approach for demonstration.
        const splitOnDoubleNewline = emailBody.split("\n\n");
        let bodyCandidate = splitOnDoubleNewline.slice(1).join("\n\n").trim();
        if (!bodyCandidate) {
          // fallback to entire raw body
          bodyCandidate = emailBody;
        }

        // If the message contains "Content-Type: text/plain", try to extract that section.
        const plainMatch = emailBody.match(/Content-Type:\s*text\/plain[^]*?(?:\r?\n\r?\n)([^]*?)(?:\r?\n--|$)/i);
        if (plainMatch && plainMatch[1]) {
          bodyCandidate = plainMatch[1].trim();
        }

        // Trim and pass to handler
        await handleDispatchText(bodyCandidate);
        callback();
      } catch (err) {
        console.error("onData processing error:", err && err.message ? err.message : err);
        callback(err);
      }
    });
  },
  logger: false,
  // increase size limits if needed
  size: 10 * 1024 * 1024,
});

server.listen(PORT, () => {
  console.log(`Dispatch SMTP server listening on port ${PORT}`);
  console.log(`Expecting messages sent TO: ${RECEIVE_EMAIL}`);
  console.log(`herald v${VERSION} running`);
});

// For testing: a convenience function that demonstrates parsing the example text and posting to Slack.
// You can call this directly (node server-geocode.js test) to run a one-off parse+post.
const EXAMPLE_TEXT = `Call Type: A - Falls
Location: 51 COLLEGE AVE, TROY CITY
Business: RPI - Darrin Communications Center (DCC)
Additional Location Info: RM 308
Cross Street: 13TH ST / 8TH ST
Dispatched Units: E59
Response Areas: Troy FD 2640/Troy EMS 8243`;

if (process.argv.includes("test")) {
  (async () => {
    console.log("Running test parse + geocode of example text...");
    await handleDispatchText(EXAMPLE_TEXT);
    process.exit(0);
  })();
}