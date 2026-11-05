import os
import io
from sqlalchemy.orm import Session
from app.models.entities import Document, User
from app.services.ingestion.pipeline import IngestionPipeline
from fastapi import UploadFile

SEED_DOCUMENTS = [
    {
        "filename": "Employee_HR_Policy.txt",
        "title": "Employee HR Policy",
        "access_level": "organization",
        "content": """# Employee Human Resources Policy

## Section 1: Annual Leave and Holidays
All full-time permanent employees are granted 25 days of paid annual vacation leave per calendar year. Vacation time begins accruing on the first day of active employment. Unused annual leave up to 5 business days may be carried over into the subsequent calendar year, expiring on March 31.

## Section 2: Parental Leave
Parental leave provides 16 weeks of fully paid leave for primary caregivers following the birth, adoption, or foster placement of a child. Secondary caregivers are entitled to 6 weeks of fully paid parental leave. Parental leave must be taken within the first 12 months of the qualifying event.

## Section 3: Sick Leave and Medical Absence
Employees receive 10 paid sick days annually. Routine sick leave does not require medical certification for days 1 and 2. However, sick leave requires a doctor note after three consecutive absent days. Extended medical leaves exceeding two weeks must be registered with the Benefits Administration department."""
    },
    {
        "filename": "Engineering_Architecture_Guide.txt",
        "title": "Engineering Architecture Guide",
        "access_level": "organization",
        "content": """# Engineering Architecture and Systems Guide

## Section 1: Service Architecture and Protocols
All internal backend microservices must communicate via gRPC or authenticated HTTPS with mutual TLS (mTLS). Unencrypted internal HTTP communication is strictly prohibited across all environments. Every API service must publish OpenAPI or Protocol Buffer definitions.

## Section 2: Persistence and Relational Data
Relational persistence mandates PostgreSQL with row-level security (RLS) enabled on multi-tenant tables. Database connection pooling is handled through PgBouncer with a maximum pool limit of 50 connections per instance.

## Section 3: Orchestration and Deployment
All production workloads run on Kubernetes with automated canary deployments. Deployments must pass continuous integration healthchecks and automated vulnerability scanning before traffic promotion. Services must maintain at least 3 replicas across separate availability zones."""
    },
    {
        "filename": "Security_and_Compliance_Policy.txt",
        "title": "Security and Compliance Policy",
        "access_level": "organization",
        "content": """# Security and Regulatory Compliance Policy

## Section 1: Data Encryption Standards
All persistent enterprise storage must use AES-256 encryption at rest. All data in transit across public networks must use TLS 1.3 encryption. Encryption keys are managed through a centralized Hardware Security Module (HSM) with mandatory annual key rotation.

## Section 2: Access Control and Authentication
Corporate passwords must have a minimum length of 16 characters with multi-factor authentication (MFA) enforced across all systems. Passwords expire every 90 days. SSH root logins are disabled across all production instances.

## Section 3: Vendor Risk Management
All external vendors and third-party SaaS integrations must complete an independent SOC2 Type II audit annually. Vendor data processing agreements (DPAs) must be approved by the Chief Information Security Officer prior to contract execution."""
    },
    {
        "filename": "Employee_Travel_Policy.txt",
        "title": "Employee Travel Policy",
        "access_level": "organization",
        "content": """# Corporate Travel and Expense Guidelines

## Section 1: Travel Pre-approval and Booking
Direct business travel requires prior approval from department managers. Flights under 6 hours require economy class; business class is only authorized for international flights exceeding 6 continuous hours. Lodging bookings must adhere to corporate hotel rate caps.

## Section 2: Reimbursement Deadlines
Employees must submit expense reports within 30 days of incurring business expenses. Late submissions beyond 30 days will be rejected unless granted prior written VP approval. Itemized receipts are mandatory for any expense exceeding $25.

## Section 3: Meal Allowances and Exclusions
Daily meal allowance is capped at $75 per day during out-of-state business travel. Personal alcohol expenses are not eligible for corporate reimbursement. Tips and gratuities up to 20% on eligible meals are reimbursable."""
    },
    {
        "filename": "Product_Roadmap.txt",
        "title": "Product Roadmap",
        "access_level": "organization",
        "content": """# Strategic Product Roadmap 2026-2027

## Section 1: First Half Roadmap (Q1 - Q2)
- Q1 Milestone: Hybrid Semantic and Full-Text Search integration with pgvector and Reciprocal Rank Fusion.
- Q2 Milestone: Multi-tenant Role-Based Access Control (RBAC) redesign and automated document permission inheritance.

## Section 2: Second Half Roadmap (Q3 - Q4)
- Q3 Milestone: Enterprise Knowledge Graph General Availability with cross-document relationship mapping. Q3 roadmap investments restrict travel budget increases to 5%.
- Q4 Milestone: Multimodal Document Understanding supporting audio, video transcripts, and complex architectural schematics."""
    }
]

def seed_enterprise_documents(db: Session, admin_user: User) -> int:
    """
    Seeds the 5 foundational hackathon demonstration documents if not already indexed.
    """
    pipeline = IngestionPipeline(db)
    seeded_count = 0

    for doc_data in SEED_DOCUMENTS:
        existing = db.query(Document).filter(Document.title == doc_data["title"]).first()
        if existing and existing.status == "indexed":
            continue

        # Ingest
        content_bytes = doc_data["content"].encode("utf-8")
        upload = UploadFile(
            file=io.BytesIO(content_bytes),
            filename=doc_data["filename"],
            headers={"content-type": "text/plain"}
        )

        pipeline.process_upload(
            file=upload,
            current_user=admin_user,
            title=doc_data["title"],
            access_level=doc_data["access_level"]
        )
        seeded_count += 1

    return seeded_count
