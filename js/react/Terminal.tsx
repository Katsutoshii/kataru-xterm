import React from "react";
import * as xterm from "xterm";
import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";
import { breakLines, insertLineBreaks } from "../util/linebreak";
import { WebLinksAddon } from "xterm-addon-web-links";
import * as ansi from "../util/ansi";
import * as keys from "../util/keycodes";
import { options } from "../util/options";

const TYPE_TIME: number = 25;
const PUNCTUATION_MULTIPLIER: number = 5;

type TerminalProps = {
  wasm: any;
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
    this.type(ansi.green("Loading story...\n"));
    this.wasm().init();
    // addEventListener("resize", () => {
    //   console.log("fit!");
    //   this.fitAddon.fit();
    //   this.maxLineLength = this.terminal().cols - 20;
    // });

    this.terminal().loadAddon(this.webLinksAddon);
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

  wasm = () => this.props.wasm;

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
    console.log("Writing with maxlen: ", this.maxLineLength);
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
    console.log("Typing with maxlen: ", this.maxLineLength);
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
        ansi.BACKSPACE + this.state.input[cursor + i] + ansi.RIGHT_ARROW
      );
    }

    // Delete the last character, then reset the cursor position to its original.
    this.terminal().write(ansi.BACKSPACE + ansi.LEFT_ARROW.repeat(n));
  };

  next = () => {
    console.log(this.state.input);
    const result = this.wasm().next(this.state.input);
    const LineTag = this.wasm().LineTag;
    const tag = result.tag();
    const line = result.line();
    console.log({ tag, line }, LineTag.Text);

    switch (tag) {
      case LineTag.Dialogue:
        const [speaker, text] = Object.entries(line)[0];
        if (typeof text === "string") {
          this.typelns(ansi.cyan(`${speaker}: `) + text.trimEnd());
        }
        this.setState({ isAwaitingChoice: false });
        break;
      case LineTag.Text:
        this.typelns(ansi.italics(line.trimEnd()));
        this.setState({ isAwaitingChoice: false });
        break;
      case LineTag.Choices:
        this.terminal().writeln("");
        this.terminal().write(ansi.grey("> "));
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
    console.log(this.state);
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
      case ansi.RIGHT_ARROW:
        if (cursor < input.length) {
          this.setState(({ cursor }) => ({ cursor: cursor + 1 }));
          this.terminal().write(data);
        }
        break;
      case ansi.LEFT_ARROW:
        if (cursor > 0) {
          this.setState(({ cursor }) => ({ cursor: cursor - 1 }));
          this.terminal().write(data);
        }
        break;
      case ansi.DELETE:
        if (cursor < input.length) {
          const nextInput = input.substr(0, cursor) + input.substr(cursor + 1);
          console.log(nextInput);
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
        ansi.CLEAR_LINE +
          ansi.START_LINE +
          ansi.grey("> ") +
          ansi.green(nextInput)
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
        ansi.CLEAR_LINE +
          ansi.START_LINE +
          ansi.grey("> ") +
          nextInput +
          ansi.grey(newSuggestion) +
          ansi.left(
            Math.max(
              0,
              newSuggestion.length + (nextInput.length - (cursor + cursorDelta))
            )
          )
      );
    } else {
      // Otherwise, it's an invalid input, print as red.
      this.terminal().write(
        ansi.CLEAR_LINE +
          ansi.START_LINE +
          ansi.grey("> ") +
          ansi.red(nextInput) +
          ansi.left(Math.max(0, nextInput.length - (cursor + cursorDelta)))
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
    console.log({ input: this.state.input });
    const code: Number = data.charCodeAt(0);

    if (code === keys.ENTER) {
      this.onEnter();
    } else if (code === keys.BACKSPACE) {
      this.onBackspace();
    } else if (code === keys.ARROW) {
      this.onArrow(data);
    } else if (code === keys.TAB) {
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
