const fs = require("fs");
const axios = require("axios");

const SUPPORTED_LANGUAGES = ["hi", "en"];

const transcribeAudio = async (audioPath, language = "hi") => {

  const safeLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "hi";

  const audioFile =
    fs.readFileSync(audioPath);

const response = await axios.post(
  `https://api.deepgram.com/v1/listen?language=${safeLanguage}&punctuate=true&smart_format=true`,
  audioFile,
  {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/wav",
    },
  }
);
/*
console.log(
  response.data.results.channels[0].alternatives[0].words.slice(0, 5)
);
*/
  return response.data;
};

module.exports = {
  transcribeAudio,
  SUPPORTED_LANGUAGES,
};