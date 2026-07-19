const IORedis = require("ioredis");

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set. Add it to your .env file (Upstash Redis URL).");
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

module.exports = connection;
