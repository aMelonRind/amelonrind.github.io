import { sleep } from "./util.ts";

export class Semaphore {
  private readonly capacity: () => number
  private permits = 0
  private waiters: (() => void)[] = []

  constructor(capacity: () => number) {
    this.capacity = () => -Math.floor(capacity())
  }

  async acquire() {
    if (this.permits > this.capacity()) {
      this.permits--
      return
    }

    await new Promise<void>(res => this.waiters.push(res))
  }

  release() {
    if (this.permits < this.capacity()) {
      this.permits++
      return
    }

    const waiter = this.waiters.shift()
    if (waiter) {
      waiter()
    } else {
      this.permits++
    }
  }

  update() {
    const cap = this.capacity()
    if (this.permits > cap) {
      const splice = this.waiters.splice(0, this.permits - cap)
      this.permits -= splice.length
      for (const waiter of splice) {
        waiter()
      }
    }
  }
}

export interface Session {
  check(errorFactory?: () => Error | string): void;
  silentCheck(): boolean;
}

export class Sessions {
  private session = 0n
  private readonly dmm: string

  constructor (defaultMismatchMessage: string = 'session changed') {
    this.dmm = defaultMismatchMessage
  }

  next(): Session {
    const s = ++this.session
    return {
      check: f => {
        if (s !== this.session) {
          throw f?.() ?? new Error(this.dmm)
        }
      },
      silentCheck: () => s === this.session
    }
  }
}

/**
 * @param tasks the list of tasks to run
 * @param semaphore the semaphore that can dynamically decide parallels
 * @param session the session checker to ensure current one is valid
 * @param progressListener the listener that consumes task progress
 * @param threadCap the absolute thread cap, not current parallel
 */
export async function runTasks(
  tasks: (() => Promise<void> | void)[],
  semaphore: Semaphore,
  session: Session,
  progressListener?: (progress: number) => void,
  threadCap: number = navigator.hardwareConcurrency
) {
  // try receive message from potentially idle workers
  await sleep(1)

  let running = true
  let progress = 0
  progressListener?.(progress)
  try {
    await Promise.all(Array.from({ length: threadCap }, async () => {
      while (tasks.length && running) {
        const task = tasks.shift()
        if (!task) break

        session.check()
        await semaphore.acquire()
        if (!running) return
        session.check()

        try {
          await task()
          progress++
          progressListener?.(progress)
        } finally {
          semaphore.release()
        }
      }
    }))
  } finally {
    running = false
  }
}
