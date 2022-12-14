const nodemailer = require("nodemailer");
require("dotenv").config();

const TO_EMAIL = process.env.RECEIVE_EMAIL;

let transporter = nodemailer.createTransport({
  host: "localhost",
  port: 25,
  secure: false, // upgrade later with STARTTLS
  ignoreTLS: true,
  // auth: {
  //   user: "username",
  //   pass: "password",
  // },
  callback(err) {
    console.error(err);
  },
});

var message = {
  from: "test@localhost",
  to: TO_EMAIL,
  subject: "cadpaging",
  // text: "Car 1 testing only",
  text: "PAGE SENT TO RE59 INCIDENT 22-184838 CALL TYPE B-Falls ADDRESS 1649 15th Street APT / FLR 1201 LOCATION RPI - Russel Sage Dining Hall (RPI) CROSS STREETS Bouton Road/Sage Avenue EMD CODE 17B04 LATITUDE 42729787 LONGITUDE 73678242",
};

transporter.sendMail(message);
