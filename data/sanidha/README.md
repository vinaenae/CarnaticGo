# Sanidha (Listen & guess source)

Studio Carnatic recordings from the [Sanidha dataset](https://ccml.gtcmt.gatech.edu/data/Sanidha/) (CC BY 4.0, Georgia Tech CCML).

## Setup

1. Request VPN access per the [Sanidha download page](https://ccml.gtcmt.gatech.edu/data/Sanidha/).
2. Download concert archives. **Wait until each file finishes completely** — partial files fail during extract (often on the first large video inside the tar).

   | Archive | Typical minimum size |
   |---------|----------------------|
   | Concert03.tar.gz | ~650 MB |
   | Concert04.tar.gz | ~1.8 GB |
   | Concert05.tar.gz | ~4.5 GB (full archive; partial ~4 GB still truncates) |

   If `tar` reports “truncated tar archive”, re-download; the archive never reaches `Audio-Multitracks-Clean/vocals.wav` or `violin.wav`.

3. Extract under `data/sanidha/`:

   ```powershell
   cd data\sanidha
   tar -xzf "%USERPROFILE%\Downloads\Concert03.tar.gz"
   tar -xzf "%USERPROFILE%\Downloads\Concert04.tar.gz"
   ```

   Or use the streaming helper (skips corrupt members):

   ```bash
   python services/raga-classifier/scripts/extract_sanidha_partial.py "%USERPROFILE%\Downloads\Concert03.tar.gz" "%USERPROFILE%\Downloads\Concert04.tar.gz"
   ```

   Layout (either is detected):

   ```
   data/sanidha/var/www/html/sanidha/Concert03/01-Some-Piece/
     info.json
     Audio-Multitracks-Clean/vocals.wav   (or violin.wav)
   ```

4. Export web clips (merges with existing `public/assets/raga-guess/`):

   ```bash
   python services/raga-classifier/scripts/export_sanidha_guess_samples.py
   ```

   Only new concerts:

   ```bash
   python services/raga-classifier/scripts/export_sanidha_guess_samples.py --concerts Concert03,Concert04
   ```

   Outputs `public/assets/raga-guess/manifest.json`, `ragas.json`, and `.wav` clips.

Add more concerts and re-run the export to grow the quiz pool.
