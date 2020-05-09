
export const throwIfEnvNot = what => {
  if (typeof process.env[what] === 'undefined') {
    throw new Error(`could not find env var ${what}`)
  }

  return process.env[what]
}
