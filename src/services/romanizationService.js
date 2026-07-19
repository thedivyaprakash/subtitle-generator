const { transliterate } = require("transliteration");

const romanizeText = (text) => {
  return transliterate(text);
};

module.exports = {
  romanizeText,
};