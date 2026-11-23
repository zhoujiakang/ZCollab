export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  defaultTitle: (date: Date) => string;
  markdown: string;
}

const meeting: DocTemplate = {
  id: 'meeting',
  name: '会议记录',
  description: '按参会人、议题、结论与待办组织一次讨论',
  defaultTitle: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} 会议记录`;
  },
  markdown: `## 参会人

- 
- 

## 议题

1. 

## 讨论要点

> 

## 结论

- 

## 待办

| 事项 | 负责人 | 期限 |
| --- | --- | --- |
|  |  |  |`,
};

const prd: DocTemplate = {
  id: 'prd',
  name: '需求文档',
  description: '从背景、用户场景到验收标准梳理一个需求',
  defaultTitle: () => '需求文档',
  markdown: `# 需求文档

## 背景与目标

> 

## 用户场景

1. 

## 功能范围

- 
- 

## 验收标准

| 场景 | 预期结果 |
| --- | --- |
|  |  |`,
};

const weekly: DocTemplate = {
  id: 'weekly',
  name: '周报',
  description: '记录本周完成、进行中与下周计划',
  defaultTitle: () => '周报',
  markdown: `# 周报

## 本周完成

- 

## 进行中

| 事项 | 进度 | 风险 |
| --- | --- | --- |
|  |  |  |

## 下周计划

1. 

## 需要支持

> `,
};

const reading: DocTemplate = {
  id: 'reading',
  name: '读书笔记',
  description: '沉淀书目观点、摘录与自己的思考',
  defaultTitle: () => '读书笔记',
  markdown: `# 读书笔记

## 书目

> 

## 核心观点

- 
- 

## 摘录

> 

## 我的思考

1. 

---`,
};

export const DOC_TEMPLATES: DocTemplate[] = [meeting, prd, weekly, reading];
