export const ESC: string = "\u001b[";
export const RESET: string = ESC + "0m";
export const GREY: string = ESC + "30;1m";
export const GREEN: string = ESC + "32;1m";
export const CYAN: string = ESC + "36;1m";
export const BACKSPACE = "\b \b"
export const RIGHT_ARROW = ESC + "C"
export const LEFT_ARROW = ESC + "D"
export const DELETE = ESC + "3~"

const move = (n: number, code: string): string => ESC + n + code;
export const right = (n: number) => move(n, "C");
export const left = (n: number) => move(n, "D");

const colored = (text: string, color: string): string => color + text + RESET;
export const grey = (text: string) => colored(text, GREY);
export const green = (text: string) => colored(text, GREEN);
export const cyan = (text: string) => colored(text, CYAN);