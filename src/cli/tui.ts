/**
 * Custom interactive select prompt using raw stdin + ANSI escape codes.
 * No external TUI dependencies — just readline-level control.
 */

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export const CANCEL: unique symbol = Symbol("cancel");

export function isCancel(value: unknown): value is symbol {
  return value === CANCEL;
}

/**
 * Parse raw stdin buffer into a navigation action.
 */
export function parseKey(
  data: Buffer
): "up" | "down" | "enter" | "cancel" | null {
  // Ctrl+C
  if (data[0] === 0x03) return "cancel";
  // Enter / CR
  if (data[0] === 0x0d) return "enter";
  // Escape sequences
  if (data[0] === 0x1b && data[1] === 0x5b) {
    if (data[2] === 0x41) return "up"; // \x1B[A
    if (data[2] === 0x42) return "down"; // \x1B[B
  }
  // Vim-style j/k
  const ch = String.fromCharCode(data[0]);
  if (ch === "k") return "up";
  if (ch === "j") return "down";
  return null;
}

/**
 * Render the visible slice of options with selection indicator.
 * Returns an array of formatted lines.
 */
export function renderOptions<T>(
  options: SelectOption<T>[],
  selected: number,
  offset: number,
  max: number
): string[] {
  const lines: string[] = [];
  const end = Math.min(offset + max, options.length);

  if (offset > 0) {
    lines.push(`  \x1B[2m\u2191 ${offset} more\x1B[0m`);
  }

  for (let i = offset; i < end; i++) {
    const opt = options[i];
    if (i === selected) {
      const hint = opt.hint ? `  \x1B[2m${opt.hint}\x1B[0m` : "";
      lines.push(`  \x1B[1m\u276F ${opt.label}\x1B[0m${hint}`);
    } else {
      const hint = opt.hint ? `  \x1B[2m${opt.hint}\x1B[0m` : "";
      lines.push(`  \x1B[2m  ${opt.label}${hint}\x1B[0m`);
    }
  }

  if (end < options.length) {
    lines.push(`  \x1B[2m\u2193 ${options.length - end} more\x1B[0m`);
  }

  return lines;
}

/**
 * Interactive select prompt. Renders inline, supports arrow keys + j/k,
 * returns the selected value or CANCEL symbol.
 */
export function select<T>(opts: {
  message: string;
  options: SelectOption<T>[];
  maxVisible?: number;
}): Promise<T | symbol> {
  const { message, options } = opts;
  const maxVisible = opts.maxVisible ?? 8;

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let selected = 0;
    let scrollOffset = 0;
    let prevLineCount = 0;
    let resolved = false;

    // Print message (stays fixed)
    stdout.write(`\n  \x1B[38;2;139;92;246m${message}\x1B[0m\n`);

    // Hide cursor
    stdout.write("\x1B[?25l");

    function render() {
      // Erase previous render
      if (prevLineCount > 0) {
        stdout.write(`\x1B[${prevLineCount}A`);
        for (let i = 0; i < prevLineCount; i++) {
          stdout.write("\x1B[2K\n");
        }
        stdout.write(`\x1B[${prevLineCount}A`);
      }

      const lines = renderOptions(options, selected, scrollOffset, maxVisible);
      prevLineCount = lines.length;
      stdout.write(lines.join("\n") + "\n");
    }

    function cleanup() {
      // Show cursor
      stdout.write("\x1B[?25h");
      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
      stdin.pause();
      stdin.removeListener("data", onData);
    }

    function onData(data: Buffer) {
      if (resolved) return;
      const key = parseKey(data);
      if (!key) return;

      switch (key) {
        case "up":
          if (selected > 0) {
            selected--;
            if (selected < scrollOffset) {
              scrollOffset = selected;
            }
          }
          render();
          break;
        case "down":
          if (selected < options.length - 1) {
            selected++;
            if (selected >= scrollOffset + maxVisible) {
              scrollOffset = selected - maxVisible + 1;
            }
          }
          render();
          break;
        case "enter":
          resolved = true;
          cleanup();
          stdout.write("\n");
          resolve(options[selected].value);
          break;
        case "cancel":
          resolved = true;
          cleanup();
          stdout.write("\n");
          resolve(CANCEL);
          break;
      }
    }

    // Safety: always restore terminal on exit
    const onExit = () => {
      stdout.write("\x1B[?25h");
    };
    process.on("exit", onExit);

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.on("data", onData);

    // Initial render
    render();
  });
}
