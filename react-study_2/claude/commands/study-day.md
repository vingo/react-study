---
description: 开始某天的学习：并行生成讲义、练习和课前测验。用法 /study-day W1D1
argument-hint: <主题ID，如 W1D1>
---
主题 ID：$ARGUMENTS

1. 读取 PLAN.md 确认该主题存在；不存在则列出可用 ID 并停止。
2. 在同一条消息中并行启动以下三个子智能体（Task 工具），三者互不依赖，不要串行等待：
   - concept-tutor：生成 $ARGUMENTS 的讲义
   - exercise-coach：生成 $ARGUMENTS 的练习
   - quiz-master：出题 $ARGUMENTS
3. 全部完成后，用不超过 10 行汇总：讲义路径、三句话自测、练习运行命令、测验路径。
   提醒学习者按顺序：先答测验 → 读讲义 → 做练习 → 运行 /study-review $ARGUMENTS。
