/**
 * Botones de página abreviados: siempre la primera y la última, la actual con sus vecinas y `null`
 * donde van los puntos suspensivos. Ej.: página 9 de 24 → 1 … 8 9 10 … 24.
 * Con 7 páginas o menos se muestran todas.
 */
export function compactPages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
  const page = Math.min(Math.max(1, current), total);
  // Cerca de un extremo se muestran 5 seguidas para que el número de botones no salte
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
