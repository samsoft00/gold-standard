export const detach = <T>(promise: Promise<T>): void => {
  promise.then(
    () => void 0,
    e => {
      console.log(e)
    }
  )
}
