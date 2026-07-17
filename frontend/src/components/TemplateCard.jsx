function TemplateCard({ template, isSelected, onClick }) {
  const previewStyle = {
    fontFamily: template.fontName,
    fontWeight:
      template.fontWeight === "Regular"
        ? 400
        : template.fontWeight === "Medium"
          ? 500
          : template.fontWeight === "SemiBold"
            ? 600
            : template.fontWeight === "Bold"
              ? 700
              : 800,
    color: template.fontColor,
  };

  return (
    <button
      type="button"
      className={`template-gallery-card ${isSelected ? "template-gallery-card--selected" : ""}`}
      onClick={onClick}
    >
      <div className="template-gallery-card__preview" style={previewStyle}>
        <span>Aa</span>
        <span> Aa</span>
      </div>
      <div className="template-gallery-card__body">
        <div className="template-gallery-card__header">
          <strong>{template.name}</strong>
          {isSelected && <span className="template-gallery-card__check">✓</span>}
        </div>
        <div className="template-gallery-card__meta">
          <span><b>Font</b>{template.fontName}</span>
          <span><b>Animation</b>{template.animation}</span>
          <span>
            <b>Highlight</b>
            <i className="template-gallery-card__swatch" style={{ backgroundColor: template.highlightColor }} />
          </span>
          <span><b>Position</b>{template.position}</span>
        </div>
      </div>
    </button>
  );
}

export default TemplateCard;
