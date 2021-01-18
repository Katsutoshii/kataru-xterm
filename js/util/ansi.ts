export const ESC: string = "\u001b[";
export const RESET: string = ESC + "0m";
export const GREY: string = ESC + "30;1m";
export const RED: string = ESC + "31;1m";
export const GREEN: string = ESC + "32;1m";
export const CYAN: string = ESC + "36;1m";
export const BACKSPACE = "\b \b"
export const RIGHT_ARROW = ESC + "C"
export const LEFT_ARROW = ESC + "D"
export const DELETE = ESC + "3~"
export const CLEAR_RIGHT = ESC + "0K"
export const CLEAR_LEFT = ESC + "1K"
export const CLEAR_LINE = ESC + "2K"
export const START_LINE = "\r"

export const BOLD = ESC + "1m"
export const ITALICS = ESC + "3m"
export const UNDERLINE = ESC + "4m"

export const move = (n: number, code: string): string => n > 0 ? ESC + n + code : "";
export const right = (n: number) => move(n, "C");
export const left = (n: number) => move(n, "D");

export const colored = (text: string, color: string): string => color + text + RESET;
export const grey = (text: string) => colored(text, GREY);
export const green = (text: string) => colored(text, GREEN);
export const cyan = (text: string) => colored(text, CYAN);
export const red = (text: string) => colored(text, RED);
export const italics = (text: string) => colored(text, ITALICS);