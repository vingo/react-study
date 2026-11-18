---
description: 结束某天的学习：并行执行代码评审和测验判卷，并更新进度。用法 /study-review W1D1
argument-hint: <主题ID，如 W1D1>
---
主题 ID：$ARGUMENTS

1. 在同一条消息中并行启动两个子智能体（Task 工具）：
   - code-reviewer：评审 exercises/$ARGUMENTS（忽略 solutions/）
   - quiz-master：判卷 $ARGUMENTS
2. 汇总：测验得分、评审中的"严重"问题、掌握度、写入 PROGRESS.md 的薄弱点。
3. 若掌握度为"需要重练"或得分 < 80%，建议明天先重做该主题的练习，再进入下一个主题。
