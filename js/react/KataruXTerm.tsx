import React from "react";
import XTerm from "./ShadedXTerm";
import * as ANSI from "../util/ansi";
import * as KEYS from "../util/keycodes";
import XTermTyper from "../util/XTermTyper";
import { sleep } from "../util/async";

type KataruXTermProps = {
  wasm: typeof import("../../pkg");
};

export default class KataruXTerm extends React.Component<KataruXTermProps, {}> {
  xtermRef: React.RefObject<XTerm>;
  typer: XTermTyper | null = null;
  wasm: typeof import("../../pkg");
  timeoutIntervalId: NodeJS.Timeout | null = null;
  blinkIntervalId: NodeJS.Timeout | null = null;
  blinkCount: number = 0;
  timeRemaining: number = 0;
  isAwaitingChoice: boolean = false;
  isValidChoice: boolean = false;
  suggestion: string = "";
  interactable: boolean = false;

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
    if (!this.interactable || !this.typer) return;

    if (this.typer.isTyping() || this.isAwaitingChoice) return;

    console.log("Blink!");
    let output = ANSI.BACKSPACE.repeat(3);
    switch (this.blinkCount) {
      case 0:
        output += ANSI.grey(" 🢂 ");
        break;
      case 1:
        output += "   ";
        break;
    }

    this.typer.write(output);

    this.blinkCount = (this.blinkCount + 1) % 2;
  };

  onInputChanged = (input: string, inputPos: number) => {
    if (!this.typer) return;

    // If it's a valid choice, type in green.
    if (this.wasm.is_choice(input)) {
      this.typer.write(this.prompt() + ANSI.green(input));
      this.suggestion = "";
      this.isValidChoice = true;
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
      this.isValidChoice = false;
      return;
    }

    // Otherwise, it's an invalid input, print as red.
    this.typer.write(
      this.prompt() +
        ANSI.red(input) +
        ANSI.left(Math.max(0, input.length - inputPos))
    );
    this.suggestion = "";
    this.isValidChoice = false;
  };

  onTypingDone = () => {
    this.typer?.write("   ");
    this.setBlinkInterval();
  };

  clearScreen = async () => {
    console.log("interactable = false");

    this.interactable = false;
    await this.xtermRef.current?.fadeOut(10);

    this.typer?.reset();
    await sleep(100);

    this.next();
    await this.xtermRef.current?.fadeIn(10);
    this.interactable = true;

    console.log("interactable = true");
  };

  // Next should only be called when there is no text currently typing.
  next = () => {
    if (!this.typer) return;

    const line = this.wasm.next(this.typer.input);
    const LineTag = this.wasm.LineTag;

    switch (this.wasm.tag()) {
      case LineTag.Dialogue:
        let [speaker, text] = Object.entries(line)[0];
        if (typeof text === "string") {
          this.typer.typelns(ANSI.cyan(`${speaker}: `) + text);
        }
        this.isAwaitingChoice = false;
        break;

      case LineTag.Text:
        this.typer.typelns(ANSI.italics(line));
        this.isAwaitingChoice = false;
        break;

      case LineTag.Choices:
        this.typer.write(this.prompt());
        this.isAwaitingChoice = true;
        if (line.timeout) {
          this.setTimeoutInterval(line.timeout);
        }
        break;

      case LineTag.InvalidChoice:
        this.typer.typelns("Invalid choice.");
        break;

      case LineTag.Cmd:
        switch (line.cmd) {
          case "clearScreen":
            this.clearScreen();
            break;
        }
        break;

      case LineTag.None:
        this.isAwaitingChoice = true;
        break;
    }
  };

  // Handle data input.
  onData = (data: string) => {
    if (!this.interactable || !this.typer) return;

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
    if (!this.typer) return;

    if (this.typer.isTyping()) {
      this.typer.flush();
    } else {
      if (this.isAwaitingChoice) {
        if (this.isValidChoice) {
          this.selectChoice();
        }
      } else {
        this.continue();
      }
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
    this.interactable = true;
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

    this.isValidChoice = false;
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

  componentWillUnmount = () => {};

  render = () => {
    return (
      <>
        {/* Create a new terminal and set it's ref. */}
        <XTerm ref={this.xtermRef} onData={this.onData} />
      </>
    );
  };
}
