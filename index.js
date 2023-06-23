require("dotenv/config");

const { readFile, writeFile, rm } = require("node:fs/promises");
const { existsSync, createReadStream } = require("node:fs");
const path = require("node:path");
const { inspect } = require("node:util");

const { OpenAIApi, Configuration } = require("openai");

const openai = new OpenAIApi(new Configuration({
  organization: process.env.ORGANIZATION, // https://platform.openai.com/account/org-settings
  apiKey: process.env.OPENAI_KEY
}));

const compiledJSONPath = path.join(__dirname, "compiled.jsonl");
const fineTuneFileIDPath = path.join(__dirname, "fineTuneFileID");
const fineTuneAftermathFileIDPath = path.join(__dirname, "fineTuneAftermathFileID");
const fineTunedModelIDPath = path.join(__dirname, "fineTunedModelID");

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
      const prompt = rawConversationArray[index] + " ->";
      const completion = " " + rawConversationArray[index + 1] + "\n";

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
async function uploadFileForFineTuning(fresh) {
  try {
    if (fresh === true) {
      await openai.deleteFile(await getFileForTuningID());
    };

    const response = await openai.createFile(createReadStream(compiledJSONPath), 'fine-tune');
    
    console.log(response.data);

    await writeFile(fineTuneFileIDPath, response.data.id);
  } catch (error) {
    console.error(error);
  };

  return;
};

async function getFileForTuningID() {
  const rawFileID = await readFile(fineTuneFileIDPath);
  if (!rawFileID) return null;

  const fileID = Buffer.from(rawFileID, "utf-8").toString("utf-8");
  return fileID?.length ? fileID : null;
};

// 3. create a fine tune model
async function createFineTuneModel() {
  try {
    const fineTunedModelExist = existsSync(fineTunedModelIDPath);
    if (fineTunedModelExist) {
      await uploadFileForFineTuning(true);
    };

    const fileID = await getFileForTuningID();
    if (!fileID) return;

    // testing, will adjust the batch size and epoch in the future
    const response = await openai.createFineTune({
      training_file: fileID,
      model: fineTunedModelExist ? Buffer.from(await readFile(fineTunedModelIDPath), "utf-8").toString("utf-8") : "davinci",
      learning_rate_multiplier: 0.2,
      n_epochs: 5
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

// 4. check list fine tune
async function retrieveCurrentFineTuneModel() {
  try {
    const modelID = await getFineTuneModelID();
    if (!modelID) return;

    const fineTuneAftermath = await openai.retrieveFineTune(modelID);

    if (fineTuneAftermath?.data?.fine_tuned_model) {
      await writeFile(fineTunedModelIDPath, fineTuneAftermath.data.fine_tuned_model, { encoding: "utf-8" });
    };

    if (fineTuneAftermath?.data) {
      return console.log(inspect(fineTuneAftermath.data, { depth: null }))
    };

    console.log(fineTuneAftermath)
  } catch (error) {
    console.error(error?.response?.data);
  };

  return;
};

async function getFineTuneModelID() {
  const rawFileTuneAftermathFile = await readFile(fineTuneAftermathFileIDPath);

  const fileTuneAftermathFileID = Buffer.from(rawFileTuneAftermathFile, "utf-8").toString("utf-8");
  if (!fileTuneAftermathFileID?.length) return null;

  return fileTuneAftermathFileID || null;
};

module.exports = {
  compileToJSONL,
  uploadFileForFineTuning,
  createFineTuneModel,
  retrieveCurrentFineTuneModel
};