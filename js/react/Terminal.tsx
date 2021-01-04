import React from "react";
import { XTerm } from "xterm-for-react";
import * as ansi from "../util/ansi";
import * as keys from "../util/keycodes";

const TYPE_TIME: number = 25;
const PUNCTUATION_MULTIPLIER: number = 5;

type TerminalProps = {
  wasm: any;
};

type TerminalState = {
  awaitingChoice: boolean;
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

  constructor(props: TerminalProps) {
    super(props);
    this.intervalId = null;

    this.state = {
      awaitingChoice: false,
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
    this.next();
  };

  componentWillUnmount = () => {
    if (this.intervalId != null) {
      this.clearTypingInterval();
    }
  };

  terminal = () => this.state.xtermRef.current.terminal;

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
    let lines = text.split("\n");
    this.terminal().write(lines.shift());
    for (var line of lines) {
      this.terminal().writeln();
      this.terminal().write(line);
    }
  };

  type = (text: string) => {
    this.setTypingInterval();
    this.setState(({ output }) => ({ output: output + text }));
  };

  typelns = (text: string) => {
    let lines = text.split("\n");
    // this.type(lines.shift());
    for (var line of lines) {
      this.type("\n" + line);
    }
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

  // Shift everything on the right hand side
  clearSuggestion = () => {
    const { input, cursor, suggestion } = this.state;
    console.log("clear sug", { input, cursor, suggestion });

    // Move to the end of the input and suggestion
    const n = input.length - cursor;
    console.log({ suglen: n + suggestion.length });
    this.terminal().write(ansi.RIGHT_ARROW.repeat(n + suggestion.length));

    // Delete the suggestion
    this.terminal().write(ansi.BACKSPACE.repeat(suggestion.length));

    // Reset to original position
    this.terminal().write(ansi.LEFT_ARROW.repeat(n));
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
        break;
      case LineTag.Text:
        this.typelns(line.trimEnd());
        break;
      case LineTag.Choices:
        this.typelns(ansi.cyan("Make a choice: "));
        this.setState({ awaitingChoice: true });
        break;
      case LineTag.InvalidChoice:
        this.typelns("Invalid choice.");
        break;
    }
  };

  onEnter = () => {
    console.log("onEnter");
    if (this.intervalId != null) {
      console.log("Enter during typing!");
      const { outputPos, output } = this.state;
      this.terminal().write(output.substring(outputPos));
      this.stopTyping();
    } else {
      if (this.state.awaitingChoice) {
        this.terminal().writeln("");
      }
      this.next();
      this.setState({ cursor: 0, input: "" });
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
          this.terminal().write(ansi.RIGHT_ARROW);
          this.shiftLeft();
        }
    }
  };

  onBackspace = () => {
    const { cursor } = this.state;
    if (cursor > 0) {
      this.shiftLeft();
      this.setState(({ input, cursor }) => {
        const nextInput = input.substr(0, cursor - 1) + input.substr(cursor);
        return {
          input: nextInput,
          cursor: cursor - 1,
        };
      });
    }
  };

  onTextInput = (data: string) => {
    if (!this.state.awaitingChoice) {
      return;
    }

    // Update state
    this.setState(({ input, cursor, suggestion }) => {
      // Insert input into current string
      const nextInput = input.substr(0, cursor) + data + input.substr(cursor);

      if (this.wasm().is_choice(nextInput)) {
        // If it's a valid choice, type in green.
        this.terminal().write(ansi.BACKSPACE.repeat(input.length));
        this.terminal().write(ansi.green(nextInput));
        return {
          input: nextInput,
          suggestion: "",
          cursor: cursor + 1,
        };
      } else if (suggestion.length > 0 && suggestion[0] === data) {
        // If continuing current prefix, just type in white.
        console.log("Continuing prefix", { suggestion, data });
        this.terminal().write(ansi.RIGHT_ARROW + ansi.BACKSPACE + data);
        return {
          input: nextInput,
          suggestion: suggestion.substring(1),
          cursor: cursor + 1,
        };
      } else {
        // Otherwise check for new prefix
        const newSuggestion = this.wasm().autocomplete(nextInput);
        if (newSuggestion.length > 0) {
          console.log("New suggestion", { newSuggestion });
          this.terminal().write(
            data + ansi.grey(newSuggestion) + ansi.left(newSuggestion.length)
          );
        } else {
          // Otherwise, it's an invalid input, print as red.
          console.log("Invalid input", { nextInput });
          this.clearSuggestion();
          this.terminal().write(
            ansi.BACKSPACE.repeat(input.length) + ansi.red(nextInput)
          );
        }
        return {
          input: nextInput,
          suggestion: newSuggestion,
          cursor: cursor + 1,
        };
      }
    });
  };

  onTab = () => {
    this.setState(({ input, suggestion }) => {
      console.log("on tab", { input, suggestion });
      this.clearSuggestion();
      this.terminal().write(suggestion);
      return {
        input: input + suggestion,
        suggestion: "",
      };
    });
  };

  onData = (data: string) => {
    // Clear the suggestion each time input is entered.
    if (this.state.suggestion.length <= 0) {
      this.clearSuggestion();
    }

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
          options={{
            cursorBlink: this.state.awaitingChoice,
            theme: { background: "#00000000" },
            allowTransparency: true,
          }}
        />
      </>
    );
  };
}

export default Terminal;
