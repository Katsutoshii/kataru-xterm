// Declare modules in here
// Makes TS stop complaining about import glsl files.
declare module "*.glsl" {
    const value: string;
    export default value;
}
