from typing import Optional
from fastapi import APIRouter, Depends, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.resource import ResourceDetail, FavoriteResponse
from app.schemas.common import UnifiedResponse
from app.api.deps import get_current_user
from app.models.user import User
from app.services import resource_service

router = APIRouter(prefix="/api/resources", tags=["资源推荐"])


class RecFavoriteRequest(BaseModel):
    recId: str = Field(..., description="推荐资源ID")
    title: str = Field(..., description="资源标题")
    platform: str = Field(..., description="来源平台")
    type: str = Field(..., description="资源类型")
    difficulty: str = Field(default="入门", description="难度")
    reason: str = Field(default="", description="推荐理由")
    url: str = Field(default="", description="资源链接")
    thumbnail: Optional[str] = Field(default=None, description="缩略图")


@router.get("", response_model=UnifiedResponse[dict])
async def list_resources(
    type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.get_resources(db, type, difficulty, tag, page, pageSize)
    return UnifiedResponse(data=data)


@router.get("/search", response_model=UnifiedResponse[dict])
async def search_resources(
    keyword: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.search_resources(db, keyword, page, pageSize)
    return UnifiedResponse(data=data)


@router.get("/favorites", response_model=UnifiedResponse[dict])
async def get_favorites(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.get_favorites(db, current_user.id, page, pageSize)
    return UnifiedResponse(data=data)


@router.post("/recommended/favorite", response_model=UnifiedResponse[FavoriteResponse])
async def toggle_recommended_favorite(
    req: RecFavoriteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.toggle_recommended_favorite(
        db,
        current_user.id,
        req.recId,
        req.title,
        req.platform,
        req.type,
        req.difficulty,
        req.reason,
        req.url,
        req.thumbnail,
    )
    return UnifiedResponse(data=data)


@router.get("/recommended/favorites", response_model=UnifiedResponse[dict])
async def get_recommended_favorites(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.get_recommended_favorites(db, current_user.id, page, pageSize)
    return UnifiedResponse(data=data)


@router.get("/{resource_id}", response_model=UnifiedResponse[ResourceDetail])
async def get_resource_detail(
    resource_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.get_resource_detail(db, resource_id)
    return UnifiedResponse(data=data)


@router.post("/{resource_id}/favorite", response_model=UnifiedResponse[FavoriteResponse])
async def toggle_favorite(
    resource_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await resource_service.toggle_favorite(db, current_user.id, resource_id)
    return UnifiedResponse(data=data)
