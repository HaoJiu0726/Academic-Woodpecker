from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class UserGoal(TimestampMixin, Base):
    __tablename__ = "user_goals"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=30)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    goal_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
