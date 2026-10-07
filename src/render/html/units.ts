// The HTML renderer draws slides at 96 px per inch (CSS inches), then scales the whole slide to fit.
export const PX = 96
export const pt = (points: number) => (points * PX) / 72
export const fontStack = (font: string) => `"${font}", system-ui, -apple-system, sans-serif`
