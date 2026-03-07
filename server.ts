import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database('history.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    permalink_url TEXT,
    thumbnail TEXT,
    duration INTEGER,
    user TEXT,
    description TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/history", (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50');
      const history = stmt.all();
      res.json(history);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/history", (req, res) => {
    try {
      const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
      
      // Check if it already exists to avoid duplicates, or just insert. Let's just insert to keep a true history.
      const stmt = db.prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(title, url, permalink_url, thumbnail, duration, user, description);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save history" });
    }
  });

  app.delete("/api/history", (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM history');
      stmt.run();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
