use base64::Engine;
use std::collections::HashMap;

/// A parsed tiktoken vocabulary entry
pub struct VocabEntry {
    pub token_bytes: Vec<u8>,
    pub rank: u32,
}

/// Parse tiktoken .model file content.
/// Each line: "<base64_encoded_bytes> <integer_rank>"
/// Returns entries sorted by rank, and a HashMap<Vec<u8>, u32> for BPE lookups.
pub fn parse_model(content: &str) -> Result<(Vec<VocabEntry>, HashMap<Vec<u8>, u32>), String> {
    let engine = base64::engine::general_purpose::STANDARD;
    let mut entries = Vec::new();
    let mut token_to_rank: HashMap<Vec<u8>, u32> = HashMap::new();

    for (line_num, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Split on last space (rank is always the last field)
        let space_pos = line.rfind(' ').ok_or_else(|| {
            format!("Line {}: missing space separator", line_num + 1)
        })?;

        let b64_str = &line[..space_pos];
        let rank_str = &line[space_pos + 1..];

        let rank: u32 = rank_str.parse().map_err(|_| {
            format!("Line {}: invalid rank '{}'", line_num + 1, rank_str)
        })?;

        let token_bytes = engine.decode(b64_str).map_err(|e| {
            format!("Line {}: base64 decode error: {}", line_num + 1, e)
        })?;

        token_to_rank.insert(token_bytes.clone(), rank);
        entries.push(VocabEntry { token_bytes, rank });
    }

    entries.sort_by_key(|e| e.rank);
    Ok((entries, token_to_rank))
}
