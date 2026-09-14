from texify.model.model import load_model
from texify.model.processor import load_processor
import os

# 모델을 저장할 로컬 경로
save_path = "./models"
if not os.path.exists(save_path):
    os.makedirs(save_path)

print("모델 추출 중...")
# 서버에서 모델을 불러온 뒤
model = load_model()
processor = load_processor()

# 로컬 폴더에 저장
model.save_pretrained(save_path)
processor.save_pretrained(save_path)

print(f"완료! 모델이 '{os.path.abspath(save_path)}'에 저장되었습니다.")