import shutil

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: ProjectCreate) -> Project:
        project = Project(**data.model_dump())
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)

        # Create project directory structure
        project_dir = settings.projects_path / project.id
        for subdir in ["raw_audio", "segments", "cache", "dataset", "checkpoints", "exports", "logs"]:
            (project_dir / subdir).mkdir(parents=True, exist_ok=True)

        return project

    async def get_all(self) -> list[Project]:
        result = await self.db.execute(
            select(Project).order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, project_id: str) -> Project | None:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        return result.scalar_one_or_none()

    async def update(self, project_id: str, data: ProjectUpdate) -> Project | None:
        project = await self.get_by_id(project_id)
        if not project:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)

        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete(self, project_id: str) -> bool:
        project = await self.get_by_id(project_id)
        if not project:
            return False

        # Delete project files
        project_dir = settings.projects_path / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)

        await self.db.delete(project)
        await self.db.commit()
        return True

    async def update_status(self, project_id: str, status: str) -> Project | None:
        project = await self.get_by_id(project_id)
        if not project:
            return None
        project.status = status
        await self.db.commit()
        await self.db.refresh(project)
        return project
