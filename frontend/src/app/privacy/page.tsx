import { AppHeader } from '@/components/composition/common/AppHeader'

export default function PrivacyPage() {
  return (
    <>
      <AppHeader mobileBack />
      <main className="mx-auto min-h-[calc(100vh-56px)] max-w-detail bg-page px-4 pt-6 pb-24">
        <h1 className="text-heading-2 sm:text-heading-1 font-semibold text-neutral mb-1">개인정보처리방침</h1>
        <p className="text-caption-1 text-neutral-muted mb-6">시행일자: 2026년 9월 3일</p>

        <div className="flex flex-col gap-6 text-label-1-reading text-neutral-muted">
          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">1. 운영자</h2>
            <p>본 서비스(NUFCVOTE)는 사업자 등록이 없는 비상업적 개인 프로젝트로 운영됩니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">2. 수집하는 개인정보 항목</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Google 로그인 시: 이메일 주소, 프로필 사진, 이름</li>
              <li>서비스 이용 중 직접 입력: 댓글 내용, 투표 선택 내역, 승부예측 참여 내역</li>
              <li>서비스 이용 중 자동 수집: IP 주소, 접속 로그, 쿠키, 브라우저·기기 정보</li>
            </ul>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">3. 개인정보의 수집 및 이용 목적</h2>
            <p>회원 식별 및 로그인 유지, 투표·승부예측 참여 기록 제공, 댓글 작성자 표시, 서비스 이용 통계 분석 및 서비스 개선</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">4. 개인정보의 제3자 제공</h2>
            <p>
              서비스 이용 분석을 위해 Mixpanel(해외 서비스)에 이용자의 서비스 내 행동 데이터(접속 페이지, 클릭 등)와 식별자를 전송합니다.{' '}
              <strong className="font-semibold text-neutral">당사는 수집된 이용 데이터를 서비스 개선 목적으로만 사용하며, 광고 등 다른 목적으로 이용하지 않습니다.</strong>{' '}
              이메일 등 식별 가능한 개인정보 원문은 전송하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">5. 개인정보 처리의 위탁</h2>
            <p>서비스 운영을 위해 데이터 저장 및 인증 인프라를 Supabase에 위탁하고 있습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">6. 개인정보의 보유 및 파기</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>회원 탈퇴 시 즉시 로그아웃되며, 24시간 이내 재로그인하면 탈퇴가 자동으로 취소됩니다.</li>
              <li>24시간이 지나면 이메일·이름·프로필 사진은 식별할 수 없는 값으로 자동 대체되고, 계정은 삭제됩니다.</li>
              <li>이미 작성한 투표·댓글 기록은 다른 이용자가 볼 수 있는 화면 구성을 위해 유지되며, 작성자 표시는 &quot;탈퇴한 사용자&quot;로 대체됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">7. 정보주체의 권리와 행사 방법</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>닉네임(표시 이름)은 마이페이지에서 직접 수정할 수 있습니다.</li>
              <li>
                작성한 댓글은 직접 삭제할 수 있으며,{' '}
                <strong className="font-semibold text-neutral">삭제된 댓글은 다른 이용자에게 더 이상 노출되지 않습니다.</strong>
              </li>
              <li>회원 탈퇴(계정 및 개인정보 삭제)는 마이페이지에서 언제든지 요청할 수 있습니다.</li>
              <li>그 외 개인정보 열람·정정 요청은 아래 문의처를 통해 할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">8. 쿠키의 사용</h2>
            <p>로그인 상태 유지를 위한 쿠키, 서비스 이용 분석을 위한 브라우저 저장소를 사용합니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 유지 등 일부 기능이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">9. 만 14세 미만 이용 제한</h2>
            <p>본 서비스는 만 14세 이상만 이용할 수 있으며, 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">10. 개인정보의 안전성 확보조치</h2>
            <p>서비스는 Supabase가 제공하는 보안 인프라(전송 구간 암호화 등)를 통해 개인정보를 관리합니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">11. 개인정보처리방침의 변경</h2>
            <p>이 방침은 필요 시 개정될 수 있으며, 변경 시 서비스 내 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">12. 개인정보 보호책임자 및 문의처</h2>
            <p>서비스 운영자 / [문의 이메일 — 배포 전 직접 입력 예정]</p>
          </section>
        </div>
      </main>
    </>
  )
}
