declare module "written-number" {
  interface WrittenNumberOptions {
    lang?: string;
  }

  export default function writtenNumber(
    value: number,
    options?: WrittenNumberOptions,
  ): string;
}
