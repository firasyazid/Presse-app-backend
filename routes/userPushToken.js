const express = require('express');
const router = express.Router();
 const { Expo } = require('expo-server-sdk');  
const UserPushToken = require('../models/userPushTokenSchema');  
let expo = new Expo();  



 router.post('/save-push-token', async (req, res) => {
  const { userId, expoPushToken } = req.body;
  try {
     if (!userId || !expoPushToken) {
      return res.status(400).json({ message: 'UserId and ExpoPushToken are required.' });
    }
     let existingToken = await UserPushToken.findOne({ userId });
    if (existingToken) {
       existingToken.expoPushToken = expoPushToken;
      existingToken.lastUpdated = Date.now();
      await existingToken.save();
    } else {
       const newToken = new UserPushToken({
        userId,
        expoPushToken,
      });
      await newToken.save();
    }
     res.status(200).json({ message: 'Push token saved successfully.' });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


 


module.exports = router;
