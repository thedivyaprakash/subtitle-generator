const karaokePresets = [
  { id: "instagram-reel", name: "Instagram Reel" },
  { id: "youtube-shorts", name: "YouTube Shorts" },
  { id: "netflix", name: "Netflix" },
  { id: "news", name: "News" },
  { id: "gaming", name: "Gaming" },
  { id: "podcast", name: "Podcast" },
];

const getKaraokePresets = () => karaokePresets;

const getKaraokePresetDefaults = () => ({
  "instagram-reel": {
    karaokeHighlightMode: "current",
    karaokeAnimationMode: "pop",
    karaokeHighlightColor: "#FFEA00",
    position: "center",
    fontSize: 54,
  },
  "youtube-shorts": {
    karaokeHighlightMode: "current",
    karaokeAnimationMode: "zoom",
    karaokeHighlightColor: "#FFFFFF",
    position: "center",
    fontSize: 56,
  },
  netflix: {
    karaokeHighlightMode: "progressive",
    karaokeAnimationMode: "fade",
    karaokeHighlightColor: "#E50914",
    position: "bottom",
    fontSize: 48,
  },
  news: {
    karaokeHighlightMode: "progressive",
    karaokeAnimationMode: "none",
    karaokeHighlightColor: "#00A3FF",
    position: "bottom",
    fontSize: 46,
  },
  gaming: {
    karaokeHighlightMode: "current",
    karaokeAnimationMode: "slide",
    karaokeHighlightColor: "#7CFF6B",
    position: "center",
    fontSize: 52,
  },
  podcast: {
    karaokeHighlightMode: "progressive",
    karaokeAnimationMode: "fade",
    karaokeHighlightColor: "#FF8A00",
    position: "bottom",
    fontSize: 44,
  },
});

module.exports = {
  getKaraokePresets,
  getKaraokePresetDefaults,
};
