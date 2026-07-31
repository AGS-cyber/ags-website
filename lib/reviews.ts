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

const REQUIRED_FIELDS = [
  "title",
  "slug",
  "score",
  "platform",
  "year",
  "verdict",
  "hoursWasted",
  "date",
] as const;

const NUMERIC_FIELDS = ["score", "year", "hoursWasted"] as const;

function parseReviewFile(filename: string): Review {
  const filePath = path.join(REVIEWS_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `content/reviews/${filename}: missing frontmatter: ${missing.join(", ")}`,
    );
  }

  const review: Review = {
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

  for (const field of NUMERIC_FIELDS) {
    if (Number.isNaN(review[field])) {
      throw new Error(
        `content/reviews/${filename}: ${field} is not a number (got ${JSON.stringify(data[field])})`,
      );
    }
  }

  const expectedSlug = filename.replace(/\.mdx$/, "");
  if (review.slug !== expectedSlug) {
    throw new Error(
      `content/reviews/${filename}: slug "${review.slug}" does not match its filename`,
    );
  }

  return review;
}

function reviewFilenames(): string[] {
  if (!fs.existsSync(REVIEWS_DIR)) {
    throw new Error(`Review content directory not found: ${REVIEWS_DIR}`);
  }

  const filenames = fs
    .readdirSync(REVIEWS_DIR)
    .filter((filename) => filename.endsWith(".mdx"));

  if (filenames.length === 0) {
    throw new Error(`No .mdx reviews found in ${REVIEWS_DIR}`);
  }

  return filenames;
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
