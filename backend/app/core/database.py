from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Dependency to be used in routes:
        def my_route(db: Session = Depends(get_db)):
            ...
    Opens a DB session, yields it, then closes it after the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
