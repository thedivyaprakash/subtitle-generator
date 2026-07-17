import { useEffect, useState } from "react";

export default function useWaveform(previewVideoSrc) {
  const [waveformPeaks, setWaveformPeaks] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const generateWaveform = async () => {
      if (!previewVideoSrc) {
        setWaveformPeaks([]);
        return;
      }

      try {
        const response = await fetch(previewVideoSrc);
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = new AudioContextClass();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);
        const bucketCount = 320;
        const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
        const peaks = Array.from({ length: bucketCount }, (_, bucketIndex) => {
          const start = bucketIndex * samplesPerBucket;
          const end = Math.min(channelData.length, start + samplesPerBucket);
          let peak = 0;
          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            peak = Math.max(peak, Math.abs(channelData[sampleIndex] || 0));
          }
          return peak;
        });

        if (!cancelled) setWaveformPeaks(peaks);
        audioContext.close?.();
      } catch {
        if (!cancelled) setWaveformPeaks([]);
      }
    };

    generateWaveform();
    return () => {
      cancelled = true;
    };
  }, [previewVideoSrc]);

  return [waveformPeaks, setWaveformPeaks];
}
