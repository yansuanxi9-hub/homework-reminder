require('dotenv').config();

const { DWClient, EventAck, TOPIC_ROBOT } = require('dingtalk-stream-sdk-nodejs');
const {
  callAIParser,
  createHomeworkFromAIResult,
  getMessagePreview,
  normalizeIncomingMessage,
  normalizeAIResults,
  readHomeworks,
  writeHomeworks
} = require('./server');

function getStreamConfig() {
  return {
    clientId: process.env.DINGTALK_CLIENT_ID || '',
    clientSecret: process.env.DINGTALK_CLIENT_SECRET || ''
  };
}

function parseStreamData(data) {
  if (!data) {
    return {};
  }

  if (typeof data === 'object') {
    return data;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    return { content: String(data) };
  }
}

function extractStreamMessageText(event) {
  const data = parseStreamData(event && event.data);
  const messageText = normalizeIncomingMessage(data, 'dingtalk');

  if (messageText && messageText !== JSON.stringify(data)) {
    return messageText;
  }

  if (data.text && typeof data.text.content === 'string') {
    return data.text.content;
  }

  if (typeof data.content === 'string') {
    return data.content;
  }

  return '';
}

async function handleRobotMessage(event) {
  const messageText = extractStreamMessageText(event);

  if (!messageText || !messageText.trim()) {
    console.log('DingTalk Stream message ignored: empty text');
    return;
  }

  console.log(`DingTalk Stream message: ${getMessagePreview(messageText)}`);
  const aiResults = normalizeAIResults(await callAIParser(messageText, 'dingtalk'), messageText);
  const newHomeworks = aiResults.map((item) =>
    createHomeworkFromAIResult('钉钉', messageText, item)
  );
  const homeworks = readHomeworks();

  homeworks.unshift(...newHomeworks);
  writeHomeworks(homeworks);
  console.log('DingTalk Stream message saved to homework list');
}

async function connectWithoutLeakingSdkConfig(client) {
  const originalLog = console.log;

  console.log = (...args) => {
    const text = args.map((item) => String(item)).join(' ');
    if (
      text.includes('clientSecret') ||
      text.includes('access_token') ||
      text.includes('ticket') ||
      text.includes('res.data')
    ) {
      return;
    }

    originalLog(...args);
  };

  try {
    await client.connect();
  } finally {
    console.log = originalLog;
  }
}

async function startDingtalkStream() {
  const { clientId, clientSecret } = getStreamConfig();

  if (!clientId || !clientSecret) {
    console.error('DingTalk Stream config missing: DINGTALK_CLIENT_ID and DINGTALK_CLIENT_SECRET are required.');
    process.exit(1);
  }

  const client = new DWClient({
    clientId,
    clientSecret
  });

  client.registerCallbackListener(TOPIC_ROBOT, (event) => {
    handleRobotMessage(event).catch((error) => {
      console.error(`DingTalk Stream message failed: ${error.message}`);
    });

    return {
      status: EventAck.SUCCESS,
      message: 'OK'
    };
  });

  await connectWithoutLeakingSdkConfig(client);
  console.log('DingTalk Stream client started.');
}

if (require.main === module) {
  startDingtalkStream().catch((error) => {
    console.error(`DingTalk Stream client failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  extractStreamMessageText,
  startDingtalkStream
};
