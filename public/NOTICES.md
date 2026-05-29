# Sources, attributions, and licenses

Datasets, models, and reference material used in **Ragify**, organized by feature. This page is the in-app copy at **About → About & legal** (`/about`); it mirrors `public/NOTICES.md` in the repository.

All Carnatic theory text in the app (theory quiz, help panels, raga/tala descriptions) is written in our own words. The links below are works we consulted or data we built on — not text copied verbatim. Where a structured reference shaped our data tables, it is listed as a source.

## Audio datasets

### carnatic-ragas (Listen & guess)

The Listen & guess quiz uses short audio samples from the **sarayusapa/carnatic-ragas** dataset, aligned with the eight rāgas used by the **sam-carnatic** classifier.

- **Dataset:** [sarayusapa/carnatic-ragas](https://huggingface.co/datasets/sarayusapa/carnatic-ragas)
- **Model:** [sarayusapa/sam-carnatic](https://huggingface.co/sarayusapa/sam-carnatic)
- **Export in this repo:** `services/raga-classifier/scripts/export_guess_samples.py`

Confirm the dataset and model licenses on Hugging Face before commercial use. Keep attribution visible in the quiz ("Data credits" panel).

### KritiSamhita (Guess the shruti / Listen & guess clips)

The Guess the shruti quiz and the KritiSamhita-derived Listen & guess clips use vocal snippets from **KritiSamhita**.

- **Dataset:** [KritiSamhita: South Indian Music Tonic Recognition Dataset (Audio)](https://data.mendeley.com/datasets/nkdm57hvw3/2)
- **Dataset DOI:** [10.17632/nkdm57hvw3.2](https://doi.org/10.17632/nkdm57hvw3.2)
- **Describing article:** [PMC11286976](https://pmc.ncbi.nlm.nih.gov/articles/PMC11286976/) · DOI [10.1016/j.dib.2024.110730](https://doi.org/10.1016/j.dib.2024.110730)
- **Creation code:** [GitHub — KritiSamhita_SouthICMAudioDataset_Code](https://github.com/Sam-Kon/KritiSamhita_SouthICMAudioDataset_Code)
- **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

#### Required citations

**Dataset record (when using the audio files):**

Konduri S., Pendyala K., Pendyala V. (2024). KritiSamhita: South Indian Music Tonic Recognition Dataset (Audio) [Data set]. Mendeley Data. https://doi.org/10.17632/nkdm57hvw3.2

**Describing article:**

Konduri S., Pendyala K., Pendyala V. (2024). KritiSamhita: A machine learning dataset of South Indian classical music audio clips with tonic classification. Data in Brief, 55, 110730. https://doi.org/10.1016/j.dib.2024.110730

#### Modifications in this app

We distribute mono WAV excerpts derived from the published 20-second MP3 snippets for an educational shruti / tanpura-matching quiz. The published dataset stores tonic labels (F♯, G, G♯, A); rāga labels for Listen & guess were verified separately (see "Listen & guess rāga labels" below).

#### Your responsibilities

1. **Keep attribution** visible where the audio is used.
2. **Commercial use** is allowed under CC BY 4.0 with proper credit.
3. **Do not imply endorsement** by the dataset authors.

### Saraga (reference)

The [Saraga](https://mtg.github.io/saraga/) open Carnatic/Hindustani collection (MTG, Universitat Pompeu Fabra) was consulted as a reference for the Listen & guess quiz design.

## Models

### Tonic (shruti) detector

The optional shruti (tonic) classifier is trained on **KritiSamhita** (F♯, G, G♯, A). Weights live in `services/tonic-detector/checkpoints/`. Retrain with `npm run train:tonic` or the Colab notebook in that folder.

### sam-carnatic raga classifier

The eight-class rāga classifier used to align Listen & guess samples is [sarayusapa/sam-carnatic](https://huggingface.co/sarayusapa/sam-carnatic). The web app no longer calls this service at runtime; it is used for dataset export scripts.

## Pitch detection (warmup tuner)

Real-time pitch detection in the warmup tuner follows Daniel Shiffman's Coding Train tutorial, using the ml5.js CREPE model. The in-app footer credits these directly.

- **Coding Train #151 — Ukulele Tuner with CREPE:** [write-up](https://thecodingtrain.com/CodingChallenges/151-ukulele-tuner.html) · [video](https://youtu.be/F1OkDTUkKFo) · [p5.js sketch](https://editor.p5js.org/codingtrain/sketches/8io2zvT03)
- **ml5 PitchDetection (CREPE wiring):** [ml5-library source](https://github.com/ml5js/ml5-library/blob/main/src/PitchDetection/index.js)
- **CREPE model weights:** [ml5 data and models](https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/)

Swara targets are computed from our Carnatic interval ratio chart times the selected Sa.

The in-browser CREPE pitch detection in `src/lib/audio/ml5-crepe-pitch.ts` is **ported from ml5.js's PitchDetection module** (same algorithm, constants, and model weights), rewritten in TypeScript. ml5.js is distributed under the MIT License, reproduced below.

#### ml5.js — MIT License

Copyright (c) 2017 ml5

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The CREPE pitch-tracking model (Kim, Salamon, Li, Bello, 2018) is likewise used under permissive (MIT) terms via ml5's distribution.

## Rāga scales and metadata

Rāga metadata (parent/melakarta, classification, type, arohanam/avarohanam) is built from a shared data pool plus rules in code — the app does not scrape a per-rāga page at runtime.

- **Ragavardhini** (janya scales, parent numbers) — [ssrihari/ragavardhini](https://github.com/ssrihari/ragavardhini/tree/master/ragas), built into `data/raga-scales/dataset.json`
- **Karnatik janya list** — [karnatik.com/janyalist2.shtml](https://karnatik.com/janyalist2.shtml) (stored as `data/raga-scales/karnatik-janyalist2.json`)
- **Arohanam / avarohanam reference** — [Ragasurabhi — ragas](https://www.ragasurabhi.com/carnatic-music/ragas.html)
- Rāga type (Audava / Shadava / Sampoorna) is counted in code from the arohanam/avarohanam swaras (not scraped).
- Melakarta names and numbers use the standard Katapayādi-derived 72-melakarta list computed in `src/lib/melakarta72.ts`.

## Melakarta system (72-melakarta wheel)

Framework, chakras, and history for the melakarta feature were drawn from:

- [Wikipedia — Melakarta](https://en.wikipedia.org/wiki/Melakarta) (72-raga system, rules, history, Katapayādi, chakras, raga table)
- [Kalpana Sangeetha Sabha — 72 Melakarta Ragas](https://sites.google.com/site/kalpsangeethasabha/ragas/72-melakarta-ragas) (chakra structure, Dha/Ni combinations)
- [Carnatic Corner — Mukund Melakarta Raga Chart](https://www.carnaticcorner.com/articles/mukund_chart.htm) · [chart PDF](https://www.carnaticcorner.com/articles/mukundchart.pdf) (M₁/M₂ split, vivādi notes)
- [Melakarta.com](https://www.melakarta.com/) (interactive chart concept)
- [Indian Heritage — Melakartha Raga Booklet (PDF)](https://www.indian-heritage.org/music/Melakartha%20Raga%20Booklet%20-%20new.pdf) (Govindacharya names, swara abbreviations)
- [D. Pattammal — Raga Pravaham](http://www.dpattammal.com/ragapravaham_more.htm) (Dha/Ni steps within each chakra)
- Composer context: [Koteeswara Iyer](https://en.wikipedia.org/wiki/Koteeswara_Iyer) · [Carnatica — Melaraga kritis of Koteeswara Iyer](http://carnatica.net/special/koteeswaraiyer.htm)
- Name etymology examples: [Kosala](https://en.wikipedia.org/wiki/Kosala) · [Koshala definition](https://www.wisdomlib.org/definition/koshala)

## Music theory content (theory quiz and concept panels)

Theory questions and explanations are written in our own words, informed by introductory overview material:

- [Carnatic Music (PDF) — vicky1997](https://vicky1997.github.io/images/Carnatic_Music.pdf)
- [Carnatic music theory (PDF) — Beautiful Note](https://beautifulnote.com//download/carnatic_music_theory1.pdf)
- [Ragasurabhi — ragas](https://www.ragasurabhi.com/carnatic-music/ragas.html)
- [Wikipedia — Melakarta](https://en.wikipedia.org/wiki/Melakarta)

### Tāla (laya & thalam)

The suladi sapta tāla × pañca jāti beat structure (angas, jāti counts, beats per cycle) in `src/lib/carnatic-tala.ts` is standard Carnatic theory. Tāla structure was cross-checked against [Paramu Kurumathur — Indian music systems: tāla](https://paramukurumathur.com/11-indian-music-systems-tala/); the app's wording and data tables are our own and are not copied from that page.

## Hand tracking and 3D tāla hand

- **Hand tracking:** [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) (`@mediapipe/tasks-vision`), Google.
- **Rigged hand model:** `rigged-hand.glb` from [WonderlandEngine/hand-poser](https://github.com/WonderlandEngine/hand-poser) (OpenXR/WebXR hand skeleton). Re-download with `npm run download:hand-model`.

## Listen & guess rāga labels (per-song verification)

Rāga labels for the KritiSamhita-derived Listen & guess clips were verified against published kriti catalogues. Primary references:

- [karnatik.com](https://www.karnatik.com/) — kriti catalogue (e.g. Koluvaiyunnade [c2404](https://www.karnatik.com/c2404.shtml), Dasaratha Nandana [c2250](https://www.karnatik.com/c2250.shtml), Inta Tamasamaite → Saveri [c2364](https://www.karnatik.com/c2364.shtml), Sita Kalyana → Shankarabharanam [c1278](https://www.karnatik.com/c1278.shtml), Ramachandraya Janaka → Kurinji [c15998](https://www.karnatik.com/c15998.shtml), Analekara → Suddha Saveri [c2415](https://karnatik.com/c2415.shtml), Vara Veena → Mohanam [c1734](https://www.karnatik.com/c1734.shtml), Raravenu → Bilahari [c1735](https://karnatik.com/c1735.shtml), Gana Ganamunaku → Hamsadhwani [c17312](https://www.karnatik.com/c17312.shtml), Sri Gananatha → Malahari [c5480](https://www.karnatik.com/c5480.shtml), Shobillu → Jaganmohini [c1044](https://www.karnatik.com/c1044.shtml), Shree Gananatham → Esha Manohari [c1038](https://karnatik.com/c1038.shtml))
- [shivkumar.org](https://www.shivkumar.org/music/) — lyrics and notation ([Koluvaiyunnade](https://www.shivkumar.org/music/koluvaiyunnade.htm), [Raravenu swarajati](https://www.shivkumar.org/music/varnams/raravenu-swarajati.htm), [Analekara geetham](https://www.shivkumar.org/music/varnams/analekara-geetham.htm), [Shobillu](https://www.shivkumar.org/music/shobillu.htm), [Shree Gananatham](https://www.shivkumar.org/music/shreegananatham.htm))
- Thyagaraja Vaibhavam — [Sita Kalyana](http://thyagaraja-vaibhavam.blogspot.com/2008/04/thyagaraja-kriti-sita-kalyana.html), [Inta Taamasamaitae](http://thyagaraja-vaibhavam.blogspot.com/2007/03/thyagaraja-kriti-inta-taamasamaitae.html)
- [Sangeeta Sahityam — Sree Gananatha (Malahari)](https://www.sangeetasahityam.com/geetams/sree-gananatha-malahari)
- Wikipedia — [Bhadrachala Ramadasu](https://en.wikipedia.org/wiki/Bhadrachala_Ramadasu), [Suddha Saveri](https://en.wikipedia.org/wiki/Suddha_Saveri), [Mayamalavagaula](https://en.wikipedia.org/wiki/Mayamalavagaula), [Kamalamba Navavarna Kritis](https://en.wikipedia.org/wiki/Kamalamba_Navavarna_Kritis)
- Additional lyric references: [Lambodara geetham](https://musicmaster.in/blog/lambodara-lakumikara-lyrics-geetham/) · [Lambodara in Malahari](https://www.octavesonline.com/post/first-song-first-raga-first-step-lambodara-in-malahari) · [Rara Venu Gopa Bala](https://vignanam.org/meaning/samskritam/carnatic-music-svarajathi-1-rara-venu-gopa-bala.html) · [Shobhillu Sapta Svara](https://sujamusic.wordpress.com/2017/03/26/shobhillu-sapta-svara/) · [Ramachandraya Janaka in Kurinji](https://learncarnaticmusicblog.wordpress.com/2021/12/13/ramachandraya-janaka-in-kurunji-with-lyrics-bhadrachala-ramadasu-watch-video-now/)

Guess the shruti stores only song name + tonic (F♯, G, G♯, A) from the KritiSamhita CSV and has no rāga quiz.
