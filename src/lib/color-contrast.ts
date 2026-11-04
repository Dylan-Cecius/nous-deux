/** Foreground for opaque #RGB/#RRGGBB member colors; other formats keep the existing white fallback. */
export function foregroundOnColor(background: string): '#FFFFFF' | '#000000' {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(background)) return '#FFFFFF';
  const hex = background.length === 4
    ? background.slice(1).split('').map(digit => digit + digit).join('')
    : background.slice(1);
  const linear = (offset: number) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(0) + 0.7152 * linear(2) + 0.0722 * linear(4);
  // Preserve white wherever it already meets the 4.5:1 text threshold.
  return 1.05 / (luminance + 0.05) >= 4.5 ? '#FFFFFF' : '#000000';
}
