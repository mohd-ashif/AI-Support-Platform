from typing import Type, TypeVar, List, Optional, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from apps.api.src.dependencies.tenant import TenantContext

T = TypeVar("T")

class TenantRepository:
    """
    Centralized Tenant Repository enforcing strict multi-tenant isolation.
    Guarantees every database query (SELECT, INSERT, UPDATE, DELETE) is scoped
    authoritatively to the authenticated tenant context.
    """

    @staticmethod
    async def get_one_scoped(
        db: AsyncSession,
        model: Type[T],
        entity_id: str,
        tenant: TenantContext,
    ) -> T:
        """Fetch single model entity by ID scoped strictly to authenticated tenant context."""
        stmt = select(model).where(
            model.id == entity_id,
            model.workspace_id == tenant.workspace_id,
        )
        res = await db.execute(stmt)
        entity = res.scalars().first()
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model.__name__} entity not found or access denied.",
            )
        return entity

    @staticmethod
    async def list_scoped(
        db: AsyncSession,
        model: Type[T],
        tenant: TenantContext,
        additional_filters: Optional[List[Any]] = None,
        order_by: Optional[Any] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[T]:
        """List model entities scoped strictly to authenticated tenant context."""
        stmt = select(model).where(model.workspace_id == tenant.workspace_id)
        if additional_filters:
            for f in additional_filters:
                stmt = stmt.where(f)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def insert_scoped(
        db: AsyncSession,
        model: Type[T],
        tenant: TenantContext,
        **kwargs,
    ) -> T:
        """Insert new entity automatically injecting authoritative workspace_id."""
        kwargs["workspace_id"] = tenant.workspace_id
        entity = model(**kwargs)
        db.add(entity)
        await db.commit()
        await db.refresh(entity)
        return entity

    @staticmethod
    async def update_scoped(
        db: AsyncSession,
        model: Type[T],
        entity_id: str,
        tenant: TenantContext,
        **updates,
    ) -> T:
        """Update entity iff owned by authenticated tenant context."""
        entity = await TenantRepository.get_one_scoped(db, model, entity_id, tenant)
        for key, val in updates.items():
            if hasattr(entity, key) and val is not None:
                setattr(entity, key, val)
        await db.commit()
        await db.refresh(entity)
        return entity

    @staticmethod
    async def delete_scoped(
        db: AsyncSession,
        model: Type[T],
        entity_id: str,
        tenant: TenantContext,
    ) -> bool:
        """Delete entity iff owned by authenticated tenant context."""
        entity = await TenantRepository.get_one_scoped(db, model, entity_id, tenant)
        await db.delete(entity)
        await db.commit()
        return True
