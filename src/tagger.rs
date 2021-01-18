use kataru::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LineTag {
    Choices,
    InvalidChoice,
    Dialogue,
    Text,
    None,
}

impl LineTag {
    pub fn tag(line: &Option<Line>) -> Self {
        match line {
            Some(Line::Choices(_)) => LineTag::Choices,
            Some(Line::Dialogue(_)) => LineTag::Dialogue,
            Some(Line::Text(_)) => LineTag::Text,
            Some(Line::InvalidChoice) => LineTag::InvalidChoice,
            _ => LineTag::None,
        }
    }
}
