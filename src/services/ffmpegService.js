const { exec } = require("child_process");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const extractAudio = (videoPath) => {
  return new Promise((resolve, reject) => {

    const audioFileName =
      Date.now() + ".wav";

    const audioPath = path.join(
      "src/temp",
      audioFileName
    );

    const command =
      `"${ffmpegPath}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;

    exec(command, (error, stdout, stderr) => {

      if (error) {
        reject(stderr);
      } else {
        resolve(audioPath);
      }

    });
  });
};

module.exports = {
  extractAudio,
};