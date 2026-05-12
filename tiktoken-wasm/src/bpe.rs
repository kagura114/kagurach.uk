use std::collections::HashMap;

pub struct BpeEncoder {
    /// Maps token bytes -> rank (token ID)
    encoder: HashMap<Vec<u8>, u32>,
    /// Maps rank -> token bytes (for decoding), indexed by rank
    decoder: Vec<Vec<u8>>,
}

impl BpeEncoder {
    pub fn new(encoder: HashMap<Vec<u8>, u32>, max_rank: u32) -> Self {
        let mut decoder = vec![Vec::new(); (max_rank + 1) as usize];
        for (bytes, &rank) in &encoder {
            if (rank as usize) < decoder.len() {
                decoder[rank as usize] = bytes.clone();
            }
        }
        Self { encoder, decoder }
    }

    pub fn vocab_size(&self) -> u32 {
        self.encoder.len() as u32
    }

    /// Encode text to token IDs using tiktoken's BPE algorithm.
    /// Start with individual bytes, then iteratively merge the lowest-rank pair.
    pub fn encode(&self, text: &str) -> Vec<u32> {
        if text.is_empty() {
            return vec![];
        }

        let bytes = text.as_bytes();

        // Start: each byte is a separate piece
        let mut pieces: Vec<Vec<u8>> = bytes.iter().map(|&b| vec![b]).collect();

        // Iteratively merge the adjacent pair with the lowest rank
        loop {
            if pieces.len() < 2 {
                break;
            }

            let mut best_rank = u32::MAX;
            let mut best_idx = usize::MAX;

            for i in 0..pieces.len() - 1 {
                let mut merged = pieces[i].clone();
                merged.extend_from_slice(&pieces[i + 1]);
                if let Some(&rank) = self.encoder.get(&merged) {
                    if rank < best_rank {
                        best_rank = rank;
                        best_idx = i;
                    }
                }
            }

            if best_idx == usize::MAX {
                break; // No more merges possible
            }

            // Perform the merge
            let right = pieces.remove(best_idx + 1);
            pieces[best_idx].extend_from_slice(&right);
        }

        // Convert pieces to token IDs
        pieces
            .iter()
            .map(|p| self.encoder.get(p).copied().unwrap_or(u32::MAX))
            .collect()
    }

    /// Decode token IDs back to a string (lossy UTF-8)
    pub fn decode(&self, ids: &[u32]) -> String {
        let mut bytes = Vec::new();
        for &id in ids {
            if (id as usize) < self.decoder.len() {
                bytes.extend_from_slice(&self.decoder[id as usize]);
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }

    /// Get raw bytes for a single token ID
    pub fn get_token_bytes(&self, id: u32) -> Option<&[u8]> {
        self.decoder
            .get(id as usize)
            .map(|v| v.as_slice())
            .filter(|v| !v.is_empty())
    }
}
