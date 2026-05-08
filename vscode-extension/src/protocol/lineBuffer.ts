export type ParsedLineHandler<T> = (line: string, ts: number) => T[];

export class LineBuffer<T> {
  private buffered = "";

  public constructor(private readonly parseLine: ParsedLineHandler<T>) {}

  public pushText(text: string, ts: number): T[] {
    this.buffered += text;

    const outputs: T[] = [];
    let lineStart = 0;

    for (let index = 0; index < this.buffered.length; index += 1) {
      const current = this.buffered.charAt(index);
      if (current !== "\n" && current !== "\r") {
        continue;
      }

      outputs.push(...this.parseLine(this.buffered.slice(lineStart, index), ts));

      if (current === "\r" && this.buffered.charAt(index + 1) === "\n") {
        index += 1;
      }
      lineStart = index + 1;
    }

    this.buffered = this.buffered.slice(lineStart);
    return outputs;
  }

  public flush(ts: number): T[] {
    if (this.buffered.length === 0) {
      return [];
    }

    const line = this.buffered;
    this.buffered = "";
    return this.parseLine(line, ts);
  }
}
