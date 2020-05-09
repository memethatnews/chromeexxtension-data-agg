const URI = require('urijs')
const normalizeUrl = require('normalize-url')

export const extractUrl = (s, skipRegEx = []) => {
  const urls = []
  URI.withinString(s, function (u) {
    if (u.indexOf('](') !== -1) {
      // handle edge case for markdown
      // see https://github.com/kevva/url-regex/pull/35
      const many = u.split('](')
      for (const someUrl of many) {
        if (someUrl.charAt(someUrl.length - 1) === ')') {
          urls.push(someUrl.slice(0, someUrl.length - 1))
          continue
        }
        urls.push(someUrl)
      }
    } else {
      urls.push(u)
    }
  })

  let final = []
  if (urls.length && skipRegEx.length) {
    final.push(
      ...urls.filter(u => {
        let skip = false
        skipRegEx.map(rx => {
          if (`${u}`.match(rx) !== null) {
            skip = true
          }
        })

        return !skip
      })
    )
  } else {
    final = urls
  }

  return final.length ? urlRemoveTrackingParams(final[0]) : ''
}

export const urlRemoveTrackingParams = s => {
  return normalizeUrl(
    `${s}`.replace(/&?utm([^&]+)/gi, '').replace(/\?$/gi, ''),
    {
      stripHash: false,
      stripWWW: false,
      removeTrailingSlash: false,
      sortQueryParameters: false,
      removeQueryParameters: [
        'ref',
        'referrer',
        // facebook
        'fbclid',
        // hubspot
        '_hsenc',
        '_hsmi',
        'hsCtaTracking',
        // generic tracking params
        'track',
        'tracking',
        'tracker',
        //
        'wkey',
        'wemail',
        // nytimes
        'smid',
        'action',
        'module',
        'pgtype',
        // youtube
        'feature',
        // source
        'source'
      ]
    }
  )
}

export const sizeBytes = (s: string) => {
  return Buffer.byteLength(s, 'utf8')
}
