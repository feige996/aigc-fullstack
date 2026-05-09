export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}

export function createId(prefix: string, value: string): string {
  return `${prefix}_${value}`
}
