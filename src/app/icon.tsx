import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/**
 * The White Balance Shift grid, drawn as pure geometry.
 *
 * No text: Satori's default font has no α glyph (it renders as tofu), and a
 * letterform would be illegible at favicon size anyway. The crosshair is the
 * instrument the whole app is built around, and it survives scaling down.
 */
export default function Icon() {
  // Strokes are deliberately heavy: this has to survive being drawn at 32px in
  // a browser tab, where hairlines disappear entirely. Content stays inside the
  // centre ~70% so the maskable variant is not cropped.
  const line = 'rgba(255,255,255,0.42)';
  const box = 360;
  const stroke = 7;
  const mid = box / 2 - stroke / 2;
  const ring = box * 0.42;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0d12',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', width: box, height: box }}>
          {/* axes */}
          <div style={{ position: 'absolute', left: 0, top: mid, width: box, height: stroke, background: line }} />
          <div style={{ position: 'absolute', left: mid, top: 0, width: stroke, height: box, background: line }} />
          {/* step ring */}
          <div
            style={{
              position: 'absolute',
              left: (box - ring) / 2, top: (box - ring) / 2, width: ring, height: ring,
              border: `${stroke}px solid rgba(255,255,255,0.22)`,
            }}
          />
          {/* the plotted recipe: warm and amber-shifted, like most of the catalogue */}
          <div
            style={{
              position: 'absolute', left: box * 0.60, top: box * 0.22,
              width: 96, height: 96, borderRadius: 48, background: '#f0a45c',
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
