# Stage 아이디에이션

## 0. 기술 규칙

S = Spawn point
x = 일반 Platform, 발판 역할
K = Key 를 품고 있는 platform
s = 무지개 스위치.
r = 무지개 platform, s 를 밟기 전에는 비활성화 된 상태.
O = 장애물
P = Portal
# = 주석 라인

연결되어 움직일 수 있는 Platform 은 `xx` 처럼 표기, 두개 platform 사이에 공간이 있어 점프해서 이동해야 할 때는 `x x` 처럼 표기.

## 1. 튜토리얼

이미 작성되어 있는 대로 진행.

## 2. 어려운 toggle

TBD

## 3. obstacle 이 경로를 계속 방해

### 3.1

1x1 타일이 여러 row, column 으로 배치된다. row 또는 column 을 patrol 하는 장애물이 플레이어를 방해.

```
# 첫번째, 두번째 row 의 플랫폼을 Obstacle 이 모두 커버하며 patrol
        S

O-> x x x x K

    K x x x x <-O

        P
```

### 3.2

한개 row 끝에 Key 가 존재하는 스테이지.

```
# 첫번째, 두번째 row 의 플랫폼을 Obstacle 이 모두 커버하며 patrol
# 장애물의 속도는 오른쪽 끝의 key 를 획득하고 portal 로 돌아갈 때 까지 여유를 충분히 줘야 한다
      K S     P

O-> x x x x x x x K

          x
```

### 3.3

낮과 밤을 오가며 장애물을 피해 움직여야 하는 스테이지. 낮에는 장애물이 플랫폼을 밟는 것을 방해. 밤으로 토글해 장애물을 피하고 한칸씩 전진하는 것을 의도.

가장 어려운 스테이지.

```
# 낮과 밤 둘 다 매우 빠르게 장애물이 움직임
# 낮
S P
x x x x x x K <- o

# 밤
# 아래쪽 row 에는 두칸 씩 떨어져 있음.
S P
              <- o
x   x   x   x
```

### 3.4

밤에 있는 발판을 밟아서 무지개 다리를 활성화해야 포탈까지 도달할 수 있는 레벨.

조금 더 앞쪽 스테이지로 배치.

```
# 낮
P xRRx S

       x   x   x # 2칸씩 유격

# 밤
# 장애물은 밤 only
       S

       x x r x K <- o
```
