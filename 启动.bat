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

if "%MODE%"=="2" (
    echo [启动] 浏览器模式...
    call npm run dev
) else (
    echo [启动] 桌面模式...
    call npm run dev:electron
)

pause
