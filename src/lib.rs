use kataru::*;
use wasm_bindgen::prelude::*;
mod tags;
use tags::*;

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
static mut LINE: Option<Line> = None;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

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
pub fn next(input: &str) -> TaggedLine {
    console_log!("input: {}", input);
    unsafe {
        LINE = RUNNER.as_mut().unwrap().next(input);
        let tagged_line = tag_line(LINE.as_ref().unwrap());
        console_log!("config: {}", format!("{:?}", CONFIG.as_ref().unwrap()));
        tagged_line
    }
}

#[wasm_bindgen]
pub fn autocomplete(input: &str) -> String {
    unsafe {
        if let Some(Line::Choices(choices)) = &LINE {
            for (choice, _passage) in &choices.choices {
                console_log!("input len: {}", input.len());
                if choice.starts_with(input) && choice != input {
                    return choice[input.len()..].to_string();
                }
            }
        }
    }

    "".to_string()
}

#[wasm_bindgen]
pub fn is_choice(input: &str) -> bool {
    unsafe {
        if let Some(Line::Choices(choices)) = &LINE {
            for (choice, _passage) in &choices.choices {
                console_log!("input len: {}", input.len());
                if choice == input {
                    return true;
                }
            }
        }
    }
    false
}
