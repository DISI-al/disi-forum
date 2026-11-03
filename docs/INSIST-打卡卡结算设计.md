# INSIST · 打卡卡结算与进化 设计方案（v3）

> 拍板人：DISI　·　v2: 2026-11-03　·　v3: 2026-11-04
> 状态：设计已确认，周末实施

## 0. 术语与底层字段（v3 变化：改名）

| 叫法 | 含义 | 字段值 |
|---|---|---|
| **打卡卡** | 按天打卡的卡 | `kind = 'checkin'`（原 `habit`，本次改名） |
| **任务卡** | 一次性完成、有交付物的卡 | `kind = 'task'` |
| **项目卡** | 分阶段结算的卡 | `kind = 'project'` |
| **成就卡** | 系统发放的里程碑 | `kind = 'achievement'` |

> 决定：`habit` 是无意义的历史命名，直接改成 `checkin`，**同时改数据库**（见第 8 节迁移脚本）。

## 1. 核心原则

1. **系统不碰技能重要度**。重要度由用户按当前阶段和外部环境自行判断。
2. **结算只结算经验值**：锁定该卡已产出的 XP，卡片退场，后续不再产生 XP。
3. **打卡卡结算后 = 一张已完成的「任务卡」**：
   - 从「今日打卡」「进行中」消失；
   - 进入技能的「关联经验卡」→ 已完成，仍可查到「30 天打卡（连续 30 天）」的记录。
4. **成就由系统按标准发放，且分等级**（tier 1–4），详见第 6 节（含独立成就系统待办）。
5. **经验卡**：技能详情页展示该技能下所有卡（进行中 + 已完成），结算后的打卡卡就是其中一张已完成的任务卡。

## 2. 状态机

```
                  ┌── 连续满 cycle_days ──► 自动结算（完美）
active(打卡卡) ───┤
                  ├── 累计满 cycle_days ──► 自动结算（补满）
                  │
                  └── 手动「提前结算」───► 手动结算（自填详情）
                                │
                                ▼
                    原地转换：kind → task, status → done
                    detail ← 用户自填 / 自动生成「30 天打卡（连续 30 天）」
                    xp 锁定为累计值；settled_at / settle_reason 落库
                    → 技能「关联经验卡」可见，打卡列表消失
```

## 3. 判定规则

| 路径 | 判定 | 成就档位 |
|---|---|---|
| **完美** | `streak ≥ cycle_days` | 最高档（如 30 天 → tier 3） |
| **补满** | `total_days ≥ cycle_days`（断过但总量够） | 低一档 |
| **手动** | 任意时刻，`total_days ≥ 1` | 只给「阶段成果」档 |

触发点：打卡成功后立即判断并结算；手动结算在详情页按钮触发。

## 4. 卡片字段变化

```
kind:          checkin → task
status:        active → done
title:         不变（例：计算机学习）
detail:        用户自填；留空则自动生成「30 天打卡（连续 30 天，累计 30 天）」
xp_value:      锁定为打卡累计 XP
locked_xp:     同上（快照）
settled_at:    结算时间
settle_reason: perfect | filled | manual
```

结算后：**不能打卡、不能完成、不能改周期**，只允许删除。

## 5. 接口

```
POST /cards/{id}/settle
  body: { detail?: string }          # 手动结算：详情自填，选填
  → { card, lockedXp, awards: [...] }

POST /cards/{id}/checkin
  → 原有字段 + { settled: false | { path: 'perfect'|'filled', card, awards } }

GET /cards?kind=checkin&status=active
GET /cards?status=done
```

## 6. 成就系统（大待办，独立设计）

### 6.1 现状

- 只有零散调用 `_award()`：连续 7/30/100 天、累计 30/100/150/200 天；
- 没有统一的成就定义表、没有"首个项目完成""首张任务卡完成"这类首次类成就；
- 成就墙只是把所有 `kind='achievement'` 的卡列出来，没有分组和进度。

### 6.2 目标（仿游戏成就系统）

1. **定义驱动**：所有成就写在一张表里（或代码常量表），字段：
   `id / 名称 / 描述 / 分类 / tier(1-4) / 条件类型 / 阈值 / 隐藏?`
2. **事件驱动发放**：业务动作触发事件 → 成就引擎匹配 → 去重发放 → 写 `InsistCard(kind='achievement')`；
3. **覆盖全部行为**，不只打卡：

| 分类 | 示例成就 | tier |
|---|---|---|
| 打卡 | 连续 7/30/100 天、累计 30/100/150/200 天、周期全满 30 天 | 1–4 |
| 任务 | **首次完成任务卡**、完成 10 张任务卡 | 1–3 |
| 项目 | **首个项目完成**、首个臻阶项目完成 | 2–4 |
| 技能 | 首次晋升、达到"专家"、单技能 XP 破千 | 2–4 |
| 记录 | 首次发帖到论坛、发满 10 篇周报 | 1–2 |
| 隐藏 | 凌晨打卡、连续 30 天零中断等 | 1–4 |

4. **成就墙升级**：按分类分组、按 tier 排序、未解锁显示灰色轮廓 + 达成进度（如 3/10）。

### 6.3 与本次结算的关系

- 结算事件（perfect / filled / manual）作为成就引擎的输入事件之一；
- 引擎实现后，现有的 7/30/100 散装调用一并迁入定义表，避免两套逻辑。

## 7. 已确认事项（v4）

| 问题 | 结论 |
|---|---|
| 结算是否发额外 XP | **不发** |
| 手动结算是否必填理由 | 不填理由，改为**自填详情**（选填，留空则自动生成） |
| 已结算卡能否复活 | 不能，只能新建 |
| 系统是否改重要度 | **不改**，永远由用户决定 |
| `habit` 是否改名 | **改**，统一为 `checkin`（含数据库） |
| 表名是否一起改 | **改**：`insist_habit_logs` → `insist_checkin_logs` |
| `cycle_days` 是否必填 | **必填**：前端不给默认值，后端 schema 与模型都要求非空 |

## 8. 数据库迁移（SQLite）

```sql
-- 1) 卡片类型改名
UPDATE insist_cards SET kind = 'checkin' WHERE kind = 'habit';
-- 2) 结算字段
ALTER TABLE insist_cards ADD COLUMN settle_reason VARCHAR(12);
ALTER TABLE insist_cards ADD COLUMN settled_at DATETIME;
ALTER TABLE insist_cards ADD COLUMN locked_xp FLOAT;
-- 3) 打卡日志表改名 + 唯一约束（防多设备同日重复）
ALTER TABLE insist_habit_logs RENAME TO insist_checkin_logs;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_log_card_day ON insist_checkin_logs (card_id, day);
-- 4) 周期必填（历史空值先补 30）
UPDATE insist_cards SET cycle_days = 30 WHERE kind = 'checkin' AND cycle_days IS NULL;
```

代码侧需要同步的位置（全部 `habit` 出现点）：

- `insist_models.py`（注释）、`insist_schemas.py`（kind 校验枚举）、`insist_api.py`（`card.kind == 'habit'` 判断、overview 统计、checkin 校验）；
- `insist_rules.py`（`promotion_checklist` 里 `count(kind, tier)` 的 kind 字符串）；
- 前端：`InsistCards.vue`（创建选项、筛选）、`InsistCardDetail.vue`（打卡区块、旧文案）、`Insist.vue`（今日打卡）、`InsistSkill.vue`（关联经验卡）。

## 9. 改名影响面清单（实测 59 处）

| 文件 | 处数 | 说明 |
|---|---|---|
| `insist_app/src/views/Insist.vue` | 23 | 今日打卡、变量名 `habits`、模板文案 |
| `backend/insist_api.py` | 13 | kind 判断、overview 统计、XP 事件 source |
| `insist_app/src/views/InsistCardDetail.vue` | 6 | 打卡区块、旧规则文案 |
| `backend/insist_models.py` | 6 | 类名 `InsistHabitLog`、注释 |
| `insist_app/src/views/InsistCards.vue` | 5 | 创建选项、筛选 |
| `backend/main.py` | 2 | 统计/导出引用 |
| `insist_app/src/views/InsistSkill.vue` | 2 | 技能详情卡列表 |
| `backend/database.py` | 1 | 建表清单 |
| `backend/insist_schemas.py` | 1 | kind 枚举校验 |

**改名策略（建议）**

1. 值改名：`kind: 'habit' → 'checkin'`（数据库 UPDATE + 代码常量）；
2. 表名不动（`insist_habit_logs` 保留，避免大面积 SQL 改动）—— 或者趁这次一起改成 `insist_checkin_logs`，需要同步 models/查询/迁移；
3. XP 事件的 `source` 字段：`'habit' → 'checkin'`（历史数据一起 UPDATE）；
4. 前端变量名 `habits → checkins`，文案「习惯卡」→「打卡卡」。

> 表名是否一起改，待确认（改的话影响 3 处查询 + 1 处建表 + 1 处导出）。

## 10. 实施顺序（周末）

1. **迁移**：跑 SQL + 代码里 `habit → checkin`；
2. **规则函数**：`settle_path(card)` / `settle_xp(card)`；
3. **后端结算**：`POST /cards/{id}/settle`，checkin 内触发自动结算；
4. **前端**：提前结算按钮 + 结算弹窗（可填详情）、卡片页 tab、技能「关联经验卡」；
5. **清旧文案**：删掉「重要度 −1」那半句；
6. **成就系统**（独立排期，见第 6 节）。
