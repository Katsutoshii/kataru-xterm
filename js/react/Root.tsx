import "../scss/App.scss";
import Terminal from "./Terminal";

import React, { useState, useEffect } from "react";

type Props = { wasm: any };

export default function Root(props: Props) {
  const { wasm } = props;

  return (
    <div>
      <Terminal wasm={wasm} />
    </div>
  );
}
