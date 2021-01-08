import { ITerminalOptions } from "xterm";

export const options: ITerminalOptions = {
    cursorBlink: true,
    theme: { background: "#00000000" },
    allowTransparency: true,
    lineHeight: 1.1,
    wordSeparator: " ",
    fontSize: 14,
    fontFamily: "Monospace",
    windowsMode: true,
    windowOptions: { fullscreenWin: true },
};
