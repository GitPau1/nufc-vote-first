import http from 'k6/http';
import { check, sleep } from 'k6';

// 계획서 5장 병목 후보 확인용 — 투표 목록/상세 + 예측 랭킹 조회 경로.
//
// MODE=latency    (기본) 1차(8/21) 베이스라인과 동일 조건. 이 값만 1차와 나란히 놓을 수 있다.
// MODE=saturation 포화점 측정. sleep 없이 도착률을 올려 서버가 무너지는 지점을 찾는다.
// MODE=ab         로컬 개선 전/후 비교용 (20260824_k6_개선전후_비교실험_설계.md 4장).
//                 k6와 Next.js가 같은 머신이라 부하를 올리면 개선 효과가 아니라
//                 노트북 CPU 경합을 재게 된다 → 동시성을 낮게 고정한다.
//
// SUITE=polls|predict|all  측정할 엔드포인트 묶음. 끈 엔드포인트는 임계값도 걸리지 않는다
//                          — 데이터가 0건인 임계값도 k6는 ✓로 출력해서 오독을 유발한다.
//
// 지표는 endpoint 태그로 분리한다 — /polls는 unstable_cache(30s)가 걸려 있고
// /polls/{id}는 캐시가 없어서, 합쳐서 보면 캐시된 목록이 병목 경로를 희석한다.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const POLL_ID = __ENV.POLL_ID || '00000000-0000-0000-0000-000000000001';
// 평점(overall_rating) 투표 상세. 선택형과 상세 경로가 갈리므로 태그를 나눈다 —
// 평점은 제출 1회가 선수 수만큼 rating_votes 행을 만들어 행 수 증가율이 다르다.
const RATING_POLL_ID = __ENV.RATING_POLL_ID || '';
const WEEK_KEY = __ENV.WEEK_KEY || '2026-33';
const MODE = __ENV.MODE || 'latency';
const SUITE = __ENV.SUITE || 'all';

const POLL_ENDPOINTS = ['list', 'detail'].concat(RATING_POLL_ID ? ['detail-rating'] : []);
const PREDICT_ENDPOINTS = ['predict-list', 'predict-week'];
const endpoints = SUITE === 'polls' ? POLL_ENDPOINTS
  : SUITE === 'predict' ? PREDICT_ENDPOINTS
  : POLL_ENDPOINTS.concat(PREDICT_ENDPOINTS);

// 콜드스타트와 캐시 채우기를 여기서 흡수한다. phase:warmup 태그로 집계에서 분리.
const warmup = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  tags: { phase: 'warmup' },
  exec: 'browse',
};

const latency = {
  warmup,
  measure: {
    executor: 'ramping-vus',
    startTime: '30s',
    startVUs: 10,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ],
    tags: { phase: 'measure' },
    exec: 'browse',
  },
};

const ab = {
  warmup,
  // ramping-vus(VU 수 통제)가 아니라 constant-arrival-rate(도착률 통제)를 쓰는 이유:
  // 서버가 느려져도 도착률이 유지되어 before/after 두 조건에 같은 부하가 들어간다.
  // dropped_iterations > 0이면 머신이 부하를 못 따라간 것 → 그 라운드는 폐기하고 RATE를 낮춘다.
  measure: {
    executor: 'constant-arrival-rate',
    startTime: '30s',
    rate: Number(__ENV.RATE || 5),
    // TIME_UNIT으로 소수 도착률을 표현한다 (예: RATE=1 TIME_UNIT=3s → 0.33 iter/s).
    timeUnit: __ENV.TIME_UNIT || '1s',
    duration: __ENV.DURATION || '3m',
    preAllocatedVUs: 20,
    maxVUs: 50,
    tags: { phase: 'measure' },
    exec: 'browseNoSleep',
  },
};

const saturation = {
  // sleep 없이 초당 요청 수를 직접 올린다. VU 수가 아니라 도착률이 통제 변수여야
  // "서버가 초당 몇 개를 처리하는가"를 잴 수 있다.
  saturate: {
    executor: 'ramping-arrival-rate',
    startRate: 20,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 500,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '30s', target: 200 },
      { duration: '30s', target: 400 },
    ],
    tags: { phase: 'saturate' },
    exec: 'browseNoSleep',
  },
};

const scenarios = MODE === 'saturation' ? saturation : MODE === 'ab' ? ab : latency;

// 임계값을 태그별로 걸면 k6가 해당 구간의 실측값을 따로 출력해준다.
// 워밍업(phase:warmup)은 어떤 임계값에도 걸리지 않으므로 자동으로 제외된다.
// 모드별·SUITE별로 나눠 거는 이유: 데이터가 0건인 임계값도 k6는 ✓로 출력해서 오독을 유발한다.
const thresholds = {};
if (MODE === 'saturation') {
  for (const e of endpoints) {
    thresholds[`http_req_duration{phase:saturate,endpoint:${e}}`] = ['p(95)<5000'];
  }
  thresholds['http_req_failed{phase:saturate}'] = ['rate<0.05'];
} else {
  for (const e of endpoints) {
    thresholds[`http_req_duration{phase:measure,endpoint:${e}}`] = ['p(95)<2000', 'avg<2000'];
  }
  thresholds['http_req_failed{phase:measure}'] = ['rate<0.01'];
}

export const options = { scenarios, thresholds };

function get(path, endpoint) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { endpoint } });
  check(res, { [`${endpoint} status 200`]: (r) => r.status === 200 });
}

function hit() {
  if (SUITE !== 'predict') {
    get('/polls', 'list');
    get(`/polls/${POLL_ID}`, 'detail');
    if (RATING_POLL_ID) get(`/polls/${RATING_POLL_ID}`, 'detail-rating');
  }
  if (SUITE !== 'polls') {
    get('/predictions', 'predict-list');
    get(`/predictions/${WEEK_KEY}`, 'predict-week');
  }
}

export function browse() {
  hit();
  sleep(1);
}

export function browseNoSleep() {
  hit();
}
