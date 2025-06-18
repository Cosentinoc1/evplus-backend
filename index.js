const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("EVPlus Backend is running!");
});

app.get("/api/evprops", (req, res) => {
  res.json([
    { player: "John Doe", prop: "Points", line: 21.5, odds: "+120" }
  ]);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
