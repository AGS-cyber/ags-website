import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type Review = {
  /** The game name. */
  title: string;
  /** Matches the filename, minus the .mdx extension. */
  slug: string;
  /** Integer from -100 (sucks infinitely) to 0 (doesn't suck — rare). */
  score: number;
  platform: string;
  year: number;
  verdict: string;
  hoursWasted: number;
  /** ISO date string. */
  date: string;
  /** The MDX body, frontmatter stripped. */
  content: string;
};

const REVIEWS_DIR = path.join(process.cwd(), "content", "reviews");

function parseReviewFile(filename: string): Review {
  const filePath = path.join(REVIEWS_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    title: String(data.title),
    slug: String(data.slug),
    score: Number(data.score),
    platform: String(data.platform),
    year: Number(data.year),
    verdict: String(data.verdict),
    hoursWasted: Number(data.hoursWasted),
    date: String(data.date),
    content,
  };
}

function reviewFilenames(): string[] {
  if (!fs.existsSync(REVIEWS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(REVIEWS_DIR)
    .filter((filename) => filename.endsWith(".mdx"));
}

/** Every review, least-bad first (-12 before -87). */
export function getAllReviews(): Review[] {
  return reviewFilenames()
    .map(parseReviewFile)
    .sort((a, b) => b.score - a.score);
}

export function getReview(slug: string): Review | null {
  const filename = `${slug}.mdx`;

  if (!reviewFilenames().includes(filename)) {
    return null;
  }

  return parseReviewFile(filename);
}

export function getAllSlugs(): string[] {
  return getAllReviews().map((review) => review.slug);
}
