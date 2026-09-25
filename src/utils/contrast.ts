function lin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const x = lum(hexA);
  const y = lum(hexB);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function onAccentColor(accentHex: string): '#FFFFFF' | '#000000' {
  return contrastRatio(accentHex, '#FFFFFF') >= contrastRatio(accentHex, '#000000')
    ? '#FFFFFF'
    : '#000000';
}
