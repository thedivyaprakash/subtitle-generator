function Waveform({ peaks = [], duration = 0, zoom = 100, currentTime = 0 }) {
  const safeDuration = Math.max(0, Number(duration) || 0);
  const pixelsPerSecond = Math.max(1, Number(zoom) || 100) / 10;
  const trackWidth = Math.max(safeDuration * pixelsPerSecond, 100);
  const bars = Array.isArray(peaks) ? peaks : [];
  const playheadLeft = safeDuration ? (Math.min(Math.max(Number(currentTime) || 0, 0), safeDuration) / safeDuration) * 100 : 0;

  return (
    <div className="waveform" style={{ width: `${trackWidth}px` }}>
      <div className="waveform__track" aria-hidden="true">
        {bars.map((peak, index) => (
          <span
            key={`${index}-${peak}`}
            className="waveform__bar"
            style={{
              height: `${Math.max(10, Math.round(Number(peak) * 100))}%`,
              left: `${(index / Math.max(bars.length, 1)) * 100}%`,
            }}
          />
        ))}
        <span className="waveform__playhead" style={{ left: `${playheadLeft}%` }} />
      </div>
    </div>
  );
}

export default Waveform;
