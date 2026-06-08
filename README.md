# Consistency Eval — GitHub Pages

解题答案一致性评测报告 & 相关工具页面。

## 页面

| 路径 | 说明 |
|------|------|
| `/` (index.html) | 解题答案一致性评测报告主页 |
| `/polymarket_report.html` | Polymarket 2026 世界杯数据源调研报告 |
| `/cover-tool/` | 千问小讲堂封面制作工具 |
| `/qianwen-lecture/` | 千问小讲堂相关页面 |

## 部署

- **GitHub Pages**：`https://paultunggm-pixel.github.io/consistency-eval/`
- **阿里云 OSS**：`consistency-eval.oss-website-cn-hangzhou.aliyuncs.com`
- 自动部署：每次 push 到 main 时通过 GitHub Actions 自动部署

## 更新方式

通过 Claude Code `deploy-static-site` skill 更新（同时推送至 GitHub Pages 和阿里云 OSS）。
