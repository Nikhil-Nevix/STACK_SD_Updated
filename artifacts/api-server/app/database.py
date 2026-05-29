import os
import re
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

_raw_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/stack")

# Convert standard postgres:// or postgresql:// to asyncpg driver
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://") and "+asyncpg" not in _raw_url:
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg handles SSL differently — extract sslmode and pass via connect_args
_ssl_mode = None
_url_clean = _raw_url

match = re.search(r"[?&]sslmode=([^&]+)", _raw_url)
if match:
    _ssl_mode = match.group(1)
    # Remove sslmode from URL string
    _url_clean = re.sub(r"[?&]sslmode=[^&]*", "", _raw_url)
    _url_clean = re.sub(r"\?$|&$", "", _url_clean)

DATABASE_URL = _url_clean

# Build connect_args for asyncpg SSL
_connect_args: dict = {}
if _ssl_mode == "require":
    import ssl
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx
elif _ssl_mode in ("disable", "allow", "prefer"):
    _connect_args["ssl"] = False

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
