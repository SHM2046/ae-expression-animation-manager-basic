# AE 动画管理器：带回家继续开发

这是当前开发中的完整源码包。最简单的做法是把整个项目文件夹，或 `handoff` 文件夹内的 ZIP，带到家里的电脑后解压。

## 先看这两份文件

1. `docs/交接开发说明-2026-08-14.md`：当前进度、架构、限制、后续优先级。
2. `README.md`：安装和日常使用说明。

## 在家继续开发

1. 安装 Node.js 20+（用于本地静态测试）。
2. 打开项目根目录后执行：

   ```powershell
   npm test
   npm run lint
   ```

3. 需要在家里的 AE 试用时，双击 `一键安装AE动画管理器.cmd`；若脚本失败，按 `手动安装说明.md` 操作。
4. 每次改完 `client`、`host` 或 `CSXS` 后，运行 `scripts/sync-installed.ps1`，然后**完全重启 AE**。

## 本包包含什么

- `client/`：CEP 面板界面。
- `host/`：After Effects ExtendScript 逻辑和表达式写入。
- `CSXS/`：CEP 插件清单。
- `tests/`：不依赖 AE 的基本契约测试。
- `docs/`：交接与开发说明。
- `scripts/`：更新已安装插件、重新生成交接包。

当前工程还没有 Git 提交历史；回家后建议先创建一个私有 Git 仓库并做首次提交，避免后续界面迭代丢失。
