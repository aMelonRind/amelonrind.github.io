
export function exposeToGlobal(objs: object) {
  const gb: any = globalThis

  for (const [key, value] of Object.entries(objs)) {
    gb[key] ??= value
    if (gb[key] === value) return

    for (let i = 2; i <= 9; i++) {
      const nkey = `${key}${i}`
      gb[nkey] ??= value
      if (gb[nkey] === value) return
    }
  }
}

const truthyStrs: Set<string | undefined> = new Set(['', 'true', 't', 'yes', 'y', 'on', '1', 'enabled', 'active'])

export function getParams() {
  return new URLSearchParams(window.location.search)
}

export function getParam(param: string) {
  return getParams().get(param)
}

export function hasParam(param: string) {
  return truthyStrs.has(getParam(param)?.toLowerCase())
}
