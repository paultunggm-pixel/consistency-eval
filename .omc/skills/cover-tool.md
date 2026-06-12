---
name: cover-tool
description: >-
  维护和更新千问小讲堂封面生成网页工具 (cover-tool)。
  当用户提到封面工具、cover-tool、封面生成网页、Canvas渲染封面、
  更新样式参数、修复渲染问题、部署封面工具时使用。
triggers:
  - "封面工具"
  - "cover-tool"
  - "封面生成网页"
  - "Canvas渲染"
  - "样式参数"
  - "封面预览"
  - "千问小讲堂封面"
---

# 千问小讲堂 · 封面生成网页工具 (cover-tool)

## 工具概述

纯前端网页工具，部署在 GitHub Pages。运营人员上传课程数据 → 配置样式 → 渲染封面 → 上传 OSS → 获取 CDN URL。

**访问地址**：`https://paultunggm-pixel.github.io/consistency-eval/cover-tool/`

**代码位置**：`consistency-eval/cover-tool/`

```
cover-tool/
├── index.html          # 主页面（6 步向导）
├── css/style.css       # 样式
├── js/
│   ├── styles.js       # 4 种样式的渲染参数常量（从 Python 提取）
│   ├── fonts.js         # 字体加载管理（FontFace API）
│   ├── renderer.js     # Canvas 渲染引擎（复刻 PIL 逻辑）
│   ├── oss.js          # OSS 上传模块（浏览器端 HMAC-SHA1 签名）
│   ├── main.js         # 主逻辑 + UI 交互
│   └── utils.js        # 工具函数（下载、CSV、localStorage）
├── fonts/              # 5 个 TTF 字体（约 37MB）
└── assets/             # SVG 徽标
```

## 参数来源

所有渲染参数从原始 Python 脚本提取：
- **源文件**：`千问小讲堂-文本挂载封面生产包/脚本/render_covers.py`
- **设计坐标系**：144×192dp，输出 4x = 576×768px
- **参数常量**在 `js/styles.js` 中维护，修改参数时同时更新 Python 源和 JS 常量

## 部署流程

```bash
cd /tmp/consistency-eval
git add cover-tool/ .omc/
git commit -m "描述修改内容"
git push
```
GitHub Pages 自动构建，约 10 秒后生效。

> **重要**：推送前确保没有硬编码密钥（GitHub Push Protection 会拦截）

## OSS 上传架构

### 凭证管理
- 凭证通过页面 UI 输入（Step 5 展开「OSS 配置」），存储于浏览器 localStorage
- **代码中禁止硬编码 AccessKey**
- 非敏感默认值预填在 `js/oss.js` 中

### 上传流程
```
Canvas.toBlob() → HMAC-SHA1 签名(Web Crypto API) → XMLHttpRequest PUT → 阿里云 OSS
用户获得 CDN URL ← https://cdn-private.sm.cn/souti-imgs-tasting/<file>.jpg ←──┘
```
整个过程不经过任何中间服务器。

## Canvas 渲染架构

| JS 函数 | Python 原版 | 适用内容 |
|---------|------------|----------|
| `renderStyle1()` | `render_style1()` | 小低数学：钩子(元黑)+标签(胶囊)+垂帘徽标 |
| `renderStyle2()` | `render_style2()` | 小高数学：钩子(普惠Bold)+标签(矩形)+下圆角徽标 |
| `renderStyle3()` | `render_style3()` | 语文/科普：学名居中(65W)+毛玻璃徽标+底部压暗带 |
| `renderChengyu()` | `render_chengyu()` | 成语：学名(65W)+钩子(W 70%)+毛玻璃+压暗带 |

### PIL → Canvas 关键映射

| Python PIL | Canvas |
|-----------|--------|
| `draw_tracked()` 逐字+字间距 | `fillText()` 逐字符 + `measureText()` + `trackPx` |
| `add_title_scrim()` 底部渐变 | `createLinearGradient()` 50%→74% |
| `draw_drape_badge()` 贝塞尔 | `bezierCurveTo()` |
| `theme_color()` 顶部主色 | `getImageData()` 缩小采样加权平均 |
| 二分搜索 JPG ≤50KB | `toBlob('image/jpeg', quality)` 循环 |

## 更新样式参数

修改 `js/styles.js` 的 `STYLES` 对象，dp 值通过 `sp()` 自动缩放。同时更新 Python `render_covers.py` 保持一致。

## 添加新样式

1. `js/styles.js` — 添加 `STYLES.newStyle`
2. `js/renderer.js` — 添加 `renderNewStyle()` 函数 + `renderCover()` 分支
3. `index.html` — 样式选择器添加选项
4. `main.js` — `loadSample()` 添加测试数据
5. 提交推送

## 安全规则

1. **绝不硬编码凭证** — AK/SK 仅通过 UI → localStorage
2. **推送前检查** — `grep -r "LTAI\|accessKeySecret.*['\"].." cover-tool/js/` 应无输出
3. **GitHub Push Protection 已开启** — 含密钥的推送自动拒绝
4. **OSS 凭证轮换** — 如怀疑泄露，在阿里云 RAM 控制台立即轮换

## 已知限制

- 字体约 37MB，首次加载较慢（后续可做子集化）
- Canvas 渲染与 Python PIL 存在微小差异（抗锯齿、字体度量）
- 跨域图片需要 CDN 支持 CORS
- style1/style2 尚未大规模验证（style3 已跑通 479 条）

## 相关资源

- **工具页面**：`https://paultunggm-pixel.github.io/consistency-eval/cover-tool/`
- **业务流程文档**：`https://paultunggm-pixel.github.io/consistency-eval/qianwen-lecture/`
- **Python 渲染脚本**：`千问小讲堂-chat挂载封面制作需求/千问小讲堂-文本挂载封面生产包/脚本/render_covers.py`
- **原 Skill 定义**：`千问小讲堂-chat挂载封面制作需求/千问小讲堂-文本挂载封面生产包/SKILL.md`
