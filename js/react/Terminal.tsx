import React from "react";
import * as xterm from "xterm";
import XTerm from "./XTerm";
import { breakLines, insertLineBreaks } from "../util/linebreak";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";
import * as ANSI from "../util/ansi";
import * as KEYS from "../util/keycodes";
import { options } from "../util/xtermOptions";

const TYPE_TIME: number = 25;
const PUNCTUATION_MULTIPLIER: number = 5;

type TerminalProps = {
  wasm: typeof import("../../pkg");
};

type TerminalState = {
  isAwaitingChoice: boolean;
  isValidChoice: boolean;
  input: string;
  suggestion: string;
  cursor: number;
  xtermRef: React.RefObject<any>;
  output: string;
  outputPos: number;
  outputPause: number;
};

class Terminal extends React.Component<TerminalProps, TerminalState> {
  // For the typewriter timer
  intervalId: NodeJS.Timeout;
  maxLineLength: number;

  // Addons
  webLinksAddon: WebLinksAddon;
  fitAddon: FitAddon;

  constructor(props: TerminalProps) {
    super(props);
    this.intervalId = null;

    this.webLinksAddon = new WebLinksAddon();
    this.fitAddon = new FitAddon();

    this.state = {
      isAwaitingChoice: false,
      isValidChoice: false,
      cursor: 0,
      xtermRef: React.createRef(),
      input: "",
      suggestion: "",
      output: "",
      outputPos: 0,
      outputPause: 0,
    };
  }

  componentDidMount = () => {
    // Add the starting text to the terminal
    this.type(ANSI.green("Loading story...\n"));
    this.wasm().init();

    this.terminal().loadAddon(this.webLinksAddon);
    // this.terminal().loadAddon(this.webglAddon); // Broken
    this.terminal().loadAddon(this.fitAddon);
    this.fitAddon.fit();
    this.maxLineLength = this.terminal().cols;
    this.next();
  };

  componentWillUnmount = () => {
    if (this.intervalId != null) {
      this.clearTypingInterval();
    }
  };

  terminal = (): xterm.Terminal => this.state.xtermRef.current.terminal;

  wasm = (): typeof import("../../pkg") => this.props.wasm;

  timer = () => {
    const { output, outputPos, outputPause } = this.state;

    // Skip typing for this frame if output is paused (used to wait longer for certain chars).
    if (outputPause > 0) {
      this.setState(({ outputPause }) => ({ outputPause: outputPause - 1 }));
      return;
    }

    const char = output[outputPos];

    // Hack to handle "\n" since printing "\n" directly adds indenting whitespace in xterm.
    if (char === "\n") {
      this.terminal().writeln("");
    } else {
      this.terminal().write(char);
    }

    // Stop typing when reached the end of the output.
    if (outputPos + 1 >= output.length) {
      this.stopTyping();
      return;
    }

    // Add pause if the char is punctuation.
    let addedPause = 0;
    if (/^[,.?!]$/.test(char)) {
      addedPause += PUNCTUATION_MULTIPLIER;
    }
    this.setState(({ outputPos, outputPause }) => ({
      outputPos: outputPos + 1,
      outputPause: outputPause + addedPause,
    }));
  };

  writelns = (text: string) => {
    let lines = breakLines(text, this.maxLineLength);
    this.terminal().write(lines.shift());
    for (var line of lines) {
      this.terminal().writeln("");
      this.terminal().write(line);
    }
  };

  type = (text: string) => {
    this.setTypingInterval();
    this.setState(({ output }) => ({ output: output + text }));
  };

  typelns = (text: string) => {
    this.terminal().writeln("");
    this.type(insertLineBreaks(text, this.maxLineLength));
  };

  setTypingInterval = () => {
    if (this.intervalId == null) {
      this.intervalId = setInterval(this.timer, TYPE_TIME);
    }
  };

  clearTypingInterval = () => {
    clearInterval(this.intervalId);
    this.intervalId = null;
  };

  stopTyping = () => {
    this.clearTypingInterval();
    this.setState({
      output: "",
      outputPos: 0,
      outputPause: 0,
    });
  };

  // Shift everything on the right hand side
  shiftLeft = () => {
    const { input, cursor } = this.state;
    const n = input.length - cursor;

    // Overwrite everything to right of cursor, shifted left by one.
    for (let i = 0; i < n; ++i) {
      this.terminal().write(
        ANSI.BACKSPACE + this.state.input[cursor + i] + ANSI.RIGHT_ARROW
      );
    }

    // Delete the last character, then reset the cursor position to its original.
    this.terminal().write(ANSI.BACKSPACE + ANSI.LEFT_ARROW.repeat(n));
  };

  next = () => {
    const result = this.wasm().next(this.state.input);
    const LineTag = this.wasm().LineTag;
    const tag = result.tag();
    const line = result.line();

    switch (tag) {
      case LineTag.Dialogue:
        const [speaker, text] = Object.entries(line)[0];
        if (typeof text === "string") {
          this.typelns(ANSI.cyan(`${speaker}: `) + text.trimEnd());
        }
        this.setState({ isAwaitingChoice: false });
        break;
      case LineTag.Text:
        this.typelns(ANSI.italics(line.trimEnd()));
        this.setState({ isAwaitingChoice: false });
        break;
      case LineTag.Choices:
        this.terminal().writeln("");
        this.terminal().write(ANSI.grey("> "));
        this.setState({ isAwaitingChoice: true });
        break;
      case LineTag.InvalidChoice:
        this.typelns("Invalid choice.");
        break;
      case LineTag.None:
        this.typelns("Thanks for playing!");
        this.setState({ isAwaitingChoice: true });
        break;
    }
  };

  onEnter = () => {
    if (this.intervalId != null) {
      const { outputPos, output } = this.state;
      this.writelns(output.substring(outputPos));
      this.stopTyping();
    } else if (!this.state.isAwaitingChoice || this.state.isValidChoice) {
      this.next();
      this.setState({
        cursor: 0,
        input: "",
        isValidChoice: false,
      });
    }
  };

  onArrow = (data: string) => {
    const { input, cursor } = this.state;
    switch (data) {
      case ANSI.RIGHT_ARROW:
        if (cursor < input.length) {
          this.setState(({ cursor }) => ({ cursor: cursor + 1 }));
          this.terminal().write(data);
        }
        break;
      case ANSI.LEFT_ARROW:
        if (cursor > 0) {
          this.setState(({ cursor }) => ({ cursor: cursor - 1 }));
          this.terminal().write(data);
        }
        break;
      case ANSI.DELETE:
        if (cursor < input.length) {
          const nextInput = input.substr(0, cursor) + input.substr(cursor + 1);
          this.setState(({ cursor }) =>
            this.getNextInputState(nextInput, cursor, 0)
          );
        }
    }
  };

  onBackspace = () => {
    const { cursor } = this.state;
    if (cursor > 0) {
      this.setState(({ input, suggestion, cursor }) => {
        const nextInput = input.substr(0, cursor - 1) + input.substr(cursor);
        return this.getNextInputState(nextInput, cursor, -1);
      });
    }
  };

  // Ggiven a change in the input, update the state
  getNextInputState = (
    nextInput: string,
    cursor: number,
    cursorDelta: number
  ) => {
    if (this.wasm().is_choice(nextInput)) {
      // If it's a valid choice, type in green.
      this.terminal().write(
        ANSI.CLEAR_LINE +
          ANSI.START_LINE +
          ANSI.grey("> ") +
          ANSI.green(nextInput)
      );
      return {
        input: nextInput,
        suggestion: "",
        cursor: cursor + cursorDelta,
        isValidChoice: true,
      };
    }

    // Otherwise check for new prefix
    const newSuggestion = this.wasm().autocomplete(nextInput);
    if (newSuggestion.length > 0) {
      this.terminal().write(
        ANSI.CLEAR_LINE +
          ANSI.START_LINE +
          ANSI.grey("> ") +
          nextInput +
          ANSI.grey(newSuggestion) +
          ANSI.left(
            Math.max(
              0,
              newSuggestion.length + (nextInput.length - (cursor + cursorDelta))
            )
          )
      );
    } else {
      // Otherwise, it's an invalid input, print as red.
      this.terminal().write(
        ANSI.CLEAR_LINE +
          ANSI.START_LINE +
          ANSI.grey("> ") +
          ANSI.red(nextInput) +
          ANSI.left(Math.max(0, nextInput.length - (cursor + cursorDelta)))
      );
    }
    return {
      input: nextInput,
      suggestion: newSuggestion,
      cursor: cursor + cursorDelta,
      isValidChoice: false,
    };
  };

  // Handle alpha numeric text input.
  onTextInput = (data: string) => {
    if (!this.state.isAwaitingChoice) {
      return;
    }

    // Update state
    this.setState(({ input, suggestion, cursor }) => {
      // Insert input into current string
      const nextInput = input.substr(0, cursor) + data + input.substr(cursor);
      return this.getNextInputState(nextInput, cursor, 1);
    });
  };

  // Handle tab key.
  onTab = () => {
    this.setState(({ input, suggestion, cursor }) => {
      this.terminal().write(suggestion);
      const nextInput = input + suggestion;
      return this.getNextInputState(nextInput, cursor, suggestion.length);
    });
  };

  // Handle data input.
  onData = (data: string) => {
    const code: Number = data.charCodeAt(0);

    if (code === KEYS.ENTER) {
      this.onEnter();
    } else if (code === KEYS.BACKSPACE) {
      this.onBackspace();
    } else if (code === KEYS.ARROW) {
      this.onArrow(data);
    } else if (code === KEYS.TAB) {
      this.onTab();
    } else if (code < 32) {
      // Do nothing for other control characters
    } else {
      this.onTextInput(data);
    }
  };

  render = () => {
    return (
      <>
        {/* Create a new terminal and set it's ref. */}
        <XTerm
          ref={this.state.xtermRef}
          onData={this.onData}
          options={options}
        />
      </>
    );
  };
}

export default Terminal;
