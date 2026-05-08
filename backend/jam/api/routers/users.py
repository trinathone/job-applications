"""
User profile endpoints.
POST /api/users/resume/parse — extract keywords from resume text using keyword set intersection (no AI)
"""
from __future__ import annotations

import re
import string

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])

# ── Built-in tech keyword dictionary ─────────────────────────────────────────
# Used for both resume parsing and job match scoring (keyword set intersection)
TECH_KEYWORDS: set[str] = {
    # Languages
    "python", "javascript", "typescript", "java", "go", "golang", "rust", "c", "cpp",
    "csharp", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab", "perl",
    "bash", "shell", "powershell", "elixir", "haskell", "clojure", "erlang", "lua",
    # Frontend
    "react", "vue", "angular", "svelte", "nextjs", "nuxt", "gatsby", "redux",
    "webpack", "vite", "tailwind", "css", "html", "sass", "graphql", "rest",
    "typescript", "javascript", "jquery", "bootstrap", "material-ui", "chakra",
    # Backend / frameworks
    "fastapi", "django", "flask", "express", "rails", "spring", "laravel", "nestjs",
    "node", "nodejs", "deno", "grpc", "websocket", "oauth", "jwt", "microservices",
    "api", "restful", "graphql", "openapi", "swagger",
    # Data / ML
    "pandas", "numpy", "scipy", "sklearn", "scikit-learn", "tensorflow", "pytorch",
    "keras", "xgboost", "lightgbm", "spark", "hadoop", "airflow", "dbt", "mlflow",
    "huggingface", "langchain", "llm", "nlp", "cv", "computer-vision", "deep-learning",
    "machine-learning", "data-science", "analytics", "tableau", "powerbi", "looker",
    # Databases
    "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "firestore", "supabase", "snowflake", "bigquery",
    "redshift", "clickhouse", "neo4j", "influxdb", "sql", "nosql", "orm",
    # Cloud / DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform", "ansible",
    "jenkins", "github-actions", "circleci", "gitlab-ci", "helm", "istio", "nginx",
    "linux", "unix", "ci-cd", "devops", "sre", "iac", "pulumi", "cloudformation",
    "lambda", "ec2", "s3", "rds", "ecs", "eks", "gke", "aks",
    # Systems / Architecture
    "distributed-systems", "kafka", "rabbitmq", "celery", "pubsub", "event-driven",
    "caching", "cdn", "load-balancing", "sharding", "replication", "monitoring",
    "observability", "prometheus", "grafana", "datadog", "splunk", "elk",
    # Security
    "security", "authentication", "authorization", "oauth2", "saml", "ssl", "tls",
    "penetration-testing", "soc2", "gdpr", "encryption", "zero-trust",
    # Mobile
    "ios", "android", "react-native", "flutter", "swiftui", "jetpack-compose",
    # Tools / practices
    "git", "github", "gitlab", "jira", "agile", "scrum", "tdd", "bdd", "testing",
    "unit-testing", "integration-testing", "pytest", "jest", "selenium", "cypress",
    "code-review", "pair-programming", "design-patterns", "solid", "ddd", "cqrs",
    # Soft / domain
    "leadership", "mentoring", "cross-functional", "startup", "fintech", "healthtech",
    "saas", "b2b", "b2c", "product", "roadmap", "stakeholder",
}


def _tokenize(text: str) -> set[str]:
    """Lowercase, strip punctuation, split on whitespace, return tokens in TECH_KEYWORDS."""
    text = text.lower()
    # normalize common separators to space
    text = re.sub(r"[/\-_.,;:()\[\]{}|]", " ", text)
    text = text.translate(str.maketrans("", "", string.punctuation))
    tokens = set(text.split())
    return tokens & TECH_KEYWORDS


def _extract_yoe(text: str) -> int:
    """Rough years-of-experience from text — look for the highest number near 'year(s)'."""
    text = text.lower()
    matches = re.findall(r"(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?", text)
    nums = [int(m) for m in matches if 0 < int(m) <= 30]
    return max(nums) if nums else 0


# ── API ───────────────────────────────────────────────────────────────────────

class ResumeParseRequest(BaseModel):
    text: str


class ParsedResume(BaseModel):
    skills: list[str]
    titles: list[str]
    keywords: list[str]
    yoe: int


@router.post("/resume/parse", response_model=ParsedResume)
async def parse_resume(
    body: ResumeParseRequest,
) -> ParsedResume:
    """Extract keywords from resume text using keyword set intersection. No AI."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Resume text is empty")

    text = body.text[:8000]
    matched_keywords = sorted(_tokenize(text))
    yoe = _extract_yoe(text)

    # Split keywords into skills (tech) vs general keywords for UI display
    tech_heavy = {
        "python", "javascript", "typescript", "java", "go", "golang", "rust",
        "react", "vue", "angular", "node", "nodejs", "aws", "gcp", "azure",
        "docker", "kubernetes", "postgresql", "mysql", "mongodb", "redis",
        "tensorflow", "pytorch", "spark", "kafka", "fastapi", "django", "flask",
    }
    skills = [k for k in matched_keywords if k in tech_heavy]
    keywords = [k for k in matched_keywords if k not in tech_heavy]

    # Infer titles from common patterns
    title_patterns = [
        (r"software\s+engineer", "Software Engineer"),
        (r"backend\s+engineer", "Backend Engineer"),
        (r"frontend\s+engineer", "Frontend Engineer"),
        (r"full.?stack", "Full Stack Engineer"),
        (r"data\s+engineer", "Data Engineer"),
        (r"ml\s+engineer|machine\s+learning\s+engineer", "ML Engineer"),
        (r"devops\s+engineer|sre\b", "DevOps / SRE"),
        (r"data\s+scientist", "Data Scientist"),
        (r"platform\s+engineer", "Platform Engineer"),
        (r"mobile\s+engineer|ios\s+developer|android\s+developer", "Mobile Engineer"),
    ]
    titles = []
    text_lower = text.lower()
    for pattern, label in title_patterns:
        if re.search(pattern, text_lower):
            titles.append(label)

    return ParsedResume(
        skills=skills[:40],
        titles=titles[:5] or ["Software Engineer"],
        keywords=keywords[:30],
        yoe=yoe,
    )
