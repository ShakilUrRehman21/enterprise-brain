import os
import pytest

# Enforce isolated test environment
os.environ["TESTING"] = "1"

from app.core.database import Base, get_engine, init_db, SessionLocal
from app.models.entities import User, Collection, Document, DocumentChunk, Conversation, Message

@pytest.fixture(scope="session", autouse=True)
def setup_test_suite():
    # Remove previous test db if exists
    test_db_file = "test_enterprise_brain.db"
    if os.path.exists(test_db_file):
        try:
            os.remove(test_db_file)
        except Exception:
            pass

    init_db()
    yield

    if os.path.exists(test_db_file):
        try:
            os.remove(test_db_file)
        except Exception:
            pass

