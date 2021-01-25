import * as React from "react";
import { WebglAddon } from "xterm-addon-webgl";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";
import * as THREE from "three";
import * as PP from "postprocessing";

import { options } from "../util/XTermOptions";
import * as KEYS from "../util/keycodes";
import "xterm/css/xterm.css";
import glitchShader from "../../shaders/glitch.glsl";

// We are using these as types.
// eslint-disable-next-line no-unused-vars
import { Terminal, ITerminalOptions, ITerminalAddon } from "xterm";
import { sleep } from "../util/async";

const SCALE_FACTOR_LOW: number = 0.01;
const SCALE_FACTOR_MID: number = 0.06;
const SCALE_FACTOR_HIGH: number = 0.3;

interface IProps {
  /**
   * Class name to add to the terminal container.
   */
  className?: string;

  /**
   * Adds an event listener for when a data event fires. This happens for
   * example when the user types or pastes into the terminal. The event value
   * is whatever `string` results, in a typical setup, this should be passed
   * on to the backing pty.
   */
  onData?(data: string): void;
}

export default class ShadedXTerm extends React.Component<IProps> {
  /**
   * The ref for the containing element.
   */
  terminalRef: React.RefObject<HTMLDivElement>;

  /**
   * XTerm.js Terminal object.
   */
  terminal!: Terminal; // This is assigned in the setupTerminal() which is called from the constructor

  // For shader
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  mesh: THREE.Mesh;
  camera: THREE.Camera;
  composer: any;
  textures: any;
  lastRenderTime: number;
  clock: THREE.Clock;
  animationId: any;
  passes: any;
  timeUniforms: any;
  scaleFactorUniforms: any;
  scaleFactor: number;

  constructor(props: IProps) {
    super(props);

    this.terminalRef = React.createRef();
    this.scaleFactor = SCALE_FACTOR_LOW;

    this.setupTerminal();
  }

  setupTerminal() {
    // Setup the XTerm terminal.
    this.terminal = new Terminal(options);

    // Create Listeners
    this.terminal.onData(this.onData);
  }

  getXTermLayers = () => {
    const xTermScreen = this.terminal.element;
    return Array.from(xTermScreen.querySelectorAll("canvas"));
  };

  getSortedXTermLayers = () => {
    const xTermLayers = this.getXTermLayers();

    const getZIndex = (element) => {
      const { zIndex } = window.getComputedStyle(element);
      return zIndex === "auto" ? 0 : Number(zIndex);
    };

    const map = new Map(xTermLayers.map((el) => [el, getZIndex(el)]));
    return xTermLayers.sort((a, b) => map.get(a) - map.get(b));
  };

  addTextures = () => {
    const xtermLayers = this.getSortedXTermLayers();
    this.textures = [];

    for (const [idx, canvas] of xtermLayers.entries()) {
      const texture = new THREE.CanvasTexture(canvas);
      this.textures.push(texture);

      texture.minFilter = THREE.LinearFilter;
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        map: texture,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = idx;
      this.scene.add(mesh);
    }
  };

  refreshTextures = () => {
    for (const texture of this.textures) {
      texture.needsUpdate = true;
    }
    this.animate();
  };

  animate = () => {
    for (let i = 0; i < this.timeUniforms.length; i++) {
      this.timeUniforms[i].value = this.clock.getElapsedTime() + 1;
    }

    this.composer.render(this.clock.getDelta());
    this.lastRenderTime = performance.now();
  };

  animateLoop = () => {
    this.animationId = window.requestAnimationFrame(this.animateLoop);
    const now = performance.now();
    if (now - this.lastRenderTime < 1000 / 30) {
      return;
    }

    this.animate();
  };

  startAnimate = () => {
    const fms = 1000 / 30;
    this.lastRenderTime = fms;

    this.timeUniforms = this.passes
      .filter((pass) => {
        return (
          pass.getFullscreenMaterial() &&
          pass.getFullscreenMaterial().uniforms.time !== undefined
        );
      })
      .map((pass) => {
        return pass.getFullscreenMaterial().uniforms.time;
      });

    this.scaleFactorUniforms = this.passes
      .filter((pass) => {
        return (
          pass.getFullscreenMaterial() &&
          pass.getFullscreenMaterial().uniforms.e0ScaleFactor !== undefined
        );
      })
      .map((pass) => {
        return pass.getFullscreenMaterial().uniforms.e0ScaleFactor;
      });

    this.clock.start();
    this.animateLoop();
    this.terminal.onRender(this.refreshTextures);
    this.terminal.onCursorMove(this.refreshTextures);
    this.terminal.onSelectionChange(this.refreshTextures);
    this.terminal.element.addEventListener("mouseup", this.refreshTextures);
    this.terminal.element.addEventListener("mousedown", this.refreshTextures);
    this.terminal.element.addEventListener("drag", this.refreshTextures);
  };

  webgl_init = () => {
    // Setup camera and scene
    this.clock = new THREE.Clock(false);
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 1, 1000);
    this.camera.position.z = 400;
    this.scene = new THREE.Scene();
    this.addTextures();

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.terminal.element.clientWidth,
      this.terminal.element.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.domElement.id = "webgl-renderer";
    document.body.appendChild(this.renderer.domElement);

    // Setup composer
    this.composer = new PP.EffectComposer(this.renderer);
    this.passes = [
      new PP.RenderPass(this.scene, this.camera),
      new PP.EffectPass(
        null,
        new PP.Effect("filmShader", glitchShader, {
          blendFunction: PP.BlendFunction.NORMAL,
          uniforms: new Map(
            Object.entries({
              scaleFactor: new THREE.Uniform(SCALE_FACTOR_LOW),
            })
          ),
        })
      ),
    ];
    for (const pass of this.passes) {
      this.composer.addPass(pass);
    }

    this.startAnimate();
  };

  setScaleFactor = (scaleFactor: number) => {
    for (let i = 0; i < this.scaleFactorUniforms.length; i++) {
      this.scaleFactorUniforms[i].value = scaleFactor;
    }
  };

  lerp = async (start: number, end: number, n: number, ms: number) => {
    const delta = (end - start) / n;
    let value = start;
    for (let i = 0; i < n; ++i) {
      this.setScaleFactor(value);
      value += delta;
      await sleep(ms);
    }
    this.setScaleFactor(end);
  };

  spikeGlitch = async () => {
    await this.lerp(SCALE_FACTOR_LOW, SCALE_FACTOR_MID, 4, 25);
    return this.lerp(SCALE_FACTOR_MID, SCALE_FACTOR_LOW, 4, 25);
  };

  fadeIn = async (n: number) => {
    return this.lerp(SCALE_FACTOR_HIGH, SCALE_FACTOR_LOW, n, 50);
  };

  fadeOut = async (n: number) => {
    return this.lerp(SCALE_FACTOR_LOW, SCALE_FACTOR_HIGH, n, 50);
  };

  onData = (data: string) => {
    const code: Number = data.charCodeAt(0);
    if (code === KEYS.ENTER || code == KEYS.TAB) {
      this.spikeGlitch();
    }
    this.props.onData(data);
  };

  componentDidMount = () => {
    if (this.terminalRef.current) {
      // Creates the terminal within the container element.
      this.terminal.open(this.terminalRef.current);

      // Load addons
      const fitAddon = new FitAddon();
      this.terminal.loadAddon(fitAddon);
      fitAddon.fit();

      this.terminal.loadAddon(new WebglAddon());
      this.terminal.loadAddon(new WebLinksAddon());

      // Initialize shader
      this.webgl_init();
    }
  };

  componentWillUnmount = () => {
    // When the component unmounts dispose of the terminal and all of its listeners.
    this.terminal.dispose();
  };

  render = () => {
    return <div className={this.props.className} ref={this.terminalRef} />;
  };
}
