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

  allHomeworks = homeworks.map(normalizeHomework);
  renderStats(allHomeworks);
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

function renderHomeworks() {
  const homeworks = getFilteredHomeworks();

  homeworkList.innerHTML = '';
  emptyState.style.display = homeworks.length ? 'none' : 'block';

  homeworks.forEach((homework) => {
    const card = document.createElement('article');
    card.className = `homework-card ${homework.status === '已完成' ? 'is-done' : ''}`;
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="title-row">
            <h3 class="course-title">${escapeHtml(homework.course)}</h3>
            <span class="status-badge ${getStatusClass(homework.status)}">${escapeHtml(homework.status)}</span>
          </div>
          <div class="meta">
            <span>来源平台：${escapeHtml(homework.platform)}</span>
            <span>接收时间：${escapeHtml(formatDate(homework.createdAt))}</span>
          </div>
        </div>
        <div class="action-group">
          <button class="secondary-button" type="button" data-action="edit" data-id="${escapeHtml(homework.id)}">编辑</button>
          ${renderStatusButton(homework)}
          <button class="delete-button" type="button" data-action="delete" data-id="${escapeHtml(homework.id)}">删除</button>
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <span class="field-label">作业内容</span>
          <span class="field-value">${escapeHtml(homework.task)}</span>
        </div>
        <div class="field two-column">
          <div>
            <span class="field-label">截止时间</span>
            <span class="field-value">${escapeHtml(homework.deadline)}</span>
          </div>
          <div>
            <span class="field-label">提交方式</span>
            <span class="field-value">${escapeHtml(homework.submitMethod)}</span>
          </div>
        </div>
        <div class="field">
          <span class="field-label">原始通知</span>
          <span class="field-value original-message">${escapeHtml(homework.originalMessage)}</span>
        </div>
      </div>
    `;

    homeworkList.appendChild(card);
  });
}

function getStatusClass(status) {
  if (status === '已完成') return 'done';
  if (status === '待确认') return 'confirm';
  return 'todo';
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
      showToast('识别到多条任务，已填入第一条，其余任务请通过平台消息接入区添加。');
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

loadHomeworks();
