require("dotenv/config");

const { readFile, writeFile, rm } = require("node:fs/promises");
const { existsSync, createReadStream } = require("node:fs");
const path = require("node:path");

const { OpenAIApi, Configuration } = require("openai");

const openai = new OpenAIApi(new Configuration({
  organization: process.env.ORGANIZATION, // https://platform.openai.com/account/org-settings
  apiKey: process.env.OPENAI_KEY
}));

const compiledJSONPath = path.join(__dirname, "compiled.jsonl");
const fineTuneFileIDPath = path.join(__dirname, "fineTuneFileID");
const fineTuneAftermathFileIDPath = path.join(__dirname, "fineTuneAftermathFileID");

// 1. compile .txt to .jsonl
// yet im still trying to find an efficient way turning paragraph into one liner
async function compileToJSONL() {
  const endOfLine = "\n";
  const rawConversationFilePath = path.join(__dirname, "conversation.txt");
  
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

// 2. upload file to openai
async function uploadFileForFineTuning() {
  try {
    const response = await openai.createFile(createReadStream(compiledJSONPath), 'fine-tune');
    
    console.log(response.data);

    await writeFile(fineTuneFileIDPath, response.data.id);
  } catch (error) {
    console.error(error);
  };

  return;
};

// 3 create a fine tune model
async function createFineTuneModel() {
  try {
    const rawFileID = await readFile(fineTuneFileIDPath);
    if (!rawFileID) return;

    const fileID = Buffer.from(rawFileID, "utf-8").toString("utf-8");

    // testing, will adjust the batch size and epoch in the future
    const response = await openai.createFineTune({
      training_file: fileID,
      model: "davinci"
    });

    console.log(response);

    if (response.data.id) {
      await writeFile(fineTuneAftermathFileIDPath, response.data.id, { encoding: "utf-8" });
    };
  } catch (error) {
    console.error(error.response.data);
  };

  return;
};

module.exports = {
  compileToJSONL,
  uploadFileForFineTuning,
  createFineTuneModel
};