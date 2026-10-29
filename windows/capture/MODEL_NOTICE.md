# Model attribution and license

- Model: **texify**, `vikp/texify`.
- Original author: **Vik Paruchuri / Vikas Paruchuri**.
- Original model: https://huggingface.co/vikp/texify
- Original project: https://github.com/VikParuchuri/texify
- License: **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
- License URL: https://creativecommons.org/licenses/by-sa/4.0/
- Full terms: `licenses/CC-BY-SA-4.0.txt` in the installation and release source archive.

## Distributed derivative

TeXture distributes `texify_weights.pt` and the accompanying model/tokenizer JSON
files for offline CPU recognition. The inherited maintainer build describes its
checkpoint as quantized. `convert_model.py` exports that trusted local checkpoint
to a state dictionary, replacing executable model-object serialization. The OCR
wrapper also adapts preprocessing and local model loading to the pinned runtime.
These packaging/conversion changes are by **allariala (TeXture), 2026**.

The upstream checkpoint revision and the earlier quantization recipe were not
recorded in the inherited source tree; this release does not claim to reproduce
that checkpoint byte-for-byte from a current upstream download. Instead, the
exact distributed derivative is included in the release source archive, together
with its configurations, conversion script, and SHA256 inventory:

`texify_weights.pt`: `d4624bf94ad05e57a979e9747a1cdd033e0531cb4a19923113f877204b55bc99`

The distributed derivative and TeXture's contributions to the model/configuration
material are offered under **CC BY-SA 4.0**. Recipients may copy, redistribute and
adapt them, including commercially, subject to attribution, indicating changes,
ShareAlike and the other license terms. No additional restrictions are imposed.
This model license does not purport to license generated OCR text or unrelated
TeXture application code. The original author does not endorse TeXture.

## 한국어

원본 모델은 Vik Paruchuri의 `vikp/texify`이며 CC BY-SA 4.0으로 제공됩니다.
TeXture는 기존 CPU 양자화 체크포인트를 오프라인용 상태 사전으로 변환해 배포합니다.
원본 체크포인트의 정확한 리비전과 이전 양자화 과정은 인계받은 자료에 기록되어 있지 않아,
현재 원본 다운로드로 동일한 바이트를 재생성한다고 주장하지 않습니다.
대신 실제 배포한 가중치·설정 파일·변환 스크립트와 해시를 소스 묶음에 함께 제공합니다.
변환·패키징 기여분도 CC BY-SA 4.0으로 제공하며, 재배포 시 작성자·출처·라이선스·변경 사항을
표시하고 변경한 모델에는 동일한 라이선스 조건을 적용해야 합니다.
