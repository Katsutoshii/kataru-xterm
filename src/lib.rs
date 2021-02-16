use kataru::*;
use wasm_bindgen::prelude::*;

#[macro_use]
mod logger;
use logger::log;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

static mut STORY: Option<Story> = None;
static mut BOOKMARK: Option<Bookmark> = None;
static mut RUNNER: Option<Runner> = None;
static mut LINE: Option<&Line> = None;

fn try_init() -> Result<()> {
    unsafe {
        STORY = Some(Story::from_mp(include_bytes!("../pkg/story"))?);
        BOOKMARK = Some(Bookmark::from_mp(include_bytes!("../pkg/bookmark"))?);
        RUNNER = Some(Runner::new(
            BOOKMARK.as_mut().unwrap(),
            &STORY.as_ref().unwrap(),
        )?);
        console_log!("Initialized story.");
    }
    Ok(())
}
#[wasm_bindgen]
pub fn init() {
    try_init().unwrap();
}

#[wasm_bindgen]
pub fn next(input: &str) -> JsValue {
    unsafe {
        LINE = Some(RUNNER.as_mut().unwrap().next(input).unwrap());
        JsValue::from_serde(&LINE).unwrap()
    }
}

#[wasm_bindgen]
pub fn tag() -> LineTag {
    unsafe { LineTag::tag(&LINE) }
}

#[wasm_bindgen]
pub fn autocomplete(input: &str) -> String {
    unsafe {
        if let Some(Line::Choices(choices)) = LINE {
            for (choice, _passage) in &choices.choices {
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
                if choice == input {
                    return true;
                }
            }
        }
    }
    false
}
