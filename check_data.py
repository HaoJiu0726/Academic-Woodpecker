import asyncio
from app.database import async_session
from app.models.user import User
from app.models.document import Document
from app.models.knowledge import UserKnowledge, KnowledgePoint
from sqlalchemy import select

async def check_data():
    async with async_session() as session:
        # 检查用户
        users = await session.execute(select(User))
        users_list = users.scalars().all()
        print('Users:', users_list)
        
        # 检查文档
        docs = await session.execute(select(Document))
        docs_list = docs.scalars().all()
        print('Documents:', docs_list)
        
        # 检查用户知识点
        uk = await session.execute(select(UserKnowledge))
        uk_list = uk.scalars().all()
        print('UserKnowledge:', uk_list)
        
        # 检查知识点
        kp = await session.execute(select(KnowledgePoint))
        kp_list = kp.scalars().all()
        print('KnowledgePoints:', kp_list)

if __name__ == '__main__':
    asyncio.run(check_data())