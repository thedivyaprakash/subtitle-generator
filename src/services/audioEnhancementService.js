const { exec } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const denoiseAudio = (audioPath) => {
  return new Promise((resolve, reject) => {
    const denoisedPath = audioPath.replace(/\.wav$/i, ".denoised.wav");

    const command =
      `"${ffmpegPath}" -i "${audioPath}" -af "afftdn=nf=-25" "${denoisedPath}" -y`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(denoisedPath);
      }
    });
  });
};

module.exports = {
  denoiseAudio,
};
