"""
User Seed Script
----------------
Creates the four demo accounts for AccessMind Phase 3.
Safe to re-run — checks if users already exist.

Accounts:
  analyst@accessmind.local  / Password123!  → Sarah Chen      (analyst)
  manager@accessmind.local  / Password123!  → Rachel Simmons  (manager)
  auditor@accessmind.local  / Password123!  → Michael Tran    (auditor)
  admin@accessmind.local    / Password123!  → Olivia Lewis     (admin)
"""

from database import SessionLocal, engine
from models import Base, User
from auth_service import hash_password

Base.metadata.create_all(bind=engine)

DEMO_USERS = [
    {
        "email": "analyst@accessmind.local",
        "password": "Password123!",
        "full_name": "Sarah Chen",
        "role": "analyst",
    },
    {
        "email": "manager@accessmind.local",
        "password": "Password123!",
        "full_name": "Rachel Simmons",
        "role": "manager",
    },
    {
        "email": "auditor@accessmind.local",
        "password": "Password123!",
        "full_name": "Michael Tran",
        "role": "auditor",
    },
    {
        "email": "admin@accessmind.local",
        "password": "Password123!",
        "full_name": "Olivia Lewis",
        "role": "admin",
    },
]


def seed(db):
    created = 0
    for u in DEMO_USERS:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
            )
            db.add(user)
            created += 1
    db.commit()
    print(f"✅ {created} demo users seeded ({len(DEMO_USERS) - created} already existed).")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
