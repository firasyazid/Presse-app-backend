const express = require("express");
const app = express();
const morgan = require("morgan");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv/config");
const errorHandler = require("./middleware/error");
const api = process.env.API_URL;
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));
const port = process.env.PORT || 3001;

//Middleware
app.use(morgan("tiny"));
app.use(express.json());
app.use(cors());
app.options("*", cors());
app.use(cors({
  origin: "*",  
}));

app.use(errorHandler);

const userRouter = require("./routes/user");
 
 
  
//Routes
app.use(`${api}/users`, userRouter);
 

//Database
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "la-comchez-vous",
  })
  .then(() => {
    console.log("Database Connection is ready...");
  })
  .catch((err) => {
    console.log(err);
  });

app.get("/", (req, res) => {
  res.send("Hello it's Firass , This is a com-chez-vous app backend.");
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
