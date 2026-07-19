// Arabic (U+0600-06FF), Arabic Supplement (U+0750-077F), Arabic Presentation
// Forms A/B (U+FB50-FDFF, U+FE70-FEFF) — covers Urdu, Pashto, Sindhi, Arabic.
const RTL_SCRIPT_PATTERN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export const isRtlText = (text) => RTL_SCRIPT_PATTERN.test(String(text || ""));

export const getRtlTextStyle = (text) =>
  isRtlText(text) ? { direction: "rtl", textAlign: "right" } : undefined;

export const getRtlCaptionStyle = (text) =>
  isRtlText(text) ? { direction: "rtl" } : undefined;
