# Kataru XTerm

An XTerm.js usage of Kataru YAML-based dialogue engine.

Kataru repository: [Github](https://github.com/Katsutoshii/kataru.git)

## Development

Instructions for getting set up to develop the project.

### Commands

```sh
# Setup
npm install
```

```sh
# Builds the project and opens it in a new browser tab. Auto-reloads when the project changes.
npm start
```

```sh
# Builds the project and places it into the `dist` folder.
npm run build
```

```sh
# Runs tests in Firefox
npm test -- --firefox

# Runs tests in Chrome
npm test -- --chrome

# Runs tests in Safari
npm test -- --safari
```

### Directories

```py
.
├── pkg             # Compiled files
├── src             # Rust source files
├── test            # Rust tests
├── js              # Javascript / Typescript source files
├── static          # Static HTML directory
├── kataru          # Kataru story source files
├── build.rs        # Build script for automatic Kataru compilation
├── cargo.toml
├── package.json
├── LICENSE
└── README.md
```
