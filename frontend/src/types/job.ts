export interface Company {
  id: number;
  slug: string;
  name: string;
  ats: string;
  active: boolean;
}

export interface Job {
  id: number;
  fingerprint: string;
  ats: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  url: string;
  yoe_min: number | null;
  yoe_max: number | null;
  yoe_source: string | null;
  salary_min: number | null;
  salary_max: number | null;
  posted_at: string | null;
  scraped_at: string;
  is_dead: boolean;
  is_duplicate: boolean;
  company: Company;
}

export interface JobListResponse {
  items: Job[];
  total: number;
  cursor: string | null;
}
