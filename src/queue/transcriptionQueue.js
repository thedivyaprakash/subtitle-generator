const { Queue } = require("bullmq");
const connection = require("./connection");

const transcriptionQueue = new Queue("transcription", { connection });

module.exports = transcriptionQueue;
