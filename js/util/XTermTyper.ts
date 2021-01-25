import * as xterm from "xterm";
import * as ANSI from "./ansi";
import { breakLines, insertLineBreaks } from "./linebreak";

const TYPE_TIME: number = 15;
const PUNCTUATION_MULTIPLIER: number = 5;

/**
 * Wrapper around XTerm Terminal to handle typing text and getting input.
 * To write output immediately, call `write(text)`.
 * To write output using typewriter effect, call `type(text)`.
 * To write all queued typerwriter text immediately, call `flush`.
 */
export default class XTermTyper {
    terminal: xterm.Terminal;
    input: string;
    inputPos: number;
    output: string;
    outputPos: number;
    outputPause: number;
    intervalId: NodeJS.Timeout;
    onInputChanged: (input: string, inputPos: number) => void;

    maxLineLength: number;

    constructor(terminal: xterm.Terminal, onInputChanged: (input: string, inputPos: number) => void) {
        this.terminal = terminal;
        this.input = "";
        this.inputPos = 0;
        this.output = "";
        this.outputPos = 0;
        this.outputPause = 0;
        this.maxLineLength = this.terminal.cols;
        this.onInputChanged = onInputChanged.bind(this);
    }

    triggerInputChanged = () =>
        this.onInputChanged(this.input, this.inputPos);

    timer = () => {
        // Skip typing for this frame if output is paused (used to wait longer for certain chars).
        if (this.outputPause > 0) {
            this.outputPause -= 1;
            return;
        }

        const char = this.output[this.outputPos];

        // Hack to handle "\n" since printing "\n" directly adds indenting whitespace in xterm.
        if (char === "\n") {
            this.terminal.writeln("");
        } else {
            this.terminal.write(char);
        }

        // Stop typing when reached the end of the output.
        if (this.outputPos + 1 >= this.output.length) {
            this.stopTyping();
            this.terminal.writeln("");
            return;
        }

        // Add pause if the char is punctuation.
        let addedPause = 0;
        if (/^[,.?!\n]$/.test(char)) {
            addedPause += PUNCTUATION_MULTIPLIER;
        }
        this.outputPos += 1;
        this.outputPause += addedPause;
    };

    flush = () => {
        const remaining = this.output.substring(this.outputPos);
        for (let line of remaining.split("\n")) {
            this.terminal.writeln(line);
        }
        this.stopTyping();
    }

    reset = () => {
        this.terminal.clear();
    };

    repos = () => {
        this.terminal.write(ANSI.pos(0, 0));
    }

    write = (text: string) => this.terminal.write(text);

    writeln = (text: string) => this.terminal.writeln(text);

    writelns = (text: string) => {
        let lines = breakLines(text.trimEnd(), this.maxLineLength);
        for (var line of lines) {
            this.terminal.writeln(line);
        }
    };

    type = (text: string) => {
        this.setTypingInterval();
        this.output += text;
    };

    typelns = (text: string) => {
        this.type(insertLineBreaks(text, this.maxLineLength));
    };

    stopTyping = () => {
        this.clearTypingInterval();
        this.output = "";
        this.outputPos = 0;
        this.outputPause = 0;
    };

    setTypingInterval = () => {
        if (this.intervalId == null) {
            this.intervalId = setInterval(this.timer, TYPE_TIME);
        }
    };

    clearTypingInterval = () => {
        if (this.intervalId != null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    };

    isTyping = (): boolean => this.intervalId != null;

    clearInput = () => {
        this.input = "";
        this.inputPos = 0;
    };

    onArrow = (data: string) => {
        switch (data) {
            case ANSI.RIGHT_ARROW:
                if (this.inputPos < this.input.length) {
                    this.inputPos += 1
                    this.terminal.write(data);
                }
                break;
            case ANSI.LEFT_ARROW:
                if (this.inputPos > 0) {
                    this.inputPos -= 1;
                    this.terminal.write(data);
                }
                break;
            case ANSI.DELETE:
                if (this.inputPos < this.input.length) {
                    this.input = this.input.substr(0, this.inputPos) + this.input.substr(this.inputPos + 1);
                }
                this.triggerInputChanged();
                break;
        }
    };

    onBackspace = () => {
        if (this.inputPos > 0) {
            this.input = this.input.substr(0, this.inputPos - 1) + this.input.substr(this.inputPos);
            this.inputPos -= 1;
            this.triggerInputChanged();
        }
    };

    onTextInput = (data: string) => {
        // Insert input into current string
        this.input = this.input.substr(0, this.inputPos) + data + this.input.substr(this.inputPos);
        this.inputPos += data.length;

        this.triggerInputChanged();
    };
};