const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbDir = path.join(process.cwd(), "src", "db");
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, "app.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_filename TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded',
    video_path TEXT,
    subtitle_path TEXT,
    words_path TEXT,
    final_video_path TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const existingColumns = db.prepare("PRAGMA table_info(videos)").all().map((col) => col.name);
if (!existingColumns.includes("denoised_audio_path")) {
  db.exec("ALTER TABLE videos ADD COLUMN denoised_audio_path TEXT");
}

const createVideo = ({ originalFilename, videoPath }) => {
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO videos (original_filename, status, video_path, created_at, updated_at)
       VALUES (?, 'uploaded', ?, ?, ?)`
    )
    .run(originalFilename, videoPath, now, now);

  return result.lastInsertRowid;
};

const ALLOWED_FIELDS = [
  "status",
  "video_path",
  "subtitle_path",
  "words_path",
  "final_video_path",
  "error_message",
  "denoised_audio_path",
];

const updateVideo = (id, fields = {}) => {
  const keys = Object.keys(fields).filter((key) => ALLOWED_FIELDS.includes(key));
  if (!keys.length) return;

  const setClause = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => fields[key]);

  db.prepare(`UPDATE videos SET ${setClause}, updated_at = ? WHERE id = ?`).run(
    ...values,
    new Date().toISOString(),
    id
  );
};

const getVideo = (id) => db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

module.exports = {
  db,
  createVideo,
  updateVideo,
  getVideo,
};
