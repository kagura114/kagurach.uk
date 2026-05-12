mod bpe;
mod parser;

use wasm_bindgen::prelude::*;
use std::sync::Mutex;

// Global state (single model loaded at a time)
static MODEL: Mutex<Option<LoadedModel>> = Mutex::new(None);

struct LoadedModel {
    encoder: bpe::BpeEncoder,
    entries: Vec<parser::VocabEntry>,
}

#[wasm_bindgen]
pub fn load_model(data: &str) -> Result<(), JsValue> {
    let (entries, token_to_rank) =
        parser::parse_model(data).map_err(|e| JsValue::from_str(&e))?;

    let max_rank = entries.iter().map(|e| e.rank).max().unwrap_or(0);
    let encoder = bpe::BpeEncoder::new(token_to_rank, max_rank);

    let mut model = MODEL.lock().unwrap();
    *model = Some(LoadedModel { encoder, entries });
    Ok(())
}

#[wasm_bindgen]
pub fn vocab_size() -> u32 {
    MODEL
        .lock()
        .unwrap()
        .as_ref()
        .map(|m| m.encoder.vocab_size())
        .unwrap_or(0)
}

#[wasm_bindgen]
pub fn encode(text: &str) -> Vec<u32> {
    MODEL
        .lock()
        .unwrap()
        .as_ref()
        .map(|m| m.encoder.encode(text))
        .unwrap_or_default()
}

#[wasm_bindgen]
pub fn decode_tokens(ids: &[u32]) -> String {
    MODEL
        .lock()
        .unwrap()
        .as_ref()
        .map(|m| m.encoder.decode(ids))
        .unwrap_or_default()
}

/// Returns JSON array: [{"id":0,"bytes":[72,101,...],"text":"Hello"}, ...]
#[wasm_bindgen]
pub fn get_vocab_json() -> String {
    let model = MODEL.lock().unwrap();
    let Some(m) = model.as_ref() else {
        return "[]".to_string();
    };

    let mut json = String::with_capacity(m.entries.len() * 48);
    json.push('[');
    for (i, entry) in m.entries.iter().enumerate() {
        if i > 0 {
            json.push(',');
        }
        let text = String::from_utf8_lossy(&entry.token_bytes);
        let text_json = serde_json::to_string(text.as_ref()).unwrap_or_else(|_| "\"\"".to_string());
        json.push_str("{\"id\":");
        json.push_str(&entry.rank.to_string());
        json.push_str(",\"bytes\":[");
        for (j, &b) in entry.token_bytes.iter().enumerate() {
            if j > 0 {
                json.push(',');
            }
            json.push_str(&b.to_string());
        }
        json.push_str("],\"text\":");
        json.push_str(&text_json);
        json.push('}');
    }
    json.push(']');
    json
}

/// Get the raw bytes of a token as a JSON array
#[wasm_bindgen]
pub fn get_token_bytes_json(id: u32) -> String {
    let model = MODEL.lock().unwrap();
    let Some(m) = model.as_ref() else {
        return "[]".to_string();
    };
    match m.encoder.get_token_bytes(id) {
        Some(bytes) => {
            let mut s = String::from("[");
            for (i, &b) in bytes.iter().enumerate() {
                if i > 0 {
                    s.push(',');
                }
                s.push_str(&b.to_string());
            }
            s.push(']');
            s
        }
        None => "[]".to_string(),
    }
}

/// Encode text and return JSON with token spans for visualization:
/// [{"id":123,"bytes":[72,101],"text":"He","start":0,"end":2}, ...]
#[wasm_bindgen]
pub fn encode_with_spans(text: &str) -> String {
    let model = MODEL.lock().unwrap();
    let Some(m) = model.as_ref() else {
        return "[]".to_string();
    };

    let ids = m.encoder.encode(text);
    let mut result = String::with_capacity(ids.len() * 64);
    result.push('[');
    let mut byte_offset: usize = 0;

    for (i, &id) in ids.iter().enumerate() {
        if i > 0 {
            result.push(',');
        }
        let token_bytes = m.encoder.get_token_bytes(id).unwrap_or(&[]);
        let len = token_bytes.len();
        let token_text = String::from_utf8_lossy(token_bytes);
        let text_json =
            serde_json::to_string(token_text.as_ref()).unwrap_or_else(|_| "\"\"".to_string());

        result.push_str("{\"id\":");
        result.push_str(&id.to_string());
        result.push_str(",\"bytes\":[");
        for (j, &b) in token_bytes.iter().enumerate() {
            if j > 0 {
                result.push(',');
            }
            result.push_str(&b.to_string());
        }
        result.push_str("],\"text\":");
        result.push_str(&text_json);
        result.push_str(",\"start\":");
        result.push_str(&byte_offset.to_string());
        result.push_str(",\"end\":");
        result.push_str(&(byte_offset + len).to_string());
        result.push('}');

        byte_offset += len;
    }

    result.push(']');
    result
}
