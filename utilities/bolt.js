//node packages
const { App } = require("@slack/bolt");

//local packages

//globals
const PORT = process.env.HTTP_PORT || 3000;
const TOKEN = process.env.SLACK_BOT_TOKEN;
const SECRET = process.env.SLACK_SIGNING_SECRET;
const { version: VERSION } = require("../package.json");

//package config
const app = new App({
  token: TOKEN,
  signingSecret: SECRET,
});

(async () => {
  await app.start(PORT);
  console.log(`herald v${VERSION} is running on port ${PORT}...`);
})();

module.exports = { app };
