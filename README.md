# 间奏

一个 macOS 桌面音乐控制器：用 Three.js 呈现透明唱片机，显示 Spotify 或 Apple Music 桌面应用的当前曲目，并提供播放、暂停、切歌、进度拖动和窗口置顶。唱片和灯光会根据专辑封面取色。

## 项目结构

- `work/app/main.js`：Electron 主进程，通过 macOS Automation 读取和控制音乐应用。
- `work/app/preload.js`、`renderer.js`：隔离的 IPC 接口与播放器状态同步。
- `work/app/src/turntable.js`：Three.js 场景、实体控件和射线交互的源码。
- `work/app/turntable.js`：已打包的浏览器脚本；修改场景源码后需要重新生成。
- `work/app/index.html`、`styles.css`：应用入口、键盘访问和 WebGL 不可用时的备用界面。
- `work/packaging/`：生成应用图标、临时签名和 DMG 的脚本。

## 操作

- 电机块上的按键：选择 Spotify 或 Apple Music、播放或暂停、上一首、下一首。
- 拖动唱臂调整进度，唱针从外圈走到内圈对应整首歌；点唱片中心的封面也可以播放或暂停。
- 左上角带图钉的按键让窗口保持置顶，旁边的灯管亮起表示已置顶。
- 键盘：空格播放或暂停；Tab 在按键和唱臂之间移动，焦点直接显示在机器上。回车或空格按下按键，方向键让唱针前后移动 5 秒，Home 回到开头。

## 本地开发

需要 macOS、Node.js、npm 和 Apple Command Line Tools。当前构建与安装包以 Apple 芯片 Mac 为目标。

安装用于生成 Three.js 浏览器脚本的依赖，并在修改场景源码后重新打包：

```sh
cd work/app
npm install
npm run build:turntable
cd ../..
```

安装 Electron 并运行应用：

```sh
npm install --prefix work/packaging --no-save --no-audit --no-fund electron@40.6.1
work/packaging/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron work/app
```

先打开 Spotify 或 macOS 的“音乐”应用并播放歌曲。首次连接时，macOS 可能要求授予自动化权限；如果之前拒绝，请在“系统设置 → 隐私与安全性 → 自动化”中检查。

## 打包

在项目根目录运行：

```sh
bash work/packaging/package.sh
```

脚本会在 `outputs/` 中生成 `间奏.dmg`。DMG 内含应用 ZIP 和安装说明；解压后将应用拖入“应用程序”。脚本使用临时签名，**没有 Developer ID 签名或 Apple 公证**，仅适合开发和测试；公开分发前需要配置正式签名、公证和发布流程。

## 当前范围

- 仅连接本机的 Spotify 和 Apple Music 桌面应用，不识别浏览器中的音频，也不录制系统声音。
- 首版没有收款、许可证或自动更新功能。Apple Music 的真实曲目、封面和完整播放控制仍需在有内容的环境中进一步验证。
- Three.js 的许可证保存在 `work/app/vendor/THREE-LICENSE.txt`。
