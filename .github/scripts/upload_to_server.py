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

host = os.environ.get("ALIYUN_HOST", "")
user = os.environ.get("ALIYUN_USER", "")
pwd = os.environ.get("ALIYUN_PASS", "")
remote_dir = os.environ.get("REMOTE_DIR", "/usr/share/nginx/html/downloads")
release_dir = os.environ.get("RELEASE_DIR", "release")

if not (host and user and pwd):
    print("::warning::缺少 ALIYUN_HOST/ALIYUN_USER/ALIYUN_PASS，跳过阿里云上传")
    sys.exit(0)

patterns = ["*.exe", "*.yml", "*.blockmap"]
files = []
for pat in patterns:
    files.extend(glob.glob(os.path.join(release_dir, pat)))
# 去重并过滤掉目录
files = [f for f in files if os.path.isfile(f)]
if not files:
    print("::warning::release 目录下没有可上传的产物")
    sys.exit(0)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=pwd, timeout=20,
               allow_agent=False, look_for_keys=False)

def run(cmd):
    _, out, err = client.exec_command(cmd)
    rc = out.channel.recv_exit_status()
    o = out.read().decode("utf-8", "ignore").strip()
    e = err.read().decode("utf-8", "ignore").strip()
    return rc, o, e

rc, o, e = run(f"mkdir -p {remote_dir}")
if rc != 0:
    print(f"::error::mkdir 失败: {e or o}")
    client.close()
    sys.exit(1)

sftp = client.open_sftp()
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