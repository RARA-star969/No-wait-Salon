export function formatChairCount(count: number): string {
  return `${count} ${count === 1 ? 'CHAIR' : 'CHAIRS'}`;
}
