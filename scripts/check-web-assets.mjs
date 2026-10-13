/**
 * 前端静态资源检查
 *
 * 页面是纯静态的（试卷规定使用 jQuery 1.8.3，无构建步骤），
 * 因此回归重点不在于编译，而在于「页面是否完整、依赖是否可离线加载」。
 *
 * 检查项：
 *   1. 试卷要求的四个页面齐全
 *   2. 页面引用的本地资源（css / js）都真实存在
 *   3. 不引用任何外部地址，保证断网也能打开
 *   4. jQuery 版本为试卷规定的 1.8.3
 *
 * 用法：node scripts/check-web-assets.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** 前端根目录：scripts -> ../web */
const WEB_DIR = path.resolve(currentDir, '../web');

/** 试卷要求的页面（图-1、图-3、图-4、图-6） */
const REQUIRED_PAGES = ['index.html', 'detail.html', 'add.html', 'edit.html'];

/** 试卷规定的 jQuery 版本 */
const REQUIRED_JQUERY = 'jquery-1.8.3.min.js';

const failures = [];
const checked = [];

/**
 * 记录一项检查结果
 * @param {boolean} ok 是否通过
 * @param {string}  label 检查项描述
 * @param {string}  [detail] 失败原因
 */
function check(ok, label, detail = '') {
  if (ok) {
    checked.push(label);
  } else {
    failures.push(detail ? `${label} —— ${detail}` : label);
  }
}

/**
 * 提取 HTML 中引用的本地资源路径
 * @param {string} html 页面内容
 * @returns {{local: string[], external: string[]}}
 */
function extractAssets(html) {
  const local = [];
  const external = [];

  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const url = match[1].trim();
      // 跳过锚点、data: 与协议相对地址以外的绝对地址
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        external.push(url);
      } else if (!url.startsWith('#') && !url.startsWith('data:')) {
        local.push(url);
      }
    }
  }

  return { local, external };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // 1) 页面齐全
  for (const page of REQUIRED_PAGES) {
    check(await exists(path.join(WEB_DIR, page)), `页面存在：web/${page}`);
  }

  // 2) 页面引用的资源都能找到，且不指向外部地址
  for (const page of REQUIRED_PAGES) {
    const pagePath = path.join(WEB_DIR, page);
    if (!(await exists(pagePath))) continue;

    const html = await fs.readFile(pagePath, 'utf8');
    const { local, external } = extractAssets(html);

    check(
      external.length === 0,
      `${page} 不依赖外部地址（可离线打开）`,
      `发现外部引用：${external.join('、')}`
    );

    for (const asset of local) {
      const assetPath = path.resolve(WEB_DIR, asset);
      // 防止 ../ 跳出 web 目录
      const insideWeb = assetPath.startsWith(WEB_DIR);
      check(
        insideWeb && (await exists(assetPath)),
        `${page} 引用的资源存在：${asset}`,
        insideWeb ? '文件不存在' : '引用路径越出了 web 目录'
      );
    }
  }

  // 3) jQuery 版本符合试卷规定
  const jqueryPath = path.join(WEB_DIR, 'assets', 'js', REQUIRED_JQUERY);
  check(await exists(jqueryPath), `jQuery 版本为试卷规定的 ${REQUIRED_JQUERY}`);

  if (await exists(jqueryPath)) {
    const source = await fs.readFile(jqueryPath, 'utf8');
    // 官方文件首行版权注释：/*! jQuery v1.8.3 jquery.com | jquery.org/license */
    check(
      /jQuery v1\.8\.3\b/.test(source),
      'jQuery 文件内容确为 1.8.3',
      '文件头的版本标识不是 v1.8.3'
    );
  }

  // 4) 页面脚本公共依赖齐全
  for (const moduleName of ['api.js', 'common.js']) {
    check(
      await exists(path.join(WEB_DIR, 'assets', 'js', moduleName)),
      `公共脚本存在：assets/js/${moduleName}`
    );
  }

  // 5) 样式表存在
  check(
    await exists(path.join(WEB_DIR, 'assets', 'css', 'style.css')),
    '样式表存在：assets/css/style.css'
  );

  // ---------- 输出 ----------
  console.log(`前端静态资源检查：通过 ${checked.length} 项\n`);
  checked.forEach((item) => console.log(`  ✓ ${item}`));

  if (failures.length > 0) {
    console.error(`\n失败 ${failures.length} 项：`);
    failures.forEach((item) => console.error(`  ✗ ${item}`));
    process.exit(1);
  }

  console.log('\n全部通过');
}

main().catch((error) => {
  console.error('检查脚本自身出错：', error);
  process.exit(1);
});