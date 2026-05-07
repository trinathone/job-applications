/**
 * Keyword Set Intersection match scoring — no AI.
 *
 * score = |resume_keywords ∩ job_keywords| / |job_keywords| × 100
 *
 * Steps:
 *  1. Tokenize job title + description: lowercase, strip punctuation, split
 *  2. Filter tokens to those in TECH_KEYWORDS dictionary
 *  3. Intersect with resume keywords (also filtered through same dictionary)
 *  4. Divide intersection size by job keyword set size → 0–100%
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
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[/\-_.,;:()\[\]{}|+]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const result = new Set<string>();
  for (const t of tokens) {
    if (TECH_KEYWORDS.has(t)) result.add(t);
  }
  return result;
}

export function computeMatchScore(job: Job, resume: ParsedResume): number {
  // Job keyword set: title + description
  const jobText = `${job.title} ${(job as any).description_raw ?? ""}`;
  const jobKeywords = tokenize(jobText);

  if (jobKeywords.size === 0) return 0;

  // Resume keyword set: all parsed keywords run through same tokenizer
  const resumeText = [...resume.skills, ...resume.keywords, ...resume.titles].join(" ");
  const resumeKeywords = tokenize(resumeText);

  // Intersection
  let intersection = 0;
  for (const kw of jobKeywords) {
    if (resumeKeywords.has(kw)) intersection++;
  }

  return Math.round((intersection / jobKeywords.size) * 100);
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-400 bg-green-900/40 border-green-700";
  if (score >= 40) return "text-yellow-400 bg-yellow-900/40 border-yellow-700";
  return "text-gray-500 bg-gray-800 border-gray-700";
}
