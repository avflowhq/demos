/** Slug helpers shared by the server (job building) and the browser (status polling). */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Job names allow up to 128 chars and forbid whitespace and `/?#`. */
export function jobName(demo: string, room: string): string {
  return slugify(`${demo}-${room}`).slice(0, 128);
}

export function roomSlug(room: string): string {
  return slugify(room.trim());
}
