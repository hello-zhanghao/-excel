@echo off
%SystemRoot%\System32\chcp.com 65001 >nul
title Excel BI Builder - 一键启动器

rem 切换到脚本所在目录（支持中文路径）
cd /d "%~dp0"

echo ============================================
echo   Excel BI Builder 环境检查
echo ============================================

rem 检查 Node.js 是否安装
node -v >nul 2>nul
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18 或更高版本
    echo 下载地址: https://nodejs.org/  ^(下载 LTS 版本即可^)
    echo 安装完成后，请关闭并重新打开本窗口，再次运行本脚本。
    echo.
    pause
    exit /b 1
)

rem 提取 Node 主版本号，要求 >= 18
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VER=%%a
set NODE_MAJOR=%NODE_VER:v=%
if %NODE_MAJOR% LSS 18 (
    echo.
    echo [错误] 当前 Node.js 版本过低 ^(%NODE_VER%^)，需要 18 或更高版本
    echo 下载地址: https://nodejs.org/  ^(下载 LTS 版本即可^)
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('npm -v') do set NPM_VER=%%v
echo [OK] Node.js 版本: %NODE_VER%
echo [OK] npm    版本: %NPM_VER%

rem 首次运行自动安装依赖
if not exist node_modules (
    echo.
    echo [提示] 未检测到依赖，正在自动安装，请耐心等待...
    echo [提示] 如需加速可执行: npm config set registry https://registry.npmmirror.com
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败！请检查网络连接后重新运行本脚本。
        echo.
        pause
        exit /b 1
    )
) else (
    echo [OK] 依赖已安装，跳过安装步骤
)

echo.
echo  ==========================================
echo    Excel BI Builder 启动模式
echo    1. 桌面模式（推荐，Electron 窗口）
echo    2. 浏览器模式（Web，无需 Electron）
echo  ==========================================
set /p MODE=请输入序号后按回车 [默认 1]: 
rem 清洗输入变量，剥离可能携带的回车符（某些终端/管道场景），避免影响后续判断
if defined MODE for /f "delims=" %%a in ("%MODE%") do set "MODE=%%a"

rem 检测旧进程是否仍在运行（Vite 占用 5173 端口 / Electron 进程）
set FOUND_VITE=0
set FOUND_ELECTRON=0
%SystemRoot%\System32\netstat.exe -ano | %SystemRoot%\System32\findstr.exe ":5173" | %SystemRoot%\System32\findstr.exe "LISTENING" >nul 2>nul
if not errorlevel 1 set FOUND_VITE=1
%SystemRoot%\System32\tasklist.exe | %SystemRoot%\System32\findstr.exe /i "electron.exe" >nul 2>nul
if not errorlevel 1 set FOUND_ELECTRON=1

set NEED_CHECK=0
if "%FOUND_VITE%"=="1" set NEED_CHECK=1
if "%MODE%"=="1" if "%FOUND_ELECTRON%"=="1" set NEED_CHECK=1

if "%NEED_CHECK%"=="1" (
    echo.
    echo  ==========================================
    echo    检测到旧进程仍在运行
    echo  ==========================================
    if "%FOUND_VITE%"=="1" echo     - Vite 开发服务器 ^(占用 5173 端口^)
    if "%FOUND_ELECTRON%"=="1" echo     - Electron 应用进程
    echo.
    echo    继续启动可能导致端口冲突或应用异常。
)

set KILL_OLD=N
if "%NEED_CHECK%"=="1" set /p KILL_OLD=是否结束旧进程并启动本次？[Y/N，默认 N]: 
rem 清洗输入变量，剥离可能携带的回车符
if defined KILL_OLD for /f "delims=" %%a in ("%KILL_OLD%") do set "KILL_OLD=%%a"

if /i "%KILL_OLD%"=="Y" (
    echo [操作] 正在结束旧进程...
    for /f "tokens=5" %%p in ('%SystemRoot%\System32\netstat.exe -ano ^| %SystemRoot%\System32\findstr.exe ":5173" ^| %SystemRoot%\System32\findstr.exe "LISTENING"') do (
        %SystemRoot%\System32\taskkill.exe /PID %%p /F >nul 2>nul
    )
    if "%FOUND_ELECTRON%"=="1" (
        %SystemRoot%\System32\taskkill.exe /IM electron.exe /F >nul 2>nul
    )
    echo [OK] 旧进程已结束
)

if "%MODE%"=="2" (
    echo [启动] 浏览器模式...
    call npm run dev
) else (
    echo [启动] 桌面模式...
    call npm run dev:electron
)

pause
