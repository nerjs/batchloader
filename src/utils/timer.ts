/**
 * Conditionally unrefs the timer. When `unrefTimeouts` is left `undefined`,
 * the default is to unref - matching the historical behaviour of this library
 * where pending timers never blocked process exit. Pass `false` explicitly to
 * keep the event loop alive while timers are pending.
 */
export const unrefTimer = (tid: NodeJS.Timeout, unrefTimeouts: boolean | undefined): NodeJS.Timeout => {
  if (unrefTimeouts !== false) tid?.unref?.()
  return tid
}
