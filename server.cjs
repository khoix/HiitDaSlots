// CommonJS wrapper for mounting Hiit Da Slots in main-server.js

const path = require("path");
const fs = require("fs");

const distAppPath = path.join(__dirname, "dist", "server", "app.cjs");
const isProduction =
  process.env.NODE_ENV === "production" || fs.existsSync(distAppPath);

let hiitdaslotsApp = null;

if (isProduction && fs.existsSync(distAppPath)) {
  try {
    const appModule = require(distAppPath);
    hiitdaslotsApp = appModule.default || appModule;
  } catch (error) {
    console.error("Error loading built Hiit Da Slots app:", error);
  }
} else {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const staticPath = path.join(__dirname, "dist", "public");

  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath, { redirect: false }));
    app.get("*", (req, res) => {
      const ext = path.extname(req.path);
      if (ext && ext !== ".html") {
        const filePath = path.join(staticPath, req.path);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
        return res.status(404).send("Not found");
      }
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    console.warn(
      "⚠️  Hiit Da Slots: dist/public not found. Run: npm run build",
    );
    app.get("*", (req, res) => {
      res
        .status(503)
        .type("text/plain")
        .send("Hiit Da Slots is not built. Run npm run build in hiitdaslots.");
    });
  }

  hiitdaslotsApp = app;
}

module.exports = hiitdaslotsApp || require("express")();
