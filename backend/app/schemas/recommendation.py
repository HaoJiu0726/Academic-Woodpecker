"""推荐系统数据模型"""
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class RecommendationItem(BaseModel):
    """推荐资源项"""
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    resourceType: Optional[str] = None
    thumbnail: Optional[str] = None
    url: str
    matchScore: Optional[float] = None
    reason: Optional[str] = None


class RecommendationResponse(BaseModel):
    """推荐响应"""
    success: bool = True
    message: str = ""
    data: List[RecommendationItem] = Field(default_factory=list)


class PreferencesUpdateRequest(BaseModel):
    """偏好更新请求"""
    enableRecommendations: Optional[bool] = True
    preferredCategories: Optional[List[str]] = Field(default_factory=list)
    preferredDifficulties: Optional[List[str]] = Field(default_factory=list)
    excludeTypes: Optional[List[str]] = Field(default_factory=list)
    minMatchScore: Optional[int] = 30


class PreferencesResponse(BaseModel):
    """偏好响应"""
    success: bool = True
    message: str = ""
    data: PreferencesUpdateRequest