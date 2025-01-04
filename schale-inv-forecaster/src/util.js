
/**
 * @template T
 * @param {T} obj 
 * @returns {NonNullable<T>}
 */
export function requireNonNull(obj) {
  if (obj != null) return obj
  throw new Error('object is null')
}

/**
 * @param {CanvasRect} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 */
export function drawRect(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, 1)
  ctx.fillRect(x, y + h - 1, w, 1)
  ctx.fillRect(x, y + 1, 1, h - 2)
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2)
}

/** @type {Set<string | undefined>} */
const truthyStrs = new Set(['', 'true', 't', 'yes', 'y', 'on', '1', 'enabled', 'active'])

/**
 * @param {string} param 
 */
export function hasParam(param) {
  return truthyStrs.has(new URLSearchParams(window.location.search).get(param)?.toLowerCase())
}

export function isDev() {
  return hasParam('dev')
}
