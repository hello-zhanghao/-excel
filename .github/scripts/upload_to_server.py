"""GitHub Actions 上传安装包到阿里云服务器（SFTP）。

依赖环境变量：
  ALIYUN_HOST      服务器 IP/域名
  ALIYUN_USER      SSH 用户名
  ALIYUN_PASS      SSH 密码
  REMOTE_DIR       远端目录（可选，默认 /usr/share/nginx/html/downloads）
  RELEASE_DIR      本地产物目录（可选，默认 release）

上传 release/ 下所有 .exe / .yml / .blockmap 文件，并保证远端权限为 644。
"""
import os
import sys
import glob
import paramiko

# Windows runner 默认 cp1252 编码，打印中文会抛 UnicodeEncodeError，强制 UTF-8。
# （工作流里也设置了 PYTHONIOENCODING=utf-8，这里双保险）
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

host = os.environ.get("ALIYUN_HOST", "")
user = os.environ.get("ALIYUN_USER", "")
pwd = os.environ.get("ALIYUN_PASS", "")
remote_dir = os.environ.get("REMOTE_DIR", "/usr/share/nginx/html/downloads")
release_dir = os.environ.get("RELEASE_DIR", "release")

if not (host and user and pwd):
    print("::error::缺少 ALIYUN_HOST/ALIYUN_USER/ALIYUN_PASS，请检查仓库 Secrets 是否已正确配置")
    sys.exit(1)

patterns = ["*.exe", "*.yml", "*.blockmap"]
files = []
for pat in patterns:
    files.extend(glob.glob(os.path.join(release_dir, pat)))
# 去重并过滤掉目录
files = [f for f in files if os.path.isfile(f)]
if not files:
    print("::error::release 目录下没有可上传的产物，请检查构建产物路径")
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(host, port=22, username=user, password=pwd, timeout=30,
                   allow_agent=False, look_for_keys=False)
except Exception as ex:
    print(f"::error::SSH 连接失败 ({host}@{user}): {ex}")
    sys.exit(1)
print(f"已连接 {host}@{user}")

sftp = client.open_sftp()

def ensure_dir(path):
    """逐级递归创建远端目录，返回 True/False"""
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur = f"{cur}/{p}" if cur else f"/{p}"
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            try:
                sftp.mkdir(cur)
            except Exception as ex:
                print(f"::error::创建远端目录 {cur} 失败: {ex}")
                return False
    return True

if not ensure_dir(remote_dir):
    print("::error::无法创建远端目录，请确认 Secrets 中的 ALIYUN_USER 具有相应写权限（推荐使用 root）")
    sftp.close()
    client.close()
    sys.exit(1)
print(f"远端目录就绪: {remote_dir}")

ok = 0
for f in sorted(files):
    name = os.path.basename(f)
    rp = f"{remote_dir}/{name}"
    size = os.path.getsize(f)
    print(f"上传 {name} ({size / 1024 / 1024:.1f} MB) ...")
    try:
        sftp.put(f, rp)
        sftp.chmod(rp, 0o644)
        rsize = sftp.stat(rp).st_size
        if rsize != size:
            print(f"::error::{name} 大小校验失败: {rsize} != {size}")
            continue
        ok += 1
        print(f"  完成")
    except Exception as ex:
        print(f"::error::上传 {name} 失败: {ex}")
sftp.close()
client.close()

print(f"::notice::阿里云上传完成，成功 {ok}/{len(files)} 个文件")
sys.exit(0 if ok == len(files) else 1)