from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, join
from app.models.resource import Resource, UserFavorite, RecommendedFavorite
from app.schemas.resource import ResourceItem, ResourceDetail, FavoriteResponse
from fastapi import HTTPException


def _parse_tags(tags) -> List[str]:
    """Normalize tags field to List[str]."""
    if tags is None:
        return []
    if isinstance(tags, list):
        return tags
    if isinstance(tags, str):
        return [tags]
    return []


def _enum_value(v) -> str:
    """Extract .value from enum members, pass through otherwise."""
    return v.value if hasattr(v, "value") else str(v)


def _to_resource_item(r: Resource) -> ResourceItem:
    """Convert a Resource model instance to ResourceItem schema."""
    return ResourceItem(
        id=r.id,
        title=r.title,
        platform=r.platform,
        platformColor=getattr(r, "platform_color", None),
        type=_enum_value(r.type),
        rating=r.rating,
        reason=r.reason,
        summary=r.summary,
        tags=_parse_tags(r.tags),
        difficulty=_enum_value(r.difficulty),
        url=r.url,
        thumbnail=r.thumbnail,
        aiRecommend=True,
    )


async def get_resources(
    db: AsyncSession,
    type_filter: Optional[str] = None,
    difficulty: Optional[str] = None,
    tag: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """Get paginated resource list with optional filters."""
    query = select(Resource)

    if type_filter:
        query = query.where(Resource.type == type_filter)
    if difficulty:
        query = query.where(Resource.difficulty == difficulty)
    if tag:
        query = query.where(Resource.tags.contains(tag))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0

    # Get page
    query = query.order_by(desc(Resource.rating)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    resources = result.scalars().all()

    items = [_to_resource_item(r) for r in resources]

    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "resources": [item.model_dump() for item in items],
    }


async def toggle_recommended_favorite(
    db: AsyncSession,
    user_id: int,
    rec_id: str,
    title: str,
    platform: str,
    rec_type: str,
    difficulty: str = "入门",
    reason: str = "",
    url: str = "",
    thumbnail: str = None,
) -> FavoriteResponse:
    result = await db.execute(
        select(RecommendedFavorite).where(
            RecommendedFavorite.user_id == user_id,
            RecommendedFavorite.rec_id == rec_id,
        )
    )
    fav = result.scalar_one_or_none()

    if fav:
        await db.delete(fav)
        await db.commit()
        return FavoriteResponse(favorited=False, resourceId=rec_id)
    else:
        new_fav = RecommendedFavorite(
            user_id=user_id,
            rec_id=rec_id,
            title=title,
            platform=platform,
            type=rec_type,
            difficulty=difficulty,
            reason=reason,
            url=url,
            thumbnail=thumbnail,
        )
        db.add(new_fav)
        await db.commit()
        return FavoriteResponse(favorited=True, resourceId=rec_id)


async def get_recommended_favorites(
    db: AsyncSession, user_id: int, page: int = 1, page_size: int = 10
) -> dict:
    query = select(RecommendedFavorite).where(
        RecommendedFavorite.user_id == user_id
    )

    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0

    query = query.order_by(desc(RecommendedFavorite.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size)
    result = await db.execute(query)
    favs = result.scalars().all()

    items = []
    for fav in favs:
        items.append({
            "id": fav.rec_id,
            "title": fav.title,
            "platform": fav.platform,
            "type": fav.type,
            "difficulty": fav.difficulty,
            "reason": fav.reason,
            "url": fav.url,
            "thumbnail": fav.thumbnail,
        })

    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "resources": items,
    }


async def is_recommended_favorited(
    db: AsyncSession, user_id: int, rec_id: str
) -> bool:
    result = await db.execute(
        select(RecommendedFavorite).where(
            RecommendedFavorite.user_id == user_id,
            RecommendedFavorite.rec_id == rec_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_resource_detail(db: AsyncSession, resource_id: int) -> ResourceDetail:
    """Get resource detail and increment view count."""
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    # Increment view count
    resource.view_count = (resource.view_count or 0) + 1
    await db.commit()

    return ResourceDetail(
        id=resource.id,
        title=resource.title,
        platform=resource.platform,
        type=_enum_value(resource.type),
        rating=resource.rating,
        reason=resource.reason,
        summary=resource.summary,
        tags=_parse_tags(resource.tags),
        difficulty=_enum_value(resource.difficulty),
        url=resource.url,
        thumbnail=resource.thumbnail,
        viewCount=resource.view_count or 0,
        createdAt=resource.created_at.strftime("%Y-%m-%d") if resource.created_at else None,
    )


async def search_resources(
    db: AsyncSession,
    keyword: str,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """Search resources by keyword in title, summary, or reason, plus generate online results."""
    search_pattern = f"%{keyword}%"
    query = select(Resource).where(
        or_(
            Resource.title.ilike(search_pattern),
            Resource.summary.ilike(search_pattern),
            Resource.reason.ilike(search_pattern),
        )
    )

    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    db_total = result.scalar() or 0

    query = query.order_by(desc(Resource.rating)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    resources = result.scalars().all()

    items = [_to_resource_item(r) for r in resources]

    online_items = _generate_online_search_results(keyword)
    all_items = items + online_items

    return {
        "total": db_total + len(online_items),
        "page": page,
        "pageSize": page_size,
        "resources": [item.model_dump() for item in all_items[:page_size]],
    }


def _generate_online_search_results(keyword: str) -> list:
    from app.schemas.today import RecommendationItem
    from app.services.today_service import TYPE_LABEL_MAP, PLATFORM_MAP

    items = []
    for r_type, (platform, url_base) in PLATFORM_MAP.items():
        items.append(RecommendationItem(
            id=f"search_{r_type}_{keyword[:10]}",
            type=r_type,
            typeLabel=TYPE_LABEL_MAP.get(r_type, "资源"),
            difficulty="中级",
            title=f"搜索「{keyword}」相关{TYPE_LABEL_MAP.get(r_type, '资源')}",
            platform=platform,
            duration=None,
            reason=f"在{platform}上搜索与「{keyword}」相关的{TYPE_LABEL_MAP.get(r_type, '资源')}",
            url=f"{url_base}{keyword}",
            thumbnail=None,
        ))
    return items


async def toggle_favorite(db: AsyncSession, user_id: int, resource_id: int) -> FavoriteResponse:
    """Toggle favorite status for a resource."""
    # Check resource exists
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    # Check if already favorited
    result = await db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == user_id,
            UserFavorite.resource_id == resource_id,
        )
    )
    fav = result.scalar_one_or_none()

    if fav:
        await db.delete(fav)
        await db.commit()
        return FavoriteResponse(favorited=False, resourceId=resource_id)
    else:
        new_fav = UserFavorite(user_id=user_id, resource_id=resource_id)
        db.add(new_fav)
        await db.commit()
        return FavoriteResponse(favorited=True, resourceId=resource_id)


async def get_favorites(db: AsyncSession, user_id: int, page: int = 1, page_size: int = 10) -> dict:
    """Get user's favorited resources."""
    query = (
        select(Resource)
        .select_from(join(Resource, UserFavorite, Resource.id == UserFavorite.resource_id))
        .where(UserFavorite.user_id == user_id)
    )

    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0

    query = query.order_by(desc(UserFavorite.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    resources = result.scalars().all()

    items = [_to_resource_item(r) for r in resources]

    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "resources": [item.model_dump() for item in items],
    }
