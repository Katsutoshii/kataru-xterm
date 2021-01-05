use kataru::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub enum LineTag {
    Choices,
    InvalidChoice,
    Dialogue,
    Text,
    None,
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TaggedLine {
    tag: LineTag,
    line: Option<Line>,
}

#[wasm_bindgen]
impl TaggedLine {
    pub fn tag(&self) -> LineTag {
        self.tag
    }

    pub fn line(&self) -> JsValue {
        JsValue::from_serde(&self.line).unwrap()
    }
}

pub fn tag_line(line: &Option<Line>) -> TaggedLine {
    let tag = match line {
        Some(Line::Choices(_)) => LineTag::Choices,
        Some(Line::Dialogue(_)) => LineTag::Dialogue,
        Some(Line::Text(_)) => LineTag::Text,
        Some(Line::InvalidChoice) => LineTag::InvalidChoice,
        _ => LineTag::None,
    };

    TaggedLine {
        tag,
        line: line.clone(),
    }
}
