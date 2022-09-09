const SMTPServer = require("simple-smtp-listener").Server;

require("dotenv").config();

const RECEIVE_EMAIL = process.env.RECEIVE_EMAIL;
const FIELDS = JSON.parse(process.env.FIELDS);

const createRegex = () => {
  let regexString = "\\s*(";
  for (const field of FIELDS) {
    regexString += field;
    regexString += ")\\s*|\\s*(";
  }
  regexString = regexString.slice(0, -5);
  console.log(regexString);
  const regex = new RegExp(regexString);
  return regex;
};

const handleMessage = async (mail) => {
  let data = [];
};

const server = new SMTPServer(25);
server.on(RECEIVE_EMAIL, async (mail) => {
  handleMessage(await mail);
});

console.log("up");

console.log(createRegex());
