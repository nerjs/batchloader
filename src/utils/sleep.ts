export const sleep = (t: number, unref?: boolean): Promise<undefined> =>
  new Promise(r => {
    const timer = setTimeout(r, t)
    // @ts-ignore
    if (unref) timer?.unref()
  })
