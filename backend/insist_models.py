"""
INSIST 数据模型
独立于论坛帖子表，按 user_id 归属到每个登录用户。
"""
from datetime import datetime, timezone, date

from sqlalchemy import Column, String, Text, Integer, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


def gen_id():
    import uuid
    return uuid.uuid4().hex[:12]


def now():
    return datetime.now(timezone.utc)


class InsistSkill(Base):
    __tablename__ = "insist_skills"

    id = Column(String(12), primary_key=True, default=gen_id)
    user_id = Column(String(12), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    category = Column(String(30), default="未分类")
    tier = Column(Integer, default=2)        # 难度阶 1-4
    importance = Column(Integer, default=2)  # 重要程度 1-4
    level = Column(Integer, default=0)       # 熟练度 0-4
    xp = Column(Float, default=0)
    overflow = Column(Float, default=0)      # 爆满后的溢出池
    overflow_since = Column(DateTime, nullable=True)
    forget_manual = Column(Integer, nullable=True)  # 手动覆盖遗忘度
    last_active = Column(DateTime, default=now)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)

    cards = relationship("InsistCard", back_populates="skill", cascade="all, delete-orphan")


class InsistCard(Base):
    __tablename__ = "insist_cards"

    id = Column(String(12), primary_key=True, default=gen_id)
    user_id = Column(String(12), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(String(12), ForeignKey("insist_skills.id", ondelete="CASCADE"), nullable=True)
    kind = Column(String(12), default="task")  # habit | task | project | achievement
    title = Column(String(120), nullable=False)
    detail = Column(Text, default="")
    tier = Column(Integer, default=2)          # 卡等级 1-4
    status = Column(String(12), default="active")  # active | done | archived
    progress = Column(Float, default=0)
    xp_value = Column(Float, default=0)
    cycle_days = Column(Integer, nullable=True)    # 打卡卡周期
    daily_target = Column(String(60), nullable=True)
    streak = Column(Integer, default=0)
    total_days = Column(Integer, default=0)
    last_checkin = Column(Date, nullable=True)
    phase = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)
    done_at = Column(DateTime, nullable=True)

    skill = relationship("InsistSkill", back_populates="cards")
    logs = relationship("InsistHabitLog", back_populates="card", cascade="all, delete-orphan")


class InsistHabitLog(Base):
    __tablename__ = "insist_habit_logs"
    __table_args__ = (UniqueConstraint("card_id", "day", name="uq_habit_card_day"),)

    id = Column(String(12), primary_key=True, default=gen_id)
    card_id = Column(String(12), ForeignKey("insist_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(12), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    day = Column(Date, nullable=False)
    base_xp = Column(Float, default=0)
    multiplier = Column(Float, default=1)
    xp = Column(Float, default=0)
    created_at = Column(DateTime, default=now)

    card = relationship("InsistCard", back_populates="logs")


class InsistXpEvent(Base):
    __tablename__ = "insist_xp_events"

    id = Column(String(12), primary_key=True, default=gen_id)
    user_id = Column(String(12), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(String(12), ForeignKey("insist_skills.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(String(12), nullable=True)
    source = Column(String(12), default="manual")  # habit | task | project | manual | promotion
    xp = Column(Float, default=0)
    note = Column(String(200), default="")
    occurred_on = Column(Date, default=date.today)
    created_at = Column(DateTime, default=now)
