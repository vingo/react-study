---
description: 周末项目日：升级贯穿项目 apps/kanban 并做周复盘。用法 /study-week 1
argument-hint: <周数 1-4>
---
第 $ARGUMENTS 周。

1. 读取 PLAN.md 中"贯穿项目"对应版本（v$ARGUMENTS）的目标和 PROGRESS.md。
2. 并行启动：
   - exercise-coach：在 apps/kanban/TASKS.md 中写出本周升级的任务清单和验收测试（只写任务和测试，不写实现）。
   - quiz-master：基于本周 5 个主题和薄弱点出 10 题周测，写入 notes/week$ARGUMENTS-quiz.md。
3. 学习者完成后，再次运行本命令时若检测到实现已存在，改为并行启动 code-reviewer 评审 apps/kanban 和 quiz-master 判周测。
