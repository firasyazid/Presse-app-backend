const express = require("express");
const router = express.Router();
const Event = require("../models/event");
const multer = require("multer");
const { User } = require("../models/user");
const { Expo } = require('expo-server-sdk');
const UserPushToken = require('../models/userPushTokenSchema');  
let expo = new Expo();

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "video/mp4": "mp4",
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




router.get("/monthly-summary", async (req, res) => {
  try {
    const summary = await Event.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" }, 
          totalEvents: { $sum: 1 },  
        },
      },
      { $sort: { _id: 1 } },  
    ]);

    res.status(200).send(summary);
  } catch (error) {
    console.error("Error fetching monthly event summary:", error);
    res.status(500).send("Internal Server Error");
  }
});

// GET Events by Type
router.get("/by-type", async (req, res) => {
  try {
    const { type } = req.query;

    // Ensure `type` query parameter is provided
    if (!type) {
      return res.status(400).send("Please provide at least one type.");
    }

    // Convert `type` into an array if it's not already one
    const typeArray = Array.isArray(type) ? type : [type];

    // Validate the types against the allowed values
    const allowedTypes = ["Culture", "Sport", "Economie", "Médical", "Social"];
    if (!typeArray.every((t) => allowedTypes.includes(t))) {
      return res
        .status(400)
        .send("Invalid type. Allowed values are: Culture, Sport, Economie, Médical, Social.");
    }

    // Query the database for events that match the provided types
    const events = await Event.find({ type: { $in: typeArray } }) 
    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order

    .populate({
      path: "assignes",
      select: "username email",
    });

    if (!events || events.length === 0) {
      return res.status(404).send("No events found for the provided type(s).");
    }

    res.status(200).send(events);
  } catch (error) {
    console.error("Error fetching events by type:", error);
    res.status(500).send("Internal Server Error");
  }
});


router.get("/category-distribution", async (req, res) => {
  try {
    const distribution = await Event.aggregate([
      {
        $group: {
          _id: "$category", // Group by category
          count: { $sum: 1 }, // Count the number of events per category
        },
      },
    ]);

    res.status(200).send(distribution);
  } catch (error) {
    console.error("Error fetching category distribution:", error);
    res.status(500).send("Internal Server Error");
  }
});


// POST Route
router.post(
  "/",
  uploadOptions.fields([
    { name: "image", maxCount: 1, optional: true },
    { name: "video", maxCount: 1, optional: true },
    { name: "image2", maxCount: 1, optional: true },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;

      let imageUrl = "";
      if (files["image"] && files["image"][0]) {
        imageUrl = `${basePath}${files["image"][0].filename}`;
      }

      let videoUrl = "";
      if (files["video"] && files["video"][0]) {
        videoUrl = `${basePath}${files["video"][0].filename}`;
      }

      let image2Url = "";
      if (files["image2"] && files["image2"][0]) {
        image2Url = `${basePath}${files["image2"][0].filename}`;
      }

      const {
        titre,
        description,
        content,
        category,
        type,
        location,
        nombreDeParticipants,
        assignes,
        eventDate,
      } = req.body;

      // Validation for `type`
      const allowedTypes = ["Culture", "Sport", "Economie", "Médical", "Social"];
      if (!type || !Array.isArray(type) || !type.every((t) => allowedTypes.includes(t))) {
        return res
          .status(400)
          .send("Invalid type. Allowed values are: Culture, Sport, Economie, Médical, Social.");
      }

      // Validation for `eventDate`
      if (!eventDate) {
        return res.status(400).send("Event date is required.");
      }

      const parsedEventDate = new Date(eventDate);
      if (isNaN(parsedEventDate.getTime())) {
        return res.status(400).send("Invalid event date format.");
      }

      const event = new Event({
        titre,
        description,
        content,
        image: imageUrl,
        video: videoUrl,
        image2: image2Url,
        nombreDeParticipants: nombreDeParticipants || 0,
        assignes: assignes || [],
        category,
        location: location || "",
        type,
        eventDate: parsedEventDate,
      });

      const savedEvent = await event.save();
      if (!savedEvent) {
        return res.status(500).send("The event could not be created");
      }

      //// Step 1: Fetch all Expo push tokens
      const tokens = await UserPushToken.find().select("expoPushToken");
      if (tokens && tokens.length > 0) {
        let messages = [];

        // Step 2: Create notification messages for each token
        for (let tokenDoc of tokens) {
          const expoPushToken = tokenDoc.expoPushToken;
          if (Expo.isExpoPushToken(expoPushToken)) {
            messages.push({
              to: expoPushToken,
              sound: "default",
              title: "Nouvel événement ajouté !",
              body: `Découvrez ${titre}. Restez informé des dernières nouveautés.`,
              data: { eventId: savedEvent._id },
            });
          }
        }

        // Step 3: Chunk and send notifications
        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];
        for (let chunk of chunks) {
          try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
          } catch (error) {
            console.error("Error sending push notifications:", error);
          }
        }
      }

      res.status(201).send(savedEvent);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);


// PUT Route
router.put(
  "/:id",
  uploadOptions.fields([
    { name: "image", maxCount: 1, optional: true },
    { name: "video", maxCount: 1, optional: true },
    { name: "image2", maxCount: 1, optional: true },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const files = req.files || {};
      const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;

      let updateFields = {};

      if (req.body.titre) updateFields.titre = req.body.titre;
      if (req.body.description) updateFields.description = req.body.description;
      if (req.body.content) updateFields.content = req.body.content;
      if (req.body.nombreDeParticipants) {
        updateFields.nombreDeParticipants = req.body.nombreDeParticipants;
      }
      if (req.body.assignes) {
        updateFields.assignes = req.body.assignes;
      }
      if (req.body.category) updateFields.category = req.body.category;
      if (req.body.location) updateFields.location = req.body.location;

      // Validation for `type` field
      if (req.body.type) {
        const allowedTypes = ["Culture", "Sport", "Economie", "Médical", "Social"];
        const typeArray = Array.isArray(req.body.type) ? req.body.type : [req.body.type];
        if (!typeArray.every((t) => allowedTypes.includes(t))) {
          return res
            .status(400)
            .send("Invalid type. Allowed values are: Culture, Sport, Economie, Médical, Social.");
        }
        updateFields.type = typeArray;
      }

      // Validation for `eventDate`
      if (req.body.eventDate) {
        const parsedEventDate = new Date(req.body.eventDate);
        if (isNaN(parsedEventDate.getTime())) {
          return res.status(400).send("Invalid event date format.");
        }
        updateFields.eventDate = parsedEventDate;
      }

      if (files["image"] && files["image"][0]) {
        updateFields.image = `${basePath}${files["image"][0].filename}`;
      }
      if (files["video"] && files["video"][0]) {
        updateFields.video = `${basePath}${files["video"][0].filename}`;
      }
      if (files["image2"] && files["image2"][0]) {
        updateFields.image2 = `${basePath}${files["image2"][0].filename}`;
      }

      const updatedEvent = await Event.findByIdAndUpdate(id, updateFields, {
        new: true,  
      });

      if (!updatedEvent) {
        return res.status(404).send("The event could not be found or updated");
      }

      res.status(200).send(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// GET All Events
router.get("/", async (req, res) => {
  try {
     const events = await Event.find().populate({
      path: "assignes",
      select: "username email",  
    });

    if (!events || events.length === 0) {
      return res.status(404).send("No events found.");
    }

    res.status(200).send(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).send("Internal Server Error");
  }
});

// GET Event by ID
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate({
      path: "assignes",
      select: "username email",  
    });
    if (!event) {
      return res.status(404).send("Event not found.");
    }
    res.status(200).send(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).send("Internal Server Error");
  }
});

// DELETE Event
router.delete("/:id", async (req, res) => {
  try {
    const event = await Event.findByIdAndRemove(req.params.id);
    if (!event) {
      return res.status(404).send("Event not found or already deleted.");
    }
    res.status(200).send({ message: "Event deleted successfully", event });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/:eventId/assign", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    // Find the event by ID
    const event = await Event.findById(eventId).populate("assignes");
    if (!event) {
      return res.status(404).send("Event not found");
    }

    // Check if the event date has passed
    const now = new Date();
    if (event.eventDate && new Date(event.eventDate) < now) {
      return res.status(400).send("La date de l'événement est déjà passée");
    }

    // Check if the event is full
    if (event.nombreDeParticipants > 0 && event.assignes.length >= event.nombreDeParticipants) {
      return res.status(400).send("Aucune place disponible pour cet événement");
    }

    // Verify if the user is already assigned
    if (event.assignes.some((user) => user._id.toString() === userId)) {
      return res.status(400).send("L'utilisateur est déjà assigné à cet événement");
    }

    // Verify if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Assign the user to the event
    event.assignes.push(userId);
    await event.save();

    res.status(200).send({
      message: "L'utilisateur a été assigné avec succès à l'événement",
      event,
    });
  } catch (error) {
    console.error("Error assigning user to event:", error);
    res.status(500).send("Internal Server Error");
  }
});


router.get("/:eventId/assignes", async (req, res) => {
  try {
    const { eventId } = req.params;

     const event = await Event.findById(eventId).populate({
      path: "assignes",
      select: "username email",  
    });

    if (!event) {
      return res.status(404).send("Event not found.");
    }

     res.status(200).send(event.assignes);
  } catch (error) {
    console.error("Error fetching assigned users:", error);
    res.status(500).send("Internal Server Error.");
  }
});


router.get("/assigned-events/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all events where the user is in the assignes array
    const assignedEvents = await Event.find({ assignes: userId })
    .sort({ createdAt: -1 }) 
      .populate({
        path: "assignes",
        select: "username email", 
      })
      .exec();

    if (!assignedEvents || assignedEvents.length === 0) {
      return res.status(404).send("No events found for the specified user.");
    }

    res.status(200).send(assignedEvents);
  } catch (error) {
    console.error("Error fetching assigned events:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
