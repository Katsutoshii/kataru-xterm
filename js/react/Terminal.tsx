import React from "react";
import { XTerm } from "xterm-for-react";
import * as ansi from "../util/ansi";
import * as keys from "../util/keycodes";

type TerminalProps = {
  wasm: any;
};
type TerminalState = {
  input: string;
  suggestion: string;
  cursor: number;
  xtermRef: React.RefObject<any>;
};

class Terminal extends React.Component<TerminalProps, TerminalState> {
  constructor(props: TerminalProps) {
    super(props);

    this.state = {
      cursor: 0,
      xtermRef: React.createRef(),
      input: "",
      suggestion: "",
    };
  }

  terminal = () => this.state.xtermRef.current.terminal;

  wasm = () => this.props.wasm;

  prompt = () => this.terminal().write(ansi.grey("input>") + " ");

  componentDidMount = () => {
    // Add the starting text to the terminal
    this.terminal().writeln("Please enter any string then press enter:");
    this.prompt();
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

  onEnter = () => {
    this.terminal().writeln("");
    this.terminal().writeln(this.wasm().echo(this.state.input));
    this.setState({ input: "" });
    this.prompt();

    console.log("Getting next dialogue line");
    const text = this.wasm().next("");
    this.terminal().write(ansi.grey(text));
  };

  onArrow = (data: string) => {
    const { input, cursor } = this.state;
    switch (data) {
      case ansi.RIGHT_ARROW:
        if (cursor < input.length) {
          this.setState({ cursor: cursor + 1 });
          this.terminal().write(data);
        }
        break;
      case ansi.LEFT_ARROW:
        if (cursor > 0) {
          this.setState({ cursor: cursor - 1 });
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
    const { input, cursor } = this.state;
    if (cursor > 0) {
      this.shiftLeft();
      const nextInput = input.substr(0, cursor - 1) + input.substr(cursor);
      this.setState({
        input: nextInput,
        cursor: cursor - 1,
      });
    }
  };

  onTextInput = (data: string) => {
    const { input, cursor } = this.state;
    // Add general key press characters to the terminal
    this.terminal().write(data);

    // Insert input into current string
    const nextInput = input.substr(0, cursor) + data + input.substr(cursor);

    // Get autocomplete suggestions
    const suggestion = this.wasm().autocomplete(nextInput);
    console.log(suggestion);
    if (suggestion.length > 0) {
      this.terminal().write(ansi.grey(suggestion));
      this.terminal().write(ansi.left(suggestion.length));
    }

    // Update state
    this.setState({
      input: nextInput,
      suggestion: suggestion,
      cursor: cursor + 1,
    });
  };

  onData = (data: string) => {
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
    console.log(this.state);
    return (
      <>
        {/* Create a new terminal and set it's ref. */}
        <XTerm ref={this.state.xtermRef} onData={this.onData} />
      </>
    );
  };
}

export default Terminal;
