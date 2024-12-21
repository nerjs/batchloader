export const sleep = (t: number, unref?: boolean) =>
  new Promise(r => {
    const timer = setTimeout(r, t)
    if (unref) timer?.unref()
  })
