// const { fs } = require("fs");

const SMTPServer = require("simple-smtp-listener").Server;
const simpleParser = require("mailparser").simpleParser;

// const server = new SMTPServer({
//   // secure: true,
//   // key: fs.readFileSync("private.key"),
//   // cert: fs.readFileSync("server.crt")
//   onData(stream, session, callback) {
//     stream.pipe(process.stdout);
//     stream.on("end", callback);
//   },
// });

// server.listen(587);

const server = new SMTPServer(25);
server.on("tmd@herald.lp13.rpiambulance.com", async (mail) => {
  console.log("text: " + mail.text);
  //   let parsed = await simpleParser(mail);
  //   console.log(parsed);
  //   console.log("got a meesage");
});

console.log("up");
