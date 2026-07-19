/**
 * Talks to the subtitle-generator-backend API. Node built-ins only (http,
 * fs, path, crypto) — no npm install needed inside the CEP panel context.
 *
 * Verified standalone: `node backendClient.js <path-to-wav>` against a
 * running backend, independent of Premiere/CEP.
 */

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

const BACKEND_HOST = "localhost";
const BACKEND_PORT = 5000;

const httpRequest = (options, body) => {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: BACKEND_HOST, port: BACKEND_PORT, ...options },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      }
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
};

const uploadAudio = (audioPath, language) => {
  const boundary = crypto.randomBytes(16).toString("hex");
  const fileName = path.basename(audioPath);
  const fileBuffer = fs.readFileSync(audioPath);

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n${language}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="audio"; filename="${fileName}"\r\n` +
      `Content-Type: audio/wav\r\n\r\n`,
    "utf8"
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([preamble, fileBuffer, epilogue]);

  return httpRequest(
    {
      path: "/api/upload/audio",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    },
    body
  ).then((data) => {
    if (!data.success) throw new Error(`Upload failed: ${JSON.stringify(data)}`);
    return data.videoId;
  });
};

const getStatus = (videoId) =>
  httpRequest({ path: `/api/upload/video/${videoId}/status`, method: "GET" });

const waitForTranscription = (videoId, { intervalMs = 2000, timeoutMs = 600000 } = {}) => {
  const startedAt = Date.now();

  const poll = () =>
    getStatus(videoId).then((data) => {
      if (data.status === "ready") return data.subtitleContent || "";
      if (data.status === "failed") {
        throw new Error(`Transcription failed: ${data.errorMessage}`);
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Timed out waiting for transcription.");
      }
      return new Promise((resolve) => setTimeout(resolve, intervalMs)).then(poll);
    });

  return poll();
};

module.exports = { uploadAudio, waitForTranscription, getStatus };

if (require.main === module) {
  const audioPath = process.argv[2];
  if (!audioPath) {
    console.error("Usage: node backendClient.js <path-to-wav>");
    process.exit(1);
  }
  uploadAudio(audioPath, "hi")
    .then((videoId) => {
      console.log("videoId:", videoId);
      return waitForTranscription(videoId);
    })
    .then((subtitleContent) => {
      console.log("subtitleContent:\n", subtitleContent);
    })
    .catch((error) => {
      console.error("ERROR:", error.message);
      process.exit(1);
    });
}
