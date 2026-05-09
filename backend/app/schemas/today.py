"""Pydantic schemas for today page endpoints."""
from typing import List, Optional, Any
from pydantic import BaseModel, Field


class TodayPushData(BaseModel):
    date: str = Field(description="今日日期 YYYY-MM-DD")
    weather: str = Field(description="天气（晴/多云/雨等）")
    suggestedStudyHours: int = Field(description="建议学习时长（小时）")
    status: str = Field(description="学习状态（最佳/良好/一般）")
    weeklyGrowthRate: float = Field(description="较上周增长率")
    hasKnowledgeData: bool = Field(default=False, description="是否有知识点数据（已上传文件并完成分析）")


class RecommendationItem(BaseModel):
    id: Optional[str] = Field(None, description="资源唯一标识")
    type: str = Field(description="资源类型：video/exercise/article")
    typeLabel: str = Field(description="显示标签：视频/练习/文章")
    difficulty: str = Field(description="难度：入门/中级/进阶")
    title: str = Field(description="资源标题")
    platform: str = Field(description="来源平台")
    duration: Optional[str] = Field(None, description="时长或题数")
    reason: str = Field(description="推荐理由")
    url: str = Field(description="资源链接")
    thumbnail: Optional[str] = Field(None, description="缩略图 URL")


class TodayRecommendationsData(BaseModel):
    recommendations: List[RecommendationItem] = []
    hasKnowledgeData: bool = Field(default=False, description="是否有知识点数据")


class WeeklyTrendItem(BaseModel):
    day: str = Field(description="星期简写 Mon/Tue/...")
    hours: float = Field(description="当天学习时长")
    isToday: bool = Field(description="是否为今天")


class TodayProgressData(BaseModel):
    weeklyStudyHours: float = Field(description="本周总学习时长（小时）")
    weeklyGrowthRate: float = Field(description="较上周增长率")
    knowledgeRate: float = Field(description="当前知识点掌握率")
    knowledgeGrowthRate: float = Field(description="掌握率较上周提升")
    weeklyTrend: List[WeeklyTrendItem] = Field(default_factory=list)


class TodayGoalItem(BaseModel):
    id: str = Field(description="目标ID")
    title: str = Field(description="任务标题")
    estimatedMinutes: int = Field(description="预计耗时（分钟）")
    completed: bool = Field(description="是否完成")


class TodayGoalsData(BaseModel):
    planId: Optional[int] = None
    todayGoals: List[TodayGoalItem] = []
    studyTips: List[str] = []


class GoalUpdateRequest(BaseModel):
    completed: bool = True


class GoalCreateRequest(BaseModel):
    title: str = Field(description="目标标题")
    estimatedMinutes: int = Field(default=30, description="预计耗时（分钟）")


class GoalEditRequest(BaseModel):
    title: Optional[str] = Field(None, description="目标标题")
    estimatedMinutes: Optional[int] = Field(None, description="预计耗时（分钟）")


class StudySessionData(BaseModel):
    sessionId: str = Field(description="学习会话ID")


class PushHistoryItem(BaseModel):
    pushDate: str = Field(description="推送日期")
    recommendations: List[Any] = Field(default_factory=list, description="推送的推荐内容")
    weakPoints: List[str] = Field(default_factory=list, description="当日薄弱知识点")
    createdAt: Optional[str] = Field(None, description="创建时间")


class PushHistoryListData(BaseModel):
    history: List[PushHistoryItem] = []
