"""API routes for today page (今日推送)."""

from fastapi import APIRouter, Depends, Path, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import UnifiedResponse
from app.schemas.today import (
    TodayPushData,
    TodayRecommendationsData,
    TodayProgressData,
    TodayGoalsData,
    GoalUpdateRequest,
    GoalCreateRequest,
    GoalEditRequest,
    StudySessionData,
    PushHistoryListData,
)
from app.api.deps import get_current_user
from app.models.user import User
from app.services import today_service

router = APIRouter(prefix="/api/today", tags=["今日推送"])


@router.get("/push", response_model=UnifiedResponse[TodayPushData])
async def get_push(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取今日推送头部信息（天气、建议时长、状态、增长率）"""
    data = await today_service.get_push(db, current_user.id)
    return UnifiedResponse(data=data)


@router.get("/recommendations", response_model=UnifiedResponse[TodayRecommendationsData])
async def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取个性化推荐内容（按类型分类）"""
    data = await today_service.get_recommendations(db, current_user.id)
    return UnifiedResponse(data=data)


@router.get("/progress", response_model=UnifiedResponse[TodayProgressData])
async def get_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取本周学习进度和趋势数据"""
    data = await today_service.get_progress(db, current_user.id)
    return UnifiedResponse(data=data)


@router.get("/goals", response_model=UnifiedResponse[TodayGoalsData])
async def get_today_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取今日学习目标（适配自当前学习计划）"""
    data = await today_service.get_today_goals(db, current_user.id)
    return UnifiedResponse(data=data)


@router.put("/goals/{goal_id}", response_model=UnifiedResponse)
async def update_goal(
    goal_id: str = Path(..., description="目标ID，格式 goal_{planId}_{taskIndex}"),
    req: GoalUpdateRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新今日目标的完成状态"""
    if req is None:
        req = GoalUpdateRequest()
    ok = await today_service.toggle_goal_completed(db, current_user.id, goal_id)
    if not ok:
        raise HTTPException(status_code=404, detail="目标不存在或无权操作")
    return UnifiedResponse(message="目标状态已更新")


@router.post("/goals", response_model=UnifiedResponse)
async def add_goal(
    req: GoalCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """添加自定义学习目标"""
    data = await today_service.add_goal(db, current_user.id, req.title, req.estimatedMinutes)
    return UnifiedResponse(data=data.model_dump(), message="目标已添加")


@router.patch("/goals/{goal_id}", response_model=UnifiedResponse)
async def edit_goal(
    goal_id: str = Path(..., description="目标ID"),
    req: GoalEditRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """编辑目标内容或学习时长"""
    if req is None:
        req = GoalEditRequest()
    ok = await today_service.edit_goal(db, current_user.id, goal_id, req.title, req.estimatedMinutes)
    if not ok:
        raise HTTPException(status_code=404, detail="目标不存在或无权操作")
    return UnifiedResponse(message="目标已更新")


@router.delete("/goals/{goal_id}", response_model=UnifiedResponse)
async def delete_goal(
    goal_id: str = Path(..., description="目标ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除学习目标"""
    ok = await today_service.delete_goal(db, current_user.id, goal_id)
    if not ok:
        raise HTTPException(status_code=404, detail="目标不存在或无权操作")
    return UnifiedResponse(message="目标已删除")


@router.post("/start-study", response_model=UnifiedResponse[StudySessionData])
async def start_study(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录用户开始学习，返回会话ID"""
    data = await today_service.start_study(db, current_user.id)
    return UnifiedResponse(data=data)


@router.get("/push-history", response_model=UnifiedResponse[PushHistoryListData])
async def get_push_history(
    limit: int = Query(7, ge=1, le=30, description="返回记录数"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取推送历史记录"""
    data = await today_service.get_push_history(db, current_user.id, limit)
    return UnifiedResponse(data=data)
