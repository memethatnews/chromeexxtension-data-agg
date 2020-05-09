import * as fs from 'fs'
import { inspect } from 'util'

export const debugIt = (input, stdOut = true, shouldExit = true) => {
  let data = ''
  data += `// typeof input: ${typeof input}\n`
  if (typeof input !== 'string') {
    data += `const data = ${inspect(input, { depth: 100 })};`
  } else {
    data += `const data = "${input}";`
  }
  data += '\n'

  const filepath = '/tmp/mtn_debug.js'
  fs.writeFileSync(filepath, data, { encoding: 'utf8' })

  if (stdOut) {
    console.log(input)
  }

  console.log(`\n~~~~~ [DEBUG] output written to: ${filepath} ~~~~~`)
  if (shouldExit) {
    console.log('~~~~~ [DEBUG] exit 0 ~~~~~\n')
    process.exit(0)
  }
  console.log('\n')
}
