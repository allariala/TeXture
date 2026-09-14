import torch
# 사용 중이신 texify 모듈을 불러옵니다.
from texify.model.model import load_model

def create_quantized_model():
    print("1. 원본 texify 모델을 불러오는 중입니다... (1.16GB 메모리 사용)")
    original_model = load_model() 
    
    # 평가 모드로 전환 (필수)
    original_model.eval()

    print("2. 모델 다이어트(INT8 양자화)를 시작합니다... (잠시만 기다려주세요)")
    # 핵심: 신경망의 Linear 레이어들의 가중치를 압축합니다.
    quantized_model = torch.quantization.quantize_dynamic(
        original_model, 
        {torch.nn.Linear}, 
        dtype=torch.qint8
    )

    print("3. 압축된 모델을 저장합니다...")
    # 압축된 모델 전체를 'texify_quantized.pt' 라는 파일로 저장합니다.
    torch.save(quantized_model, "texify_quantized.pt")
    
    print("완료! 이제 약 300MB 크기의 'texify_quantized.pt' 파일이 생성되었습니다.")

if __name__ == "__main__":
    create_quantized_model()