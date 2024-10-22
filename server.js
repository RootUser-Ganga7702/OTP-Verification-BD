const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const twilio = require('twilio');
const cors = require("cors")
require('dotenv').config();
 
const app = express();
const PORT = process.env.PORT || 4000;
 
// Middleware
app.use(bodyParser.json());
app.use(cors())
 
// MongoDB Atlas connection
mongoose.connect(process.env.OPENAI_API_KEY).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch(err => {
    console.error('Failed to connect to MongoDB Atlas', err);
});
 
const TWILIO_ACCOUNT_SID=process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN=process.env.TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER=process.env.TWILIO_PHONE_NUMBER
 
// Twilio setup
const twilioClient = twilio(TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN);
 
// User schema and model
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile: { type: String, required: true },
    otp: { type: String },
    isVerified: { type: Boolean, default: false }
});
 
const User = mongoose.model('User', userSchema);
 
// Registration route
app.post('/register', async (req, res) => {
    try {
        const { email, password, mobile } = req.body;
 
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
 
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
 
        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
 
        // Send OTP via Twilio
        await twilioClient.messages.create({
            body: `Your OTP code is ${otp}`,
            from: TWILIO_PHONE_NUMBER,
            to:mobile
        });
 
        // Create new user with OTP
        const newUser = new User({
            email,
            password: hashedPassword,
            mobile,
            otp
        });
 
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully. Please verify your OTP.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});
 
// OTP verification route
app.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
 
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
 
        // Check OTP
        if (user.otp === otp) {
            user.isVerified = true;
            user.otp = null; // Clear OTP after verification
            await user.save();
            res.status(200).json({ message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ message: 'Invalid OTP' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});
 
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});