export function nowEpochSeconds(): number {
  return Date.now() / 1000;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function formatSessionDirectoryStamp(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

export function formatClockTime(date: Date): string {
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  const milliseconds = date.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}
