import React from "react";
import XTerm from "./ShadedXTerm";
import * as ANSI from "../util/ansi";
import * as KEYS from "../util/keycodes";
import XTermTyper from "../util/XTermTyper";
import { sleep } from "../util/async";

type KataruXTermProps = {
  wasm: typeof import("../../pkg");
};

enum Status {
  EnteringInput,
  EnteringChoice,
  EnteredValidChoice,
  AwaitingText,
  AwaitingContinue,
  Loading
}

export default class KataruXTerm extends React.Component<KataruXTermProps, {}> {
  xtermRef: React.RefObject<XTerm>;
  typer: XTermTyper | null = null;
  wasm: typeof import("../../pkg");
  timeoutIntervalId: NodeJS.Timeout | null = null;
  blinkIntervalId: NodeJS.Timeout | null = null;
  blinkCount: number = 0;
  timeRemaining: number = 0;

  status: Status = Status.Loading;

  suggestion: string = "";

  constructor(props: KataruXTermProps) {
    super(props);
    this.wasm = props.wasm;
    this.xtermRef = React.createRef();
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
    if (!this.typer) return;

    this.typer.triggerInputChanged();
    this.timeRemaining -= 1;

    if (this.timeRemaining <= 0) {
      this.clearTimeoutInterval();
      this.typer.clearInput();
      this.typer.onTextInput("...");
      this.next();
    }
  };

  setBlinkInterval = () => {
    console.log("Start blink");

    if (this.blinkIntervalId == null) {
      this.blinkCount = 0;
      this.blinkIntervalId = setInterval(this.blink, 500);
    }
  };

  clearBlinkInterval = () => {
    if (this.blinkIntervalId != null) {
      clearInterval(this.blinkIntervalId);
      this.blinkIntervalId = null;
    }
  };

  blink = () => {
    if (this.status != Status.AwaitingContinue || !this.typer) return;

    console.log("Blink!");

    let output = ANSI.BACKSPACE.repeat(3);
    switch (this.blinkCount) {
      case 0:
        output += "   ";
        break;
      case 1:
        output += ANSI.grey(" 🢂 ");
        break;
    }

    this.typer.write(output);

    this.blinkCount = (this.blinkCount + 1) % 2;
  };

  onInputChanged = (input: string, inputPos: number) => {
    if (!this.typer) return;

    if (this.status === Status.EnteringInput) {
      this.typer.write(this.prompt() + input + ANSI.left(input.length - inputPos));
      return;
    }

    // If it's a valid choice, type in green.
    if (this.wasm.is_choice(input)) {
      this.typer.write(this.prompt() + ANSI.green(input));
      this.suggestion = "";
      this.status = Status.EnteredValidChoice;
      return;
    }

    // Otherwise check for new prefix
    this.suggestion = this.wasm.autocomplete(input);
    if (this.suggestion.length > 0) {
      this.typer.write(
        this.prompt() +
        input +
        ANSI.grey(this.suggestion) +
        ANSI.left(
          Math.max(0, this.suggestion.length + (input.length - inputPos))
        )
      );
      this.status = Status.EnteringChoice;
      return;
    }

    // Otherwise, it's an invalid input, print as red.
    this.typer.write(
      this.prompt() +
      ANSI.red(input) +
      ANSI.left(Math.max(0, input.length - inputPos))
    );
    this.suggestion = "";
    this.status = Status.EnteringChoice;
  };

  onTypingDone = () => {
    this.status = Status.AwaitingContinue;
    this.setBlinkInterval();
    this.typer?.write(ANSI.grey(" 🢂 "));
    console.log("Typing done");
  };

  clearScreen = async () => {
    this.status = Status.Loading;
    await this.xtermRef.current?.fadeOut(10);

    this.typer?.reset();
    await sleep(100);

    this.next();
    await this.xtermRef.current?.fadeIn(10);
  };

  runCommand = (command: string, params: any) => {
    console.log({ command, params });

    switch (command) {
      case "clearScreen":
        this.clearScreen();
        break;
    }
  }

  // Next should only be called when there is no text currently typing.
  next = () => {
    if (!this.typer) return;

    const line = this.wasm.next(this.typer.input);
    console.log({ line });

    const LineTag = this.wasm.LineTag;

    switch (this.wasm.tag()) {
      case LineTag.Dialogue:

        const { name, text } = line;
        if (typeof text === "string") {
          if (name === "Narrator") {
            this.typer.typelns(ANSI.italics(text));
          } else {
            this.typer.typelns(ANSI.cyan(`${name}: `) + text);
          }
        }
        this.status = Status.AwaitingText;
        break;

      case LineTag.Choices:
        this.typer.write(this.prompt());
        this.status = Status.EnteringChoice;
        if (line.timeout) {
          this.setTimeoutInterval(line.timeout);
        }
        break;

      case LineTag.Input:
        for (const [_var, prompt] of Object.entries(line.input)) {
          this.typer.writeln(ANSI.cyan(`${prompt}:`));
          this.typer.write(this.prompt());
        }
        this.status = Status.EnteringInput;
        break;

      case LineTag.InvalidChoice:
        this.typer.typelns("Invalid choice.");
        break;

      case LineTag.Commands:
        console.log("Commands");

        for (const cmd of line) {
          console.log({ cmd });

          for (const [command, params] of Object.entries(cmd)) {
            this.runCommand(command, params);
          }
        }
        break;

      case LineTag.None:
        break;
    }
  };

  // Handle data input.
  onData = (data: string) => {
    console.log({ status: this.status });

    if (this.status === Status.Loading) return;
    if (!this.typer) return;

    const code: Number = data.charCodeAt(0);
    if (code === KEYS.ENTER) {
      this.onEnter();
      return;
    }

    if (![
      Status.EnteringChoice,
      Status.EnteredValidChoice,
      Status.EnteringInput
    ].includes(this.status)) return;

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
  };

  onEnter = () => {
    switch (this.status) {
      case Status.AwaitingContinue:
        this.continue();
        break;
      case Status.AwaitingText:
        console.log("flushing text");
        this.typer?.flush();
        break;
      case Status.EnteringInput:
        console.log("send input input");
        this.sendInput();
        break;
      case Status.EnteredValidChoice:
        this.selectChoice();
        break;
    }
  };

  onTab = () => {
    this.typer?.onTextInput(this.suggestion);
  };

  init = async () => {
    let fadePromise = this.xtermRef.current?.fadeIn(10);
    this.typer?.writeln(ANSI.green("Loading story..."));
    this.wasm.init();
    await fadePromise;
    this.next();
  };

  continue = () => {
    console.log("Continue!");

    this.typer?.writeln(ANSI.BACKSPACE.repeat(3));
    this.next();
  };

  selectChoice = () => {
    console.log("Selecting choice!");

    this.typer?.writeln("");
    this.clearTimeoutInterval();
    this.next();

    this.typer?.clearInput();
  };

  sendInput = () => {
    console.log("Sending input");

    if (!this.typer || this.typer.input.length <= 0) return;

    console.log(`Not empty '${this.typer.input}'`,);
    this.typer?.writeln("");
    this.next();

    this.typer?.clearInput();
  };

  componentDidMount = () => {
    if (!this.xtermRef.current) return;

    // Add the starting text to the terminal
    this.typer = new XTermTyper(
      this.xtermRef.current.terminal,
      this.onInputChanged,
      this.onTypingDone
    );

    // Initializes Kataru async
    this.init();
  };

  componentWillUnmount = () => { };

  render = () => {
    return (
      <>
        {/* Create a new terminal and set it's ref. */}
        <XTerm ref={this.xtermRef} onData={this.onData} />
      </>
    );
  };
}
