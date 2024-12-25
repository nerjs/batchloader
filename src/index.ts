import * as DataLoader from 'dataloader'
import { sleep } from './utils/sleep'

const loader = new DataLoader<number, number>(
  async arr => {
    console.log(arr)
    await sleep(100)
    return arr.map(n => n * 2)
  },
  {
    cache: false,
  },
)

;(async () => {
  const result = await Promise.all([loader.load(1), loader.load(2), loader.load(2)])

  console.log({ result })
})()
