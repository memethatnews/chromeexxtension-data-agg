import { getAccountApiDetails, getPostSourceComment, rUrl, isShareableRedditPost } from '../lib/reddit'
// eslint-disable-next-line no-unused-vars
import { debugIt } from '../lib/dev'
import Mercury from "@postlight/mercury-parser";
import eachLimit from "async/eachLimit";
import { urlRemoveTrackingParams, sizeBytes } from '../lib/string';
import { arrayObjectsSoryByKeyDesc } from '../lib/array';
import * as fs from 'fs'

require('dotenv').config()
const debug = require('debug')('mtn:update-data')

const CHECK_LAST_MAX_ITEMS = 500
const MTN_SUB_URL = 'https://www.reddit.com/r/MemeThatNews/'
// check this amount of posts in parallel
const AT_ONCE = 5;

const Snoowrap = require('snoowrap')
const r = new Snoowrap(getAccountApiDetails('MemeThatNewsBot'))
r.config({
  requestDelay: 1001 // Setting this to more than 1000 will ensure that reddit's ratelimit is never reached, but it will make things run slower than necessary if only a few requests are being sent
})

if (process.env.APP_ENV !== 'lambda') {
  (async () => {
    process.nextTick(async () => {
      await main()
    })
  })()
}

type DataItem = {
    title: string;
    url: string;
    article_title: string;
    article_smmry: string;
    article_url: string;
    sub_url: string;
    sub_name: string;
    created_utc: number;
}

const data: DataItem[] = []

export const main = async () => {
  debug('starting')

  const sub = await r.getSubreddit('MemeThatNews')

  const posts = (await sub.getNew({
    limit: CHECK_LAST_MAX_ITEMS
  })).filter(isShareableRedditPost)

  await eachLimit(posts, AT_ONCE, extractPostData);

  debug(`array length: ${data.length} || string size: ${sizeBytes(JSON.stringify(data))} bytes`)
  // console.log(data)

  arrayObjectsSoryByKeyDesc(data, 'created_utc')

  fs.writeFileSync('mtn_data.json', JSON.stringify(data), {encoding: 'utf8'})

  // debugIt(data, false)
}

const extractPostData = async (p) => {
  if (p.num_comments === 0) {
    debug(`no comments for ${p.permalink}`)
    return
  }

  debug(`checking ${p.permalink}`)

  const pcs = await p.expandReplies()
  const { sourceLink } = getPostSourceComment(pcs)
  
  let mercuryRes
  try {
    mercuryRes= await Mercury.parse(sourceLink)
  } catch(err) {
    console.error(`could not Marcury.parse ${sourceLink}: ${err}`)
    return
  }

  data.push({
    title: p.title,
    url: rUrl(p.permalink),
    article_title: mercuryRes.title,
    article_smmry: mercuryRes.excerpt,
    // use Mercury url as the sourceLink might have been shortened
    article_url: urlRemoveTrackingParams(mercuryRes.url),
    sub_url: MTN_SUB_URL,
    sub_name: 'r/MemeThatNews',
    created_utc: p.created_utc
  })
}
