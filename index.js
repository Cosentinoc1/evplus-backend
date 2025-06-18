// index.js ― EVPlus backend 2.0
// -----------------------------
// • GET /api/props?league=nba —— returns JSON list of live PrizePicks props
// • GET /api/generate-pdf?league=nba —— streams a nicely-formatted PDF

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const { Readable } = require("stream");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

/* ---------------- League helpers ---------------- */
const LEAGUE_IDS = {
  nba: 7,
  mlb: 10,
  nfl: 9,
  nhl: 2,
  tennis: 14,
};

async function fetchPrizePicksProps(leagueKey = "nba") {
  const leagueId = LEAGUE_IDS[leagueKey.toLowerCase()];
  if (!leagueId) throw new Error(`Unsupported league: ${leagueKey}`);

  // PrizePicks’ undocumented JSON endpoint
  // It sometimes blocks blank User-Agents, so we spoof a browser header. 0
  const url = `https://api.prizepicks.com/projections?league_id=${leagueId}&per_page=250&single_stat=true`;

  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: "https://www.prizepicks.com/",
    },
    timeout: 10000,
  });

  // Build quick player-id → name map from the “included” array
  const playerName = {};
  (data.included || []).forEach((inc) => {
    if (inc.type === "new-player") playerName[inc.id] = inc.attributes.name;
  });

  // Flatten projection rows
  const props = (data.data || []).map((row) => {
    const a = row.attributes;
    return {
      player: playerName[a.new_player_id] || "Unknown",
      stat: a.stat_type,
      line: a.line_score,
      team: a.team || "",
      league: leagueKey.toUpperCase(),
    };
  });

  return props;
}

/* ---------------- REST endpoints ---------------- */
app.get("/", (_req, res) => res.send("EVPlus Backend is running!"));

app.get("/api/props", async (req, res) => {
  try {
    const league = req.query.league || "nba";
    const props  = await fetchPrizePicksProps(league);
    res.json(props);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/generate-pdf", async (req, res) => {
  try {
    const league = req.query.league || "nba";
    const props  = await fetchPrizePicksProps(league);

    // --- Build PDF in memory ---
    const doc  = new PDFDocument({ margin: 30, size: "LETTER" });
    const name = `prizepicks_${league}_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename=${name}`);
    res.setHeader("Content-Type", "application/pdf");

    // Title
    doc.fontSize(18).text(`PrizePicks Props – ${league.toUpperCase()}`, {
      align: "center",
    });
    doc.moveDown();

    // Table header
    const COLS = [180, 90, 80, 80]; // widths
    doc.fontSize(12).font("Helvetica-Bold");
    ["Player", "Stat", "Line", "Team"].forEach((h, i) =>
      doc.text(h, { continued: i !== 3, width: COLS[i] })
    );
    doc.moveDown(0.3);
    doc.font("Helvetica");

    // Rows
    props.forEach((p) => {
      const row = [p.player, p.stat, p.line, p.team];
      row.forEach((txt, i) =>
        doc.text(String(txt), { continued: i !== 3, width: COLS[i] })
      );
      doc.moveDown(0.1);
    });

    doc.end();
    Readable.from(doc).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Start server ---------------- */
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
