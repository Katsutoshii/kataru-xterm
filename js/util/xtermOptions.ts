import { ITerminalOptions } from "xterm";

export const options: ITerminalOptions = {
    allowTransparency: true,
    lineHeight: 1.1,
    wordSeparator: " ",
    fontSize: Math.round(20 * Math.sqrt(window.devicePixelRatio)),
    windowOptions: { fullscreenWin: true },
};
