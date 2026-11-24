<p align="center">
  <a href="https://docs.zzzink.cn">
    <img src="./.github/assets/readme-cover.svg" alt="ZCollab — 让想法成文，让协作发生" width="100%" />
  </a>
</p>

<p align="center">个人开发的在线文档协作项目，用来记录、整理，也用来一起写作。</p>

<p align="center">
  <a href="https://docs.zzzink.cn"><strong>在线体验 ↗</strong></a> ·
  <a href="#界面预览">界面预览</a> ·
  <a href="#功能亮点">功能亮点</a> ·
  <a href="#技术实现">技术实现</a> ·
  <a href="https://github.com/zhoujiakang/ZCollab/issues">反馈与建议</a>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-74dfc7?style=flat-square&amp;labelColor=172b3a" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&amp;labelColor=172b3a" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&amp;labelColor=172b3a" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Java-21-ed9b40?style=flat-square&amp;labelColor=172b3a" alt="Java 21" />
  <img src="https://img.shields.io/badge/Powered_by-Yjs-b8a6fa?style=flat-square&amp;labelColor=172b3a" alt="Powered by Yjs" />
</p>

---

## 界面预览

页面树、富文本编辑器与文档目录，在一个界面里完成整理和写作。

![ZCollab 浅色主题：页面树、富文本编辑器与文档目录](./.github/assets/editor-light.jpg)

## 功能亮点

### ✍️ 多人一起写

同时编辑同一份文档，实时查看彼此的光标与在线状态。选中文字就能发起评论，在对应的内容旁回复、讨论和标记解决。

### 🗂️ 从一页笔记到一个知识库

通过工作区与嵌套页面树整理内容，拖拽排序或移动文档。用全文搜索查找标题和正文，通过收藏与最近访问回到常用页面。

### 🧩 让写作顺手一些

支持标题、列表、引用、代码高亮、表格、图片和附件，通过斜杠命令插入内容。内置会议记录、需求文档、周报、读书笔记等模板，也支持 Markdown 导入导出、命令面板、快捷键与明暗主题。

### 🔗 写完之后，分享出去

用公开链接分享一份文档，或通过邀请链接让其他人加入工作区，一起维护内容。

### 协作与讨论实景

深色主题下的评论面板与协作光标。截图使用同一演示账号的两个窗口，展示实时同步与选区状态。

![ZCollab 深色主题：双窗口在线状态、协作选区与文档评论](./.github/assets/collaboration-dark.jpg)

<sub>以上均为线上实际界面，文档与评论是为项目展示创建的示例内容。</sub>

## 技术实现

这个项目的一项主要实践是：**用 Java 实现与 y-websocket 客户端对接的协作同步服务**，把实时编辑接入 Spring Boot 业务系统。

- **同步协议**：处理 Yjs 同步握手与增量消息，按文档房间广播变更，转发光标和在线状态。
- **持久化与恢复**：将二进制增量写入 PostgreSQL；新连接通过快照和后续增量重放恢复文档，快照收缩后清理已覆盖的增量。
- **访问校验**：协作连接校验登录态、工作区成员身份与文档归属，和业务接口使用同一套身份体系。

文档变更的合并由客户端 **Yjs** 完成，富文本编辑基于 **Tiptap**。

```mermaid
flowchart TB
    A["编辑者 A · Tiptap / Yjs"] <-->|WebSocket| S["Spring Boot<br/>协作同步服务"]
    B["编辑者 B · Tiptap / Yjs"] <-->|WebSocket| S
    S --> P[("PostgreSQL<br/>文档快照与增量")]
    classDef editor fill:#eef9f5,stroke:#69baa5,color:#183a38
    classDef server fill:#eef2fb,stroke:#8c9bc8,color:#253652
    classDef storage fill:#f4f0fc,stroke:#ab98d5,color:#403359
    class A,B editor
    class S server
    class P storage
```

| 层次 | 技术选型 |
| --- | --- |
| 界面与交互 | React · TypeScript · Vite · Mantine · dnd-kit |
| 编辑与协作 | Tiptap · Yjs · y-websocket · lowlight |
| 业务与认证 | Spring Boot · MyBatis-Plus · Sa-Token |
| 数据存储 | PostgreSQL · Redis |

<details>
<summary>浏览源码结构</summary>

```text
ZCollab
├── client/src/
│   ├── components/   编辑器、页面树、评论与应用布局
│   ├── collab/       Yjs 文档与 WebSocket 连接
│   ├── pages/        登录、工作区与设置页面
│   └── lib/          Markdown、模板与文档工具
├── server/
│   ├── src/main/    业务接口、协作协议与持久化实现
│   ├── src/test/    后端单元测试
│   └── sql/         数据库脚本
└── docs/            项目文档与开发记录
```

</details>

## 交流与反馈

ZCollab 是我的个人开源项目，从编辑器、工作区到协作同步逐步实现，目前仍在持续完善。

欢迎通过 [Issues](https://github.com/zhoujiakang/ZCollab/issues) 反馈问题、分享使用感受，或提出想看到的功能。如果这个项目对你有帮助，也欢迎留一颗 Star。

项目基于 [MIT License](./LICENSE) 开源。

<p align="center">
  <sub>由 <a href="https://github.com/zhoujiakang">zhoujiakang</a> 开发 · <a href="https://docs.zzzink.cn">去写下第一个想法 ↗</a></sub>
</p>
