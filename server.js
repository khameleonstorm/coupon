const express = require('express');
const mongoose = require('mongoose');
const app = express();
const nodemailer = require('nodemailer');
require('dotenv').config();


// connecting to MongoDB
mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to MongoDB..."))
  .catch((e) => console.log("Error connecting to MongoDB"));


// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});


app.use(express.json());


// listening to port
const PORT = !process.env.PORT ? 5000 : process.env.PORT;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));


app.get('/', (req, res) => res.send('API running 🥳'));


// Define a schema for the coupon collection
const couponSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  couponCode: {
    type: String,
    required: true,
  }
});

const Coupon = mongoose.model('Coupon', couponSchema);


app.post('/generate-coupon', async (req, res) => {
  const { ip } = req.body;

  const lastRequest = await Coupon.findOne({ ip });

  if (lastRequest) {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    if (lastRequest.date >= twentyFourHoursAgo) {
      // IP address has been used within the last 24 hours
      return res.status(400).json({ message: 'IP address limit exceeded' });
    }
  }

  // Check if the coupon counter is greater than or equal to 20
  const couponCount = await Coupon.countDocuments()

  if (couponCount >= 20) {
    // Coupon limit reached
    return res.status(400).json({ message: 'Coupon limit exceeded' });
  }

  let couponCode = Math.floor(1000 + Math.random() * 9000).toString();

  if (couponCount < 9) couponCode = `0${couponCount + 1}${couponCode}`
  else couponCode = `${couponCount + 1}${couponCode}`



  // Save the new coupon to the database
  const newCoupon = new Coupon({ ip, couponCode });
  await newCoupon.save();

  // Send email to the admin with the coupon code
  sendEmailToAdmin(couponCode);

  // Return the coupon code to the frontend
  res.header("Access-Control-Allow-Origin", "*").send( newCoupon );
});


// Utility function to send email to the admin
function sendEmailToAdmin(couponCode) {
  let transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: `${process.env.SMTP_USER}`,
      pass: `${process.env.SMTP_PASSWORD}`
    },
    tls: { rejectUnauthorized: false }, 
  });

  const mailOptions = {
    from: 'test@spyderdev.com',
    to: 'beeyondteck@gmail.com',
    subject: 'New Coupon Generated',
    text: `Coupon code: ${couponCode}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}