use kataru::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LineTag {
    Choices,
    InvalidChoice,
    Dialogue,
    Text,
    Cmd,
    None,
}

impl LineTag {
    pub fn tag(line_opt: &Option<Line>) -> Self {
        match line_opt {
            Some(line) => match line {
                Line::Choices(_) => LineTag::Choices,
                Line::Dialogue(_) => LineTag::Dialogue,
                Line::Text(_) => LineTag::Text,
                Line::Cmd(_) => LineTag::Cmd,
                Line::InvalidChoice => LineTag::InvalidChoice,
                _ => LineTag::None,
            },
            None => LineTag::None,
        }
    }
}
