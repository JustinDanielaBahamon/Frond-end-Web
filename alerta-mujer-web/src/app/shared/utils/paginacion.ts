/**
 * Botones de página abreviados: siempre la primera y la última, la actual con sus vecinas y `null`
 * donde van los puntos suspensivos. Ej.: página 9 de 24 → 1 … 8 9 10 … 24.
 * Con 7 páginas o menos se muestran todas.
 */
export function paginasCompactas(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
  const pagina = Math.min(Math.max(1, actual), total);
  // Cerca de un extremo se muestran 5 seguidas para que el número de botones no salte
  let inicio = Math.max(2, pagina - 1);
  let fin = Math.min(total - 1, pagina + 1);
  if (pagina <= 4) {
    inicio = 2;
    fin = 5;
  } else if (pagina >= total - 3) {
    inicio = total - 4;
    fin = total - 1;
  }
  const paginas: (number | null)[] = [1];
  if (inicio > 2) paginas.push(null);
  for (let p = inicio; p <= fin; p++) paginas.push(p);
  if (fin < total - 1) paginas.push(null);
  paginas.push(total);
  return paginas;
}
