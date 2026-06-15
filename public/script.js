const homeworkList = document.querySelector('#homeworkList');
const emptyState = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');
const refreshBtn = document.querySelector('#refreshBtn');
const forms = document.querySelectorAll('.message-box');
const platformFilter = document.querySelector('#platformFilter');
const statusFilter = document.querySelector('#statusFilter');
const totalCount = document.querySelector('#totalCount');
const todoCount = document.querySelector('#todoCount');
const doneCount = document.querySelector('#doneCount');
const confirmCount = document.querySelector('#confirmCount');
const planningList = document.querySelector('#planningList');
const reminderBanner = document.querySelector('#reminderBanner');
const reminderToggle = document.querySelector('#reminderToggle');
const editModal = document.querySelector('#editModal');
const editForm = document.querySelector('#editForm');
const closeEditBtn = document.querySelector('#closeEditBtn');
const cancelEditBtn = document.querySelector('#cancelEditBtn');
const editId = document.querySelector('#editId');
const editPlatform = document.querySelector('#editPlatform');
const editStatus = document.querySelector('#editStatus');
const editCourse = document.querySelector('#editCourse');
const editTask = document.querySelector('#editTask');
const editDeadline = document.querySelector('#editDeadline');
const editSubmitMethod = document.querySelector('#editSubmitMethod');
const editOriginalMessage = document.querySelector('#editOriginalMessage');
const manualForm = document.querySelector('#manualForm');
const manualPlatform = document.querySelector('#manualPlatform');
const manualStatus = document.querySelector('#manualStatus');
const manualCourse = document.querySelector('#manualCourse');
const manualTask = document.querySelector('#manualTask');
const manualDeadline = document.querySelector('#manualDeadline');
const manualSubmitMethod = document.querySelector('#manualSubmitMethod');
const manualOriginalMessage = document.querySelector('#manualOriginalMessage');
const manualAiText = document.querySelector('#manualAiText');
const manualAiFillBtn = document.querySelector('#manualAiFillBtn');

const REMINDER_ENABLED_KEY = 'homeworkReminderEnabled';
const REMINDER_SEEN_KEY_PREFIX = 'homeworkReminderSeen';
const DAY_MS = 24 * 60 * 60 * 1000;

// 后续如需手机或系统级提醒，可基于 Notification API、Service Worker 和 Push API 扩展。
let allHomeworks = [];

function formatDate(value) {
  if (!value) {
    return '未知时间';
  }

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.style.display = 'block';

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.style.display = 'none';
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toProductValue(value) {
  if (!value || value === '未识别') {
    return '待人工确认';
  }

  return value;
}

function normalizePlatform(value) {
  if (value === '飞书' || value === 'feishu' || value === 'qq') {
    return 'QQ';
  }

  return toProductValue(value);
}

function normalizeHomework(homework) {
  const normalized = {
    id: homework.id,
    platform: normalizePlatform(homework.platform),
    course: toProductValue(homework.course || homework.courseName),
    task: toProductValue(homework.task || homework.content),
    deadline: toProductValue(homework.deadline),
    deadlineAt: homework.deadlineAt || null,
    submitMethod: toProductValue(homework.submitMethod),
    originalMessage: toProductValue(homework.originalMessage || homework.originalFragment),
    status: homework.status || '待完成',
    createdAt: homework.createdAt
  };

  if (!['待完成', '已完成', '待确认'].includes(normalized.status)) {
    normalized.status = '待完成';
  }

  return normalized;
}

async function loadHomeworks() {
  const response = await fetch('/api/homeworks');
  const homeworks = await response.json();

  allHomeworks = homeworks.map(normalizeHomework).map(enrichHomework).sort(compareHomeworks);
  renderStats(allHomeworks);
  renderPlanning(allHomeworks);
  updateReminderBanner(allHomeworks);
  renderHomeworks();
}

function renderStats(homeworks) {
  totalCount.textContent = homeworks.length;
  todoCount.textContent = homeworks.filter((item) => item.status === '待完成').length;
  doneCount.textContent = homeworks.filter((item) => item.status === '已完成').length;
  confirmCount.textContent = homeworks.filter((item) => item.status === '待确认').length;
}

function getFilteredHomeworks() {
  return allHomeworks.filter((homework) => {
    const platformMatched =
      platformFilter.value === '全部' || homework.platform === platformFilter.value;
    const statusMatched = statusFilter.value === '全部' || homework.status === statusFilter.value;

    return platformMatched && statusMatched;
  });
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function chineseNumberToInt(value) {
  if (!value) return NaN;
  const normalized = String(value).replace(/两/g, '二');
  const direct = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized === '十') return 10;
  if (normalized.includes('十')) {
    const [tens, ones] = normalized.split('十');
    return (direct[tens] || 1) * 10 + (direct[ones] || 0);
  }

  return direct[normalized];
}

function normalizeDeadlineText(text) {
  return String(text || '')
    .replace(/[，。；;]/g, ' ')
    .replace(/提交前|之前|截止|截至|前/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimeParts(text) {
  const source = String(text || '');
  const colonMatch = source.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  let hour;
  let minute = 0;

  if (colonMatch) {
    hour = Number(colonMatch[1]);
    minute = Number(colonMatch[2]);
  } else {
    const pointMatch = source.match(/([零一二三四五六七八九十两\d]{1,3})\s*点(?:\s*([零一二三四五六七八九十两\d]{1,3})\s*分?)?/);
    if (pointMatch) {
      hour = chineseNumberToInt(pointMatch[1]);
      minute = pointMatch[2] ? chineseNumberToInt(pointMatch[2]) : 0;
    }
  }

  if (Number.isNaN(hour) || hour === undefined) {
    return { hour: 23, minute: 59, explicit: false };
  }

  if (/(下午|晚上|傍晚)/.test(source) && hour < 12) {
    hour += 12;
  }

  if (/中午/.test(source) && hour < 11) {
    hour += 12;
  }

  if (hour > 23 || minute > 59) {
    return { hour: 23, minute: 59, explicit: false };
  }

  return { hour, minute, explicit: true };
}

function buildDeadlineDate(baseDate, text) {
  const { hour, minute } = parseTimeParts(text);
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function parseWeekdayDate(text, now) {
  const source = String(text || '');
  const match = source.match(/(本周|这周|下周|下星期)?\s*(?:星期|周)?\s*([一二三四五六日天])/);
  if (!match) return null;

  const weekdayMap = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7
  };
  const targetWeekday = weekdayMap[match[2]];
  if (!targetWeekday) return null;

  const currentWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const monday = addDays(startOfDay(now), 1 - currentWeekday);
  let offset = targetWeekday - 1;
  const prefix = match[1] || '';

  if (prefix === '下周' || prefix === '下星期') {
    offset += 7;
  }

  let targetDate = addDays(monday, offset);

  if (!prefix && targetDate < startOfDay(now)) {
    targetDate = addDays(targetDate, 7);
  }

  return targetDate;
}

function parseDeadline(deadline, now = new Date()) {
  const text = String(deadline || '').trim();

  if (!text || text === '待人工确认' || text === '未识别') {
    return null;
  }

  const normalized = normalizeDeadlineText(text);
  const isoMatch = normalized.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (isoMatch) {
    return buildDeadlineDate(new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])), normalized);
  }

  const slashMatch = normalized.match(/(^|[^\d])(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (slashMatch) {
    return buildDeadlineDate(new Date(now.getFullYear(), Number(slashMatch[2]) - 1, Number(slashMatch[3])), normalized);
  }

  const monthMatch = normalized.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (monthMatch) {
    return buildDeadlineDate(new Date(now.getFullYear(), Number(monthMatch[1]) - 1, Number(monthMatch[2])), normalized);
  }

  if (/今天/.test(normalized)) {
    return buildDeadlineDate(startOfDay(now), normalized);
  }

  if (/明天/.test(normalized)) {
    return buildDeadlineDate(addDays(startOfDay(now), 1), normalized);
  }

  if (/后天/.test(normalized)) {
    return buildDeadlineDate(addDays(startOfDay(now), 2), normalized);
  }

  const weekdayDate = parseWeekdayDate(normalized, now);
  if (weekdayDate) {
    return buildDeadlineDate(weekdayDate, normalized);
  }

  if (parseTimeParts(normalized).explicit) {
    return buildDeadlineDate(startOfDay(now), normalized);
  }

  return null;
}

function inferTaskComplexity(homework) {
  const text = `${homework.course} ${homework.task} ${homework.originalMessage}`;
  const complexPattern = /论文|PPT|汇报|展示|演讲|调研|查资料|项目|网站|视频剪辑|小组作业|策划书|计划书|作品集/i;
  const artComplexPattern = /作品|绘画|色相环|明度|色阶|色调|调和色|对比色|图片|8张|八张|作品集/i;
  const quantityPattern = /[三四五六七八九十\d]+\s*张|若干张|共计/i;
  const mediumPattern = /练习题|翻译|阅读报告|reading report|实验报告|手写|整理笔记|案例分析|小组讨论|报告/i;
  const mediumToComplexPattern = /小组|查资料|展示|PPT/i;
  const simplePattern = /背诵|预习|阅读|完成练习|拍照|提交截图|填表|签到|观看视频/i;

  if (
    complexPattern.test(text) ||
    artComplexPattern.test(text) ||
    quantityPattern.test(text) ||
    (mediumPattern.test(text) && mediumToComplexPattern.test(text))
  ) {
    return {
      complexity: 'complex',
      complexityLabel: '复杂',
      reminderLeadDays: 4
    };
  }

  if (mediumPattern.test(text)) {
    return {
      complexity: 'medium',
      complexityLabel: '中等',
      reminderLeadDays: 2
    };
  }

  if (simplePattern.test(text)) {
    return {
      complexity: 'simple',
      complexityLabel: '简单',
      reminderLeadDays: 1
    };
  }

  return {
    complexity: 'medium',
    complexityLabel: '中等',
    reminderLeadDays: 2
  };
}

function getUrgency(homework, now = new Date()) {
  if (homework.status === '已完成') {
    return {
      urgency: 'done',
      urgencyLabel: ''
    };
  }

  if (!homework.deadlineAt) {
    return {
      urgency: 'unknown',
      urgencyLabel: '待确认时间',
      priority: 5,
      advice: '截止时间不明确，建议手动确认。'
    };
  }

  const deadline = new Date(homework.deadlineAt);
  const diff = deadline.getTime() - now.getTime();

  if (diff < 0) {
    return {
      urgency: 'overdue',
      urgencyLabel: '已逾期',
      priority: 100,
      advice: '这项作业已经超过截止时间，请优先处理。'
    };
  }

  if (isSameDay(deadline, now)) {
    return {
      urgency: 'today',
      urgencyLabel: '今天截止',
      priority: 90,
      advice: '今天需要完成，建议现在安排时间处理。'
    };
  }

  if (isSameDay(deadline, addDays(now, 1))) {
    return {
      urgency: 'tomorrow',
      urgencyLabel: '明天截止',
      priority: 80,
      advice: '明天截止，建议今天先完成主要部分。'
    };
  }

  if (diff <= homework.reminderLeadDays * DAY_MS) {
    const scoreMap = {
      complex: 70,
      medium: 60,
      simple: 50
    };

    return {
      urgency: 'soon',
      urgencyLabel: '建议开始',
      priority: scoreMap[homework.complexity] || 60,
      advice: getPlanningAdvice(homework, 'soon')
    };
  }

  return {
    urgency: 'normal',
    urgencyLabel: '按计划',
    priority: 30,
    advice: getPlanningAdvice(homework, 'normal')
  };
}

function isArtComplexHomework(homework) {
  const text = `${homework.course} ${homework.task} ${homework.originalMessage}`;
  return /作品|绘画|色相环|明度|色阶|色调|调和色|对比色|图片|8张|八张|作品集/i.test(text);
}

function getPlanningAdvice(homework, urgency) {
  if (urgency === 'soon' && homework.complexity === 'complex') {
    return isArtComplexHomework(homework)
      ? '这项作业包含多项作品提交，建议提前开始准备。'
      : '这项任务内容较多，建议提前开始安排时间。';
  }

  if (homework.status === '待确认' && homework.deadlineAt) {
    return '这项任务仍需确认部分信息，但已进入规划范围。';
  }

  if (urgency === 'soon') {
    return '这项任务已进入提醒期，建议预留时间完成。';
  }

  return '按当前节奏推进即可。';
}

function enrichHomework(homework) {
  const deadlineDate = homework.deadlineAt ? new Date(homework.deadlineAt) : parseDeadline(homework.deadline);
  const hasValidDeadline = deadlineDate && !Number.isNaN(deadlineDate.getTime());
  const complexity = inferTaskComplexity(homework);
  const enriched = {
    ...homework,
    ...complexity,
    deadlineAt: hasValidDeadline ? deadlineDate.toISOString() : null,
    deadlineTimestamp: hasValidDeadline ? deadlineDate.getTime() : null
  };

  return {
    ...enriched,
    ...getUrgency(enriched)
  };
}

function compareHomeworks(a, b) {
  const doneA = a.status === '已完成';
  const doneB = b.status === '已完成';
  if (doneA !== doneB) return doneA ? 1 : -1;

  const knownA = Boolean(a.deadlineAt);
  const knownB = Boolean(b.deadlineAt);
  if (knownA !== knownB) return knownA ? -1 : 1;

  if (knownA && knownB && a.deadlineTimestamp !== b.deadlineTimestamp) {
    return a.deadlineTimestamp - b.deadlineTimestamp;
  }

  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function getPriorityHomeworks(homeworks) {
  return homeworks
    .filter((homework) => homework.status !== '已完成')
    .filter((homework) => homework.deadlineAt || homework.status === '待确认')
    .map((homework) => ({
      ...homework,
      planningScore:
        homework.urgency === 'unknown' && homework.status === '待确认'
          ? 40
          : homework.priority || 30
    }))
    .sort((a, b) => {
      if (a.planningScore !== b.planningScore) return b.planningScore - a.planningScore;
      if (a.deadlineAt && b.deadlineAt) return a.deadlineTimestamp - b.deadlineTimestamp;
      if (a.deadlineAt !== b.deadlineAt) return a.deadlineAt ? -1 : 1;
      return 0;
    })
    .slice(0, 3);
}

function getTaskSummary(text) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact;
}

function formatDeadlineAt(value) {
  if (!value) {
    return '待确认';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '待确认';
  }

  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function logDeadlineParserSamples() {
  const samples = [
    '本周四',
    '下周三晚上八点',
    '本周五18:00前',
    '下周一中午12点',
    '今天晚上8点',
    '明天中午12点',
    '6月18号晚上八点前',
    '2026年6月18日18:00前'
  ];

  console.table(
    samples.map((sample) => {
      const parsed = parseDeadline(sample);
      return {
        text: sample,
        deadlineAt: parsed ? formatDeadlineAt(parsed.toISOString()) : '待确认'
      };
    })
  );
}

function renderPlanning(homeworks) {
  const priorityHomeworks = getPriorityHomeworks(homeworks);

  planningList.innerHTML = '';

  if (!priorityHomeworks.length) {
    planningList.innerHTML = `
      <div class="planning-empty">
        <strong>当前没有紧急任务</strong>
        <span>继续保持，新的 QQ/钉钉作业通知会自动进入这里。</span>
      </div>
    `;
    return;
  }

  priorityHomeworks.forEach((homework) => {
    const item = document.createElement('article');
    item.className = `planning-item urgency-${homework.urgency}`;
    item.innerHTML = `
      <div>
        <h3>${escapeHtml(homework.course)}</h3>
        <p>${escapeHtml(getTaskSummary(homework.task))}</p>
      </div>
      <div class="planning-meta">
        <span>截止：${escapeHtml(homework.deadline)}</span>
        <span>换算：${escapeHtml(formatDeadlineAt(homework.deadlineAt))}</span>
        <span class="complexity-badge ${homework.complexity}">${escapeHtml(homework.complexityLabel)}</span>
        <span>${escapeHtml(homework.advice)}</span>
      </div>
    `;
    planningList.appendChild(item);
  });
}

function isReminderEnabled() {
  return window.localStorage.getItem(REMINDER_ENABLED_KEY) === 'true';
}

function updateReminderButton() {
  reminderToggle.textContent = isReminderEnabled() ? '站内提醒已开启' : '开启站内提醒';
}

function updateReminderBanner(homeworks) {
  updateReminderButton();
  reminderBanner.classList.remove('is-visible');
  reminderBanner.textContent = '';

  if (!isReminderEnabled()) {
    return;
  }

  const todayKey = `${REMINDER_SEEN_KEY_PREFIX}:${getTodayKey()}`;
  if (window.localStorage.getItem(todayKey) === 'true') {
    return;
  }

  const priorityHomeworks = getPriorityHomeworks(homeworks);
  if (!priorityHomeworks.length) {
    return;
  }

  const top = priorityHomeworks[0];
  reminderBanner.textContent = `${top.urgencyLabel}：${top.course} - ${getTaskSummary(top.task)}。${top.advice}`;
  reminderBanner.classList.add('is-visible');
  window.localStorage.setItem(todayKey, 'true');
}

function renderHomeworks() {
  const homeworks = getFilteredHomeworks();

  homeworkList.innerHTML = '';
  emptyState.style.display = homeworks.length ? 'none' : 'block';

  homeworks.forEach((homework) => {
    const row = document.createElement('article');
    row.className = `homework-row urgency-${homework.urgency} ${homework.status === '已完成' ? 'is-done' : ''}`;
    row.innerHTML = `
      <div class="task-course">
        <h3 class="course-title">${escapeHtml(homework.course)}</h3>
        <span class="source-line">来自：${escapeHtml(homework.platform)}</span>
        <div class="badge-row">
          <span class="status-badge ${getStatusClass(homework.status)}">${escapeHtml(homework.status)}</span>
          ${renderUrgencyBadge(homework)}
          <span class="complexity-badge ${homework.complexity}">${escapeHtml(homework.complexityLabel)}</span>
        </div>
      </div>
      <div class="task-main">
        <p class="task-text">${escapeHtml(homework.task)}</p>
        <div class="task-meta">
          <span>截止：${escapeHtml(homework.deadline)}</span>
          <span>换算：${escapeHtml(formatDeadlineAt(homework.deadlineAt))}</span>
          <span>提交方式：${escapeHtml(homework.submitMethod)}</span>
          <span>接收：${escapeHtml(formatDate(homework.createdAt))}</span>
        </div>
        <blockquote class="original-message">${escapeHtml(homework.originalMessage)}</blockquote>
      </div>
      <div class="action-group">
        ${renderStatusButton(homework)}
        <button class="secondary-button" type="button" data-action="edit" data-id="${escapeHtml(homework.id)}">编辑</button>
        <button class="delete-button" type="button" data-action="delete" data-id="${escapeHtml(homework.id)}">删除</button>
      </div>
    `;

    homeworkList.appendChild(row);
  });

  if (homeworks.length) {
    const footer = document.createElement('div');
    footer.className = 'list-end';
    footer.textContent = '没有更多作业了';
    homeworkList.appendChild(footer);
  }
}

function getStatusClass(status) {
  if (status === '已完成') return 'done';
  if (status === '待确认') return 'confirm';
  return 'todo';
}

function renderUrgencyBadge(homework) {
  if (!homework.urgencyLabel || homework.status === '已完成' || homework.urgency === 'normal') {
    return '';
  }

  return `<span class="urgency-badge ${homework.urgency}">${escapeHtml(homework.urgencyLabel)}</span>`;
}

function renderStatusButton(homework) {
  if (homework.status === '已完成') {
    return `<button class="secondary-button" type="button" data-action="todo" data-id="${escapeHtml(homework.id)}">恢复为待完成</button>`;
  }

  return `<button class="primary-button" type="button" data-action="done" data-id="${escapeHtml(homework.id)}">标记完成</button>`;
}

async function updateHomeworkStatus(id, status) {
  const response = await fetch(`/api/homeworks/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error('状态更新失败');
  }
}

async function updateHomework(homework) {
  const response = await fetch(`/api/homeworks/${homework.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(homework)
  });

  if (!response.ok) {
    throw new Error('保存失败，请稍后重试');
  }
}

async function createHomework(homework) {
  const response = await fetch('/api/homeworks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(homework)
  });

  if (!response.ok) {
    throw new Error('添加失败，请稍后重试');
  }
}

async function deleteHomework(id) {
  const response = await fetch(`/api/homeworks/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('删除失败，请刷新后重试');
  }
}

async function sendMessage(platform, message) {
  const endpoint = platform === 'dingtalk' ? '/webhook/dingtalk' : '/webhook/qq';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: message })
  });

  if (!response.ok) {
    throw new Error('消息接入失败');
  }

  return response.json();
}

async function parseManualNotice(messageText, platform) {
  const response = await fetch('/api/ai-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      platform,
      messageText
    })
  });

  if (!response.ok) {
    throw new Error('AI识别失败，请稍后重试');
  }

  return response.json();
}

function fillManualFormFromAIResult(item, originalMessage) {
  manualCourse.value = toProductValue(item.course);
  manualTask.value = toProductValue(item.task);
  manualDeadline.value = toProductValue(item.deadline);
  manualSubmitMethod.value = toProductValue(item.submitMethod);
  manualOriginalMessage.value = originalMessage;
}

function openEditModal(homework) {
  editId.value = homework.id;
  editPlatform.value = homework.platform;
  editStatus.value = homework.status;
  editCourse.value = homework.course;
  editTask.value = homework.task;
  editDeadline.value = homework.deadline;
  editSubmitMethod.value = homework.submitMethod;
  editOriginalMessage.value = homework.originalMessage;

  editModal.classList.add('is-open');
  editModal.setAttribute('aria-hidden', 'false');
  editCourse.focus();
}

function closeEditModal() {
  editModal.classList.remove('is-open');
  editModal.setAttribute('aria-hidden', 'true');
  editForm.reset();
}

forms.forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const platform = form.dataset.platform;
    const textarea = form.querySelector('textarea');
    const button = form.querySelector('button');
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = '接入中...';

    try {
      const result = await sendMessage(platform, textarea.value);
      const count = Array.isArray(result.homeworks) ? result.homeworks.length : 0;
      showToast(`已接入 ${count} 条作业通知`);
      await loadHomeworks();
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});

manualForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await createHomework({
      platform: manualPlatform.value,
      course: manualCourse.value,
      task: manualTask.value,
      deadline: manualDeadline.value,
      deadlineAt: parseDeadline(manualDeadline.value)?.toISOString() || null,
      submitMethod: manualSubmitMethod.value,
      originalMessage: manualOriginalMessage.value,
      status: manualStatus.value
    });

    manualForm.reset();
    showToast('作业已添加');
    await loadHomeworks();
  } catch (error) {
    showToast(error.message);
  }
});

manualAiFillBtn.addEventListener('click', async () => {
  const messageText = manualAiText.value.trim();

  if (!messageText) {
    showToast('请先粘贴原始通知');
    return;
  }

  const originalText = manualAiFillBtn.textContent;
  manualAiFillBtn.disabled = true;
  manualAiFillBtn.textContent = '识别中...';

  try {
    const result = await parseManualNotice(messageText, manualPlatform.value);
    const items = Array.isArray(result.results) ? result.results : [];

    if (!items.length) {
      showToast('未识别到可填入的作业信息');
      return;
    }

    fillManualFormFromAIResult(items[0], messageText);

    if (items.length > 1) {
      showToast('识别到多条任务，已填入第一条，其余任务可分别手动添加。');
    } else {
      showToast('AI识别结果已填入表单');
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    manualAiFillBtn.disabled = false;
    manualAiFillBtn.textContent = originalText;
  }
});

homeworkList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  try {
    if (action === 'edit') {
      const homework = allHomeworks.find((item) => item.id === id);
      if (homework) {
        openEditModal(homework);
      }
      return;
    }

    if (action === 'delete') {
      await deleteHomework(id);
      showToast('已删除该作业');
    }

    if (action === 'done') {
      await updateHomeworkStatus(id, '已完成');
      showToast('已标记为完成');
    }

    if (action === 'todo') {
      await updateHomeworkStatus(id, '待完成');
      showToast('已恢复为待完成');
    }

    await loadHomeworks();
  } catch (error) {
    showToast(error.message);
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await updateHomework({
      id: editId.value,
      platform: editPlatform.value,
      course: editCourse.value,
      task: editTask.value,
      deadline: editDeadline.value,
      deadlineAt: parseDeadline(editDeadline.value)?.toISOString() || null,
      submitMethod: editSubmitMethod.value,
      originalMessage: editOriginalMessage.value,
      status: editStatus.value
    });

    closeEditModal();
    showToast('作业已更新');
    await loadHomeworks();
  } catch (error) {
    showToast(error.message);
  }
});

closeEditBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (event) => {
  if (event.target === editModal) {
    closeEditModal();
  }
});

platformFilter.addEventListener('change', renderHomeworks);
statusFilter.addEventListener('change', renderHomeworks);
refreshBtn.addEventListener('click', loadHomeworks);
reminderToggle.addEventListener('click', () => {
  const nextEnabled = !isReminderEnabled();
  window.localStorage.setItem(REMINDER_ENABLED_KEY, String(nextEnabled));

  if (nextEnabled) {
    window.localStorage.removeItem(`${REMINDER_SEEN_KEY_PREFIX}:${getTodayKey()}`);
    showToast('站内提醒已开启');
  } else {
    reminderBanner.classList.remove('is-visible');
    reminderBanner.textContent = '';
    showToast('站内提醒已关闭');
  }

  updateReminderBanner(allHomeworks);
});

logDeadlineParserSamples();
loadHomeworks();
