#!/usr/bin/env python3
"""
同步 cover-tool 目录到阿里云 OSS（双通道部署）
由 GitHub Actions 在 Pages 部署后自动执行。

用法：
  export OSS_ACCESS_KEY_ID="..."
  export OSS_ACCESS_KEY_SECRET="..."
  python3 scripts/sync-cover-tool-to-oss.py
"""

import oss2
import os
import mimetypes
from pathlib import Path

# ====== 配置 ======
OSS_ENDPOINT = "oss-cn-hangzhou.aliyuncs.com"
BUCKET_NAME = "consistency-eval"
LOCAL_DIR = Path(__file__).resolve().parent.parent / "cover-tool"
OSS_PREFIX = "cover-tool/"

# ====== MIME 类型映射 ======
EXTRA_MIME_TYPES = {
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}

# 不上传的文件模式
EXCLUDE_SUFFIXES = (".DS_Store", ".gitignore")
EXCLUDE_PREFIXES = (".omc/",)


def get_content_type(file_path: Path) -> str:
    """获取文件的 MIME Type"""
    ext = file_path.suffix.lower()
    if ext in EXTRA_MIME_TYPES:
        return EXTRA_MIME_TYPES[ext]
    # fallback 到 mimetypes 猜测
    ct, _ = mimetypes.guess_type(str(file_path))
    return ct or "application/octet-stream"


def get_cache_control(file_path: Path) -> str:
    """
    根据文件类型设置缓存策略。
    - 字体/JS/CSS: 长缓存（用户很少修改）
    - HTML: 短缓存（更新频率高）
    - 其他: 默认
    """
    ext = file_path.suffix.lower()
    if ext in (".ttf", ".woff", ".woff2"):
        return "public, max-age=2592000, immutable"  # 30 天
    if ext in (".js", ".css", ".svg"):
        return "public, max-age=604800"  # 7 天
    if ext == ".html":
        return "public, max-age=600"  # 10 分钟
    return "public, max-age=86400"  # 1 天


def should_include(file_path: Path) -> bool:
    """判断文件是否应上传"""
    rel = str(file_path.relative_to(LOCAL_DIR.parent))
    # 排除 .omc/ 目录
    if rel.startswith(EXCLUDE_PREFIXES):
        return False
    # 排除临时文件
    if file_path.name.endswith(EXCLUDE_SUFFIXES):
        return False
    return True


def main():
    # 检查环境变量
    ak_id = os.environ.get("OSS_ACCESS_KEY_ID")
    ak_secret = os.environ.get("OSS_ACCESS_KEY_SECRET")
    if not ak_id or not ak_secret:
        print("❌ 错误：OSS_ACCESS_KEY_ID 或 OSS_ACCESS_KEY_SECRET 未设置")
        exit(1)

    # 检查本地目录
    if not LOCAL_DIR.is_dir():
        print(f"❌ 错误：本地目录不存在：{LOCAL_DIR}")
        exit(1)

    # 初始化 OSS 客户端
    auth = oss2.Auth(ak_id, ak_secret)
    bucket = oss2.Bucket(auth, OSS_ENDPOINT, BUCKET_NAME)

    # 确保 Bucket Policy 有效
    try:
        bucket.get_bucket_policy()
    except oss2.exceptions.NoSuchKey:
        import json
        policy = {
            "Version": "1",
            "Statement": [{
                "Effect": "Allow",
                "Action": ["oss:GetObject"],
                "Principal": ["*"],
                "Resource": [f"acs:oss:*:*:{BUCKET_NAME}/*"]
            }]
        }
        bucket.put_bucket_policy(json.dumps(policy))
        print("  📋 Bucket Policy 已设置（公开读）")

    # 计算文件列表
    files_to_upload = []
    for file_path in sorted(LOCAL_DIR.rglob("*")):
        if file_path.is_file() and should_include(file_path):
            files_to_upload.append(file_path)

    if not files_to_upload:
        print("❌ 错误：未找到需要上传的文件")
        exit(1)

    print(f"📦 发现 {len(files_to_upload)} 个文件，开始同步...")

    # 逐个上传
    success_count = 0
    fail_count = 0
    for file_path in files_to_upload:
        # 计算 OSS 对象名（相对路径）
        relative = file_path.relative_to(LOCAL_DIR.parent)
        object_key = str(relative)

        content_type = get_content_type(file_path)
        cache_control = get_cache_control(file_path)
        file_size = file_path.stat().st_size

        headers = {
            "Content-Type": content_type,
            "Cache-Control": cache_control,
        }

        try:
            with open(file_path, "rb") as f:
                result = bucket.put_object(object_key, f, headers=headers)

            if result.status == 200:
                success_count += 1
                print(f"  ✅ {object_key}  ({file_size / 1024:.1f} KB, {content_type})")
            else:
                fail_count += 1
                print(f"  ❌ {object_key}  (HTTP {result.status})")
        except Exception as e:
            fail_count += 1
            print(f"  ❌ {object_key}  (异常: {e})")

    # 汇总
    print(f"\n{'='*40}")
    print(f"📊 同步完成：成功 {success_count} / 失败 {fail_count} / 总计 {len(files_to_upload)}")
    if success_count > 0:
        print(f"🔗 OSS: https://{BUCKET_NAME}.{OSS_ENDPOINT}/cover-tool/")
        print(f"🔗 Pages: https://paultunggm-pixel.github.io/consistency-eval/cover-tool/")


if __name__ == "__main__":
    main()
