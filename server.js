const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const uploadRoutes = require("./src/routes/uploadRoutes");
const karaokeRoutes = require("./src/routes/karaokeRoutes");

const app = express();

const fontRoutes = require("./src/routes/fontRoutes");

app.use(cors());
app.use(express.json());
app.use("/fonts", express.static(path.join(process.cwd(), "fonts")));
app.use("/uploads", express.static(path.join(process.cwd(), "src", "uploads")));

app.use("/api/upload", uploadRoutes);
app.use("/api/karaoke", karaokeRoutes);
app.use("/api/fonts", fontRoutes);

app.get("/", (req, res) => {
  res.send("Subtitle API Running");
});
 
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
