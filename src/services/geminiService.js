const { GoogleGenerativeAI } =
require("@google/generative-ai");

const genAI =
new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const LANGUAGE_NAMES = {
  hi: "Hindi",
  en: "English",
};

const enhanceText = async (text, language = "hi") => {

  try {
    const model =
      genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
      });

    const languageName = LANGUAGE_NAMES[language] || "Hindi";

    const prompt = `
You are a professional ${languageName} subtitle proofreader.

Your job is to CORRECT the subtitle text.

STRICT RULES:

- Keep subtitle numbers EXACTLY unchanged.
- Keep timestamps EXACTLY unchanged.
- Keep subtitle block count EXACTLY unchanged.
- Correct ${languageName} transcription mistakes.
- Correct English transcription mistakes.
- Replace wrong words with the most likely spoken words.
- Improve grammar when the transcription is obviously incorrect.
- Do NOT explain anything.
- Do NOT add notes.
- Do NOT return markdown.
- Return ONLY the corrected SRT.

Example:

Input:
1
00:00:00,000 --> 00:00:02,000
media में changes जा रहा है

Output:
1
00:00:00,000 --> 00:00:02,000
मीडिया इंडस्ट्री में बदलाव आ रहे हैं

Now correct this SRT:

${text}
`;

    const result =
      await model.generateContent(
        prompt
      );

    return result.response
      .text()
      .trim();

  } catch (error) {

    //console.log(      "FULL GEMINI ERROR =>"    );

    //console.log(error);

    return text;
  }

};



const translateText = async (text, sourceLanguage = "hi") => {

  try {
    const model =
      genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
      });

    const languageName = LANGUAGE_NAMES[sourceLanguage] || "Hindi";

    const prompt = `
You are a professional subtitle translator.

Your job is to TRANSLATE the subtitle text from ${languageName} to English.

STRICT RULES:

- Keep subtitle numbers EXACTLY unchanged.
- Keep timestamps EXACTLY unchanged.
- Keep subtitle block count EXACTLY unchanged.
- Translate the ${languageName} text into natural, fluent English.
- Do NOT explain anything.
- Do NOT add notes.
- Do NOT return markdown.
- Return ONLY the translated SRT.

Now translate this SRT:

${text}
`;

    const result =
      await model.generateContent(
        prompt
      );

    return result.response
      .text()
      .trim();

  } catch (error) {

    return text;
  }

};

module.exports = {
  enhanceText,
  translateText,
};