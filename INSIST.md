# INSIST · 技能与经验

INSIST 是挂在 `/insist` 下的独立模块：技能卡、经验卡、成就卡、打卡与晋升。
它复用论坛的登录（`disi_token`），数据按 `user_id` 隔离，部署时不需要额外的服务或数据库。

## 一、页面

| 路径 | 内容 |
|---|---|
| `/insist` | 主页：成就滑墙、近期目标、14 天折线、今日打卡、进行中 |
| `/insist/collection` | 收藏室：全部技能卡，按重要程度 / 分类 / 难度阶分组 |
| `/insist/skill/:id` | 技能详情：进度、晋升清单、关联经验卡 |
| `/insist/cards` | 卡片库：进行中 / 已完成 / 已归档 |
| `/insist/card/:id` | 经验卡详情（打卡 / 任务 / 项目 / 成就） |
| `/insist/stats` | 打卡统计：每个打卡目标的近 14 天 |
| `/insist/achievements` | 成就墙 |
| `/insist/settings` | 图例、阈值、打卡数值、复习间隔（只读） |

入口：论坛「我的」页的 **TALENT / INSIST** 门 → `/dao` 长按开锁 → `/insist`。

## 二、后端

代码在 `backend/`：

| 文件 | 作用 |
|---|---|
| `insist_models.py` | 表：`insist_skills`、`insist_cards`、`insist_habit_logs`、`insist_xp_events` |
| `insist_rules.py` | 段位阈值、打卡递减、溢出倍率、晋升清单、遗忘度 |
| `insist_api.py` | `/api/insist` 路由 |
| `insist_schemas.py` | 请求模型 |
| `insist_ai.py` | AI 审核接口（预留，默认关闭） |

启动时 `database.init_db()` 会自动建表，不需要手工迁移。

### 接口一览

```
GET    /api/insist/skills                 技能列表（含进度、遗忘、爆满标记）
POST   /api/insist/skills                 新建技能
GET    /api/insist/skills/{id}
PATCH  /api/insist/skills/{id}
DELETE /api/insist/skills/{id}
GET    /api/insist/skills/{id}/promotion  晋升清单（按量）
POST   /api/insist/skills/{id}/promote    晋升

GET    /api/insist/cards?status=&kind=
POST   /api/insist/cards
GET    /api/insist/cards/{id}
PATCH  /api/insist/cards/{id}
DELETE /api/insist/cards/{id}
POST   /api/insist/cards/{id}/checkin     打卡（每日一次）
POST   /api/insist/cards/{id}/complete    任务 / 项目结算

GET    /api/insist/stats/checkins?days=14
GET    /api/insist/overview
POST   /api/insist/ai/review              AI 审核（预留）
```

全部需要 `Authorization: Bearer <disi_token>`。

### 核心规则

- 段位：初识 0 / 入门 100 / 熟练 300 / 精通 700 / 专家 1300；
- 打卡每日 XP：低阶 1.5、中阶 3.5、高阶 12、臻阶 24，按累计天数递减 1.0 → 0.85 → 0.62 → 0.45 → 0.30；
- 卡等级 ≥ 当前段位才能推进进度；否则只进溢出池；
- 段满未晋升：溢出池按 ×0.10 → ×0.05 → ×0.02 递减入账；
- 初识 → 入门 → 熟练：打卡自动晋升；
- 熟练 → 精通：高阶项目 ×1 + 中阶任务 ×3 + 小任务 ×5（成就可替代同等级项目）；
- 精通 → 专家：臻阶项目 ×1 + 高阶项目 ×2 + 高阶成就 ×1；
- 遗忘度 = 距上次活跃天数 / 复习间隔（次要 180 / 一般 120 / 重要 60 / 核心 30 天），可手动覆盖。

## 三、AI 审核（预留）

接口已经存在，但默认不调用任何外部模型：

```bash
export INSIST_AI_REVIEW=1        # 打开开关
export INSIST_AI_PROVIDER=deepseek
export INSIST_AI_MODEL=deepseek-chat
```

然后在 `backend/insist_ai.py` 的 `_call_provider()` 里补 HTTP 调用，返回：

```json
{ "verdict": "pass|reject|manual", "confidence": 0.8, "reasons": ["..."], "missing": ["..."] }
```

约束：AI 只给建议，不会直接改 XP 或段位；最终由人确认。

## 四、部署

`update.sh` 已经覆盖：同步 `backend/`、`npm run build`、重启服务。
新增的表会在后端启动时自动创建，无需额外步骤。

服务器上首次使用：

1. 登录 → 「我的」→ TALENT → 长按开锁 → 进入 `/insist`；
2. 收藏室「＋ 新建技能」添加第一个技能；
3. 卡片库「＋ 新建卡片」建打卡 / 任务 / 项目；
4. 之后每天在主页打卡，完成任务后点「完成」结算。

本地演示数据（只在开发库）：`local_dev/seed_insist.py`，执行：

```bash
DATABASE_URL=sqlite:///.../local_dev/disi_forum.db python local_dev/seed_insist.py
```
