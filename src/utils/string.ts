let num = 0
const count = () => {
  num++
  return num
}

export const randomString = () =>
  `${count().toString(32)}${Date.now().toString(32).substring(4)}${Math.random().toString(32).substring(2, 5)}`
