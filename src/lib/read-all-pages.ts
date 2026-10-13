type PageResult<T> = { data: T[] | null; error: { message: string } | null };
/** Kararlı sıralanmış sorgu; API daha kısa sayfa döndürse de boş sayfaya kadar devam eder. */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  size = 200,
): Promise<PageResult<T>> {
  const rows: T[] = [];
  for (;;) {
    const result = await page(rows.length, rows.length + size - 1);
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) return { data: rows, error: null };
    rows.push(...result.data);
  }
}
