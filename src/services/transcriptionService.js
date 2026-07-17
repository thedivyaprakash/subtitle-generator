const fs = require("fs");
const axios = require("axios");

const transcribeAudio = async (audioPath) => {

  const audioFile =
    fs.readFileSync(audioPath);

const response = await axios.post(
  "https://api.deepgram.com/v1/listen?language=hi&punctuate=true&smart_format=true",
  audioFile,
  {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/wav",
    },
  }
);

console.log(
  response.data.results.channels[0].alternatives[0].words.slice(0, 5)
);

  return response.data;
};

module.exports = {
  transcribeAudio,
};