import { parseEmphasis } from "../utils/emphasisUtils";

const FONT_WEIGHT_NUMBERS = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
};

const BOLD_WEIGHTS = ["SemiBold", "Bold", "ExtraBold", "Black"];

const buildChips = (template) => {
  const chips = [];
  if (BOLD_WEIGHTS.includes(template.fontWeight)) chips.push("Bold");
  if (template.uppercase) chips.push("Uppercase");
  if (Number(template.outline) > 0) chips.push("Outline");
  if (Number(template.shadow) > 0) chips.push("Shadow");
  if (template.backgroundStyle === "line") chips.push("Background");
  if (template.backgroundStyle === "word") chips.push("Boxed Words");
  if (template.animation && template.animation !== "none") {
    chips.push(template.animation.charAt(0).toUpperCase() + template.animation.slice(1));
  }
  return chips;
};

function TemplateCard({ template, isSelected, onClick }) {
  const previewWords = parseEmphasis(template.previewText || "Aa Aa");
  const chips = buildChips(template);
  const isBoxed = template.backgroundStyle === "word";

  const previewTextStyle = {
    fontFamily: template.fontName,
    fontWeight: FONT_WEIGHT_NUMBERS[template.fontWeight] || 400,
    textTransform: template.uppercase ? "uppercase" : "none",
    textShadow:
      isBoxed
        ? "none"
        : Number(template.shadow) > 0
          ? `1px 1px 0 rgba(0, 0, 0, 0.85)`
          : Number(template.outline) > 0
            ? `0 0 3px rgba(0, 0, 0, 0.9)`
            : "none",
  };

  return (
    <button
      type="button"
      className={`template-gallery-card ${isSelected ? "template-gallery-card--selected" : ""}`}
      onClick={onClick}
    >
      <div
        className="template-gallery-card__preview"
        style={{ backgroundColor: template.backgroundStyle === "line" ? "#000000" : undefined }}
      >
        {previewWords.map(({ word, emphasized }, index) => (
          <span
            key={`${word}-${index}`}
            className={[
              emphasized ? "template-gallery-card__preview-word--emphasized" : "",
              isBoxed ? "template-gallery-card__preview-word--boxed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              ...previewTextStyle,
              color: isBoxed ? template.fontColor : emphasized ? template.highlightColor : template.fontColor,
              backgroundColor: isBoxed
                ? emphasized
                  ? template.highlightColor
                  : template.backColor || "#000000"
                : undefined,
            }}
          >
            {word}
          </span>
        ))}
      </div>
      <div className="template-gallery-card__body">
        <div className="template-gallery-card__header">
          <strong>{template.name}</strong>
          {isSelected && <span className="template-gallery-card__check">✓</span>}
        </div>
        {chips.length > 0 && (
          <div className="template-gallery-card__chips">
            {chips.map((chip) => (
              <span key={chip} className="template-gallery-card__chip">
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export default TemplateCard;
