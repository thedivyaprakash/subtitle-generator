const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const buildFontsDirectory = (fontFilePath) => {
  if (!fontFilePath || !fs.existsSync(fontFilePath)) {
    return {
      fontsDir: path.resolve("fonts"),
    };
  }

  const familyDir = path.dirname(fontFilePath);

  return {
    fontsDir: familyDir,
  };
};

const burnSubtitles = (videoPath, assPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const { fontFile } = options;

    const outputPath = path.join(
      "src/videos",
      `subtitled_${Date.now()}.mp4`
    );

    const assFile = path
      .resolve(assPath)
      .replace(/\\/g, "/")
      .replace(":", "\\:");

    const { fontsDir } = buildFontsDirectory(fontFile);
    const normalizedFontsDir = path
      .resolve(fontsDir)
      .replace(/\\/g, "/")
      .replace(":", "\\:");

    const command =
          `ffmpeg -i "${videoPath}" -vf "ass='${assFile}':fontsdir='${normalizedFontsDir}'" "${outputPath}" -y`;

    console.log("Fonts Directory:", fontsDir);
    console.log("ASS File:", assPath);
    console.log("FFmpeg Command:", command);

    exec(command, (error, stdout, stderr) => {
      console.log(stderr);

      if (error) {

        console.log("FFMPEG STDERR =>", stderr);

        reject(error);

      } else {

        resolve(outputPath);

      }

    });

  });
};

module.exports = {
  burnSubtitles
};
