"""推荐系统API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.services.recommendation_service import (
    get_recommendations,
    get_user_recommendation_preferences,
    update_user_recommendation_preferences,
    update_resource_views,
)
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationItem,
    PreferencesResponse,
    PreferencesUpdateRequest,
)
from app.core.logging import get_logger

logger = get_logger("recommendation_api")

router = APIRouter(prefix="/recommendations", tags=["推荐系统"])


@router.get("/", response_model=RecommendationResponse)
async def get_user_recommendations(
    limit: int = Query(6, ge=1, le=20),
    exclude: Optional[List[int]] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户个性化推荐资源"""
    logger.info(f"获取推荐资源: user_id={current_user.id}, limit={limit}")
    recommendations = await get_recommendations(db, current_user.id, limit, exclude)
    return RecommendationResponse(
        success=True,
        message="推荐资源获取成功",
        data=recommendations,
    )


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户推荐偏好设置"""
    preferences = await get_user_recommendation_preferences(db, current_user.id)
    return PreferencesResponse(
        success=True,
        message="偏好设置获取成功",
        data=preferences,
    )


@router.put("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    request: PreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新用户推荐偏好设置"""
    preferences = await update_user_recommendation_preferences(
        db, current_user.id, request.model_dump()
    )
    return PreferencesResponse(
        success=True,
        message="偏好设置更新成功",
        data=preferences,
    )


@router.post("/{resource_id}/view")
async def record_resource_view(
    resource_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录资源访问（用于更新热度）"""
    await update_resource_views(db, resource_id)
    return {"success": True, "message": "访问记录成功"}