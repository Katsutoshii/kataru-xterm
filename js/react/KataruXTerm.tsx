import React from "react";
import * as xterm from "xterm";
import XTerm from "./ShadedXTerm";
import * as ANSI from "../util/ansi";
import * as KEYS from "../util/keycodes";
import XTermTyper from "../util/XTermTyper";
import { options } from "../util/XTermOptions";

type KataruXTermProps = {
  wasm: typeof import("../../pkg");
};

type KataruXTermState = {
  isAwaitingChoice: boolean;
  isValidChoice: boolean;
  suggestion: string;
  xtermRef: React.RefObject<XTerm>;
};

const PROMPT: string = ANSI.CLEAR_LINE + ANSI.START_LINE + ANSI.grey("> ");

export default class KataruXTerm extends React.Component<
  KataruXTermProps,
  KataruXTermState
> {
  typer: XTermTyper;
  wasm: typeof import("../../pkg");
  terminal: xterm.Terminal;

  constructor(props: KataruXTermProps) {
    super(props);
    this.wasm = props.wasm;

    this.state = {
      isAwaitingChoice: false,
      isValidChoice: false,
      xtermRef: React.createRef(),
      suggestion: "",
    };
  }

  onInputChanged = (input: string, inputPos: number) => {
    // If it's a valid choice, type in green.
    if (this.wasm.is_choice(input)) {
      this.terminal.write(
        ANSI.CLEAR_LINE + ANSI.START_LINE + ANSI.grey("> ") + ANSI.green(input)
      );
      return this.setState({ suggestion: "", isValidChoice: true });
    }

    // Otherwise check for new prefix
    const suggestion = this.wasm.autocomplete(input);
    if (suggestion.length > 0) {
      this.terminal.write(
        PROMPT +
          input +
          ANSI.grey(suggestion) +
          ANSI.left(Math.max(0, suggestion.length + (input.length - inputPos)))
      );
      return this.setState({ suggestion, isValidChoice: false });
    }

    // Otherwise, it's an invalid input, print as red.
    this.terminal.write(
      PROMPT + ANSI.red(input) + ANSI.left(Math.max(0, input.length - inputPos))
    );
    return this.setState({ suggestion: "", isValidChoice: false });
  };

  next = () => {
    const result = this.wasm.next(this.typer.input);
    const LineTag = this.wasm.LineTag;
    const tag = result.tag();
    const line = result.line();

    switch (tag) {
      case LineTag.Dialogue:
        const [speaker, text] = Object.entries(line)[0];
        if (typeof text === "string") {
          this.typer.typelns(ANSI.cyan(`${speaker}: `) + text.trimEnd());
        }
        this.setState({ isAwaitingChoice: false });
        break;
      case LineTag.Text:
        this.typer.typelns(ANSI.italics(line.trimEnd()));
        this.setState({ isAwaitingChoice: false });
        break;
      case LineTag.Choices:
        this.terminal.writeln("");
        this.terminal.write(ANSI.grey("> "));
        this.setState({ isAwaitingChoice: true });
        break;
      case LineTag.InvalidChoice:
        this.typer.typelns("Invalid choice.");
        break;
      case LineTag.None:
        this.setState({ isAwaitingChoice: true });
        break;
    }
  };

  // Handle data input.
  onData = (data: string) => {
    const code: Number = data.charCodeAt(0);

    if (code === KEYS.ENTER) {
      this.onEnter();
    } else if (this.state.isAwaitingChoice) {
      if (code === KEYS.BACKSPACE) {
        this.typer.onBackspace();
      } else if (code === KEYS.ARROW) {
        this.typer.onArrow(data);
      } else if (code === KEYS.TAB) {
        this.onTab();
      } else if (code < 32) {
        // Do nothing for other control characters
      } else {
        this.typer.onTextInput(data);
      }
    }
  };

  onEnter = () => {
    if (this.typer.isTyping()) {
      this.typer.flush();
    } else if (!this.state.isAwaitingChoice || this.state.isValidChoice) {
      this.next();
      this.typer.clearInput();
      this.setState({ isValidChoice: false });
    }
  };

  onTab = () => {
    this.typer.onTextInput(this.state.suggestion);
  };

  componentDidMount = () => {
    // Add the starting text to the terminal
    this.terminal = this.state.xtermRef.current.terminal;
    this.typer = new XTermTyper(this.terminal, this.onInputChanged);
    this.typer.type(ANSI.green("Loading story...\n"));
    this.wasm.init();
    this.next();
  };

  componentWillUnmount = () => {};

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
