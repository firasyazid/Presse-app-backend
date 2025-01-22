const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: "",
  },
  image2: {
    type: String,
    default: "",
  },
  video: {
    type: String,
    default: "",
  },
  category: {
    type: String,
    enum: ["invitation", "communiqué", "dossier de presse"],
    required: true,
  }, 
 
  type: {
    type: [String],  
    enum: ["Culture", "Sport", "Economie", "Médical", "Social"],  
    required: true,  
  },
  nombreDeParticipants: {
    type: Number,
    default: 0,
  },
  assignes: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    default: [],
  },
  location: {
    type: String,
    default: "",
  }, 
  eventDate: { 
    type: Date,
    required: true, 
  },
  createdAt: { 
    type: Date,
    default: Date.now(),
  }
});

module.exports = mongoose.model("Event", eventSchema);
