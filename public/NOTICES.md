# Third-party data and licenses

Attribution and license terms for datasets and models used in **Ragify**. An in-app copy lives at **About → About & legal** (`/about`).

## carnatic-ragas (Listen & guess)

The Listen & guess quiz uses short audio samples from the **sarayusapa/carnatic-ragas** dataset on Hugging Face, aligned with the eight rāgas used by the **sam-carnatic** classifier.

- **Dataset:** [sarayusapa/carnatic-ragas](https://huggingface.co/datasets/sarayusapa/carnatic-ragas)
- **Model:** [sarayusapa/sam-carnatic](https://huggingface.co/sarayusapa/sam-carnatic)
- **Export in this repo:** `python services/raga-classifier/scripts/export_guess_samples.py`

Confirm the dataset and model licenses on Hugging Face before commercial use. Keep attribution visible in the quiz (“Data credits” panel).

## KritiSamhita (Guess the shruti)

The Guess the shruti quiz uses vocal snippets from **KritiSamhita**.

- **Dataset:** [KritiSamhita: South Indian Music Tonic Recognition Dataset (Audio)](https://data.mendeley.com/datasets/nkdm57hvw3/2)
- **Dataset DOI:** [10.17632/nkdm57hvw3.2](https://doi.org/10.17632/nkdm57hvw3.2)
- **Describing article:** [PMC11286976](https://pmc.ncbi.nlm.nih.gov/articles/PMC11286976/) · DOI [10.1016/j.dib.2024.110730](https://doi.org/10.1016/j.dib.2024.110730)
- **Creation code:** [GitHub — KritiSamhita_SouthICMAudioDataset_Code](https://github.com/Sam-Kon/KritiSamhita_SouthICMAudioDataset_Code)
- **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

### Required citations

**Dataset record (when using the audio files):**

Konduri S., Pendyala K., Pendyala V. (2024). KritiSamhita: South Indian Music Tonic Recognition Dataset (Audio) [Data set]. Mendeley Data. https://doi.org/10.17632/nkdm57hvw3.2

**Describing article:**

Konduri S., Pendyala K., Pendyala V. (2024). KritiSamhita: A machine learning dataset of South Indian classical music audio clips with tonic classification. *Data in Brief*, 55, 110730. https://doi.org/10.1016/j.dib.2024.110730

### Modifications in this app

We distribute mono WAV excerpts derived from the published 20-second MP3 snippets for an educational shruti / tanpura-matching quiz.

### Your responsibilities

1. **Keep attribution** visible where the audio is used.
2. **Commercial use** is allowed under CC BY 4.0 with proper credit.
3. **Do not imply endorsement** by the dataset authors.

## Tonic detector model

The optional shruti (tonic) classifier is trained on **KritiSamhita** (F♯, G, G♯, A). Weights live in `services/tonic-detector/checkpoints/`. Retrain with `npm run train:tonic` or the Colab notebook in that folder.
