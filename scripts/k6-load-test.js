import http from 'k6/http';
import { check, sleep } from 'k6';

// 계획서 5장 병목 후보 확인용 — 투표 목록/상세 조회 경로.
//
// MODE=latency    (기본) p95 측정. 워밍업을 별도 scenario로 분리해 집계에서 제외한다.
// MODE=saturation 포화점 측정. sleep 없이 도착률을 올려 서버가 무너지는 지점을 찾는다.
//
// 지표는 endpoint 태그로 분리한다 — /polls는 unstable_cache(30s)가 걸려 있고
// /polls/{id}는 캐시가 없어서, 합쳐서 보면 캐시된 목록이 병목 경로를 희석한다.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const POLL_ID = __ENV.POLL_ID || '00000000-0000-0000-0000-000000000001';
const MODE = __ENV.MODE || 'latency';

const latency = {
  // 콜드스타트와 캐시 채우기를 여기서 흡수한다. phase:warmup 태그로 집계에서 분리.
  warmup: {
    executor: 'constant-vus',
    vus: 5,
    duration: '30s',
    tags: { phase: 'warmup' },
    exec: 'browse',
  },
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

// 임계값을 태그별로 걸면 k6가 해당 구간의 실측값을 따로 출력해준다.
// 워밍업(phase:warmup)은 어떤 임계값에도 걸리지 않으므로 자동으로 제외된다.
// 모드별로 나눠 거는 이유: 데이터가 0건인 임계값도 k6는 ✓로 출력해서 오독을 유발한다.
const thresholds = MODE === 'saturation'
  ? {
      'http_req_duration{phase:saturate,endpoint:detail}': ['p(95)<5000'],
      'http_req_failed{phase:saturate}': ['rate<0.05'],
    }
  : {
      'http_req_duration{phase:measure,endpoint:list}': ['p(95)<2000', 'avg<2000'],
      'http_req_duration{phase:measure,endpoint:detail}': ['p(95)<2000', 'avg<2000'],
      'http_req_failed{phase:measure}': ['rate<0.01'],
    };

export const options = {
  scenarios: MODE === 'saturation' ? saturation : latency,
  thresholds,
};

function hit() {
  const list = http.get(`${BASE_URL}/polls`, { tags: { endpoint: 'list' } });
  check(list, { 'list status 200': (r) => r.status === 200 });

  const detail = http.get(`${BASE_URL}/polls/${POLL_ID}`, { tags: { endpoint: 'detail' } });
  check(detail, { 'detail status 200': (r) => r.status === 200 });
}

export function browse() {
  hit();
  sleep(1);
}

export function browseNoSleep() {
  hit();
}
