/**
 * Abbreviated page buttons: always the first and the last, the current one with its neighbors and `null`
 * where the ellipsis goes. E.g.: page 9 of 24 → 1 … 8 9 10 … 24.
 * With 7 pages or fewer all are shown.
 */
export function compactPages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
  const page = Math.min(Math.max(1, current), total);
  // Near an end 5 in a row are shown so the number of buttons does not jump
  let start = Math.max(2, page - 1);
  let end = Math.min(total - 1, page + 1);
  if (page <= 4) {
    start = 2;
    end = 5;
  } else if (page >= total - 3) {
    start = total - 4;
    end = total - 1;
  }
  const pages: (number | null)[] = [1];
  if (start > 2) pages.push(null);
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push(null);
  pages.push(total);
  return pages;
}
