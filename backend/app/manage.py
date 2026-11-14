"""Admin commands.

    python -m app.manage create-admin you@company.com "Your Name"
    python -m app.manage load-samples you@company.com
    python -m app.manage reindex
    python -m app.manage reprocess
    python -m app.manage check-ai
    python -m app.manage reset-db --yes
"""
import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.database import SessionLocal, init_db, reset_db
from app.core.security import hash_password
from app.models import Role, User


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.manage")
    sub = p.add_subparsers(dest="cmd", required=True)
    ca = sub.add_parser("create-admin", help="Create an admin account (or promote an existing one)")
    ca.add_argument("email")
    ca.add_argument("name", nargs="?", default="Administrator")
    ls = sub.add_parser("load-samples", help="Add the sample policy documents")
    ls.add_argument("owner_email")
    sub.add_parser("reindex", help="Re-embed chunks made with a different embedding model")
    sub.add_parser("reprocess", help="Re-extract and re-index every document (after upgrading)")
    sub.add_parser("check-ai", help="Test the Gemini API key (answers and embeddings)")
    rd = sub.add_parser("reset-db", help="Drop and recreate all tables (deletes all data)")
    rd.add_argument("--yes", action="store_true")
    args = p.parse_args(argv)

    if args.cmd == "reset-db":
        if not args.yes:
            print("This deletes every user, document and conversation. Re-run with --yes to confirm.")
            return 1
        reset_db()
        print("Database reset.")
        return 0

    if args.cmd == "check-ai":
        return check_ai()

    init_db()
    with SessionLocal() as db:
        if args.cmd == "create-admin":
            email = args.email.lower()
            user = db.scalar(select(User).where(User.email == email))
            if user:
                user.role = Role.ADMIN
                print(f"{email} is now an admin.")
            else:
                pw = getpass.getpass("Password (min 8 characters): ")
                if len(pw) < 8:
                    print("Password too short.")
                    return 1
                db.add(User(email=email, full_name=args.name, password_hash=hash_password(pw), role=Role.ADMIN))
                print(f"Created admin {email}.")
            db.commit()
        elif args.cmd == "load-samples":
            from app.services.sample_data import load_sample_documents

            owner = db.scalar(select(User).where(User.email == args.owner_email.lower()))
            if not owner:
                print("No user with that email.")
                return 1
            added = load_sample_documents(db, owner)
            print(f"Added {len(added)} sample documents.")
        elif args.cmd == "reprocess":
            from app.models import Document
            from app.services.ingestion.pipeline import process_document

            ids = db.scalars(select(Document.id)).all()
            for i, doc_id in enumerate(ids, 1):
                process_document(doc_id)
                print(f"  {i}/{len(ids)}", end="\r")
            print(f"Reprocessed {len(ids)} documents.")
        elif args.cmd == "reindex":
            from app.services.ingestion.pipeline import reindex_stale_embeddings

            print(f"Re-embedded {reindex_stale_embeddings(db)} chunks.")
    return 0


def check_ai() -> int:
    from app.core.config import settings
    from app.services.embeddings import embeddings
    from app.services.gemini import get_client
    from app.services.llm import llm

    if not settings.gemini_enabled or llm is None or embeddings.gemini is None:
        print("No GEMINI_API_KEY found. Put it in .env in the project root or in backend/.")
        return 1
    ok = True
    try:
        reply = llm.generate("Reply with the single word: ready", "You are a connectivity check.", 0.0, 256)
        used = llm.last_model if llm.last_model != llm.model else llm.model
        note = f", {llm.model} was busy" if used != llm.model else ""
        print(f"Answers:    OK  ({used}{note}) -> {reply!r}")
    except Exception as exc:
        ok = False
        print(f"Answers:    FAILED  {exc}")
    try:
        vec = embeddings.gemini.embed_query("connectivity check")
        print(f"Embeddings: OK  ({embeddings.gemini.model_id}, {len(vec)} dimensions)")
    except Exception as exc:
        ok = False
        print(f"Embeddings: FAILED  {exc}")
    client = get_client()
    print(f"Endpoint:   {'Vertex AI express mode' if client.mode == 'vertex' else 'Gemini Developer API'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
