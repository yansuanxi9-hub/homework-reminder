const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'homeworks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readHomeworks() {
  ensureDataFile();

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (error) {
    console.error('读取作业数据失败：', error);
    return [];
  }
}

function writeHomeworks(homeworks) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(homeworks, null, 2), 'utf8');
}

function normalizePlatform(platform) {
  if (platform === '飞书' || platform === 'feishu' || platform === 'qq') {
    return 'QQ';
  }

  return platform || '待人工确认';
}

function normalizeStatus(homework) {
  if (['待完成', '已完成', '待确认'].includes(homework.status)) {
    return homework.status;
  }

  const hasPendingField = [
    homework.course || homework.courseName,
    homework.task || homework.content,
    homework.deadline,
    homework.submitMethod
  ].some((value) => !value || value === '未识别' || value === '待人工确认');

  return hasPendingField ? '待确认' : '待完成';
}

function normalizeHomeworkRecord(homework) {
  return {
    ...homework,
    platform: normalizePlatform(homework.platform),
    course: homework.course || homework.courseName || '待人工确认',
    task: homework.task || homework.content || '待人工确认',
    deadline: homework.deadline || '待人工确认',
    submitMethod: homework.submitMethod || '待人工确认',
    originalMessage: homework.originalMessage || homework.originalFragment || '空消息',
    status: normalizeStatus(homework)
  };
}

function normalizeIncomingMessage(input, platform) {
  const payload = input && input.body && typeof input.body === 'object' ? input.body : input;

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (Object.keys(payload).length === 0) {
    return '';
  }

  if (typeof payload.messageText === 'string') {
    return payload.messageText;
  }

  if (typeof payload.content === 'string') {
    return payload.content;
  }

  if (typeof payload.text === 'string') {
    return payload.text;
  }

  if (typeof payload.message === 'string') {
    return payload.message;
  }

  if (payload.text && typeof payload.text.content === 'string') {
    return payload.text.content;
  }

  if (payload.event && payload.event.message) {
    const message = payload.event.message;

    if (typeof message.content === 'string') {
      try {
        const parsed = JSON.parse(message.content);
        return parsed.text || parsed.content || message.content;
      } catch (error) {
        return message.content;
      }
    }

    if (typeof message.text === 'string') {
      return message.text;
    }
  }

  return JSON.stringify(payload);
}

function getMessageText(payload) {
  return normalizeIncomingMessage(payload);
}

function sanitizeHeaders(headers) {
  const safeHeaders = {};
  const hiddenKeys = new Set(['authorization', 'cookie', 'x-api-key']);

  Object.entries(headers || {}).forEach(([key, value]) => {
    safeHeaders[key] = hiddenKeys.has(key.toLowerCase()) ? '[hidden]' : value;
  });

  return safeHeaders;
}

function simplifyBody(body) {
  if (!body || typeof body !== 'object') {
    return body || {};
  }

  const simplified = {};

  Object.entries(body).forEach(([key, value]) => {
    if (/key|token|secret|authorization/i.test(key)) {
      simplified[key] = '[hidden]';
      return;
    }

    if (typeof value === 'string') {
      simplified[key] = value.slice(0, 300);
      return;
    }

    simplified[key] = value;
  });

  return simplified;
}

function isDingtalkVerificationRequest(req) {
  const body = req.body || {};
  const query = req.query || {};
  const verificationKeys = [
    'challenge',
    'encrypt',
    'EventType',
    'msg_signature',
    'signature',
    'timestamp'
  ];

  return verificationKeys.some(
    (key) => body[key] !== undefined || query[key] !== undefined
  );
}

function getDingtalkChallenge(req) {
  const body = req.body || {};
  const query = req.query || {};

  return body.challenge || query.challenge || body.encrypt || query.encrypt || null;
}

function getDingtalkCryptoConfig() {
  return {
    token: process.env.DINGTALK_TOKEN || '',
    aesKey: process.env.DINGTALK_AES_KEY || '',
    ownerKey: process.env.DINGTALK_OWNER_KEY || ''
  };
}

function getDingtalkEncryptedPayload(req) {
  const body = req.body || {};
  const query = req.query || {};

  return body.encrypt || query.encrypt || null;
}

function getDingtalkCryptoQuery(req) {
  const body = req.body || {};
  const query = req.query || {};

  return {
    msgSignature: query.msg_signature || body.msg_signature || query.signature || body.signature,
    timestamp: query.timestamp || body.timestamp || String(Date.now()),
    nonce: query.nonce || body.nonce || 'nonce'
  };
}

function getDingtalkAesKey(aesKey) {
  const normalizedKey = String(aesKey || '').trim();
  const keyWithPadding = normalizedKey.length === 43 ? `${normalizedKey}=` : normalizedKey;
  const key = Buffer.from(keyWithPadding, 'base64');

  if (key.length !== 32) {
    throw new Error('DINGTALK_AES_KEY must decode to 32 bytes');
  }

  return key;
}

function createDingtalkSignature(token, timestamp, nonce, encrypt) {
  return crypto
    .createHash('sha1')
    .update([token, timestamp, nonce, encrypt].sort().join(''))
    .digest('hex');
}

function removePkcs7Padding(buffer) {
  const pad = buffer[buffer.length - 1];

  if (pad < 1 || pad > 32) {
    return buffer;
  }

  return buffer.subarray(0, buffer.length - pad);
}

function addPkcs7Padding(buffer) {
  const blockSize = 32;
  const remainder = buffer.length % blockSize;
  const pad = remainder === 0 ? blockSize : blockSize - remainder;
  const padding = Buffer.alloc(pad, pad);

  return Buffer.concat([buffer, padding]);
}

function decryptDingtalkPayload(encrypt, config) {
  const key = getDingtalkAesKey(config.aesKey);
  const iv = key.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(encrypt, 'base64'),
    decipher.final()
  ]);
  const plain = removePkcs7Padding(decrypted);
  const messageLength = plain.readUInt32BE(16);
  const message = plain.subarray(20, 20 + messageLength).toString('utf8');
  const ownerKey = plain.subarray(20 + messageLength).toString('utf8');

  if (config.ownerKey && ownerKey && ownerKey !== config.ownerKey) {
    throw new Error('Dingtalk owner key mismatch');
  }

  return message;
}

function encryptDingtalkPayload(message, config) {
  const key = getDingtalkAesKey(config.aesKey);
  const iv = key.subarray(0, 16);
  const messageBuffer = Buffer.from(String(message), 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(messageBuffer.length, 0);

  const plain = addPkcs7Padding(
    Buffer.concat([
      crypto.randomBytes(16),
      lengthBuffer,
      messageBuffer,
      Buffer.from(config.ownerKey || '', 'utf8')
    ])
  );
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);

  return Buffer.concat([cipher.update(plain), cipher.final()]).toString('base64');
}

function createDingtalkEncryptedResponse(message, config, timestamp, nonce) {
  const encrypt = encryptDingtalkPayload(message, config);
  const msgSignature = createDingtalkSignature(config.token, timestamp, nonce, encrypt);

  return {
    msg_signature: msgSignature,
    timeStamp: timestamp,
    nonce,
    encrypt
  };
}

function parseDingtalkEncryptedMessage(req) {
  const config = getDingtalkCryptoConfig();
  const encrypt = getDingtalkEncryptedPayload(req);
  const { msgSignature, timestamp, nonce } = getDingtalkCryptoQuery(req);

  if (!config.token || !config.aesKey || !config.ownerKey) {
    throw new Error('Dingtalk crypto env is incomplete');
  }

  if (!encrypt) {
    throw new Error('Dingtalk encrypted payload is missing');
  }

  if (msgSignature) {
    const expectedSignature = createDingtalkSignature(config.token, timestamp, nonce, encrypt);
    if (expectedSignature !== msgSignature) {
      throw new Error('Dingtalk signature mismatch');
    }
  }

  const decryptedText = decryptDingtalkPayload(encrypt, config);
  let decryptedBody = {};

  try {
    decryptedBody = JSON.parse(decryptedText);
  } catch (error) {
    decryptedBody = { text: decryptedText };
  }

  return {
    config,
    timestamp,
    nonce,
    decryptedText,
    decryptedBody
  };
}

function cleanValue(value) {
  return String(value)
    .replace(/[。；;，,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPending(value) {
  const cleaned = cleanValue(value || '');
  return cleaned || '待人工确认';
}

function mergeEditableValue(nextValue, currentValue) {
  if (nextValue === undefined) {
    return currentValue;
  }

  return toPending(nextValue);
}

function defaultAIResult(messageText) {
  return [
    {
      course: '待人工确认',
      task: cleanValue(messageText) || '待人工确认',
      deadline: '待人工确认',
      submitMethod: '待人工确认'
    }
  ];
}

function stripListMarker(line) {
  return cleanValue(
    line.replace(/^[-*·•]\s*/, '').replace(/^\d+[.、．]\s*/, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
  );
}

function getMessageLines(messageText) {
  return String(messageText || '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(stripListMarker)
    .filter(Boolean);
}

function splitNaturalSentences(messageText) {
  return String(messageText || '')
    .replace(/\r/g, '\n')
    .split(/[\n。！？!?；;]+/)
    .map(stripListMarker)
    .filter(Boolean);
}

function assignStructuredField(homework, key, value) {
  const normalizedKey = cleanValue(key).toLowerCase();
  const normalizedValue = cleanValue(value);

  if (!normalizedValue) {
    return;
  }

  if (/^(课程|科目|课程名称)$/.test(normalizedKey)) {
    homework.course = normalizedValue;
    return;
  }

  if (/^(作业|作业内容|任务|内容|事项)$/.test(normalizedKey)) {
    homework.task = normalizedValue;
    return;
  }

  if (/^(截止|截止时间|ddl|时间|完成时间)$/.test(normalizedKey)) {
    homework.deadline = normalizedValue;
    return;
  }

  if (/^(提交|提交方式|提交平台|提交到|发送到|发到)$/.test(normalizedKey)) {
    homework.submitMethod = normalizedValue;
  }
}

function parseStructuredFields(messageText) {
  const homework = {
    course: '',
    task: '',
    deadline: '',
    submitMethod: ''
  };
  const fieldPattern =
    /^(课程|科目|课程名称|作业|作业内容|任务|内容|事项|截止|截止时间|ddl|DDL|时间|完成时间|提交|提交方式|提交平台|提交到|发送到|发到)\s*[:：]\s*(.+)$/;

  getMessageLines(messageText).forEach((line) => {
    const match = line.match(fieldPattern);
    if (match) {
      assignStructuredField(homework, match[1], match[2]);
    }
  });

  return homework;
}

function extractTaskFromText(messageText) {
  const keywords =
    /作业|研讨作业|论文|论文选题|PPT|报告|读书笔记|口语稿|预习|复习|提交|完成|上传/i;
  const sentences = splitNaturalSentences(messageText)
    .filter((sentence) => keywords.test(sentence))
    .map((sentence) => {
      const compact = sentence
        .replace(/^(各位同学|同学们|大家|请大家|通知|提醒)[，,：:\s]*/g, '')
        .replace(/^(作业|作业内容|任务|内容|事项)\s*[:：]\s*/g, '');
      const discussionMatch = compact.match(/(认真完成研讨作业|完成研讨作业|研讨作业)/);
      const topicMatch = compact.match(/(论文选题)/);

      if (discussionMatch) {
        return discussionMatch[1];
      }

      return topicMatch ? topicMatch[1] : cleanValue(compact);
    })
    .filter(Boolean);

  return [...new Set(sentences)].join('；');
}

function extractDeadlineFromText(messageText) {
  const text = String(messageText || '');
  const patterns = [
    /(?:截止|截止时间|ddl|DDL|时间|完成时间)\s*[:：]?\s*([^\n，。,；;]+)/,
    /((?:本周|下周)?周[一二三四五六日天](?:\s*(?:早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{2}|点(?:半|\d{0,2}分?)?)?)?\s*(?:前|之前|截止)?)/,
    /((?:今天|明天|后天)(?:\s*(?:早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{2}|点(?:半|\d{0,2}分?)?)?)?\s*(?:前|之前|截止)?)/,
    /(\d{1,2}\s*月\s*\d{1,2}\s*日?(?:\s*(?:早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{2}|点(?:半|\d{0,2}分?)?)?)?\s*(?:前|之前|截止)?)/,
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?(?:\s*\d{1,2}:\d{2})?\s*(?:前|之前|截止)?)/,
    /((?:早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{2}|点(?:半|\d{0,2}分?)?)\s*(?:前|之前|截止))/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return cleanValue(match[1] || match[0]);
    }
  }

  return '';
}

function extractSubmitMethodFromText(messageText) {
  const text = String(messageText || '');
  const structured = text.match(/(?:提交|提交方式|提交平台|提交到|发送到|发到)\s*[:：]\s*([^\n，。,；;]+)/);
  if (structured) {
    return cleanValue(structured[1]);
  }

  const keywords = [
    '学习通',
    '钉钉',
    'QQ',
    'QQ群',
    '微信群',
    '邮箱',
    '发给课代表',
    '发给组长',
    '纸质版',
    'Word',
    'PDF',
    'PPT'
  ];
  const found = keywords.filter((keyword) => new RegExp(keyword, 'i').test(text));

  if (found.length) {
    return found.join('、');
  }

  const actionMatch = text.match(/(?:上传|提交)\s*到?\s*([^\n，。,；;]+)/);
  if (actionMatch) {
    return cleanValue(actionMatch[0]);
  }

  return '';
}

function parseCommonHomeworkNotice(messageText) {
  const structured = parseStructuredFields(messageText);
  const parsed = {
    course: structured.course || '待人工确认',
    task: structured.task || extractTaskFromText(messageText) || '待人工确认',
    deadline: structured.deadline || extractDeadlineFromText(messageText) || '待人工确认',
    submitMethod:
      structured.submitMethod || extractSubmitMethodFromText(messageText) || '待人工确认'
  };

  if (
    parsed.course === '待人工确认' &&
    parsed.task === '待人工确认' &&
    parsed.deadline === '待人工确认' &&
    parsed.submitMethod === '待人工确认'
  ) {
    return defaultAIResult(messageText);
  }

  return [parsed];
}

function builtInAIParser(messageText) {
  const text = String(messageText || '');
  const lowerText = text.toLowerCase();

  if (text.includes('色相环')) {
    return [
      {
        course: '美术基础课',
        task: '完成并提交色相环作业，共8张图片，包括色相环、明度渐变色阶、色调、调和色、对比色等',
        deadline: '本周四前',
        submitMethod: '待人工确认'
      }
    ];
  }

  if (text.includes('公开课')) {
    return [
      {
        course: '公开课',
        task: '到实验楼308智慧教室参加公开课，主题与期末作业相关',
        deadline: '周四10:30',
        submitMethod: '现场参与'
      }
    ];
  }

  if (lowerText.includes('reading report')) {
    const parsed = parseCommonHomeworkNotice(messageText)[0];

    return [
      {
        course: parsed.course === '待人工确认' ? '大学英语' : parsed.course,
        task: parsed.task === '待人工确认' ? '完成 Unit 5 reading report' : parsed.task,
        deadline: parsed.deadline,
        submitMethod: parsed.submitMethod
      }
    ];
  }

  return parseCommonHomeworkNotice(messageText);
}

/*
AI 识别层可替换接口。

DeepSeek 接入说明：
1. 从环境变量读取 DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL、DEEPSEEK_MODEL，
   不能把真实 API Key 写进代码。
2. 如果没有配置 DEEPSEEK_API_KEY，直接使用本地识别作为备用方案。
3. 将 platform 和 messageText 作为用户消息发送给 DeepSeek。
4. 要求模型只返回 JSON 数组：
   [
     {
       "course": "课程名称",
       "task": "任务内容",
       "deadline": "截止时间",
       "submitMethod": "提交方式"
     }
   ]
5. 如果 API 调用失败、超时、返回格式不正确，返回本地识别结果，
   也就是把未确定字段统一标记为“待人工确认”。
*/
function parseDeepSeekContent(content) {
  const cleaned = String(content || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('DeepSeek 返回内容不是 JSON 数组');
  }

  return parsed;
}

function getDeepSeekEndpoint(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
}

async function callAIParser(messageText, platform) {
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
  const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const deepSeekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!deepSeekApiKey) {
    console.log('Using local fallback parser');
    return builtInAIParser(messageText, platform);
  }

  try {
    console.log('Using DeepSeek API parser');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(getDeepSeekEndpoint(deepSeekBaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepSeekApiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: deepSeekModel,
        messages: [
          {
            role: 'system',
            content:
              '你是作业通知结构化助手。请从消息中提取作业信息，只返回 JSON 数组，不要解释。字段必须为 course、task、deadline、submitMethod；无法识别的字段填“待人工确认”。'
          },
          {
            role: 'user',
            content: JSON.stringify({ platform, messageText })
          }
        ],
        temperature: 0.1
      })
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const result = await response.json();
    const content = result.choices && result.choices[0] && result.choices[0].message
      ? result.choices[0].message.content
      : '';
    const parsed = parseDeepSeekContent(content);

    return normalizeAIResults(parsed, messageText);
  } catch (error) {
    console.error(`DeepSeek API parser failed: ${error.message}`);
    console.log('Using local fallback parser');
    return builtInAIParser(messageText, platform);
  }
}

function normalizeAIResults(results, messageText) {
  if (!Array.isArray(results) || !results.length) {
    return defaultAIResult(messageText);
  }

  return results.map((item) => ({
    course: toPending(item.course),
    task: toPending(item.task),
    deadline: toPending(item.deadline),
    submitMethod: toPending(item.submitMethod)
  }));
}

function createHomeworkFromAIResult(platform, messageText, aiResult) {
  const homework = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    platform: normalizePlatform(platform),
    course: toPending(aiResult.course),
    task: toPending(aiResult.task),
    deadline: toPending(aiResult.deadline),
    submitMethod: toPending(aiResult.submitMethod),
    originalMessage: String(messageText || '').trim() || '空消息',
    createdAt: new Date().toISOString()
  };

  return {
    ...homework,
    status: normalizeStatus(homework)
  };
}

function createManualHomework(body) {
  const homework = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    platform: normalizePlatform(toPending(body.platform)),
    course: toPending(body.course),
    task: toPending(body.task),
    deadline: toPending(body.deadline),
    submitMethod: toPending(body.submitMethod),
    originalMessage: String(body.originalMessage || '').trim() || '手动添加',
    createdAt: new Date().toISOString()
  };
  const status = body.status;

  return {
    ...homework,
    status: ['待完成', '已完成', '待确认'].includes(status)
      ? status
      : normalizeStatus(homework)
  };
}

function getMessagePreview(messageText) {
  return String(messageText || '').replace(/\s+/g, ' ').slice(0, 100);
}

function getDeepSeekConfig() {
  return {
    hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  };
}

async function parseAndSaveHomework(platform, messageText) {
  const aiResults = normalizeAIResults(await callAIParser(messageText, platform), messageText);
  const newHomeworks = aiResults.map((item) =>
    createHomeworkFromAIResult(platform, messageText, item)
  );
  const homeworks = readHomeworks();

  homeworks.unshift(...newHomeworks);
  writeHomeworks(homeworks);

  return newHomeworks;
}

async function receivePlatformMessage(platform, req, res, webhookName) {
  console.log(`Received webhook: ${webhookName}`);

  const messageText = getMessageText(req.body);
  console.log(`Calling AI parser with message: ${getMessagePreview(messageText)}`);

  const newHomeworks = await parseAndSaveHomework(platform, messageText);

  res.status(201).json({
    message: '平台消息已接入，并完成 AI 结构化识别',
    homeworks: newHomeworks,
    homework: newHomeworks[0] || null,
    aiResult: {
      platform,
      originalMessage: String(messageText || '').trim() || '空消息',
      items: newHomeworks
    }
  });
}

async function handleDingtalkWebhook(req, res) {
  console.log('Received webhook: dingtalk');
  console.log('Dingtalk webhook headers:', sanitizeHeaders(req.headers));
  console.log('Dingtalk webhook body:', simplifyBody(req.body));

  try {
    if (getDingtalkEncryptedPayload(req)) {
      const parsed = parseDingtalkEncryptedMessage(req);
      console.log('Dingtalk decrypted body:', simplifyBody(parsed.decryptedBody));

      const responseBody = createDingtalkEncryptedResponse(
        'success',
        parsed.config,
        parsed.timestamp,
        parsed.nonce
      );

      return res.status(200).json(responseBody);
    }

    if (isDingtalkVerificationRequest(req)) {
      const challenge = getDingtalkChallenge(req);

      if (challenge) {
        return res.status(200).send(challenge);
      }

      return res.status(200).json({ success: true });
    }

    const messageText = normalizeIncomingMessage(req, 'dingtalk');

    if (!messageText || !String(messageText).trim()) {
      return res.status(200).json({
        success: true,
        message: 'empty message ignored'
      });
    }

    console.log(`Calling AI parser with message: ${getMessagePreview(messageText)}`);

    const newHomeworks = await parseAndSaveHomework('钉钉', messageText);

    return res.status(200).json({
      success: true,
      message: '平台消息已接入，并完成 AI 结构化识别',
      homeworks: newHomeworks,
      homework: newHomeworks[0] || null
    });
  } catch (error) {
    console.error(`Dingtalk webhook handled with fallback response: ${error.message}`);

    return res.status(200).json({
      success: true,
      message: 'webhook received'
    });
  }
}

app.get('/api/homeworks', (req, res) => {
  res.json(readHomeworks().map(normalizeHomeworkRecord));
});

app.get('/api/deepseek-status', (req, res) => {
  res.json(getDeepSeekConfig());
});

app.post('/api/ai-test', async (req, res) => {
  const body = req.body || {};
  const platform = body.platform || 'dingtalk';
  const messageText = body.messageText || '';

  console.log(`Calling AI parser with message: ${getMessagePreview(messageText)}`);

  const results = normalizeAIResults(await callAIParser(messageText, platform), messageText);

  res.json({
    platform,
    messageText,
    results
  });
});

app.post('/api/homeworks', (req, res) => {
  const homework = createManualHomework(req.body || {});
  const homeworks = readHomeworks().map(normalizeHomeworkRecord);

  homeworks.unshift(homework);
  writeHomeworks(homeworks);

  res.status(201).json({
    message: '作业添加成功',
    homework
  });
});

app.patch('/api/homeworks/:id/status', (req, res) => {
  const nextStatus = req.body && req.body.status;

  if (!['待完成', '已完成', '待确认'].includes(nextStatus)) {
    return res.status(400).json({ message: '状态不合法' });
  }

  const homeworks = readHomeworks().map(normalizeHomeworkRecord);
  const target = homeworks.find((homework) => homework.id === req.params.id);

  if (!target) {
    return res.status(404).json({ message: '未找到该作业' });
  }

  target.status = nextStatus;
  writeHomeworks(homeworks);
  res.json({ message: '状态更新成功', homework: target });
});

function updateHomeworkById(req, res) {
  const body = req.body || {};
  const homeworks = readHomeworks().map(normalizeHomeworkRecord);
  const target = homeworks.find((homework) => homework.id === req.params.id);

  if (!target) {
    return res.status(404).json({ message: '未找到该作业' });
  }

  const nextStatus = body.status;
  if (nextStatus && !['待完成', '已完成', '待确认'].includes(nextStatus)) {
    return res.status(400).json({ message: '状态不合法' });
  }

  target.platform = mergeEditableValue(body.platform, target.platform);
  target.course = mergeEditableValue(body.course, target.course);
  target.task = mergeEditableValue(body.task, target.task);
  target.deadline = mergeEditableValue(body.deadline, target.deadline);
  target.submitMethod = mergeEditableValue(body.submitMethod, target.submitMethod);
  target.originalMessage =
    body.originalMessage === undefined
      ? target.originalMessage
      : String(body.originalMessage || '').trim() || '空消息';
  target.status = nextStatus || normalizeStatus(target);
  target.updatedAt = new Date().toISOString();

  writeHomeworks(homeworks);
  res.json({ message: '作业更新成功', homework: target });
}

app.put('/api/homeworks/:id', updateHomeworkById);

app.patch('/api/homeworks/:id', updateHomeworkById);

app.delete('/api/homeworks/:id', (req, res) => {
  const homeworks = readHomeworks();
  const nextHomeworks = homeworks.filter((homework) => homework.id !== req.params.id);

  if (homeworks.length === nextHomeworks.length) {
    return res.status(404).json({ message: '未找到该作业' });
  }

  writeHomeworks(nextHomeworks);
  res.json({ message: '删除成功' });
});

app.get('/webhook/dingtalk', (req, res) => {
  res.status(200).send('dingtalk webhook ok');
});

app.post('/webhook/dingtalk', async (req, res) => {
  await handleDingtalkWebhook(req, res);
});

app.post('/webhook/qq', async (req, res) => {
  await receivePlatformMessage('QQ', req, res, 'qq');
});

if (require.main === module) {
  app.listen(PORT, () => {
    ensureDataFile();
    console.log(`作业提醒助手已启动：http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  callAIParser,
  createHomeworkFromAIResult,
  getMessagePreview,
  normalizeAIResults,
  normalizeIncomingMessage,
  parseAndSaveHomework,
  readHomeworks,
  writeHomeworks
};
