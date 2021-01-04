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
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TaggedLine {
    tag: LineTag,
    line: Line,
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

pub fn tag_line(line: &Line) -> TaggedLine {
    let tag = match line {
        Line::Choices(_) => LineTag::Choices,
        Line::Dialogue(_) => LineTag::Dialogue,
        Line::Text(_) => LineTag::Text,
        Line::InvalidChoice => LineTag::InvalidChoice,
        _ => LineTag::InvalidChoice,
    };

    TaggedLine {
        tag,
        line: line.clone(),
    }
}
