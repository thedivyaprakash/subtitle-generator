const { Queue } = require("bullmq");
const connection = require("./connection");

const renderQueue = new Queue("render", { connection });

module.exports = renderQueue;
