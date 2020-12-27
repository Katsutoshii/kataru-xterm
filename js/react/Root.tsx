import "../scss/App.scss";
import Terminal from "./Terminal";

import React, { useState, useEffect } from "react";

type Props = { wasm: any };

export default function Root(props: Props) {
  const { wasm } = props;

  // On mount
  useEffect(() => {
    console.log("Initializing story!");
    wasm.init();
  }, []);

  return (
    <div>
      <Terminal wasm={wasm} />
    </div>
  );
}
