"""
SQLAlchemy models mirroring schema.sql exactly.
If you add a column in schema.sql, add it here too.
"""
from sqlalchemy import (
    String, Float, Integer,
    ForeignKey, CheckConstraint, UniqueConstraint, Enum as SAEnum,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db import Base


class Account(Base):
    __tablename__ = "accounts"

    id:                 Mapped[str] = mapped_column(String(36), primary_key=True)
    name:               Mapped[str] = mapped_column(String(100), nullable=False)
    type:               Mapped[str] = mapped_column(SAEnum("cash", "bank", "card", "savings", "other", name="account_type"), nullable=False, default="other")
    currency:           Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    starting_balance:   Mapped[float] = mapped_column(Float, nullable=False, default=0)
    is_archived:        Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exclude_from_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at:         Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at:         Mapped[str] = mapped_column(String(40), nullable=False)
    is_deleted:         Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dirty:              Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_synced_at:     Mapped[str | None] = mapped_column(String(40), nullable=True)


class Category(Base):
    __tablename__ = "categories"

    id:             Mapped[str] = mapped_column(String(36), primary_key=True)
    name:           Mapped[str] = mapped_column(String(100), nullable=False)
    kind:           Mapped[str] = mapped_column(SAEnum("expense", "income", name="category_kind"), nullable=False)
    parent_id:      Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    icon:           Mapped[str | None] = mapped_column(String(50), nullable=True)
    color:          Mapped[str | None] = mapped_column(String(7), nullable=True)
    is_archived:    Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at:     Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at:     Mapped[str] = mapped_column(String(40), nullable=False)
    is_deleted:     Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dirty:          Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_synced_at: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Self-referential; left untyped to preserve the original relationship
    # configuration (single FK, no remote_side).
    children = relationship("Category")


class Transaction(Base):
    __tablename__ = "transactions"

    id:                    Mapped[str] = mapped_column(String(36), primary_key=True)
    type:                  Mapped[str] = mapped_column(SAEnum("expense", "income", "transfer", name="transaction_type"), nullable=False)
    account_id:            Mapped[str | None] = mapped_column(String(36), ForeignKey("accounts.id"), nullable=True)
    from_account_id:       Mapped[str | None] = mapped_column(String(36), ForeignKey("accounts.id"), nullable=True)
    to_account_id:         Mapped[str | None] = mapped_column(String(36), ForeignKey("accounts.id"), nullable=True)
    category_id:           Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    amount:                Mapped[float] = mapped_column(Float, nullable=False)
    currency:              Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    occurred_at:           Mapped[str] = mapped_column(String(10), nullable=False)   # YYYY-MM-DD
    note:                  Mapped[str | None] = mapped_column(String(255), nullable=True)
    recurring_template_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("recurring_templates.id"), nullable=True)
    created_at:            Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at:            Mapped[str] = mapped_column(String(40), nullable=False)
    is_deleted:            Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dirty:                 Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_synced_at:        Mapped[str | None] = mapped_column(String(40), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(type IN ('expense','income') AND account_id IS NOT NULL "
            "  AND from_account_id IS NULL AND to_account_id IS NULL) "
            "OR "
            "(type = 'transfer' AND account_id IS NULL "
            "  AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL)",
            name="chk_transaction_shape",
        ),
    )


class Budget(Base):
    __tablename__ = "budgets"

    id:             Mapped[str] = mapped_column(String(36), primary_key=True)
    category_id:    Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    month:          Mapped[str] = mapped_column(String(7), nullable=False)   # YYYY-MM
    amount:         Mapped[float] = mapped_column(Float, nullable=False)
    created_at:     Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at:     Mapped[str] = mapped_column(String(40), nullable=False)
    is_deleted:     Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dirty:          Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_synced_at: Mapped[str | None] = mapped_column(String(40), nullable=True)

    __table_args__ = (
        UniqueConstraint("category_id", "month", name="uq_budget_category_month"),
    )


class RecurringTemplate(Base):
    __tablename__ = "recurring_templates"

    id:             Mapped[str] = mapped_column(String(36), primary_key=True)
    name:           Mapped[str] = mapped_column(String(100), nullable=False)
    type:           Mapped[str] = mapped_column(SAEnum("expense", "income", name="recurring_type"), nullable=False)
    account_id:     Mapped[str | None] = mapped_column(String(36), ForeignKey("accounts.id"), nullable=True)
    category_id:    Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    amount:         Mapped[float] = mapped_column(Float, nullable=False)
    currency:       Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    day_of_month:   Mapped[int] = mapped_column(Integer, nullable=False)
    is_active:      Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at:     Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at:     Mapped[str] = mapped_column(String(40), nullable=False)
    is_deleted:     Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dirty:          Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_synced_at: Mapped[str | None] = mapped_column(String(40), nullable=True)


class DeviceSyncState(Base):
    """Tracks when each device last successfully synced."""
    __tablename__ = "device_sync_state"

    device_id:      Mapped[str] = mapped_column(String(100), primary_key=True)
    last_synced_at: Mapped[str] = mapped_column(String(40), nullable=False)