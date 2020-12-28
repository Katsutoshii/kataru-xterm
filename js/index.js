import ReactDOM from "react-dom";
import React from "react";
import Root from "./react/Root";

import("../pkg/index.js")
  .then((wasm) => {
    ReactDOM.render(
      React.createElement(Root, { wasm }),
      document.getElementById("root")
    );
  })
  .catch(console.error);
