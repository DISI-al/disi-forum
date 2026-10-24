"""INSIST 请求 / 响应模型"""
from typing import Optional, Literal

from pydantic import BaseModel, Field


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    category: str = "未分类"
    tier: int = Field(2, ge=1, le=4)
    importance: int = Field(2, ge=1, le=4)
    level: int = Field(0, ge=0, le=4)
    xp: float = Field(0, ge=0)


class SkillUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=60)
    category: Optional[str] = None
    tier: Optional[int] = Field(None, ge=1, le=4)
    importance: Optional[int] = Field(None, ge=1, le=4)
    level: Optional[int] = Field(None, ge=0, le=4)
    xp: Optional[float] = Field(None, ge=0)
    forget_manual: Optional[int] = Field(None, ge=0, le=100)


class CardCreate(BaseModel):
    kind: Literal["habit", "task", "project", "achievement"] = "task"
    title: str = Field(..., min_length=1, max_length=120)
    detail: str = ""
    tier: int = Field(2, ge=1, le=4)
    skill_id: Optional[str] = None
    xp_value: float = Field(0, ge=0)
    cycle_days: Optional[int] = Field(None, ge=1)
    daily_target: Optional[str] = None


class CardUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    detail: Optional[str] = None
    tier: Optional[int] = Field(None, ge=1, le=4)
    progress: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[Literal["active", "done", "archived"]] = None
    phase: Optional[str] = None
    xp_value: Optional[float] = Field(None, ge=0)


class AiReviewRequest(BaseModel):
    skill_id: str
    target_level: Optional[int] = Field(None, ge=0, le=4)
    note: str = ""
