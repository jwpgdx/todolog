# Todo App

React Native + Express + MongoDB 풀스택 Todo 앱

## 기술 스택

### Client
- React Native + Expo
- Zustand (상태 관리)
- NativeWind (스타일링)
- TanStack Query (서버 상태)
- Axios (HTTP)

### Server
- Node.js + Express
- MongoDB + Mongoose
- JWT 인증
- bcryptjs

## 설치 및 실행

### 1. MongoDB 설치 및 실행
```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# 또는 Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

### 2. 서버 실행
```bash
cd server
npm run dev
```

### 3. 클라이언트 실행
```bash
cd client
npx expo start
```

## API 엔드포인트

### Auth
- POST `/api/auth/register` - 회원가입
- POST `/api/auth/login` - 로그인

### Todos
- GET `/api/todos` - Todo 목록
- POST `/api/todos` - Todo 생성
- PUT `/api/todos/:id` - Todo 수정
- DELETE `/api/todos/:id` - Todo 삭제

## 환경 변수

`server/.env` 파일에서 설정:
- `PORT` - 서버 포트 (기본: 5000)
- `MONGODB_URI` - MongoDB 연결 URI
- `JWT_SECRET` - JWT 시크릿 키
