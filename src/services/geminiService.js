const { GoogleGenerativeAI } =
require("@google/generative-ai");

const genAI =
new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const enhanceText = async (text) => {

  try {
    const model =
      genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
      });

    const prompt = `
You are a professional Hindi subtitle proofreader.

Your job is to CORRECT the subtitle text.

STRICT RULES:

- Keep subtitle numbers EXACTLY unchanged.
- Keep timestamps EXACTLY unchanged.
- Keep subtitle block count EXACTLY unchanged.
- Correct Hindi transcription mistakes.
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



module.exports = {
  enhanceText
};