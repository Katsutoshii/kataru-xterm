import { ITerminalOptions } from "xterm";

export const options: ITerminalOptions = {
    cursorBlink: true,
    // theme: { background: "#00000000", selection: "\u001b[31m1b" },
    allowTransparency: true,
    lineHeight: 1.1,
    wordSeparator: " ",
    fontSize: 14,
    windowOptions: { fullscreenWin: true },
};
