from sqlalchemy import Integer, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PushHistory(TimestampMixin, Base):
    __tablename__ = "push_history"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    push_date: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendations: Mapped[dict] = mapped_column(JSON, nullable=True)
    weak_points: Mapped[str] = mapped_column(Text, nullable=True)
    push_type: Mapped[str] = mapped_column(String(20), default="daily")
