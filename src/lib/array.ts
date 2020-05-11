
export const arrayObjectsSoryByKeyDesc = (array, key) => {
  return array.sort((b, a) =>
    a[key] > b[key] ? 1 : a[key] === b[key] ? 0 : -1
  )
}
