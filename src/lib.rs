use kataru::*;
use wasm_bindgen::prelude::*;
// When the `wee_alloc` feature is enabled, this uses `wee_alloc` as the global
// allocator.
//
// If you don't want to use `wee_alloc`, you can safely delete this.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

static mut STORY: Option<Story> = None;
static mut CONFIG: Option<Config> = None;
static mut RUNNER: Option<Runner> = None;

#[wasm_bindgen]
pub fn init() {
    unsafe {
        STORY = Some(Story::parse(include_str!("../story/.passages.yml")).unwrap());
        CONFIG = Some(Config::parse(include_str!("../story/config.yml")).unwrap());
        RUNNER = Some(Runner::new(
            CONFIG.as_mut().unwrap(),
            &STORY.as_ref().unwrap(),
        ));
    }
}

#[wasm_bindgen]
pub fn next(s: &str) -> String {
    unsafe {
        match RUNNER.as_mut().unwrap().next(s) {
            Some(line) => match &line {
                Line::Text(text) => text.to_string(),
                Line::Dialogue(dialogue) => {
                    let (character, text) = dialogue.iter().next().unwrap();
                    format!("{}: {}", character, text)
                }
                _ => "No text".to_string(),
            },
            None => "".to_string(),
        }
    }
}

#[wasm_bindgen]
pub fn echo(s: &str) -> String {
    format!("You said '{}'!", s)
}

#[wasm_bindgen]
pub fn autocomplete(s: &str) -> String {
    if s.chars().next() == Some('i') {
        return "nstall".to_string();
    }
    "".to_string()
}
