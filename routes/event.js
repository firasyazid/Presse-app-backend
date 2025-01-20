const express = require("express");
const router = express.Router();
const Event = require("../models/event");
const multer = require("multer");

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

      const event = new Event({
        titre: req.body.titre,
        description: req.body.description,
        content: req.body.content,
        image: imageUrl,
        video: videoUrl,
        image2: image2Url,
        nombreDeParticipants: req.body.nombreDeParticipants || 0,
        assignes: req.body.assignes || [],
        category: req.body.category, // New field added
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
      if (req.body.category) updateFields.category = req.body.category; // New field added

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
    const events = await Event.find();
    if (!events) {
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
    const event = await Event.findById(req.params.id);
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

module.exports = router;
