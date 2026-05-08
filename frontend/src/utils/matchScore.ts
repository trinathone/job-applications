/**
 * Hardcoded resume match formula — no AI, no network call.
 *
 * score = skill overlap 55% + title fit 20% + experience fit 15% + signal bonus 10%
 */

import type { Job } from "../types/job";
import type { ParsedResume } from "../store/resumeStore";

// Mirror of the backend TECH_KEYWORDS set (users.py) — keep in sync
const TECH_KEYWORDS = new Set([
  // Languages
  "python","javascript","typescript","java","go","golang","rust","c","cpp",
  "csharp","ruby","php","swift","kotlin","scala","r","matlab","perl",
  "bash","shell","powershell","elixir","haskell","clojure","erlang","lua",
  // Frontend
  "react","vue","angular","svelte","nextjs","nuxt","gatsby","redux",
  "webpack","vite","tailwind","css","html","sass","graphql","rest",
  "jquery","bootstrap",
  // Backend
  "fastapi","django","flask","express","rails","spring","laravel","nestjs",
  "node","nodejs","deno","grpc","websocket","oauth","jwt","microservices",
  "api","restful","openapi","swagger",
  // Data / ML
  "pandas","numpy","scipy","sklearn","tensorflow","pytorch","keras",
  "xgboost","lightgbm","spark","hadoop","airflow","dbt","mlflow",
  "huggingface","langchain","llm","nlp","cv","deeplearning","machinelearning",
  "datascience","analytics","tableau","powerbi","looker",
  // Databases
  "postgresql","postgres","mysql","sqlite","mongodb","redis","elasticsearch",
  "cassandra","dynamodb","firestore","supabase","snowflake","bigquery",
  "redshift","clickhouse","neo4j","influxdb","sql","nosql","orm",
  // Cloud / DevOps
  "aws","gcp","azure","docker","kubernetes","k8s","terraform","ansible",
  "jenkins","helm","istio","nginx","linux","unix","cicd","devops","sre",
  "pulumi","lambda","ec2","s3","rds","ecs","eks","gke","aks",
  // Systems
  "kafka","rabbitmq","celery","pubsub","caching","cdn","prometheus",
  "grafana","datadog","splunk","elk",
  // Security
  "security","authentication","authorization","oauth2","saml","ssl","tls","encryption",
  // Mobile
  "ios","android","reactnative","flutter","swiftui",
  // Tools
  "git","github","gitlab","jira","agile","scrum","tdd","bdd","testing",
  "pytest","jest","selenium","cypress",
  // Seniority / domain (useful for title matching)
  "senior","junior","lead","staff","principal","architect","manager",
  "frontend","backend","fullstack","mobile","embedded","platform","data",
  "software","engineer","developer","intern","entrylevel","newgrad",
]);

const ALIASES: Record<string, string> = {
  "js": "javascript",
  "ts": "typescript",
  "node.js": "nodejs",
  "react.js": "react",
  "next.js": "nextjs",
  "full-stack": "fullstack",
  "full": "fullstack",
  "front-end": "frontend",
  "back-end": "backend",
  "postgresql": "postgres",
  "golang": "go",
  "k8s": "kubernetes",
  "ci": "cicd",
  "cd": "cicd",
};

const FORMULA = {
  skill: 0.55,
  title: 0.20,
  experience: 0.15,
  signal: 0.10,
};

function normalize(token: string): string {
  const cleaned = token.toLowerCase().trim();
  return ALIASES[cleaned] ?? cleaned;
}

function tokenize(text: string, includeGeneral = false): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/full\s+stack/g, "fullstack")
    .replace(/front\s+end/g, "frontend")
    .replace(/back\s+end/g, "backend")
    .replace(/entry\s+level/g, "entrylevel")
    .replace(/new\s+grad/g, "newgrad")
    .replace(/[/\-_.,;:()\[\]{}|+]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const result = new Set<string>();
  for (const t of tokens) {
    const token = normalize(t);
    if (TECH_KEYWORDS.has(token) || includeGeneral) result.add(token);
  }
  return result;
}

function overlapScore(needed: Set<string>, owned: Set<string>): number {
  if (needed.size === 0 || owned.size === 0) return 0;
  let hits = 0;
  for (const item of needed) {
    if (owned.has(item)) hits++;
  }
  return hits / needed.size;
}

function experienceScore(job: Job, resume: ParsedResume): number {
  const yoe = Number.isFinite(resume.yoe) ? resume.yoe : 0;
  if (job.yoe_min == null && job.yoe_max == null) return yoe > 0 ? 0.75 : 0.5;
  if (job.yoe_min != null && yoe + 1 < job.yoe_min) {
    const gap = job.yoe_min - yoe;
    return Math.max(0.15, 1 - gap * 0.22);
  }
  if (job.yoe_max != null && yoe > job.yoe_max + 3) return 0.72;
  return 1;
}

export function computeMatchScore(job: Job, resume: ParsedResume): number | null {
  const jobText = [
    job.title,
    job.company?.name,
    job.ats,
    job.location,
    (job as any).description_raw,
  ].filter(Boolean).join(" ");
  const jobKeywords = tokenize(jobText);

  const resumeText = [...resume.skills, ...resume.keywords, ...resume.titles].join(" ");
  const resumeKeywords = tokenize(resumeText);
  if (resumeKeywords.size === 0) return null;

  const titleKeywords = tokenize(job.title);
  const resumeTitleKeywords = tokenize(resume.titles.join(" "));
  const skill = overlapScore(jobKeywords, resumeKeywords);
  const title = titleKeywords.size > 0
    ? overlapScore(titleKeywords, new Set([...resumeTitleKeywords, ...resumeKeywords]))
    : 0.45;
  const experience = experienceScore(job, resume);
  const signal = Math.min(1, (jobKeywords.size + resumeKeywords.size) / 18);

  const score = Math.round(100 * (
    skill * FORMULA.skill +
    title * FORMULA.title +
    experience * FORMULA.experience +
    signal * FORMULA.signal
  ));

  return Math.max(8, Math.min(99, score));
}

export function getScoreColor(_score: number): string {
  // Monochrome — all the same style, just varies by intensity via opacity at call site
  return "border-[var(--border-2)]";
}
