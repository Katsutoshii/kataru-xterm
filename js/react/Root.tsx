import "../scss/App.scss";
import KataruXTerm from "./KataruXTerm";

import React from "react";

type Props = { wasm: typeof import("../../pkg") };

export default function Root(props: Props) {
  const { wasm } = props;

  return (
    <div>
      <KataruXTerm wasm={wasm} />
    </div>
  );
}
