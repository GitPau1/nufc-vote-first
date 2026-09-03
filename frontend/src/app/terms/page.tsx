import { AppHeader } from '@/components/composition/common/AppHeader'
import { Card, CardContent } from '@/components/primitives/card'

export default function TermsPage() {
  return (
    <>
      <AppHeader mobileBack />
      <main className="mx-auto min-h-[calc(100vh-56px)] max-w-detail bg-page px-4 pt-6 pb-24">
        <h1 className="text-heading-2 sm:text-heading-1 font-semibold text-neutral mb-1">이용약관</h1>
        <p className="text-caption-1 text-neutral-muted mb-6">시행일자: 2026년 9월 3일</p>

        <Card>
        <CardContent className="flex flex-col gap-6 text-label-1-reading text-neutral-muted p-4">
          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">1. 목적</h2>
            <p>이 약관은 NUFCVOTE(이하 &quot;서비스&quot;)의 이용 조건을 정합니다. 서비스는 사업자가 아닌 개인이 비상업적으로 운영하는 뉴캐슬 유나이티드 팬 투표 플랫폼입니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">2. 이용계약의 성립</h2>
            <p>Google 계정으로 로그인 시 본 약관 및 개인정보처리방침에 동의한 것으로 봅니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">3. 이용 자격</h2>
            <p>본 서비스는 만 14세 이상만 이용할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">4. 이용자의 의무</h2>
            <p>이용자는 타인의 권리를 침해하거나 명예를 훼손하는 게시물을 작성하지 않아야 하며, 서비스를 부정한 방법으로 이용하지 않아야 합니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">5. 게시물의 저작권</h2>
            <p>이용자가 작성한 게시물(댓글 등)의 저작권은 작성자 본인에게 있습니다. 서비스는 해당 게시물을 서비스 운영 목적 범위 내에서 사용할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">6. 서비스의 운영, 변경 및 중단</h2>
            <p>운영자는 서비스 내용을 변경하거나 서비스 제공을 일시적·영구적으로 중단할 수 있으며, 이 경우 사전에 공지하기 위해 노력합니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">7. 서비스 이용 제한</h2>
            <p>이용자가 이 약관을 위반한 경우, 운영자는 필요한 범위 내에서 서비스 이용을 제한할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">8. 면책</h2>
            <p>서비스는 무상으로 제공되며, 운영자는 서비스 이용과 관련하여 발생하는 손해에 대해 법이 허용하는 한도 내에서 책임을 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">9. 계정 관리</h2>
            <p>회원 탈퇴 절차는 개인정보처리방침에 따릅니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">10. 약관의 변경</h2>
            <p>이 약관은 필요 시 개정될 수 있으며, 변경 시 서비스 내 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-headline-2 font-semibold text-neutral mb-1">11. 준거법</h2>
            <p>이 약관은 대한민국 법령에 따라 해석됩니다.</p>
          </section>
        </CardContent>
        </Card>
      </main>
    </>
  )
}
