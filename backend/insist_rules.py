"""
INSIST 规则：段位、XP、递减、溢出、晋升清单、遗忘度
所有计算集中在这里，接口层只负责读写。
"""
from datetime import datetime, date, timezone

LEVELS = ['初识', '入门', '熟练', '精通', '专家']
LEVEL_MIN = [0, 100, 300, 700, 1300]
TIERS = ['低阶', '中阶', '高阶', '臻阶']
IMPORTANCE = ['次要', '一般', '重要', '核心']

DAILY_XP = {1: 1.5, 2: 3.5, 3: 12.0, 4: 24.0}
REVIEW_DAYS = {1: 180, 2: 120, 3: 60, 4: 30}     # 复习间隔（按重要程度）
STREAK_BONUS = {7: 20.0, 30: 80.0, 100: 300.0}   # 连续里程碑一次奖励


def segment_max(level: int):
    """当前段位的 XP 上限；专家段没有上限"""
    return LEVEL_MIN[level + 1] if level < len(LEVEL_MIN) - 1 else None


def segment_start(level: int) -> int:
    return LEVEL_MIN[level] if level < len(LEVEL_MIN) else LEVEL_MIN[-1]


def day_decay(total_days: int) -> float:
    """打卡天数的边际递减"""
    if total_days < 7:
        return 1.0
    if total_days < 30:
        return 0.85
    if total_days < 100:
        return 0.62
    if total_days < 200:
        return 0.45
    return 0.30


def overflow_rate(days_saturated: int) -> float:
    """爆满后的溢出倍率"""
    if days_saturated < 7:
        return 0.10
    if days_saturated < 30:
        return 0.05
    return 0.02


def days_between(a: date, b: date) -> int:
    return (b - a).days


def forget_percent(skill, today: date | None = None) -> int:
    """遗忘度：距上次活跃 / 复习间隔。手动值优先。"""
    if skill.forget_manual is not None:
        return int(skill.forget_manual)
    if not skill.last_active:
        return 0
    today = today or date.today()
    last = skill.last_active.date() if isinstance(skill.last_active, datetime) else skill.last_active
    days = max(0, (today - last).days)
    interval = REVIEW_DAYS.get(skill.importance, 120)
    return min(100, round(days / interval * 100))


def skill_level_ok(card_tier: int, skill_level: int) -> bool:
    """卡等级 >= 当前段位，才能推进进度（段位 1..4）"""
    return card_tier >= skill_level


def promotion_checklist(cards) -> dict:
    """
    按量晋升清单：统计已完成卡片。
    熟练 → 精通：高阶项目 1 + 中阶任务 3 + 小任务 5
    精通 → 专家：臻阶项目 1 + 高阶项目 2 + 高阶成就 1
    """
    done = [c for c in cards if c.status in ("done", "archived")]

    def count(kind, tier):
        return sum(1 for c in done if c.kind == kind and c.tier == tier)

    project_high = count("project", 3)
    project_expert = count("project", 4)
    task_mid = count("task", 2) + count("project", 2)
    task_low = count("task", 1)
    ach_high = count("achievement", 3) + count("achievement", 4)

    return {
        "to_master": [
            {"label": "高阶项目卡", "need": 1, "got": project_high},
            {"label": "中阶任务卡", "need": 3, "got": task_mid},
            {"label": "小任务卡", "need": 5, "got": task_low},
        ],
        "to_expert": [
            {"label": "臻阶项目卡", "need": 1, "got": project_expert},
            {"label": "高阶项目卡", "need": 2, "got": project_high},
            {"label": "高阶成就卡", "need": 1, "got": ach_high},
        ],
    }


def checklist_for_level(checklist: dict, level: int):
    if level == 2:
        return checklist["to_master"]
    if level == 3:
        return checklist["to_expert"]
    return []


def checklist_done(items) -> bool:
    return all(i["got"] >= i["need"] for i in items)


def apply_xp(skill, amount: float) -> dict:
    """
    把一笔 XP 写进技能：
    - 未满：加到段内，超出部分按溢出倍率
    - 已满：全部按溢出倍率
    返回实际入账明细。
    """
    now = datetime.now(timezone.utc)
    cap = segment_max(skill.level)
    result = {"progress": 0.0, "overflow": 0.0, "saturated": False}

    if cap is not None and skill.xp >= cap:
        # 已爆满
        if not skill.overflow_since:
            skill.overflow_since = now
        days = max(0, (now.date() - skill.overflow_since.date()).days)
        rate = overflow_rate(days)
        gained = round(amount * rate, 3)
        skill.overflow = round((skill.overflow or 0) + gained, 3)
        result.update(overflow=gained, saturated=True)
    else:
        room = amount
        if cap is not None:
            room = cap - skill.xp
        if amount <= room:
            skill.xp = round(skill.xp + amount, 3)
            result["progress"] = amount
        else:
            skill.xp = cap if cap is not None else skill.xp + amount
            result["progress"] = room if cap is not None else amount
            rest = amount - (room if cap is not None else amount)
            if rest > 0:
                skill.overflow_since = now
                skill.overflow = round((skill.overflow or 0) + rest, 3)
                result["overflow"] = round(rest, 3)
                result["saturated"] = True

    # 低段位（初识 → 入门 → 熟练）可以靠打卡直接晋升，不等考核
    while skill.level < 2:
        cap_now = segment_max(skill.level)
        if cap_now is None or skill.xp < cap_now:
            break
        transferred = skill.overflow or 0
        skill.level += 1
        skill.xp = round(segment_start(skill.level) + transferred, 3)
        skill.overflow = 0
        skill.overflow_since = None
        result["autoPromoted"] = True

    skill.last_active = now
    skill.updated_at = now
    return result
