const express = require("express");
const router = express.Router();
const Event = require("../models/event");
const multer = require("multer");
const { User } = require("../models/user");

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

      const { titre, description, content, category, type, location, nombreDeParticipants, assignes } = req.body;

      // Validation for `type`
      const allowedTypes = ["Culture", "Sport", "Economie", "Médical", "Social"];
      if (!type || !Array.isArray(type) || !type.every((t) => allowedTypes.includes(t))) {
        return res
          .status(400)
          .send("Invalid type. Allowed values are: Culture, Sport, Economie, Médical, Social.");
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
      });

      const savedEvent = await event.save();
      if (!savedEvent) {
        return res.status(500).send("The event could not be created");
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

    // Check if the event is full
    if (event.nombreDeParticipants > 0 && event.assignes.length >= event.nombreDeParticipants) {
      return res.status(400).send("No empty place available in this event");
    }

    // Verify if the user is already assigned
    if (event.assignes.some((user) => user._id.toString() === userId)) {
      return res.status(400).send("User is already assigned to this event");
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
      message: "User assigned successfully",
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





module.exports = router;
