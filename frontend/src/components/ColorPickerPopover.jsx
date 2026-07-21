import { useCallback, useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, isValidHex } from "../utils/colorUtils";

// A small trigger swatch that opens a saturation/value box + hue strip +
// hex field popover — lets you pick any shade freely, not just the fixed
// preset row (ColorSwatchRow, kept as-is alongside this) or whatever the
// browser's native color input happens to look like on a given OS.
function ColorPickerPopover({ value, onChange, disabled, label }) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const [dragTarget, setDragTarget] = useState(null); // "sv" | "hue" | null

  const svBoxRef = useRef(null);
  const hueRef = useRef(null);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (dragTarget) return;
    setHsv(hexToHsv(value));
    setHexInput(value);
  }, [value, dragTarget]);

  const commit = useCallback(
    (nextHsv) => {
      setHsv(nextHsv);
      const hex = hsvToHex(nextHsv);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange]
  );

  // Pointer handlers read the latest hsv via a ref (not the hsv state
  // closure) so rapid drag events during a fast pointermove don't race a
  // stale value.
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const handleSvPointer = useCallback(
    (clientX, clientY) => {
      const box = svBoxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      commit({ ...hsvRef.current, s, v });
    },
    [commit]
  );

  const handleHuePointer = useCallback(
    (clientX) => {
      const strip = hueRef.current;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const h = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * 360;
      commit({ ...hsvRef.current, h });
    },
    [commit]
  );

  useEffect(() => {
    if (!dragTarget) return undefined;
    const handleMove = (event) => {
      if (dragTarget === "sv") handleSvPointer(event.clientX, event.clientY);
      else handleHuePointer(event.clientX);
    };
    const handleUp = () => setDragTarget(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragTarget, handleSvPointer, handleHuePointer]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleHexInputChange = (event) => {
    const next = event.target.value;
    setHexInput(next);
    if (isValidHex(next)) {
      setHsv(hexToHsv(next));
      onChange(next);
    }
  };

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className="color-picker">
      <button
        ref={triggerRef}
        type="button"
        className="color-picker__trigger"
        style={{ backgroundColor: value }}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={label ? `Open color picker for ${label}` : "Open color picker"}
      />
      {open && (
        <div ref={popoverRef} className="color-picker__popover">
          <div
            ref={svBoxRef}
            className="color-picker__sv-box"
            style={{ backgroundColor: hueColor }}
            onPointerDown={(event) => {
              setDragTarget("sv");
              handleSvPointer(event.clientX, event.clientY);
            }}
          >
            <div
              className="color-picker__sv-handle"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <div
            ref={hueRef}
            className="color-picker__hue-strip"
            onPointerDown={(event) => {
              setDragTarget("hue");
              handleHuePointer(event.clientX);
            }}
          >
            <div className="color-picker__hue-handle" style={{ left: `${(hsv.h / 360) * 100}%` }} />
          </div>
          <input
            className="color-picker__hex-input"
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            spellCheck={false}
            maxLength={7}
          />
        </div>
      )}
    </div>
  );
}

export default ColorPickerPopover;
