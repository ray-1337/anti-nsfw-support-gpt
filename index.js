require("dotenv/config");

const { readFile, writeFile, rm } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");

const { OpenAIApi, Configuration } = require("openai");

const { createFineTune, createFile } = new OpenAIApi(new Configuration({
  organization: process.env.ORGANIZATION,
  accessToken: process.env.OPENAI_KEY
}));

// 1. compile .txt to .jsonl
// yet im still trying to find an efficient way turning paragraph into one liner
async function compileToJSONL() {
  const endOfLine = "\n";
  const rawConversationFilePath = path.join(__dirname, "conversation.txt");
  const compiledJSONPath = path.join(__dirname, "compiled.jsonl");
  
  if (existsSync(compiledJSONPath)) {
    await rm(compiledJSONPath, { force: true, recursive: true });
  };

  const rawConversationFile = await readFile(rawConversationFilePath);
  const rawConversationArray = Buffer.from(rawConversationFile, "utf-8").toString("utf-8").split(endOfLine).filter(val => val.length);
  const collectedConversationInManner = [];

  for (let index = 0; index < rawConversationArray.length; index++) {
    if (index % 2 === 0) {
      const prompt = rawConversationArray[index];
      const completion = rawConversationArray[index + 1];
      collectedConversationInManner.push({prompt, completion})
    };
  };

  const finale = collectedConversationInManner
  .map(val => JSON.stringify(val))
  .join(endOfLine);

  return await writeFile(compiledJSONPath, finale, {
    encoding: "utf-8"
  });
};

module.exports = {
  compileToJSONL
};