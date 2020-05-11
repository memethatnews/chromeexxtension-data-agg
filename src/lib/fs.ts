import * as path from 'path'

export const fileExtension = s => {
  return path.extname(`${s}`).slice(1)
}
