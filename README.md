# Excel BI Builder

积木式 Excel 可视化处理工具 —— 类 Tableau 的拖拽编码 BI。

基于 React + Electron 构建，网页端与桌面端共用同一套代码：网页端用 SheetJS 解析数据，桌面端用 DuckDB 向量化引擎处理百万行级数据。

## 功能特性

- **数据流画布**：节点式拖拽搭建数据处理流水线（数据源 → 筛选/计算/聚合/关联/合并 → 输出）
- **可视化仪表盘**：拖拽字段到编码槽，自由组合图表卡片（柱状/折线/面积混合组合图、地图）
- **模板复用**：流水线可保存/加载/导入/导出模板，支持一键替换数据源（按名字自动匹配）
- **导出 Excel**：把流水线结果一键导出为多 sheet 的 .xlsx 文件
- **导出 PPT**：基于 PPT 模板 + 上游数据，替换占位符生成 .pptx（文本/图表/表格/图片）

## 环境要求

- Node.js 18+
- 桌面端额外需要 Python 3.10+（含 `python-pptx`、`pandas`、`openpyxl`），并设置 `EXCEL2PPT_DIR` 指向 excel2ppt 的 `template_filler` 目录

## 快速开始

```bash
npm install          # 安装依赖（使用国内镜像）
npm run dev:web      # 网页版开发模式
npm run dev:electron # 桌面版开发模式
npm run build        # 构建网页版 + 桌面版
```

## 打包发布

```bash
npm run pack:win   # Windows 安装包
npm run pack:mac   # macOS
npm run pack:linux # Linux
```

## 下载分发

桌面版安装包通过以下渠道分发，国内用户建议优先使用阿里云服务器：

- **阿里云服务器（推荐，国内直连最快）**：`http://8.160.160.145/downloads/`
- **GitHub Releases（全球源，国内较慢）**：`https://github.com/hello-zhanghao/-excel/releases`

发布流程：打 tag（如 `v0.2.9`）push 后，GitHub Actions 会自动构建，并同时上传到 GitHub 以及阿里云服务器的 `/downloads/` 目录（无需手动操作）。

## 目录结构

```
├── src/              # 前端源码 (React + Vite)
│   ├── components/   # 组件（含数据流节点、仪表盘、模板管理等）
│   ├── lib/          # 引擎（数据源双端适配、PPT 模板填充、流水线引擎等）
│   ├── store/        # 全局状态 (Zustand)
│   └── types/        # 类型定义
├── electron/         # 桌面端主进程 (Electron + DuckDB + Python 调用)
├── dist/             # 网页版构建产物
└── dist-electron/    # 桌面版构建产物
```

## 版本记录

### v0.2.9 (2026-08-08)

- feat: 新增「导出 PPT」数据流节点，基于 PPT 模板 + 上游数据替换占位符生成 .pptx
  - 桌面端通过 Electron IPC 调用本地 Python（excel2ppt 的 `template_filler`）真正替换
  - 网页端支持上传模板与配置预览，实际生成需桌面版
  - 支持多上游作为多个数据区块、输出文件名、时间戳、缺失标注
- 新增 `lib/pptTemplateEngine.ts` 双端适配器、`electron/pptService.ts` 主进程服务
- 新增 Electron IPC：`ppt:openTemplate` / `ppt:generate` / `ppt:engineStatus`

### v0.2.8 (未发布)

- feat: 一键替换数据源 —— 选择文件夹，按名字自动匹配（归一化相等 > 双向包含 > 编辑距离），人工确认后批量替换
- 新增 `lib/dataSourceMatcher.ts` 匹配算法、`DataSourceReplaceDialog` 弹窗