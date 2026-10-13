/** XML kategori yolunun son parçası; içe aktarma ve önizleme aynı kuralı kullanır. */
export function categoryLeaf(value: string | null | undefined) {
  return (
    (value ?? "")
      .split(/[>/|]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? null
  );
}
