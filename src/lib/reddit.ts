import { throwIfEnvNot } from './utils'
import { extractUrl } from './string'

export const rUrl = permalink => `https://www.reddit.com${permalink}`

export const getAccountPass = account => {
  const what = `REDDIT_PASS_${account}`
  return throwIfEnvNot(what)
}

export const getAccountApiDetails = account => {
  return {
    userAgent: `user-script/${account}/v0.1`,
    clientId: getAccountApiId(account),
    clientSecret: getAccountApiSecret(account),
    username: account,
    password: getAccountPass(account)
  }
}

export const getAccountApiId = account => {
  const what = `REDDIT_API_CLIENTID_${account}`
  return throwIfEnvNot(what)
}

export const getAccountApiSecret = account => {
  const what = `REDDIT_API_CLIENTSECRET_${account}`
  return throwIfEnvNot(what)
}

export const getPostSourceComment = postComments => {
  const extractSkipUrls = [/reddit\.com\/user/gi]
  const pAuthor = postComments.author.name
  const stickyComments = postComments.comments.filter(
    c => c.stickied === true && c.removed === false
  )
  const authorComments = postComments.comments.filter(
    c => c.author.name === pAuthor
  )
  for (const c of [...stickyComments, ...authorComments]) {
    const cUrl = extractUrl(c.body, extractSkipUrls)
    if (cUrl) {
      return {
        comment: c,
        sourceLink: cUrl
      }
    }
  }

  for (const c of postComments.comments) {
    if (c.banned_by || c.mod_reason_by || c.removal_reason) {
      continue
    }
    const cUrl = extractUrl(c.body, extractSkipUrls)
    if (cUrl) {
      return {
        comment: c,
        sourceLink: cUrl
      }
    }
  }

  // recursive through the replies
  for (const c of postComments.comments) {
    if (c.replies) {
      const { comment, sourceLink } = getPostSourceComment({
        author: { name: pAuthor },
        comments: c.replies
      })

      if (comment) {
        return { comment, sourceLink }
      }
    }
  }

  return { sourceLink: '' }
}

export const getPostSourceLink = postComments => {
  const { sourceLink } = getPostSourceComment(postComments)
  return sourceLink
}
