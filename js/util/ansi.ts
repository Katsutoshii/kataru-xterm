export const ESC: string = "\u001b[";
export const RESET: string = ESC + "0m";
export const GREY: string = ESC + "30;1m";
export const BACKSPACE = "\b \b"
export const RIGHT_ARROW = ESC + "C"
export const LEFT_ARROW = ESC + "D"
export const DELETE = ESC + "3~"

export const right = (n: number) => ESC + n + "C"
export const left = (n: number) => ESC + n + "D"
export const grey = (text: string) => GREY + text + RESET;
