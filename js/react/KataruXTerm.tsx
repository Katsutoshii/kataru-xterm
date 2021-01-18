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
  xtermRef: React.RefObject<XTerm>;
};

export default class KataruXTerm extends React.Component<
  KataruXTermProps,
  KataruXTermState
> {
  typer: XTermTyper;
  wasm: typeof import("../../pkg");
  terminal: xterm.Terminal;
  timeoutIntervalId: NodeJS.Timeout;
  timeRemaining: number;
  isAwaitingChoice: boolean;
  isValidChoice: boolean;
  suggestion: string;

  constructor(props: KataruXTermProps) {
    super(props);
    this.wasm = props.wasm;
    this.isAwaitingChoice = false;
    this.isValidChoice = false;
    this.suggestion = "";

    this.state = {
      xtermRef: React.createRef(),
    };
  }

  /// Returns an ANSI sequence to clear the line and write the prompt.
  /// If no timeout, returns `>>>` in grey.
  /// If a timeout is given, returns `TT>` where TT is the zero padded time remaining.
  /// With less than 10 seconds remaining, returns the prompt in red.
  prompt = (): string =>
    ANSI.CLEAR_LINE +
    ANSI.START_LINE +
    ANSI.colored(
      (this.timeoutIntervalId != null
        ? this.timeRemaining.toString().padStart(2, "0")
        : ">>") + "> ",
      this.timeoutIntervalId != null && this.timeRemaining < 10
        ? ANSI.RED
        : ANSI.GREY
    );

  setTimeoutInterval = (timeout: number) => {
    if (this.timeoutIntervalId == null) {
      this.timeRemaining = timeout;
      this.timeoutIntervalId = setInterval(this.timer, 1000);
    }
  };

  clearTimeoutInterval = () => {
    if (this.timeoutIntervalId != null) {
      clearInterval(this.timeoutIntervalId);
      this.timeoutIntervalId = null;
    }
  };

  timer = () => {
    this.typer.triggerInputChanged();
    this.timeRemaining -= 1;

    if (this.timeRemaining <= 0) {
      this.clearTimeoutInterval();
      this.typer.clearInput();
      this.typer.onTextInput("...");
      this.next();
    }
  };

  onInputChanged = (input: string, inputPos: number) => {
    console.log("Input changed!");

    // If it's a valid choice, type in green.
    if (this.wasm.is_choice(input)) {
      this.terminal.write(this.prompt() + ANSI.green(input));
      this.suggestion = "";
      this.isValidChoice = true;
      return;
    }

    // Otherwise check for new prefix
    this.suggestion = this.wasm.autocomplete(input);
    if (this.suggestion.length > 0) {
      this.terminal.write(
        this.prompt() +
          input +
          ANSI.grey(this.suggestion) +
          ANSI.left(
            Math.max(0, this.suggestion.length + (input.length - inputPos))
          )
      );
      this.isValidChoice = false;
      return;
    }

    // Otherwise, it's an invalid input, print as red.
    this.terminal.write(
      this.prompt() +
        ANSI.red(input) +
        ANSI.left(Math.max(0, input.length - inputPos))
    );
    this.suggestion = "";
    this.isValidChoice = false;
  };

  next = () => {
    const line = this.wasm.next(this.typer.input);
    const LineTag = this.wasm.LineTag;

    switch (this.wasm.tag()) {
      case LineTag.Dialogue:
        const [speaker, text] = Object.entries(line)[0];
        if (typeof text === "string") {
          this.typer.typelns(ANSI.cyan(`${speaker}: `) + text.trimEnd());
        }
        this.isAwaitingChoice = false;
        break;

      case LineTag.Text:
        this.typer.typelns(ANSI.italics(line.trimEnd()));
        this.isAwaitingChoice = false;
        break;

      case LineTag.Choices:
        this.terminal.writeln("");
        this.terminal.write(this.prompt());
        this.isAwaitingChoice = true;
        if (line.timeout) {
          this.setTimeoutInterval(line.timeout);
        }
        break;

      case LineTag.InvalidChoice:
        this.typer.typelns("Invalid choice.");
        break;

      case LineTag.None:
        this.isAwaitingChoice = true;
        break;
    }
  };

  // Handle data input.
  onData = (data: string) => {
    const code: Number = data.charCodeAt(0);

    if (code === KEYS.ENTER) {
      this.onEnter();
    } else if (this.isAwaitingChoice) {
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
    } else if (!this.isAwaitingChoice || this.isValidChoice) {
      this.clearTimeoutInterval();
      this.next();
      this.typer.clearInput();
      this.isValidChoice = false;
    }
  };

  onTab = () => {
    this.typer.onTextInput(this.suggestion);
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
