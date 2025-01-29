const { User } = require("../models/user");
 const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
 const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const crypto = require("crypto");
 const multer = require("multer");
const { type } = require("os");


const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.split(" ").join("-");
    const extension = FILE_TYPE_MAP[file.mimetype] || "file";
    cb(null, `${fileName}-${Date.now()}.${extension}`);
  },
});

const uploadOptions = multer({ storage: storage });

router.get('/last-user', async (req, res) => {
  try {
    const userList = await User.find().select("-passwordHash").sort({ _id: -1 });  

    if (!userList) {
      return res.status(500).json({ success: false, message: "No users found" });
    }
    res.status(200).send(userList);
  } catch (error) {
    console.error("Error fetching the last user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
router.get('/total', async (req, res) => {
  try {
    const count = await User.countDocuments(); 
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const userTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "firasyazid4@gmail.com",
    pass: "cntnhhvujdsfzhig",
  },
});

const generateBadgeId = () => {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000); // Generates 8 random digits
  return `com${randomDigits}`;
};

router.post("/inscription", async (req, res) => {
  try {
    const { username, email, password, phone, isAdmin = false, type } = req.body;

    // Validation for required fields
    if (!username || !email || !password || !type || !Array.isArray(type)) {
      return res
        .status(400)
        .send("Username, email, password, and type (as an array) are required.");
    }

    // Check if all values in the `type` array are valid
    const allowedTypes = ["Culture", "Sport", "Economie", "Médical", "Social"];
    if (!type.every((t) => allowedTypes.includes(t))) {
      return res
        .status(400)
        .send("Invalid type. Allowed values are: Culture, Sport, Economie, Médical, Social.");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("User with this email already exists.");
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate badgeId
    const badgeId = generateBadgeId();

    // Create a new user
    const user = new User({
      username,
      email,
      passwordHash,
      phone,
      isAdmin,
      type,
      badgeId, // Add the generated badgeId
    });

    // Save the user
    const savedUser = await user.save();
    if (!savedUser) {
      return res.status(400).send("The user could not be created.");
    }

    // Send welcome email
    const mailOptions = {
      from: "firasyazid4@gmail.com",
      to: email,
      subject: "Bienvenue sur notre plateforme !",
      text: `Bonjour ${username},\n\nNous sommes ravis de vous accueillir sur notre plateforme. Votre badgeId est ${badgeId}.\n\nCordialement,\nL'équipe.`,
    };

    try {
      await userTransporter.sendMail(mailOptions);
      console.log("Email de bienvenue envoyé à", email);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email de bienvenue :", error);
    }

    // Respond with user details
    res.status(201).send({
      id: savedUser.id,
      username: savedUser.username,
      email: savedUser.email,
      phone: savedUser.phone,
      isAdmin: savedUser.isAdmin,
      type: savedUser.type,
      badgeId: savedUser.badgeId,  
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Error creating user");
  }
});

router.get(`/`, async (req, res) => {
  const userList = await User.find().select("-passwordHash").sort({ _id: -1 });

  if (!userList) {
    res.status(500).json({ success: false });
  }
  res.status(200).send(userList);
});

router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id).select("-passwordHash");

  if (!user) {
    res
      .status(500)
      .json({ message: "The user with the given ID was not found." });
  }
  res.status(200).send(user);
});

router.put("/:id", async (req, res) => {
  try {
    const userExist = await User.findById(req.params.id);
    let newPassword;
    if (req.body.password) {
      newPassword = bcrypt.hashSync(req.body.password, 10);
    } else {
      newPassword = userExist.passwordHash;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        username: req.body.username,
        email: req.body.email,
        passwordHash: newPassword,
        phone: req.body.phone,
        isAdmin: req.body.isAdmin,
        type: req.body.type,
       },
      { new: true }
    );

    if (!user) return res.status(400).send("The user cannot be updated!");

   

    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérification des données envoyées
    if (!email || !password) {
      return res.status(400).send("Email et mot de passe sont requis.");
    }

    const user = await User.findOne({ email });
    const secret = process.env.secret;

    if (!user) {
      return res.status(404).send("Utilisateur non trouvé");
    }

     if (!user.passwordHash) {
      return res.status(400).send("L'utilisateur n'a pas de mot de passe défini.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (isPasswordValid) {
      const token = jwt.sign(
        {
          userId: user.id,
          isAdmin: user.isAdmin,
        },
        secret,
        { expiresIn: "3d" }
      );

      return res.status(200).send({
        user: user.email,
        userId: user.id,
        token: token,
        isAdmin: user.isAdmin,
        username: user.username,
        phone: user.phone,
        type : user.type,
      });
    } else {
      return res.status(401).send("Mot de passe incorrect");
    }
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    return res.status(500).send("Erreur interne du serveur");
  }
});


router.get(`/get/count`, async (req, res) => {
  const userCount = await User.countDocuments();
  if (!userCount) {
    res.status(500).json({ success: false });
  }
  res.send({
    userCount: userCount,
  });
});

router.delete("/:id", (req, res) => {
  User.findByIdAndRemove(req.params.id)
    .then((user) => {
      if (user) {
        return res
          .status(200)
          .json({ success: true, message: "the user is deleted!" });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "user not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

router.put("/update/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, name, lastname, password, validation } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (email) {
      user.email = email;
    }

    if (name) {
      user.name = name;
    }

    if (lastname) {
      user.lastname = lastname;
    }

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      user.passwordHash = hashedPassword;
    }

    if (validation !== undefined) {
      user.validation = validation;
    }

    await user.save();
    res.status(200).send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating user");
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Vérifiez si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("Utilisateur introuvable");
    }

     const token = Math.floor(10000 + Math.random() * 90000);  

     user.tokenPassword = token; 
    user.tokenPasswordExpiration = Date.now() + 60 * 60 * 1000;  
    await user.save();

     const userTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "firasyazid4@gmail.com",
        pass: "cntnhhvujdsfzhig",
      },
    });

     const userMailOptions = {
      from: "firasyazid4@gmail.com",
      to: user.email,
      subject: "Réinitialisation de mot de passe",
      html: `
        <html>
          <body>
            <p>Bonjour ${user.fullname},</p>
            <p>Voici votre code de réinitialisation de mot de passe :</p>
            <h3>${token}</h3>
            <p>Ce code expirera dans une heure.</p>
          </body>
        </html>
      `,
    };

     userTransporter.sendMail(userMailOptions, function (error, info) {
      if (error) {
        console.error(error);
        return res.status(500).json({ message: "Échec de l'envoi de l'email" });
      } else {
        console.log("Email envoyé : " + info.response);
        return res
          .status(200)
          .json({ message: "Code de réinitialisation envoyé par email avec succès" });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Erreur serveur");
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    // Validate inputs
    if (!email || !token || !newPassword) {
      return res.status(400).send("Tous les champs sont obligatoires.");
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("Utilisateur introuvable.");
    }

    // Check if the token matches and is not expired
    if (
      user.tokenPassword !== parseInt(token, 10) || // Compare token as a number
      user.tokenPasswordExpiration < Date.now()
    ) {
      return res.status(400).send("Token invalide ou expiré.");
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password and clear the token
    user.passwordHash = hashedPassword;
    user.tokenPassword = null; // Clear the token
    user.tokenPasswordExpiration = null; // Clear the expiration
    await user.save();

    return res.status(200).send("Mot de passe réinitialisé avec succès.");
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", error);
    res.status(500).send("Erreur serveur.");
  }
});

router.put("/:id/email", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

     if (!email) {
      return res.status(400).json({
        success: false,
        message: "Le champ email est obligatoire.",
      });
    }

     const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé.",
      });
    }

     const updatedUser = await User.findByIdAndUpdate(
      id,
      { email },
      { new: true }  
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Email mis à jour avec succès.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'email:", error);
    res.status(500).json({
      success: false,
      message: "Erreur interne du serveur.",
      error,
    });
  }
});

// PUT route to update the phone number of a user
router.put("/update-phone/:userId", async (req, res) => {
  const { userId } = req.params;
  const { phone } = req.body;

  try {
    // Validate input
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Update the user's phone field
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { phone },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Phone number updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while updating the phone number" });
  }
});

router.put("/update-password/:userId", async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  try {
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Both current and new passwords are required.",
      });
    }

    // Fetch user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect." });
    }

    // Hash the new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    user.passwordHash = newPasswordHash;
    const updatedUser = await user.save();

    res.status(200).json({
      message: "Password updated successfully.",
      user: { id: updatedUser.id, email: updatedUser.email },
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the password." });
  }
});

router.put(
  "/:userId/update-image",
  uploadOptions.single("image"),
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const file = req.file;
      const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { image: `${basePath}${file.filename}` },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).send("User not found");
      }

      res.send(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating user's image");
    }
  }
);

router.put(
  "/:userId/update-image",
  uploadOptions.single("image"),
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const file = req.file;
      const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { image: `${basePath}${file.filename}` },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).send("User not found");
      }

      res.send(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating user's image");
    }
  }
);
router.post("/send-email", async (req, res) => {
  const { email, message } = req.body;

  // Input validation
  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are required." });
  }

  try {
    // Email options
    const mailOptions = {
      from: email,  
      to: "firasyazid4@gmail.com",  
      subject: "New Message from Contact Form",  
      text: `You have received a message from ${email}:\n\n${message}`,  
    };

     const info = await userTransporter.sendMail(mailOptions);

    console.log("Email sent:", info.response);
    res.status(200).json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, error: "Failed to send email." });
  }
});

router.post("/inscription2", async (req, res) => {
  try {
    const { username, email, password, phone, isAdmin = false, type = ['Culture'] } = req.body;

    // Validation for required fields
    if (!username || !email || !password) {
      return res
        .status(400)
        .send("Username, email, and password are required.");
    }

    // Ensure type is an array
    if (!Array.isArray(type)) {
      return res
        .status(400)
        .send("Type must be an array.");
    }

    // Check if all values in the `type` array are valid
    const allowedTypes = ["Culture", "Sport", "Economie", "Médical", "Social"];
    if (!type.every((t) => allowedTypes.includes(t))) {
      return res
        .status(400)
        .send("Invalid type. Allowed values are: Culture, Sport, Economie, Médical, Social.");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("User with this email already exists.");
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({
      username,
      email,
      passwordHash,
      phone,
      isAdmin,
      type, 
    });

    // Save the user
    const savedUser = await user.save();
    if (!savedUser) {
      return res.status(400).send("The user could not be created.");
    }

    // Send welcome email
    const mailOptions = {
      from: "firasyazid4@gmail.com",
      to: email,
      subject: "Bienvenue sur notre plateforme !",
      text: `Bonjour ${username},\n\nNous sommes ravis de vous accueillir sur notre plateforme. N'hésitez pas à explorer toutes nos fonctionnalités.\n\nCordialement,\nL'équipe.`,
    };

    try {
      await userTransporter.sendMail(mailOptions);
      console.log("Email de bienvenue envoyé à", email);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email de bienvenue :", error);
    }

    // Respond with user details
    res.status(201).send({
      id: savedUser.id,
      username: savedUser.username,
      email: savedUser.email,
      phone: savedUser.phone,
      isAdmin: savedUser.isAdmin,
      type: savedUser.type,  
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Error creating user");
  }
});


module.exports = router;
