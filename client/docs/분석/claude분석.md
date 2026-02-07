정확히 핵심을 짚으셨습니다. 이 선택이 앱 전체 UX를 결정합니다.

---

## 상황 분석

### Option 1: 바로 Todo 화면 (자동 게스트)
```
앱 설치 → 즉시 Todo 화면 → 할일 생성 가능
```

**문제 시나리오:**
```javascript
1. 앱 설치 → 자동 게스트 생성 (UUID: guest-123)
2. 할일 10개 생성
3. "아 이거 내 기존 계정으로 쓰고 싶다"
4. 기존 계정 로그인 (UUID: user-456)

// 😱 지옥의 데이터 병합
- guest-123의 할일 10개 → user-456로 이동?
- 카테고리 중복은? (Inbox 2개?)
- 완료 기록은?
- 서버 동기화 충돌은?
- 클라이언트 SQLite 정리는?

// 코드 복잡도 폭발
const mergeGuestToExistingUser = async (guestId, userId) => {
  // 1. 할일 이동
  await Todo.updateMany(
    { userId: guestId },
    { userId: userId }
  );
  
  // 2. 카테고리 병합 (중복 처리)
  const guestCategories = await Category.find({ userId: guestId });
  const userCategories = await Category.find({ userId: userId });
  
  for (const guestCat of guestCategories) {
    const duplicate = userCategories.find(c => c.name === guestCat.name);
    if (duplicate) {
      // 게스트 카테고리의 할일을 기존 카테고리로 이동
      await Todo.updateMany(
        { categoryId: guestCat._id },
        { categoryId: duplicate._id }
      );
      await Category.deleteOne({ _id: guestCat._id });
    } else {
      await Category.updateOne(
        { _id: guestCat._id },
        { userId: userId }
      );
    }
  }
  
  // 3. 완료 기록 이동
  await Completion.updateMany(
    { userId: guestId },
    { userId: userId }
  );
  
  // 4. 게스트 계정 삭제
  await User.deleteOne({ _id: guestId });
  
  // 5. 클라이언트 SQLite 전체 재동기화
  await fullSync();
};
```

**이거 진짜 헬입니다.** 😱

---

### Option 2: 로그인 화면 (게스트 버튼)
```
앱 설치 → 로그인 화면
- "게스트로 시작하기" 버튼
- "기존 계정으로 로그인" 버튼
```

**장점:**
- ✅ 명확한 선택 (게스트 vs 기존 계정)
- ✅ 데이터 병합 문제 없음
- ✅ 코드 단순

**단점:**
- ❌ 진입 장벽 (버튼 1번 클릭)

---

## 하이브리드 솔루션 (추천) 🎯

### "Smart Onboarding"

```
┌─────────────────────────────────┐
│   Welcome to Todo App! 🎉       │
│                                  │
│   [시작하기]  ← 큰 버튼          │
│                                  │
│   이미 계정이 있으신가요?        │
│   → 로그인                       │
└─────────────────────────────────┘

"시작하기" 클릭 → 자동 게스트 생성
"로그인" 클릭 → 로그인 화면
```

**핵심:**
- 기본 흐름은 게스트 (바로 시작)
- 기존 사용자는 명시적으로 "로그인" 선택
- **데이터 병합 문제 회피**

---

## 구체적 구현 방안

### A. 최소 마찰 버전 (추천)

```javascript
// WelcomeScreen.js
export default function WelcomeScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-white px-6">
      {/* 로고 */}
      <Text className="text-4xl font-bold mb-2">✓ Todo</Text>
      <Text className="text-gray-500 mb-12">간단하고 강력한 할일 관리</Text>
      
      {/* 메인 액션 */}
      <TouchableOpacity
        className="bg-blue-500 w-full py-4 rounded-xl mb-4"
        onPress={handleStart}
      >
        <Text className="text-white text-center font-bold text-lg">
          시작하기
        </Text>
      </TouchableOpacity>
      
      {/* 세컨더리 액션 */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text className="text-gray-600">
          이미 계정이 있으신가요? <Text className="text-blue-500 font-semibold">로그인</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const handleStart = async () => {
  // 자동 게스트 생성
  await authStore.loginAsGuest();
  navigation.replace('Home');
};
```

**유저 입장:**
1. 앱 열기 → "시작하기" 1번 클릭 → 바로 사용 ✅
2. 기존 사용자는 "로그인" 명시적 선택 ✅

**개발자 입장:**
- 데이터 병합 로직 불필요 ✅
- 코드 단순 ✅

---

### B. 완전 자동 버전 (비추천)

```javascript
// App.js
useEffect(() => {
  const token = await AsyncStorage.getItem('token');
  
  if (token) {
    // 기존 사용자 → 메인 화면
    navigation.replace('Home');
  } else {
    // 신규 사용자 → 자동 게스트 생성
    await authStore.loginAsGuest();
    navigation.replace('Home');
  }
}, []);
```

**문제:**
```
사용자: "어? 내 기존 데이터가 안 보이네? 아 로그인을 안 했구나"
→ 로그인 시도
→ 😱 방금 만든 게스트 데이터는?
```

이거 **UX 재앙**입니다.

---

## 실제 앱 사례 분석

### Todoist (Option 2 방식)
```
로그인 화면:
- [구글로 시작하기]
- [이메일로 시작하기]
- [계정이 있으신가요? 로그인]

✅ 명확함
❌ 버튼 1번 더 클릭
```

### Things 3 (Option 1 방식)
```
앱 열기 → 바로 Todo 화면
나중에 "Things Cloud" 설정에서 동기화 켜기

⚠️ 문제: 동기화 켜면 로컬 데이터가 날아감 (사용자 불만 多)
```

### Notion (하이브리드)
```
앱 열기 → Welcome 화면
- [Get Started] ← 큰 버튼 (자동 게스트)
- [I have an account] ← 작은 링크

✅ 최고의 UX
✅ 데이터 병합 문제 없음
```

**Notion 방식이 정답입니다.**

---

## 데이터 병합이 필요한 경우

만약 Option 1을 선택하더라도 "병합"은 **절대 하지 마세요**.

### 대신 이렇게:

```javascript
// 기존 계정 로그인 시
if (hasLocalGuestData) {
  showDialog({
    title: '게스트 데이터가 있습니다',
    message: '게스트로 만든 할일이 3개 있습니다.',
    options: [
      {
        text: '게스트 데이터 삭제하고 로그인',
        onPress: () => {
          deleteGuestData();
          loginExistingUser();
        }
      },
      {
        text: '게스트로 계속 사용',
        onPress: () => {
          // 로그인 취소
        }
      }
    ]
  });
}
```

**병합은 하지 않습니다. 선택하게 합니다.**

---

## 최종 추천: 하이브리드 방식

### 화면 흐름

```
1. 앱 설치
   ↓
2. Welcome 화면
   - [시작하기] ← 70% 사용자
   - [로그인] ← 30% 사용자
   ↓
3a. 시작하기 → 자동 게스트 생성 → Todo 화면
3b. 로그인 → 로그인 화면 → Todo 화면 (기존 데이터)
```

### 구현 코드

```javascript
// App.js
function AppNavigator() {
  const { token, user } = useAuthStore();
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  
  useEffect(() => {
    const checkFirstLaunch = async () => {
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      
      if (!hasLaunched && !token) {
        // 최초 실행 → Welcome 화면
        setIsFirstLaunch(true);
      } else if (token) {
        // 토큰 있음 → 메인 화면
        setIsFirstLaunch(false);
      } else {
        // 이전에 실행했지만 토큰 없음 → 로그인 화면
        setIsFirstLaunch(false);
      }
    };
    
    checkFirstLaunch();
  }, [token]);
  
  if (isFirstLaunch === null) {
    return <LoadingScreen />;
  }
  
  if (isFirstLaunch) {
    return <WelcomeScreen />;
  }
  
  if (!token) {
    return <LoginScreen />;
  }
  
  return <MainApp />;
}

// WelcomeScreen.js
function WelcomeScreen() {
  const navigation = useNavigation();
  const { loginAsGuest } = useAuthStore();
  
  const handleStart = async () => {
    await AsyncStorage.setItem('hasLaunched', 'true');
    await loginAsGuest();
    navigation.replace('Home');
  };
  
  const handleLogin = () => {
    AsyncStorage.setItem('hasLaunched', 'true');
    navigation.replace('Login');
  };
  
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-8">
        {/* 일러스트 or 로고 */}
        <View className="items-center mb-12">
          <Text className="text-5xl mb-4">📝</Text>
          <Text className="text-3xl font-bold text-gray-800 mb-2">
            Welcome to Todo
          </Text>
          <Text className="text-gray-500 text-center">
            하루를 체계적으로 관리하세요
          </Text>
        </View>
        
        {/* 메인 CTA */}
        <TouchableOpacity
          className="bg-blue-500 py-4 rounded-xl mb-4 shadow-sm"
          onPress={handleStart}
        >
          <Text className="text-white text-center font-bold text-lg">
            시작하기
          </Text>
        </TouchableOpacity>
        
        {/* 세컨더리 액션 */}
        <View className="flex-row justify-center items-center mt-4">
          <Text className="text-gray-600 mr-2">이미 계정이 있으신가요?</Text>
          <TouchableOpacity onPress={handleLogin}>
            <Text className="text-blue-500 font-semibold">로그인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

---

## 왜 하이브리드가 최선인가?

| 측면 | Option 1 (자동) | Option 2 (로그인) | 하이브리드 (추천) |
|------|----------------|------------------|------------------|
| **신규 사용자 마찰** | 0번 클릭 | 1번 클릭 | 1번 클릭 |
| **기존 사용자 경험** | 혼란 😱 | 명확 ✅ | 명확 ✅ |
| **데이터 병합** | 필수 (지옥) | 불필요 | 불필요 |
| **코드 복잡도** | 매우 높음 | 낮음 | 낮음 |
| **UX 명확성** | 낮음 | 높음 | 높음 |

**결론: 하이브리드가 압승**

---

## 구현 우선순위

### Phase 1 (MVP)
```javascript
✅ Welcome 화면 (시작하기 + 로그인)
✅ 자동 게스트 생성
✅ 로그인 화면
```

### Phase 2 (개선)
```javascript
✅ Welcome 화면에 앱 기능 소개 슬라이드 (선택)
✅ "시작하기" 후 간단한 튜토리얼 (선택)
```

### ❌ 절대 하지 마세요
```javascript
❌ 데이터 병합 로직
❌ "게스트 데이터를 기존 계정으로 이동하시겠습니까?"
❌ 복잡한 충돌 해결 알고리즘
```

---

## 최종 답변

**하이브리드 방식 (Welcome 화면)을 강력히 추천합니다.**

**이유:**
1. ✅ 신규 사용자: 1번 클릭으로 바로 시작 (충분히 빠름)
2. ✅ 기존 사용자: 명확하게 "로그인" 선택 (혼란 없음)
3. ✅ 개발자: 데이터 병합 지옥 회피
4. ✅ 유지보수: 코드 단순

**Option 1 (자동 게스트)은 절대 비추천:**
- 데이터 병합 로직 = 버그 공장
- 기존 사용자 혼란
- 개발 공수 3배

클릭 1번 차이가 앱 개발 난이도를 10배 바꿉니다. **하이브리드로 가세요.**