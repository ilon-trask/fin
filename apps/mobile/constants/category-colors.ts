export const categoryPresetColors = [
  ["Gray", "#A1A1AA"], ["Sage", "#A2B4A3"], ["Sand", "#C8B38E"],
  ["Rose", "#B69698"], ["Blue", "#A0ABCF"], ["Lavender", "#ADA0C7"],
] as const;

export function getDefaultCategoryColor(
  categories: readonly { color: string }[],
  previousColor: string,
) {
  const usedColors = new Set(categories.map(({ color }) => color.toUpperCase()));
  const unusedColor = categoryPresetColors.find(([, color]) => !usedColors.has(color));
  if (unusedColor) return unusedColor[1];

  const lastIndex = categoryPresetColors.findIndex(([, color]) => color === previousColor.toUpperCase());
  return categoryPresetColors[(lastIndex + 1) % categoryPresetColors.length][1];
}
