const SMTPServer = require("simple-smtp-listener").Server;
const simpleParser = require("mailparser").simpleParser;

const server = new SMTPServer(25);
server.on("tmd@herald.lp13.rpiambulance.com", async (mail) => {
  console.log("text: " + mail.text);
});

console.log("up");
