// App-wide UI signals that don't need a state library.
export const openSettings = () => window.dispatchEvent(new Event('slidecraft:settings'))
export const onOpenSettings = (handler: () => void) => {
  window.addEventListener('slidecraft:settings', handler)
  return () => window.removeEventListener('slidecraft:settings', handler)
}
