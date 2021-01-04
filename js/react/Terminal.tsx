import React from "react";
import { XTerm } from "xterm-for-react";
import * as ansi from "../util/ansi";
import * as keys from "../util/keycodes";
import * as kataru from "../util/kataru";

const TYPE_TIME: number = 25;
const PUNCTUATION_MULTIPLIER: number = 5;

type TerminalProps = {
  wasm: any;
};
type TerminalState = {
  canType: boolean;
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
      canType: false,
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
    this.write(ansi.green("Loading story...\n"));
    this.wasm().init();
    this.next();
  };

  componentWillUnmount = () => {
    this.clearTypingInterval();
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
      this.clearTypingInterval();
      this.setState({
        canType: true,
        output: "",
        outputPos: 0,
        outputPause: 0,
      });
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

  write = (text: string) => {
    this.setState({ canType: false });
    this.setTypingInterval();
    this.setState(({ output }) => ({ output: output + text }));
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

  // Shift everything on the right hand side
  shiftLeft = () => {
    const { input, cursor } = this.state;
    const n = input.length - cursor;

    // Overwrite everything to right of cursor, shifted left by one.
    for (let i = 0; i < n; ++i) {
      this.terminal().write(ansi.BACKSPACE);
      this.terminal().write(this.state.input[cursor + i]);
      this.terminal().write(ansi.RIGHT_ARROW);
    }

    // Delete the last character, then reset the cursor position to its original.
    this.terminal().write(ansi.BACKSPACE);
    for (let i = 0; i < n; ++i) {
      this.terminal().write(ansi.LEFT_ARROW);
    }
  };

  // Shift everything on the right hand side
  clearSuggestion = () => {
    const { input, cursor, suggestion } = this.state;

    // Move to the end of the input and suggestion
    const n = input.length - cursor;
    for (let i = 0; i < n + suggestion.length; ++i) {
      this.terminal().write(ansi.RIGHT_ARROW);
    }

    // Delete the suggestion
    for (let i = 0; i < suggestion.length; ++i) {
      this.terminal().write(ansi.BACKSPACE);
    }

    // Reset to original position
    for (let i = 0; i < n; ++i) {
      this.terminal().write(ansi.LEFT_ARROW);
    }
  };

  next = () => {
    const result = this.wasm().next(this.state.input);
    const text = kataru.getPrintableText(result);
    this.write("\n");
    for (var line of text.split("\n")) {
      this.write(line);
      this.write("\n");
    }
  };

  onEnter = () => {
    // if (this.state.canType) {
    //   this.terminal().writeln("");
    // }
    this.next();
    this.setState({ input: "" });
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
    if (!this.state.canType) {
      return;
    }

    // Update state
    this.setState(({ input, cursor }) => {
      // Add general key press characters to the terminal
      this.terminal().write(data);

      // Insert input into current string
      const nextInput = input.substr(0, cursor) + data + input.substr(cursor);

      // Get autocomplete suggestions
      const suggestion = this.wasm().autocomplete(nextInput);
      if (suggestion.length > 0) {
        this.terminal().write(ansi.grey(suggestion));
        this.terminal().write(ansi.left(suggestion.length));
      }
      return {
        input: nextInput,
        suggestion,
        cursor: cursor + 1,
      };
    });
  };

  onData = (data: string) => {
    // Don't process input until done outputting text.
    if (this.state.output.length > 0) {
      return;
    }

    if (this.state.suggestion.length > 0) {
      this.clearSuggestion();
    }

    const code: Number = data.charCodeAt(0);
    // If the user hits empty and there is something typed echo it.
    if (code === keys.ENTER) {
      this.onEnter();
    } else if (code === keys.BACKSPACE) {
      this.onBackspace();
    } else if (code === keys.ARROW) {
      this.onArrow(data);
    } else if (code === keys.TAB) {
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
        <XTerm ref={this.state.xtermRef} onData={this.onData} />
      </>
    );
  };
}

export default Terminal;
