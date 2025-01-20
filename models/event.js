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
  content : { 
    type: String,
    required: true,

  },
  image: {
    type: String,
    default: ""
   },
  image2: {
    type: String,
    default: ""

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

  nombreDeParticipants: {
    type: Number,
    default: 0,
  },
 
  assignes: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],
    default: [],
  },
});

module.exports = mongoose.model("Event", eventSchema);
