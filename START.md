
0. ip 확인
ipconfig getifaddr en0

.env 수정할것.

1. 그냥 실행
npx expo start --dev-client -c

2. 네이티브 포함 실행
npx expo run:ios --device
npx expo run:android --device

결론: 평소엔 1번으로 개발하다가, 뭐 새로 설치하면 2번 돌리세요!

## 접속 주소
- 웹 앱: http://localhost:8081
- API 서버: http://localhost:5000

