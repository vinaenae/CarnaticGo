# Raga scales dataset (offline)

Not wired into the CarnaticGo app. Built by:

```bash
python scripts/build_raga_scales_dataset.py
python scripts/build_raga_scales_dataset.py --audio --audio-limit 200
```

## Contents

| File | Description |
|------|-------------|
| `dataset.json` | Raga names + arohanam/avarohanam (normalized Unicode swaras) |
| `audio/*.wav` | Optional reference clips (when `--audio` is used) |
| `../raw/ragavardhini-*` | Cached upstream files |

## Sources

1. **[ssrihari/ragavardhini](https://github.com/ssrihari/ragavardhini)** — `ragas.md` and `ragams.psv` (~5,000+ raga entries).
2. **72 melakarta** — computed standard patterns (merged by slug; verify for pedagogy).
3. **[sarayusapa/carnatic-ragas](https://huggingface.co/datasets/sarayusapa/carnatic-ragas)** — optional vocal clips when labels match a dataset raga name.

## Audio limitation

The web rarely hosts separate downloadable files labeled only “arohanam” / “avarohanam”. The `--audio` flag pulls **performance samples** from Hugging Face when the raga label matches. They are useful as raga-colored vocal references, not guaranteed scale-only exercises.

For true scale-only audio you would need manual recording, synthesis, or YouTube search with human curation (licensing applies).
