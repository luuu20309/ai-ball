# AI Ball - 桌面 AI 助手小球

一个基于 Tauri 构建的桌面悬浮球 AI 助手，支持液态玻璃风格 UI 和 Markdown 渲染。

## 功能特点

- 桌面悬浮球，可拖拽移动
- 液态玻璃风格 UI
- 支持 OpenAI 兼容 API
- 流式响应，实时显示
- Markdown 渲染（标题、代码块、表格等）
- API 配置自动保存
- 系统托盘支持

## 安装

### 下载安装包

从 Release 页面下载对应系统的安装包：

- Windows: `ai-ball_0.1.0_x64-setup.exe` 或 `ai-ball_0.1.0_x64_en-US.msi`

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/luuu20309/ai-ball.git
cd ai-ball

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 打包
npm run tauri build
```

## 使用说明

1. 启动应用后，桌面会出现一个紫色悬浮球
2. 点击悬浮球打开对话面板
3. 点击右上角齿轮图标配置 API：
   - API URL：OpenAI 兼容 API 地址
   - API Key：你的 API 密钥
   - Model：模型名称
4. 输入问题开始对话

## 技术栈

- **前端**: HTML, CSS, JavaScript
- **后端**: Rust (Tauri v2)
- **API**: OpenAI 兼容接口
- **Markdown**: marked.js

## 项目结构

```
ai-ball/
├── src/                    # 前端代码
│   ├── index.html         # 主页面
│   ├── styles.css         # 样式
│   └── app.js             # 前端逻辑
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── main.rs        # 入口
│   │   ├── lib.rs         # 主逻辑
│   │   ├── commands.rs    # API 命令
│   │   └── tray.rs        # 系统托盘
│   └── Cargo.toml         # Rust 依赖
└── package.json
```

## 许可证

MIT
