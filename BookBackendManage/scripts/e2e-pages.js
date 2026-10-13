/**
 * 页面端到端验收（图-1 ~ 图-9）
 *
 * 用真实 Chrome 走完试卷要求的全部交互链路，断言页面行为，
 * 并在 docs/screenshots 同级的临时目录留下截图。
 *
 * 与 test/ 下的接口回归测试互补：
 *   · test/        验证后端接口行为，跑在 CI 里
 *   · 本脚本        验证「页面点下去会怎样」，需要真实浏览器，故只在本地跑
 *
 * 前置条件：
 *   1. 数据库已初始化（npm run db:init）
 *   2. 服务已启动（npm start）
 *   3. 本机安装了 Chrome
 *
 * 用法：
 *   npm run test:e2e
 *   npm run test:e2e -- --chrome="D:/path/to/chrome.exe"   指定浏览器路径
 *   npm run test:e2e -- --base=http://127.0.0.1:3000       指定被测地址
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import puppeteer from 'puppeteer-core';

// ---------- 运行参数 ----------

/** 从 --key=value 形式的参数中取值 */
function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const BASE = readArg('base', process.env.E2E_BASE_URL || 'http://127.0.0.1:3000');
const CHROME = readArg('chrome', process.env.CHROME_PATH || '');

/** 截图输出目录：未指定时放在系统临时目录，不污染仓库 */
const SHOTS = readArg(
  'shots',
  path.join(os.tmpdir(), 'book-system-e2e', `${Date.now()}`)
);

/** 各平台常见的 Chrome 安装位置，逐个探测 */
const CHROME_CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

/**
 * 找到可用的浏览器可执行文件
 * @returns {Promise<string>} 路径
 */
async function resolveChromePath() {
  if (CHROME) return CHROME;

  const candidates = CHROME_CANDIDATES[process.platform] ?? [];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* 继续找下一个 */
    }
  }

  throw new Error(
    `未找到 Chrome。请用 --chrome=<路径> 指定，或设置环境变量 CHROME_PATH。\n` +
      `已尝试：\n${candidates.map((c) => `  ${c}`).join('\n')}`
  );
}

// ---------- 断言收集 ----------

const results = [];
const dialogs = [];

/** 记录一条断言 */
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: ok ? '' : String(detail) });
}

/** 记录一条「实际值 === 期望值」断言 */
function eq(name, actual, expected) {
  check(
    name,
    actual === expected,
    `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- 主流程 ----------

async function main() {
  await fs.mkdir(SHOTS, { recursive: true });

  const executablePath = await resolveChromePath();
  console.log(`浏览器：${executablePath}`);
  console.log(`被测地址：${BASE}`);
  console.log(`截图目录：${SHOTS}\n`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  /** 弹窗自动确认；取消场景临时改为 false */
  let acceptDialogs = true;
  let lastDialog = null;

  page.on('dialog', async (dialog) => {
    lastDialog = { type: dialog.type(), message: dialog.message() };
    dialogs.push({ ...lastDialog });
    if (acceptDialogs) {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  });

  page.on('pageerror', (error) => check('页面无 JS 报错', false, error.message));

  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name) });
  const goto = async (url) => {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await sleep(250);
  };

  /** 读取当前列表页的表格内容 */
  const rows = () =>
    page.$$eval('#bookTableBody tr', (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())
      )
    );

  // ============ 图-1：打开首页，默认显示全部图书 ============
  await goto(`${BASE}/`);
  await shot('01-图1-图书列表页.png');

  let list = await rows();
  eq('图-1 每页显示 5 条', list.length, 5);
  eq('图-1 首行图书编号（入库时间降序）', list[0][0], 'BK000023');
  eq('图-1 首行图书分类（由类型表关联）', list[0][1], '科技');
  eq('图-1 首行入库时间格式为年-月-日', list[0][5], '2014-07-03');

  const headers = await page.$$eval('.data-table thead th', (ths) =>
    ths.map((th) => th.innerText.trim())
  );
  eq(
    '图-1 表头与试卷一致',
    headers.join('|'),
    ['图书编号', '图书分类', '图书名称', '作者', '出版社', '入库时间', '是否借阅', '操作'].join('|')
  );

  const firstBg = await page.$eval(
    '#bookTableBody tr:nth-child(1)',
    (el) => getComputedStyle(el).backgroundColor
  );
  const secondBg = await page.$eval(
    '#bookTableBody tr:nth-child(2)',
    (el) => getComputedStyle(el).backgroundColor
  );
  check('图-1 列表隔行变色', firstBg !== secondBg, `第1行 ${firstBg}，第2行 ${secondBg}`);

  const pager = await page.$eval('#pagination', (el) =>
    el.innerText.replace(/\s+/g, ' ').trim()
  );
  check('图-1 分页显示共 3 页', /共3页/.test(pager), pager);
  check('图-1 分页含「到第 页 确定」', /到第[\s\S]*页[\s\S]*确定/.test(pager), pager);

  const totalText = pager.match(/共\s*(\d+)\s*条记录/);
  eq('图-1 默认显示全部 12 条图书', totalText ? totalText[1] : '未取到', '12');

  const ops = await page.$$eval('#bookTableBody tr:first-child .ops a', (as) =>
    as.map((a) => a.innerText.trim())
  );
  eq('图-1 操作列含查看/修改/删除', ops.join('|'), '查看|修改|删除');

  // ============ 图-2：按图书名称查询 ============
  await page.type('#bookNameInput', '天龙八部');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#searchBtn'),
  ]);
  await sleep(250);
  await shot('02-图2-按图书名称查询.png');

  list = await rows();
  eq('图-2 查询结果条数', list.length, 1);
  eq('图-2 查询结果图书编号', list[0][0], 'BK000025');
  eq('图-2 输入框保留查询条件', await page.$eval('#bookNameInput', (el) => el.value), '天龙八部');
  check('图-2 查询条件写入地址栏（刷新可还原）', page.url().includes('bookName='), page.url());

  await goto(`${BASE}/index.html?bookName=${encodeURIComponent('不存在的书名')}`);
  const emptyText = await page.$eval('#bookTableBody', (el) => el.innerText.trim());
  check('图-2 无结果时给出提示', emptyText.includes('未查询到'), emptyText);

  // ============ 图-3：查看详情 ============
  await goto(`${BASE}/detail.html?id=1&bookName=&page=1`);
  await shot('03-图3-查看图书详细信息.png');

  eq(
    '图-3 页面标题',
    await page.$eval('.page-title', (el) => el.innerText.trim()),
    '查看图书信息'
  );

  const fieldStates = await page.$$eval('.form-grid input, .form-grid select', (els) =>
    els.map((el) => ({ id: el.id, readonly: el.readOnly || el.disabled }))
  );
  check(
    '图-3 所有字段只读',
    fieldStates.length > 0 && fieldStates.every((f) => f.readonly),
    JSON.stringify(fieldStates.filter((f) => !f.readonly))
  );

  const detail = await page.evaluate(() => ({
    bookCode: document.querySelector('#bookCode').value,
    bookName: document.querySelector('#bookName').value,
    typeName: document.querySelector('#typeName').value,
    author: document.querySelector('#bookAuthor').value,
    press: document.querySelector('#publishPress').value,
    createdBy: document.querySelector('#createdBy').value,
    time: document.querySelector('#creationTime').value,
  }));
  eq('图-3 图书编号', detail.bookCode, 'BK000023');
  eq('图-3 图书名称', detail.bookName, '企业应用架构模式');
  eq('图-3 图书类型显示名称而非 id', detail.typeName, '科技');
  eq('图-3 作者', detail.author, '(英) Martin Fowler');
  eq('图-3 出版社', detail.press, '机械工业出版社');
  eq('图-3 入库人', detail.createdBy, '系统管理员');
  eq('图-3 入库时间', detail.time, '2014-07-03');

  // 返回后保留查询条件与结果
  await goto(`${BASE}/detail.html?id=3&bookName=${encodeURIComponent('天龙八部')}&page=1`);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#backBtn'),
  ]);
  await sleep(250);
  eq(
    '图-3 返回后保留查询条件',
    await page.$eval('#bookNameInput', (el) => el.value),
    '天龙八部'
  );
  eq('图-3 返回后保留查询结果', (await rows()).length, 1);

  // ============ 图-4 / 图-5：新增 ============
  await goto(`${BASE}/`);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#addBtn'),
  ]);
  await sleep(300);
  await shot('04-图4-新增图书信息.png');

  eq(
    '图-4 页面标题',
    await page.$eval('.page-title', (el) => el.innerText.trim()),
    '新增图书信息'
  );
  eq('图-4 入库人默认「系统管理员」', await page.$eval('#createdBy', (el) => el.value), '系统管理员');
  eq('图-4 是否借阅默认「未借阅」', await page.$eval('#borrowed', (el) => el.value), '0');

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  eq('图-4 入库时间默认当天', await page.$eval('#creationTime', (el) => el.value), today);

  const typeOptions = await page.$$eval('#bookType option', (os) =>
    os.map((o) => o.innerText.trim())
  );
  eq('图-4 类型下拉占位项', typeOptions[0], '——请选择——');
  eq(
    '图-4 类型下拉数据来自 book_type 表',
    typeOptions.slice(1).join('|'),
    '小说|文学|传记|艺术|少儿|经济|管理|科技'
  );

  const starFields = await page.$$eval('.form-item', (items) =>
    items
      .filter((item) => item.querySelector('.required-star'))
      .map((item) => item.querySelector('label').innerText.replace(':', '').trim())
  );
  eq(
    '图-4 星号只标在 6 个必填项上',
    starFields.join('|'),
    '图书编号|图书名称|图书类型|是否借阅|入库人|入库时间'
  );

  // 必填校验：编号留空
  lastDialog = null;
  await page.click('#submitBtn');
  await sleep(300);
  check(
    '图-4 必填校验拦截空编号',
    Boolean(lastDialog) && lastDialog.message.includes('图书编号不能为空'),
    JSON.stringify(lastDialog)
  );
  eq('图-4 校验失败停留在新增页', new URL(page.url()).pathname, '/add.html');
  await shot('05-图4-必填校验拦截后停留本页.png');

  // 编号重复
  await page.$eval('#bookCode', (el) => (el.value = ''));
  await page.type('#bookCode', 'BK000023');
  await page.type('#bookName', '重复编号测试书');
  await page.select('#bookType', '1');
  lastDialog = null;
  await page.click('#submitBtn');
  await sleep(700);
  check(
    '图-5 编号重复时提示具体原因',
    Boolean(lastDialog) && lastDialog.message.includes('已存在'),
    JSON.stringify(lastDialog)
  );
  await shot('06-图5-编号重复校验后停留本页.png');

  // 正常新增
  await page.$eval('#bookCode', (el) => (el.value = ''));
  await page.type('#bookCode', 'BK009001');
  await page.$eval('#bookName', (el) => (el.value = ''));
  await page.type('#bookName', '验收测试图书');
  await page.type('#bookAuthor', '验收作者');
  await page.type('#publishPress', '验收出版社');
  lastDialog = null;
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
    page.click('#submitBtn'),
  ]);
  await sleep(500);
  check(
    '图-5 提示语为「新增成功！」',
    Boolean(lastDialog) && lastDialog.message === '新增成功！',
    JSON.stringify(lastDialog)
  );
  eq('图-5 新增后跳回列表页', new URL(page.url()).pathname, '/index.html');
  await shot('07-图5-新增成功后返回列表.png');

  const afterAdd = await page.$eval('#pagination', (el) => el.innerText.replace(/\s+/g, ' '));
  check('新增后总数变为 13 条', /共\s*13\s*条记录/.test(afterAdd), afterAdd);
  eq('新增的图书排在列表首位', (await rows())[0][0], 'BK009001');

  const newBookId = await page.evaluate(async () => {
    const response = await fetch(
      `/api/books?bookName=${encodeURIComponent('验收测试图书')}`
    );
    const json = await response.json();
    return json.data.list[0].bookId;
  });

  // ============ 图-6 / 图-7：修改 ============
  await goto(`${BASE}/edit.html?id=${newBookId}&bookName=&page=1`);
  await sleep(300);
  await shot('08-图6-修改图书信息.png');

  eq(
    '图-6 页面标题',
    await page.$eval('.page-title', (el) => el.innerText.trim()),
    '修改图书信息'
  );
  eq('图-6 回填图书编号', await page.$eval('#bookCode', (el) => el.value), 'BK009001');
  eq('图-6 回填图书名称', await page.$eval('#bookName', (el) => el.value), '验收测试图书');

  const createdByState = await page.$eval('#createdBy', (el) => ({
    readonly: el.readOnly,
    disabled: el.disabled,
  }));
  check(
    '图-6 入库人只读',
    createdByState.readonly || createdByState.disabled,
    JSON.stringify(createdByState)
  );

  const timeState = await page.$eval('#creationTime', (el) => ({
    readonly: el.readOnly,
    disabled: el.disabled,
  }));
  check(
    '图-6 入库时间只读',
    timeState.readonly || timeState.disabled,
    JSON.stringify(timeState)
  );

  // 绕过页面禁用，强行篡改只读字段，确认后端同样拒绝
  await page.evaluate(() => {
    const createdBy = document.querySelector('#createdBy');
    createdBy.readOnly = false;
    createdBy.value = '入侵者';

    const creationTime = document.querySelector('#creationTime');
    creationTime.disabled = false;
    creationTime.value = '1999-01-01';
  });
  await page.$eval('#bookName', (el) => (el.value = ''));
  await page.type('#bookName', '验收测试图书-已修改');

  lastDialog = null;
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
    page.click('#submitBtn'),
  ]);
  await sleep(500);
  check(
    '图-7 提示语为「修改成功！」',
    Boolean(lastDialog) && lastDialog.message === '修改成功！',
    JSON.stringify(lastDialog)
  );
  eq('图-7 修改后跳回列表页', new URL(page.url()).pathname, '/index.html');
  await shot('09-图7-修改成功后返回列表.png');

  const saved = await page.evaluate(async (bookId) => {
    const response = await fetch(`/api/books/${bookId}`);
    const json = await response.json();
    return json.data;
  }, newBookId);
  eq('只读字段未被篡改：入库人', saved.createdBy, '系统管理员');
  eq('只读字段未被篡改：入库时间', saved.creationTime, today);
  eq('可编辑字段已更新', saved.bookName, '验收测试图书-已修改');

  // ============ 图-8 / 图-9：删除 ============
  await goto(`${BASE}/index.html?bookName=${encodeURIComponent('验收测试图书')}&page=1`);
  eq('删除前查得 1 条', (await rows()).length, 1);

  // 先取消一次
  acceptDialogs = false;
  lastDialog = null;
  await page.click('.delete-link');
  await sleep(400);
  check('图-8 删除前弹出确认框', Boolean(lastDialog) && lastDialog.type === 'confirm', JSON.stringify(lastDialog));
  eq('图-8 确认框文案', lastDialog && lastDialog.message, '确定删除该图书信息？');
  await shot('10-图8-删除确认.png');
  await sleep(400);
  eq('图-8 取消后记录仍在', (await rows()).length, 1);

  // 再确认删除
  acceptDialogs = true;
  lastDialog = null;
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
    page.click('.delete-link'),
  ]);
  await sleep(600);
  check(
    '图-9 提示语为「删除成功！」',
    Boolean(lastDialog) && lastDialog.message === '删除成功！',
    JSON.stringify(lastDialog)
  );
  await shot('11-图9-删除成功后返回列表.png');

  const afterDelete = await rows();
  check(
    '图-9 删除后当前查询已无结果',
    afterDelete.length === 1 && afterDelete[0][0].includes('未查询到'),
    JSON.stringify(afterDelete)
  );

  // 回到不带条件的首页，确认总数复原
  await goto(`${BASE}/`);
  const restored = await page.$eval('#pagination', (el) => el.innerText.replace(/\s+/g, ' '));
  check('删除后总数回到 12 条', /共\s*12\s*条记录/.test(restored), restored);
  check(
    '被删除的图书不再出现',
    !(await rows()).some((row) => row[0] === 'BK009001')
  );
  await shot('12-删除后首页复原.png');

  await browser.close();

  // ---------- 输出 ----------
  const failed = results.filter((item) => !item.ok);

  const reportPath = path.join(SHOTS, 'report.json');
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      { base: BASE, total: results.length, passed: results.length - failed.length, results, dialogs },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\n断言：${results.length - failed.length}/${results.length} 通过`);

  if (failed.length > 0) {
    console.log('\n失败项：');
    failed.forEach((item) => console.log(`  ✗ ${item.name} —— ${item.detail}`));
  } else {
    console.log('全部通过');
  }

  console.log('\n实际捕获的弹窗文本：');
  dialogs.forEach((dialog) => {
    console.log(`  [${dialog.type}] ${dialog.message.split('\n').join(' / ')}`);
  });

  console.log(`\n截图与报告：${SHOTS}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('端到端验收失败：', error.message);
  process.exit(1);
});