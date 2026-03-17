export function resolveOutputDir(filePath: string): string {
  const slashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (slashIndex < 0) return filePath
  return filePath.slice(0, slashIndex)
}
