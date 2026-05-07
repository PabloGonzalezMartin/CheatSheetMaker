from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, LargeBinary, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship, mapped_column, Mapped
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cheatsheets: Mapped[list["Cheatsheet"]] = relationship(
        "Cheatsheet", back_populates="owner", cascade="all, delete-orphan"
    )
    groups: Mapped[list["Group"]] = relationship(
        "Group", back_populates="owner", cascade="all, delete-orphan"
    )

class Cheatsheet(Base):
    __tablename__ = "cheatsheets"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    group_id: Mapped[str | None] = mapped_column(
        String(100), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner: Mapped["User"] = relationship("User", back_populates="cheatsheets")
    group: Mapped["Group | None"] = relationship("Group", back_populates="cheatsheets")
    images: Mapped[list["Image"]] = relationship(
        "Image", back_populates="cheatsheet", cascade="all, delete-orphan"
    )

class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#667eea")

    owner: Mapped["User"] = relationship("User", back_populates="groups")
    cheatsheets: Mapped[list["Cheatsheet"]] = relationship("Cheatsheet", back_populates="group")

class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cheatsheet_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("cheatsheets.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cheatsheet: Mapped["Cheatsheet"] = relationship("Cheatsheet", back_populates="images")

    __table_args__ = (
        UniqueConstraint("cheatsheet_id", "filename", name="uq_cheatsheet_filename"),
    )
