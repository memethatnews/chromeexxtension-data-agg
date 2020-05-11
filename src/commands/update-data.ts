import {
  getAccountApiDetails,
  getPostSourceComment,
  rUrl,
  isShareableRedditPost,
} from "../lib/reddit";
// eslint-disable-next-line no-unused-vars
import { debugIt } from "../lib/dev";
import Mercury from "@postlight/mercury-parser";
import eachLimit from "async/eachLimit";
import { urlRemoveTrackingParams, sizeBytes } from "../lib/string";
import { arrayObjectsSoryByKeyDesc } from "../lib/array";
// import * as fs from "fs";
import { throwIfEnvNot } from "../lib/utils";
import S3 from "aws-sdk/clients/s3";
const zlib = require("zlib");
const util = require("util");
const gzip = util.promisify(zlib.gzip);

require("dotenv").config();
const debug = require("debug")("mtn:update-data");

const CHECK_LAST_MAX_ITEMS = parseInt(throwIfEnvNot("CHECK_LAST_MAX_ITEMS"));

const MTN_SUB_URL = "https://www.reddit.com/r/MemeThatNews/";
// check this amount of posts in parallel
const AT_ONCE = throwIfEnvNot("AT_ONCE");
const BUCKET_NAME = throwIfEnvNot("MTN_AGG_AWS_BUCKET");

const Snoowrap = require("snoowrap");
let r;
let s3;

if (process.env.APP_ENV !== "lambda") {
  (async () => {
    process.nextTick(async () => {
      await main();
    });
  })();
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
};

export const main = async () => {
  debug("starting");
  s3 = new S3({
    accessKeyId: throwIfEnvNot("MTN_AGG_AWS_ACCESS_KEY"),
    secretAccessKey: throwIfEnvNot("MTN_AGG_AWS_SECRET"),
  });

  r = new Snoowrap(getAccountApiDetails("MemeThatNewsBot"));
  r.config({
    requestDelay: 1001, // Setting this to more than 1000 will ensure that reddit's ratelimit is never reached, but it will make things run slower than necessary if only a few requests are being sent
  });
  const sub = await r.getSubreddit("MemeThatNews");

  const posts = (
    await sub.getNew({
      limit: CHECK_LAST_MAX_ITEMS,
    })
  ).filter(isShareableRedditPost);

  const data: DataItem[] = [];

  await eachLimit(posts, AT_ONCE, async (p) => {
    const result = await extractPostData(p);
    if (result) {
      data.push(result);
    }
  });

  debug(
    `array length: ${data.length} || string size: ${sizeBytes(
      JSON.stringify(data)
    )} bytes`
  );

  arrayObjectsSoryByKeyDesc(data, "created_utc");

  if (!data.length) {
    console.error(`empty data set. skipping upload`);
    return;
  }

  await s3UploadData(data);

  // fs.writeFileSync("mtn_data.json", JSON.stringify(data), { encoding: "utf8" });
  // debugIt(data, false)
};

const extractPostData = async (p) => {
  if (p.num_comments === 0) {
    debug(`no comments for ${p.permalink}`);
    return;
  }

  debug(`checking ${p.permalink}`);

  const pcs = await p.expandReplies();
  const { sourceLink } = getPostSourceComment(pcs);

  let mercuryRes;
  try {
    mercuryRes = await Mercury.parse(sourceLink, {
      timeout: 5000,
    });
  } catch (err) {
    console.error(`could not Mercury.parse ${sourceLink}: ${err}`);
    return;
  }

  return {
    title: p.title,
    url: rUrl(p.permalink),
    article_title: mercuryRes.title,
    article_smmry: mercuryRes.excerpt,
    // use Mercury url as the sourceLink might have been shortened
    article_url: urlRemoveTrackingParams(mercuryRes.url),
    sub_url: MTN_SUB_URL,
    sub_name: "r/MemeThatNews",
    created_utc: p.created_utc,
  };
};

const s3UploadData = async (raw) => {
  debug(`uploading data`);
  const rawstring = JSON.stringify(raw);
  const buffer = Buffer.from(rawstring, "utf8");
  const compressed = await gzip(buffer);

  await Promise.all([
    s3
      .putObject({
        Bucket: BUCKET_NAME,
        Key: "mtn_data.json",
        Body: rawstring,
        ContentType: "application/json; charset=utf-8",
      })
      .promise(),
    s3
      .putObject({
        Bucket: BUCKET_NAME,
        Key: "mtn_data.json.gz",
        Body: compressed,
        ContentType: "application/json; charset=utf-8",
        ContentEncoding: "gzip",
      })
      .promise(),
  ]);

  debug(`upload successfull`);
};
