const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  passwordHash: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    default: "",
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  expirationDate: {
    type: Date,
    default: null,  
  },
  tokenPassword: {
    type: Number,  
    default: null,
  },
  tokenPasswordExpiration: {
    type: Date,
    default: null,
  },
  image: {
    type: String,
    default: null,
  },
  type: {
    type: [String],  
    enum: ["Culture", "Sport", "Economie", "Médical", "Social"],  
    required: true,  
  },
  badgeId: {
    type: String,
    unique: true,
    default: '',
  },
});


userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

userSchema.set("toJSON", {
  virtuals: true,
});

exports.User = mongoose.model("User", userSchema);
exports.userSchema = userSchema;
