const SWATCHES = [
  "#ffffff",
  "#000000",
  "#ffea00",
  "#ff3b30",
  "#00d4ff",
  "#34c759",
  "#ff8a00",
  "#c77dff",
];

function ColorSwatchRow({ value, onChange, disabled }) {
  return (
    <div className="color-swatch-picker">
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          className={`color-swatch-picker__item ${value === swatch ? "color-swatch-picker__item--active" : ""}`}
          style={{ backgroundColor: swatch }}
          disabled={disabled}
          onClick={() => onChange(swatch)}
          aria-label={`Use color ${swatch}`}
        />
      ))}
    </div>
  );
}

export default ColorSwatchRow;
