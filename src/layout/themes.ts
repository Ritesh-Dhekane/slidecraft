// Slide themes. Colours follow the "Studio Deck" design system (docs: Stitch export); fonts are ones
// PowerPoint has on Windows, so the exported file looks like the preview. Mac/LibreOffice substitute
// similar fonts.
import type { ThemeId } from '../schema/content.ts'

export type Theme = {
  id: ThemeId
  name: string
  fonts: { heading: string; body: string; mono: string }
  colors: {
    background: string
    surface: string // cards
    text: string
    muted: string
    primary: string // titles' accent bar, header fills
    accent: string // kickers, highlights
    emphasis: string // big numbers
    onPrimary: string
    accentOnPrimary: string // labels on primary-coloured backgrounds
    border: string
    stripe: string // alternate table rows
    chart: string[]
  }
}

export const THEMES: Record<ThemeId, Theme> = {
  slate: {
    id: 'slate',
    name: 'Editorial Slate',
    fonts: { heading: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas' },
    colors: {
      background: '#FFFFFF',
      surface: '#F2F4F6',
      text: '#191C1E',
      muted: '#464652',
      primary: '#10137A',
      accent: '#5F3ADD',
      emphasis: '#10137A',
      onPrimary: '#FFFFFF',
      accentOnPrimary: '#C9BCFF',
      border: '#C7C5D4',
      stripe: '#F7F9FB',
      chart: ['#2A2F8F', '#7857F8', '#2BB6A3', '#F2A23A'],
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    fonts: { heading: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas' },
    colors: {
      background: '#0F1420',
      surface: '#1A2133',
      text: '#EEF0F5',
      muted: '#A5ADC0',
      primary: '#2A2F8F',
      accent: '#B8A4FF',
      emphasis: '#989EFF',
      onPrimary: '#FFFFFF',
      accentOnPrimary: '#D4C8FF',
      border: '#2C3550',
      stripe: '#151B2A',
      chart: ['#989EFF', '#B8A4FF', '#4FD1BE', '#F6B95C'],
    },
  },
}
